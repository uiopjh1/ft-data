// يُشغَّل على خوادم GitHub كل 30 دقيقة ويكتب stats.json الذي يقرؤه التطبيق (طلب واحد بدل المئات)
import { writeFileSync, readFileSync } from 'node:fs';

// المعرّف الثابت الوحيد: دوري روشن في ESPN (نظير 955 في Sofascore). بقية البطولات تُكتشف تلقائيًا من جدول كل نادٍ.
const LEAGUE = 'ksa.1';
// أسماء عربية للبطولات المعروفة (غير المعروفة تظهر باسمها الإنجليزي من ESPN)
const LABELS = {
  'ksa.1': 'دوري روشن', 'ksa.kings.cup': 'كأس الملك', 'ksa.super_cup': 'كأس السوبر',
  'afc.champions': 'دوري أبطال آسيا', 'afc.champions.two': 'دوري أبطال آسيا 2', 'afc.cup': 'دوري أبطال آسيا 2',
  'afc.champions_qual': 'تصفيات دوري أبطال آسيا', 'fifa.intercontinental_cup': 'كأس إنتركونتيننتال',
};
const now = new Date();
const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
const B = 'https://site.api.espn.com/apis';

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
      if (r.status === 404 || r.status === 400) throw new Error('HTTP ' + r.status);
    } catch (e) {
      if (i === tries - 1) throw e;
    }
    await new Promise((s) => setTimeout(s, 800 * (i + 1)));
  }
  throw new Error('failed ' + url);
}
async function pool(jobs, size) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < jobs.length) {
        const k = i++;
        out[k] = await jobs[k]().then((v) => ({ ok: true, v }), (e) => ({ ok: false, e }));
      }
    })
  );
  return out;
}
// الفائز: علامة ESPN أولاً، وإلا بالنتيجة، وإلا بركلات الترجيح
const wonBy = (me, op) => {
  if (me.winner === true) return true;
  if (op.winner === true) return false;
  const a = scoreOf(me);
  const b = scoreOf(op);
  if (a > b) return true;
  if (a < b) return false;
  const sa = Number(me.shootoutScore);
  const sb = Number(op.shootoutScore);
  return !Number.isNaN(sa) && !Number.isNaN(sb) && sa > sb;
};
const scoreOf = (c) => {
  const sc = c && c.score;
  if (sc && typeof sc === 'object') return Number(sc.value !== undefined ? sc.value : sc.displayValue);
  if (sc === undefined || sc === null || sc === '') return NaN;
  return Number(sc);
};
const stat = (e, n) => {
  const q = (e.stats || []).find((z) => z.name === n);
  return q ? Number(q.value) : NaN;
};
const isDone = (st) => st.state === 'post' || st.completed;
const statusOf = (ev) => {
  const c = ev.competitions && ev.competitions[0];
  return (c && c.status && c.status.type) || (ev.status && ev.status.type) || {};
};

// 1) أندية الدوري الحالية
const st = await getJson(`${B}/v2/sports/soccer/ksa.1/standings`);
const entries = ((st.children && st.children[0] ? st.children[0] : st).standings || {}).entries || [];
const teams = {};
entries.forEach((e) => {
  const t = e.team || {};
  if (t.id) teams[String(t.id)] = { id: String(t.id), name: t.displayName || t.name || '-', logo: t.logos && t.logos[0] ? t.logos[0].href : t.logo };
});
const ids = Object.keys(teams);
if (!ids.length) throw new Error('no teams');
let leagueChamp = null;
const top = entries.find((e) => stat(e, 'rank') === 1);
if (top && top.team && stat(top, 'gamesPlayed') >= (ids.length - 1) * 2) leagueChamp = String(top.team.id);

// 2) جداول كل نادٍ في كل بطولة
const slugOf = (ev) => {
  if (ev.league && ev.league.slug) return ev.league.slug;
  const re = /soccer\/([a-z0-9._]+)\//g;
  const s = JSON.stringify(ev.links || []) + JSON.stringify(ev.competitions && ev.competitions[0] ? ev.competitions[0].competitors || [] : []);
  let m;
  while ((m = re.exec(s))) if (m[1] !== 'all') return m[1];
  return '';
};
const compOf = (ev) => {
  const slug = slugOf(ev);
  const name = (ev.league && ev.league.name) || '';
  if (!slug || /friend/i.test(slug + ' ' + name)) return null;
  return { slug, key: slug === LEAGUE ? 'league' : slug, label: LABELS[slug] || name || slug };
};
// يكتشف بطولات كل نادٍ تلقائيًا من جدوله الشامل (all)، ثم يجلب جدول كل بطولة كاملًا
async function season(year, full) {
  const alls = await pool(ids.map((id) => () => getJson(`${B}/site/v2/sports/soccer/all/teams/${id}/schedule?season=${year}`).then((j) => ({ id, events: j.events || [] }))), 6);
  const out = [];
  const jobs = [];
  alls.filter((x) => x.ok).forEach((x) => {
    const by = {};
    x.v.events.forEach((ev) => {
      const c = compOf(ev);
      if (!c) return;
      (by[c.slug] = by[c.slug] || { id: x.v.id, c, events: [] }).events.push(ev);
    });
    by[LEAGUE] = by[LEAGUE] || { id: x.v.id, c: { slug: LEAGUE, key: 'league', label: LABELS[LEAGUE] }, events: [] };
    Object.values(by).forEach((g) => {
      if (full || g.c.slug === LEAGUE) {
        jobs.push(() => getJson(`${B}/site/v2/sports/soccer/${g.c.slug}/teams/${g.id}/schedule?season=${year}`).then((j) => { g.events = j.events || g.events; }).catch(() => {}));
      }
      out.push(g);
    });
  });
  await pool(jobs, 6);
  return out;
}

// 3) الموسم الحالي
const cur = await season(y, true);
if (!cur.some((x) => x.events.length)) throw new Error('no schedule data');
const start = new Date(y, 6, 1).getTime();
const games = [];
const finals = {};
cur.forEach((x) =>
  x.events.forEach((ev) => {
    const comp = ev.competitions && ev.competitions[0];
    if (!comp || !comp.competitors) return;
    const s = statusOf(ev);
    const rn = (ev.seasonType && ev.seasonType.name) || '';
    const when = new Date(ev.date).getTime();
    if (/^final$/i.test(rn) && !isDone(s) && when > Date.now() - 6 * 3600 * 1000) finals[ev.id] = { label: x.c.label, when, name: ev.name || '' };
    if (!isDone(s)) return;
    const me = comp.competitors.find((c) => String((c.team && c.team.id) || c.id) === x.id);
    const op = comp.competitors.find((c) => c !== me);
    if (!me || !op) return;
    const gf = scoreOf(me);
    const ga = scoreOf(op);
    if (Number.isNaN(gf) || Number.isNaN(ga) || when < start) return;
    games.push({ id: x.id, mid: ev.id, key: x.c.key, when, gf, ga, opp: (op.team && op.team.displayName) || '', label: x.c.label, round: rn, won: wonBy(me, op) });
  })
);

// 4) الموسم الماضي: أبطال آخر بطولات
const prevSeason = await season(y - 1, false);
const prev = [];
const lastLeague = {};
const pts = {};
const played = {};
prevSeason.forEach((x) =>
  x.events.forEach((ev) => {
    const comp = ev.competitions && ev.competitions[0];
    if (!comp || !isDone(statusOf(ev))) return;
    const me = (comp.competitors || []).find((c) => String((c.team && c.team.id) || c.id) === x.id);
    const op = (comp.competitors || []).find((c) => c !== me);
    if (!me || !op) return;
    const when = new Date(ev.date).getTime();
    if (x.c.key === 'league') {
      lastLeague[x.id] = Math.max(lastLeague[x.id] || 0, when);
      const a = scoreOf(me);
      const b = scoreOf(op);
      if (!Number.isNaN(a) && !Number.isNaN(b)) {
        played[x.id] = (played[x.id] || 0) + 1;
        pts[x.id] = (pts[x.id] || 0) + (a > b ? 3 : a === b ? 1 : 0);
      }
      return;
    }
    if (/^final$/i.test((ev.seasonType && ev.seasonType.name) || '') && wonBy(me, op)) {
      prev.push({ id: x.id, label: x.c.label, when, opp: (op.team && op.team.displayName) || '', score: `${scoreOf(me)}-${scoreOf(op)}` });
    }
  })
);
const ranked = Object.keys(pts).filter((id) => played[id] >= 34).sort((a, b) => pts[b] - pts[a]);
if (ranked.length && (ranked.length === 1 || pts[ranked[0]] > pts[ranked[1]]) && lastLeague[ranked[0]]) {
  prev.push({ id: ranked[0], label: 'دوري روشن', when: lastLeague[ranked[0]], pts: pts[ranked[0]] });
}

// آخر بطولة بين كل أندية روشن (الموسم الحالي والماضي) + صورة تتويج من Wikimedia Commons إن وُجدت
const cand = prev.slice();
if (leagueChamp) cand.push({ id: leagueChamp, label: 'دوري روشن', when: Date.now() });
games.forEach((g) => {
  if (g.key !== 'league' && g.won && /^final$/i.test(g.round)) cand.push({ id: g.id, label: g.label, when: g.when, opp: g.opp, score: `${g.gf}-${g.ga}` });
});
cand.sort((a, b) => b.when - a.when);
const last = cand[0] || null;

const EN = { 'دوري روشن': 'Saudi Pro League', 'كأس الملك': "King's Cup", 'كأس السوبر': 'Saudi Super Cup', 'دوري أبطال آسيا': 'AFC Champions League', 'دوري أبطال آسيا 2': 'AFC Champions League Two' };
async function findPhoto(l) {
  try {
    const club = teams[l.id].name;
    const short = club.replace(/^Al[ -]?/i, '').toLowerCase();
    const yr = String(new Date(l.when).getFullYear());
    const queries = [`${club} ${EN[l.label] || ''} ${yr} trophy`, `${club} ${yr} champions trophy celebration`];
    for (const q of queries) {
      const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=15&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=900&gsrsearch=' + encodeURIComponent(q);
      const r = await fetch(url, { headers: { 'User-Agent': 'FT-football-app/1.0 (github.com/uiopjh1/ft-data)' } });
      if (!r.ok) continue;
      const j = await r.json();
      const pages = Object.values((j.query && j.query.pages) || {});
      const ok = pages
        .map((p) => ({ p, ii: (p.imageinfo || [])[0] }))
        .filter(({ p, ii }) => {
          if (!ii || !/jpeg|png/.test(ii.mime || '')) return false;
          const name = (p.title || '').toLowerCase();
          const desc = String((ii.extmetadata && ii.extmetadata.ImageDescription && ii.extmetadata.ImageDescription.value) || '').toLowerCase();
          const date = String((ii.extmetadata && ii.extmetadata.DateTimeOriginal && ii.extmetadata.DateTimeOriginal.value) || '');
          const all = name + ' ' + desc;
          const club1 = all.includes(short) || all.includes(club.toLowerCase());
          const trophy = /troph|champion|celebrat|lift|winner|cup/.test(all);
          const recent = all.includes(yr) || date.includes(yr);
          return club1 && trophy && recent;
        });
      if (ok.length) {
        const { ii } = ok[0];
        const m = ii.extmetadata || {};
        const strip = (s) => String((s && s.value) || '').replace(/<[^>]*>/g, '').trim();
        return { url: ii.thumburl || ii.url, credit: [strip(m.Artist), strip(m.LicenseShortName)].filter(Boolean).join(' · ') };
      }
    }
  } catch (e) {}
  return null;
}

// ---- صورة التتويج من صحيفة الرياضية (أثناء التطوير؛ يلزم إذن قبل النشر) ----
const AR_TAG = {
  'Al Hilal': 'الهلال', 'Al Ittihad': 'الاتحاد', 'Al Nassr': 'النصر', 'Al Qadsiah': 'القادسية', 'Neom SC': 'نيوم', 'Al Ahli': 'الأهلي',
  'Al Kholood': 'الخلود', 'Al Diriyah': 'الدرعية', 'Al Ettifaq': 'الاتفاق', 'Al Hazem': 'الحزم', 'Al Riyadh': 'الرياض', 'Al Fayha': 'الفيحاء',
  'Al Khaleej': 'الخليج', 'Al Shabab': 'الشباب', 'Al Fateh': 'الفتح', 'Al Faisaly': 'الفيصلي', 'Al Taawoun': 'التعاون', 'Abha': 'أبها',
};
// اسم النادي بالعربي من ESPN نفسه (للأندية الجديدة التي ليست في القائمة أعلاه)
const AR_ESPN = {};
try {
  const sa = await getJson(`${B}/v2/sports/soccer/ksa.1/standings?lang=ar&region=sa`);
  (((sa.children && sa.children[0] ? sa.children[0] : sa).standings || {}).entries || []).forEach((e) => {
    if (e.team && e.team.id) AR_ESPN[String(e.team.id)] = String(e.team.displayName || e.team.name || '').replace(/^نادي\s+/, '').trim();
  });
} catch (e) {}
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; FT-app-dev/1.0)', 'Accept-Language': 'ar' };
const debug = [];
async function getHtml(url) {
  const r = await fetch(url, { headers: UA });
  if (!/\/tag\//.test(url) || !r.ok) debug.push(`${r.status} ${decodeURIComponent(url).slice(0, 90)}`);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return await r.text();
}
const clean = (s) => s.replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
function bilinear(img, nw) {
  const nh = Math.max(1, Math.round((img.h * nw) / img.w));
  const d = new Float32Array(nw * nh);
  for (let y = 0; y < nh; y++) {
    const sy = ((y + 0.5) * img.h) / nh - 0.5;
    const y0 = Math.max(0, Math.min(img.h - 1, Math.floor(sy)));
    const y1 = Math.min(img.h - 1, y0 + 1);
    const fy = Math.max(0, sy - y0);
    for (let x = 0; x < nw; x++) {
      const sx = ((x + 0.5) * img.w) / nw - 0.5;
      const x0 = Math.max(0, Math.min(img.w - 1, Math.floor(sx)));
      const x1 = Math.min(img.w - 1, x0 + 1);
      const fx = Math.max(0, sx - x0);
      const a = img.d[y0 * img.w + x0] * (1 - fx) + img.d[y0 * img.w + x1] * fx;
      const b = img.d[y1 * img.w + x0] * (1 - fx) + img.d[y1 * img.w + x1] * fx;
      d[y * nw + x] = a * (1 - fy) + b * fy;
    }
  }
  return { w: nw, h: nh, d };
}
function stats(d) {
  let m = 0;
  for (let i = 0; i < d.length; i++) m += d[i];
  m /= d.length;
  let v = 0;
  for (let i = 0; i < d.length; i++) v += (d[i] - m) * (d[i] - m);
  return { m, s: Math.sqrt(v) };
}
// أعلى ارتباط (NCC) للقالب T داخل A
function bestMatch(A, T) {
  if (T.w > A.w || T.h > A.h) return -1;
  const tz = new Float32Array(T.d.length);
  const ts = stats(T.d);
  if (ts.s < 1e-3 || ts.s / Math.sqrt(T.d.length) < 6) return -1; // قالب مسطّح بلا تفاصيل
  for (let i = 0; i < T.d.length; i++) tz[i] = T.d[i] - ts.m;
  let best = -1;
  const win = new Float32Array(T.d.length);
  for (let y = 0; y <= A.h - T.h; y += 2) {
    for (let x = 0; x <= A.w - T.w; x += 2) {
      let k = 0;
      let m = 0;
      for (let j = 0; j < T.h; j++) for (let i = 0; i < T.w; i++) { const v = A.d[(y + j) * A.w + x + i]; win[k++] = v; m += v; }
      m /= win.length;
      let num = 0;
      let den = 0;
      for (let q = 0; q < win.length; q++) { const z = win[q] - m; num += z * tz[q]; den += z * z; }
      const c = num / (Math.sqrt(den) * ts.s + 1e-9);
      if (c > best) best = c;
    }
  }
  return best;
}
// هل B جزء (مقصوص/مقرّب) من A؟
function cropOf(A, B) {
  let best = -1;
  for (let f = 0.3; f <= 1.001; f += 0.1) {
    const T = bilinear(B, Math.max(8, Math.round(A.w * f)));
    const c = bestMatch(A, T);
    if (c > best) best = c;
  }
  return best;
}
const SAME = 0.65;

// يحذف الصور المكررة/المقصوصة من نفس الصورة. أي خطأ = نبقي كل الصور.
async function dedupePhotos(urls) {
  try {
    let sharp;
    try { sharp = (await import('sharp')).default; } catch (e) {
      const { execSync } = await import('node:child_process');
      const { createRequire } = await import('node:module');
      execSync('npm install sharp --no-save --prefix /tmp/sh', { stdio: 'ignore', timeout: 180000 });
      sharp = createRequire('/tmp/sh/')('sharp');
    }
    const imgs = [];
    for (const u of urls) {
      try {
        const r = await fetch(u, { headers: { ...UA, Referer: 'https://arriyadiyah.com/' } });
        if (!r.ok) { imgs.push(null); continue; }
        const buf = Buffer.from(await r.arrayBuffer());
        const o = await sharp(buf).greyscale().resize({ width: 96 }).raw().toBuffer({ resolveWithObject: true });
        imgs.push({ w: o.info.width, h: o.info.height, d: Float32Array.from(o.data) });
      } catch (e) { imgs.push(null); }
    }
    debug.push(`dedupe loaded ${imgs.filter(Boolean).length}/${urls.length} ` + imgs.map((m) => (m ? m.w + 'x' + m.h : 'x')).join(' '));
    const drop = new Set();
    for (let i = 0; i < urls.length; i++) {
      if (!imgs[i] || drop.has(i)) continue;
      for (let j = i + 1; j < urls.length; j++) {
        if (!imgs[j] || drop.has(j)) continue;
        // ندخل B داخل A (والعكس): الأكبر مساحة (الكاملة) هي التي نبقيها
        const aInB = cropOf(imgs[i], imgs[j]); // j جزء من i
        const bInA = cropOf(imgs[j], imgs[i]); // i جزء من j
        if (Math.max(aInB, bInA) > 0.6) debug.push(`dedupe pair ${i + 1}-${j + 1}: ${aInB.toFixed(2)} / ${bInA.toFixed(2)}`);
        if (aInB >= SAME && aInB >= bInA) { drop.add(j); debug.push(`dedupe: drop ${j + 1} (crop of ${i + 1}) ${aInB.toFixed(2)}`); }
        else if (bInA >= SAME) { drop.add(i); debug.push(`dedupe: drop ${i + 1} (crop of ${j + 1}) ${bInA.toFixed(2)}`); break; }
      }
    }
    debug.push(`dedupe removed ${drop.size} of ${urls.length}`);
    return urls.filter((_, i) => !drop.has(i));
  } catch (e) {
    debug.push('dedupe failed: ' + String(e.message || e).slice(0, 80));
    return urls;
  }
}
async function riyadiyahPhoto(l) {
  const tag = AR_TAG[teams[l.id].name] || (/[\u0600-\u06FF]/.test(AR_ESPN[l.id] || '') ? AR_ESPN[l.id] : '');
  if (!tag) return null;
  const abs = (u) => (u.startsWith('//') ? 'https:' + u : u.startsWith('/') ? 'https://arriyadiyah.com' + u : u);
  const seen = {};
  const cands = [];
  let tried = 0;
  let stop = false;
  for (let page = 1; page <= 70 && tried < 30 && !stop; page++) {
    let html;
    try {
      html = await getHtml(`https://arriyadiyah.com/tag/${encodeURIComponent(tag)}${page > 1 ? '?page=' + page : ''}`);
    } catch (e) {
      break;
    }
    const re = /<a[^>]+href="(?:https?:\/\/arriyadiyah\.com)?\/(\d{5,7})\/([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html))) {
      const id = m[1];
      const slug = decodeURIComponent(m[2]).replace(/-/g, ' ');
      const title = clean(m[3]) || slug;
      if (seen[id]) continue;
      seen[id] = 1;
      if (!/تتويج|توج|توّج|لقب|رفع|الكأس|حفل/.test(title + ' ' + slug)) continue;
      if (tried >= 30) break;
      tried++;
      try {
        const art = await getHtml(`https://arriyadiyah.com/${id}/${m[2]}`);
        const d = art.match(/(\d{4})\.(\d{2})\.(\d{2})/);
        if (!d) continue;
        const ts = new Date(`${d[1]}-${d[2]}-${d[3]}T12:00:00Z`).getTime();
        if (ts < l.when - 3 * 24 * 3600e3) {
          stop = true;
          break;
        }
        if (ts > l.when + 6 * 24 * 3600e3) continue;
        const t2 = slug + ' ' + title;
        let score = 0;
        if (/^\s*(حفل\s+)?تتويج\s+\S+\s*$/.test(slug)) score += 10;
        if (/^\s*تتويج/.test(slug) || /تتويج\s+\S+\s*$/.test(slug)) score += 6;
        if (/حفل\s+التتويج|يتوج|يتوّج|رفع\s+الكأس|رفع\s+الدرع|كأس\s+الدوري/.test(t2)) score += 4;
        if (/تتويج/.test(t2)) score += 3;
        if (/السقوط|أزمة|صفقة|عقد|يخسر|يرحل|انسحب|ينسحب|مليون|مليار|دائرة|مشوار|أفكار|ترسم|تمهد|طريق|ليلة|يحتفل|احتفالات/.test(t2)) score -= 5;
        const og = art.match(/property="og:image"[^>]*content="([^"]+)"/) || art.match(/content="([^"]+)"[^>]*property="og:image"/);
        const all = [];
        const keys = {};
        const add = (u, alt) => {
          const h = u.match(/\/(\d+)_([0-9a-f]+)\.(jpe?g)/i);
          if (!h || keys[h[2]] || Number(h[1]) < 800) return;
          keys[h[2]] = 1;
          all.push({ url: abs(u).replace(/\/(\d+)_/, '/1200_').replace('//media', '/media'), alt: alt || '' });
        };
        if (og) add(og[1], 'og');
        for (const tg of art.match(/<img[^>]*>/gi) || []) {
          const src = tg.match(/(?:data-src|src)="([^"]*\/media\/thumb\/[^"]+)"/);
          if (!src) continue;
          const alt = (tg.match(/alt="([^"]*)"/) || [])[1] || '';
          const at = art.indexOf(tg);
          const cap = (art.slice(at, at + 900).match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/) || [])[1] || '';
          add(src[1], clean(alt + ' ' + cap));
        }
        debug.push(`cand ${id} score ${score} imgs ${all.length} ${slug.slice(0, 40)}`);
        if (all.length && score >= 3) cands.push({ score, id, slug: m[2], all, ts });
      } catch (e) {}
    }
  }
  if (!cands.length) return null;
  cands.sort((a, b) => b.score - a.score || b.all.length - a.all.length || a.ts - b.ts);
  const best = cands[0];
  const trophy = (x) => /كأس|الكأس|درع|يرفع|رفع|حمل|يحمل|تتويج|لقب|يحتفل|احتفال/.test(x.alt);
  const flagged = best.all.filter(trophy);
  const list = (flagged.length ? flagged : best.all).slice(0, 12);
  debug.push(`picked ${best.id} score ${best.score} imgs ${best.all.length} flagged ${flagged.length}`);
  const urls = await dedupePhotos(list.map((x) => x.url));
  return { v: 6, url: urls[0], credit: 'صحيفة الرياضية', source: `https://arriyadiyah.com/${best.id}`, all: urls };
}
let old = null;
try {
  old = JSON.parse(readFileSync('stats.json', 'utf8')).last;
} catch (e) {}
if (last) {
  if (old && old.id === last.id && old.label === last.label && old.photo && old.photo.v === 6 && Math.abs(old.when - last.when) < 36 * 3600e3) last.photo = old.photo;
  else last.photo = (await riyadiyahPhoto(last)) || (await findPhoto(last));
}

writeFileSync(
  'stats.json',
  JSON.stringify({ updated: Date.now(), year: y, teams, games, leagueChamp, last, debug, finals: Object.values(finals).sort((a, b) => a.when - b.when), prev })
);
console.log('teams', ids.length, 'games', games.length, 'prev titles', prev.length);

// يُشغَّل على خوادم GitHub كل 30 دقيقة ويكتب stats.json الذي يقرؤه التطبيق (طلب واحد بدل المئات)
import { writeFileSync, readFileSync } from 'node:fs';

const COMPS = [
  { slug: 'ksa.1', key: 'league', label: 'دوري روشن' },
  { slug: 'ksa.kings.cup', key: 'kings', label: 'كأس الملك' },
  { slug: 'ksa.super_cup', key: 'super', label: 'كأس السوبر' },
  { slug: 'afc.champions', key: 'asia', label: 'دوري أبطال آسيا' },
  { slug: 'afc.champions.two', key: 'asia', label: 'دوري أبطال آسيا 2' },
];
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
const lists = await Promise.all(
  COMPS.filter((c) => c.slug !== 'ksa.1').map((c) =>
    getJson(`${B}/site/v2/sports/soccer/${c.slug}/teams?limit=300`)
      .then((j) => (((((j.sports || [])[0] || {}).leagues || [])[0] || {}).teams || []).map((t) => String(t.team && t.team.id)))
      .catch(() => null)
  )
);
const extra = COMPS.filter((c) => c.slug !== 'ksa.1');
async function season(year, onlyParticipants) {
  const jobs = [];
  ids.forEach((id) =>
    COMPS.forEach((c) => {
      const k = extra.indexOf(c);
      if (onlyParticipants && k >= 0 && lists[k] && lists[k].length && lists[k].indexOf(id) < 0) return;
      jobs.push(() => getJson(`${B}/site/v2/sports/soccer/${c.slug}/teams/${id}/schedule?season=${year}`).then((j) => ({ id, c, events: j.events || [] })));
    })
  );
  return (await pool(jobs, 6)).filter((x) => x.ok).map((x) => x.v);
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
    games.push({ id: x.id, mid: ev.id, key: x.c.key, when, gf, ga, opp: (op.team && op.team.displayName) || '', label: x.c.label, round: rn, won: me.winner === true });
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
    if (/^final$/i.test((ev.seasonType && ev.seasonType.name) || '') && me.winner === true) {
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
async function riyadiyahPhoto(l) {
  const tag = AR_TAG[teams[l.id].name] || (/[\u0600-\u06FF]/.test(AR_ESPN[l.id] || '') ? AR_ESPN[l.id] : '');
  if (!tag) return null;
  const seen = {};
  let tried = 0;
  let stop = false;
  for (let page = 1; page <= 70 && tried < 25 && !stop; page++) {
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
      const title = clean(m[3]) || decodeURIComponent(m[2]).replace(/-/g, ' ');
      if (seen[id]) continue;
      seen[id] = 1;
      if (!/تتويج|توج|توّج|لقب|رفع/.test(title)) continue;
      if (tried >= 25) break;
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
        const og = art.match(/property="og:image"[^>]*content="([^"]+)"/) || art.match(/content="([^"]+)"[^>]*property="og:image"/);
        const abs = (u) => (u.startsWith('//') ? 'https:' + u : u.startsWith('/') ? 'https://arriyadiyah.com' + u : u);
        const all = [];
        const keys = {};
        const add = (u, alt) => {
          const h = u.match(/\/(\d+)_([0-9a-f]+)\.(jpe?g|png|webp)/i);
          if (!h || keys[h[2]]) return;
          if (Number(h[1]) < 800) return;
          keys[h[2]] = 1;
          all.push({ url: abs(u).replace(/\/(\d+)_/, '/1200_').replace('//media', '/media'), alt: alt || '' });
        };
        if (og) add(og[1], 'og');
        const tags = art.match(/<img[^>]*>/gi) || [];
        for (const tg of tags) {
          const src = tg.match(/(?:data-src|src)="([^"]*\/media\/thumb\/[^"]+)"/);
          if (!src) continue;
          const alt = (tg.match(/alt="([^"]*)"/) || [])[1] || '';
          const at = art.indexOf(tg);
          const cap = (art.slice(at, at + 900).match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/) || [])[1] || '';
          add(src[1], clean(alt + ' ' + cap));
        }
        if (!all.length) continue;
        const trophy = (x) => /كأس|الكأس|درع|يرفع|رفع|حمل|يحمل|تتويج|لقب|يحتفل|احتفال/.test(x.alt);
        const flagged = all.filter(trophy);
        const list = (flagged.length ? flagged : all).slice(0, 12);
        debug.push(`imgs ${all.length} flagged ${flagged.length} | ` + all.slice(0, 4).map((x) => x.alt.slice(0, 30)).join(' / '));
        return { url: list[0].url, credit: 'صحيفة الرياضية', source: `https://arriyadiyah.com/${id}`, all: list.map((x) => x.url) };
      } catch (e) {}
    }
  }
  return null;
}
let old = null;
try {
  old = JSON.parse(readFileSync('stats.json', 'utf8')).last;
} catch (e) {}
if (last) {
  if (old && old.id === last.id && old.label === last.label && old.photo && old.photo.all && Math.abs(old.when - last.when) < 36 * 3600e3) last.photo = old.photo;
  else last.photo = (await riyadiyahPhoto(last)) || (await findPhoto(last));
}

writeFileSync(
  'stats.json',
  JSON.stringify({ updated: Date.now(), year: y, teams, games, leagueChamp, last, debug, finals: Object.values(finals).sort((a, b) => a.when - b.when), prev })
);
console.log('teams', ids.length, 'games', games.length, 'prev titles', prev.length);

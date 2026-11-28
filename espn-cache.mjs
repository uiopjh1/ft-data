// يجلب ترتيب البطولات من ESPN مرة واحدة على خوادم GitHub ويحفظه ملفات يقرؤها التطبيق (بدل أن يطلبها كل جوال)
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
const SLUGS = ['ksa.1', 'eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1', 'uefa.champions', 'uefa.europa', 'uefa.europa.conf', 'afc.champions', 'ned.1', 'por.1', 'tur.1', 'bel.1', 'sco.1', 'eng.2', 'bra.1', 'arg.1', 'mex.1', 'usa.1', 'jpn.1', 'caf.nations_qual'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync('espn/standings', { recursive: true });
let ok = 0, bad = 0;
for (const slug of SLUGS) {
  const file = `espn/standings/${slug}.json`;
  try {
    const res = await fetch(`https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings`, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    const hasRows = (j.children && j.children.length ? j.children : [j]).some((g) => g.standings && g.standings.entries && g.standings.entries.length);
    if (!hasRows) throw new Error('no rows');
    let same = false;
    if (existsSync(file)) {
      // إن لم يتغير الترتيب نعيد الكتابة مرة كل 6 ساعات فقط ليبقى ختم الوقت حديثاً (التطبيق يتجاهل النسخة الأقدم من 36 ساعة)
      try { const o = JSON.parse(readFileSync(file, 'utf8')); const ts = o._ts || 0; delete o._ts; same = JSON.stringify(o) === JSON.stringify(j) && Date.now() - ts < 6 * 3600000; } catch (e) {}
    }
    if (!same) writeFileSync(file, JSON.stringify({ ...j, _ts: Date.now() }));
    ok++;
  } catch (e) {
    bad++;
    console.log(slug, String(e.message || e));
  }
  await sleep(1500);
}
console.log('ok', ok, 'bad', bad);

// هدافو بطولات لا يوفّر ESPN لها لوحة لاعبين كاملة: نأخذ "قادة الأهداف" من صفحة الإحصائيات
mkdirSync('espn/scorers', { recursive: true });
for (const slug of ['caf.nations_qual']) {
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/statistics`, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    const cat = (j.stats || []).find((c) => c.name === 'goalsLeaders');
    const rows = ((cat && cat.leaders) || []).map((l) => {
      const a = l.athlete || {};
      const tm = a.team || {};
      const m = /Matches:\s*(\d+)/.exec(l.displayValue || '');
      return { name: a.displayName || '', team: tm.displayName || '', logo: (tm.logos && tm.logos[0] && tm.logos[0].href) || null, goals: Math.round(Number(l.value)), games: m ? Number(m[1]) : null };
    }).filter((r) => r.name && r.goals > 0);
    if (!rows.length) throw new Error('no rows');
    const file = `espn/scorers/${slug}.json`;
    let same = false;
    if (existsSync(file)) { try { const o = JSON.parse(readFileSync(file, 'utf8')); same = JSON.stringify(o.rows) === JSON.stringify(rows) && Date.now() - (o._ts || 0) < 6 * 3600000; } catch (e) {} }
    if (!same) writeFileSync(file, JSON.stringify({ _ts: Date.now(), rows }));
  } catch (e) {
    console.log('scorers', slug, String(e.message || e));
  }
  await sleep(500);
}

// ---- مباريات الأيام (scoreboard) تُنشر على فرع espn-data (يُستبدل كل مرة، فلا يتضخم تاريخ المستودع) ----
const BOARD = ['ksa.1','eng.1','esp.1','ita.1','ger.1','fra.1','uefa.champions','uefa.europa','uefa.europa.conf','afc.champions','afc.cup','ksa.kings.cup','fifa.cwc','fifa.intercontinental_cup','eng.fa','esp.copa_del_rey','fifa.world','fifa.worldq.afc','fifa.worldq.uefa','afc.asian.cup','caf.nations','fifa.friendly','club.friendly','uefa.nations','caf.nations_qual'];
const riyadh = new Date(Date.now() + 3 * 3600000);
const keyFor = (off) => {
  const d = new Date(riyadh.getTime() + off * 86400000);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
};
mkdirSync('out/scoreboard', { recursive: true });
const LOGOS = {};
const pickLogo = (slug, j) => {
  if (LOGOS[slug]) return;
  const lg = (j.leagues || [])[0];
  const arr = (lg && lg.logos) || [];
  const l = arr.find((x) => (x.rel || []).includes('default') && !(x.rel || []).includes('dark')) || arr[0];
  if (l && l.href) LOGOS[slug] = l.href;
};
let bOk = 0, bBad = 0;
for (const slug of BOARD) {
  const days = {};
  for (let off = -3; off <= 8; off++) {
    const k = keyFor(off);
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${k}`, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      days[k] = j.events || [];
      pickLogo(slug, j);
      bOk++;
    } catch (e) {
      bBad++;
    }
    await sleep(250);
  }
  if (Object.keys(days).length) writeFileSync(`out/scoreboard/${slug}.json`, JSON.stringify({ _ts: Date.now(), days }));
}
console.log('board ok', bOk, 'bad', bBad);


// ---- نتائج الموسم مع أهداف اللاعبين (يقرؤها التطبيق لإكمال الهدافين: المباريات المؤجلة تغيب أحياناً عن Sofascore) ----
mkdirSync('out/results', { recursive: true });
{
  const now = new Date();
  const y0 = now.getUTCMonth() < 6 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const f = (d) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  for (const slug of ['ksa.1', 'eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1']) {
    const evs = {};
    let fail = 0;
    for (let d = new Date(Date.UTC(y0, 7, 1)); d <= now; d = new Date(d.getTime() + 7 * 86400000)) {
      const to = new Date(Math.min(d.getTime() + 6 * 86400000, now.getTime()));
      try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${f(d)}-${f(to)}`, { headers: { 'user-agent': 'Mozilla/5.0' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const j = await res.json();
        for (const e of j.events || []) {
          if (!e.status || !e.status.type || e.status.type.state !== 'post') continue;
          const c = e.competitions && e.competitions[0];
          if (!c) continue;
          const h = c.competitors.find((q) => q.homeAway === 'home');
          const a = c.competitors.find((q) => q.homeAway === 'away');
          if (!h || !a) continue;
          const g = [];
          for (const x of c.details || []) {
            const ty = String((x.type && (x.type.text || x.type.id)) || '');
            if (!x.scoringPlay && !/goal/i.test(ty)) continue;
            if (/own/i.test(ty)) continue;
            const at = (x.athletesInvolved || [])[0];
            if (!at) continue;
            g.push({ id: at.id, n: at.displayName || at.fullName || '', t: x.team && x.team.id, p: /penalty/i.test(ty) ? 1 : 0 });
          }
          evs[e.id] = { id: e.id, d: e.date, h: { id: h.team.id, n: h.team.displayName, s: Number(h.score) }, a: { id: a.team.id, n: a.team.displayName, s: Number(a.score) }, g };
        }
      } catch (er) { fail++; if (fail < 3) console.log('results err', slug, String(er)); }
      await sleep(250);
    }
    console.log('results', slug, Object.keys(evs).length, 'fail', fail);
    if (Object.keys(evs).length) writeFileSync(`out/results/${slug}.json`, JSON.stringify({ _ts: Date.now(), fail, events: Object.values(evs) }));
  }
  console.log('results done');
}

// شعارات بطولات إضافية (للبطاقات) من ESPN نفسه
for (const slug of ['ksa.super_cup', 'eng.league_cup', 'ita.coppa_italia', 'ger.dfb_pokal', 'fra.coupe_de_france', 'ksa.crown.prince.cup']) {
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (res.ok) pickLogo(slug, await res.json());
  } catch (e) {}
  await sleep(250);
}
// البطولات السعودية بلا شعار في ESPN: نأخذ الشعار من Sofascore بعد مطابقة الاسم والدولة (وليس تخميناً)
const DEBUG = {};
for (const [slug, q, re] of [['ksa.kings.cup', 'Saudi King Cup', /king/i], ['ksa.super_cup', 'Saudi Super Cup', /super/i], ['ksa.crown.prince.cup', 'Saudi Crown Prince Cup', /crown/i]]) {
  try {
    const res = await fetch(`https://api.sofascore.com/api/v1/search/all?q=${encodeURIComponent(q)}&page=0`, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const j = await res.json();
    const hits = (j.results || []).filter((r) => r.type === 'uniqueTournament' && r.entity).map((r) => r.entity);
    DEBUG[slug] = hits.map((h) => ({ id: h.id, name: h.name, country: h.category && h.category.name }));
    const hit = hits.find((h) => h.category && /saudi/i.test(h.category.name) && re.test(h.name));
    if (hit && !LOGOS[slug]) LOGOS[slug] = `https://api.sofascore.app/api/v1/unique-tournament/${hit.id}/image`;
  } catch (e) { DEBUG[slug] = String(e.message || e); }
  await sleep(300);
}
writeFileSync('out/logos-debug.json', JSON.stringify(DEBUG, null, 1));
writeFileSync('out/logos.json', JSON.stringify(LOGOS));
console.log('logos', Object.keys(LOGOS).length);
// refresh 1794430163

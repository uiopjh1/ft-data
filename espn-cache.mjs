// يجلب ترتيب البطولات من ESPN مرة واحدة على خوادم GitHub ويحفظه ملفات يقرؤها التطبيق (بدل أن يطلبها كل جوال)
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
const SLUGS = ['ksa.1', 'eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1', 'uefa.champions', 'uefa.europa', 'uefa.europa.conf', 'afc.champions'];
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
      try { const o = JSON.parse(readFileSync(file, 'utf8')); delete o._ts; same = JSON.stringify(o) === JSON.stringify(j); } catch (e) {}
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

// ---- مباريات الأيام (scoreboard) تُنشر على فرع espn-data (يُستبدل كل مرة، فلا يتضخم تاريخ المستودع) ----
const BOARD = ['ksa.1','eng.1','esp.1','ita.1','ger.1','fra.1','uefa.champions','uefa.europa','uefa.europa.conf','afc.champions','afc.cup','ksa.kings.cup','fifa.cwc','fifa.intercontinental_cup','eng.fa','esp.copa_del_rey','fifa.world','fifa.worldq.afc','fifa.worldq.uefa','afc.asian.cup','caf.nations','fifa.friendly'];
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

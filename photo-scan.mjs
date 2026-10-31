// فحص لمرة واحدة: تغطية صور لاعبي الدوري السعودي في ويكيبيديا (EN/AR) وويكيداتا. يكتب photo_scan_report.json و photo_scan_players.json
import { writeFileSync } from 'node:fs';

const UA = { 'User-Agent': 'FT-football-app/1.0 (github.com/uiopjh1/ft-data; photo coverage scan)' };
let FAILS = 0;
const T0 = Date.now();
const LATE = () => Date.now() - T0 > 40 * 60 * 1000; // بعد 20 دقيقة نتوقف ونكتب ما أُنجز
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TALLY = {};
const tally = (k) => { TALLY[k] = (TALLY[k] || 0) + 1; };
async function gj(url, tries = 3) {
  await sleep(250);
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const tm = setTimeout(() => ctrl.abort(), 15000);
      let r;
      try { r = await fetch(url, { headers: UA, signal: ctrl.signal }); tally(r.status); if (r.ok) return await r.json(); } finally { clearTimeout(tm); }
      if (r.status === 404) return null;
    } catch (e) { tally('exc'); }
    await sleep(1500 * (i + 1));
  }
  tally('GAVE_UP');
  FAILS++;
  return null;
}
async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

// 1) فرق ولاعبو دوري روشن من ESPN
const st = await gj('https://site.api.espn.com/apis/v2/sports/soccer/ksa.1/standings');
const entries = ((st && st.children && st.children[0] ? st.children[0] : st || {}).standings || {}).entries || [];
const teams = entries.map((e) => e.team).filter((t) => t && t.id);
console.log('teams', teams.length);
const players = [];
for (const t of teams) {
  const j = await gj(`https://site.api.espn.com/apis/site/v2/sports/soccer/ksa.1/teams/${t.id}/roster`);
  const list = (j && (j.athletes || [])) || [];
  list.forEach((a) => {
    const x = a.items ? a.items : [a];
    (Array.isArray(x) ? x : [x]).forEach((p) => {
      if (p && (p.fullName || p.displayName)) players.push({ team: t.displayName || t.name, name: p.fullName || p.displayName, dob: (p.dateOfBirth || '').slice(0, 10), pos: (p.position && p.position.abbreviation) || '' });
    });
  });
  await sleep(150);
}
console.log('players', players.length);

// 2) ويكيبيديا الإنجليزية كما يفعل التطبيق (اسم + _(footballer) + _(soccer))
async function appWiki(name) {
  const base = name.replace(/\s+/g, '_');
  for (const ti of [base, base + '_(footballer)', base + '_(soccer)']) {
    const j = await gj('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(ti).replace(/%2C/g, ','));
    if (!j) continue;
    const isFb = /football|soccer/i.test((j.description || '') + ' ' + (j.extract || '').slice(0, 200));
    const img = j.originalimage || j.thumbnail;
    if (isFb) return { page: true, img: !!(img && img.source), src: img && img.source };
  }
  return { page: false, img: false };
}

// 3) ويكيداتا: بحث بالاسم، ثم تصفية (إنسان + لاعب كرة قدم + تاريخ ميلاد مطابق إن توفر)
async function wikidata(p) {
  const s = await gj(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(p.name)}&language=en&type=item&limit=7&format=json`);
  const ids = ((s && s.search) || []).map((x) => x.id);
  if (!ids.length) return { status: 'none' };
  const e = await gj(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=claims|sitelinks&format=json`);
  const cands = [];
  for (const id of ids) {
    const en = e && e.entities && e.entities[id];
    if (!en || !en.claims) continue;
    const c = en.claims;
    const isHuman = (c.P31 || []).some((x) => x.mainsnak && x.mainsnak.datavalue && x.mainsnak.datavalue.value && x.mainsnak.datavalue.value.id === 'Q5');
    const isFb = (c.P106 || []).some((x) => x.mainsnak && x.mainsnak.datavalue && x.mainsnak.datavalue.value && x.mainsnak.datavalue.value.id === 'Q937857');
    if (!isHuman || !isFb) continue;
    const b = c.P569 && c.P569[0] && c.P569[0].mainsnak.datavalue && c.P569[0].mainsnak.datavalue.value.time;
    const bd = b ? b.replace(/^\+/, '').slice(0, 10) : '';
    const p18 = c.P18 && c.P18[0] && c.P18[0].mainsnak.datavalue && c.P18[0].mainsnak.datavalue.value;
    cands.push({ id, bd, p18: p18 || null, enwiki: !!(en.sitelinks && en.sitelinks.enwiki), arwiki: en.sitelinks && en.sitelinks.arwiki ? en.sitelinks.arwiki.title : null });
  }
  if (!cands.length) return { status: 'none' };
  let m = p.dob ? cands.filter((x) => x.bd === p.dob) : [];
  if (m.length === 1) return { status: 'dob', ...m[0] };
  if (!p.dob && cands.length === 1) return { status: 'single', ...cands[0] };
  return { status: 'ambiguous' };
}
async function arWiki(title) {
  const j = await gj('https://ar.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/\s+/g, '_')));
  const img = j && (j.originalimage || j.thumbnail);
  return !!(img && img.source);
}

const res0 = await pool(players, 1, async (p, k) => {
  if (LATE()) return null;
  const f0 = FAILS;
  const a = await appWiki(p.name);
  const w = await wikidata(p);
  let ar = false;
  if (w.arwiki) ar = await arWiki(w.arwiki);
  if (k % 25 === 0) console.log('progress', k, new Date().toISOString());
  if (FAILS > f0) return { ...p, unknown: true };
  return { ...p, appPage: a.page, appImg: a.img, wd: w.status, wdP18: !!w.p18, wdFile: w.p18 || null, enwiki: !!w.enwiki, arwiki: !!w.arwiki, arImg: ar };
});

const res = res0.filter(Boolean);
const unknownN = res.filter((r) => r.unknown).length;
const known = res.filter((r) => !r.unknown);
console.log('scanned', res.length, 'of', players.length);
// 4) تواريخ ملفات صور ويكيداتا (أقصى تاريخ ممكن: الأقل بين تاريخ الالتقاط وتاريخ الرفع)
const files = [...new Set(res.filter((r) => !r.unknown).map((r) => r.wdFile).filter(Boolean))];
const yearOf = {};
for (let i = 0; i < files.length; i += 40) {
  const chunk = files.slice(i, i + 40);
  const j = await gj(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(chunk.map((f) => 'File:' + f).join('|'))}&prop=imageinfo&iiprop=extmetadata%7Ctimestamp&format=json`);
  Object.values((j && j.query && j.query.pages) || {}).forEach((pg) => {
    const ii = pg.imageinfo && pg.imageinfo[0];
    if (!ii) return;
    const up = ii.timestamp ? new Date(ii.timestamp).getUTCFullYear() : null;
    const raw = ii.extmetadata && ii.extmetadata.DateTimeOriginal && String(ii.extmetadata.DateTimeOriginal.value).replace(/<[^>]*>/g, ' ');
    const m = raw && raw.match(/(20[0-3][0-9]|19[5-9][0-9])/);
    const taken = m ? Number(m[1]) : null;
    const t = String(pg.title || '').replace(/^File:/, '').replace(/_/g, ' ');
    yearOf[t] = taken && up ? Math.min(taken, up) : taken || up;
  });
  await sleep(300);
}
known.forEach((r) => { r.wdYear = r.wdFile ? yearOf[String(r.wdFile).replace(/_/g, ' ')] || null : null; });

// 5) الملخص
const n = known.length;
const c = (f) => known.filter(f).length;
const matched = c((r) => r.wd === 'dob' || r.wd === 'single');
const anyImg = c((r) => r.appImg || r.wdP18 || r.arImg);
const years = {};
known.filter((r) => r.wdYear).forEach((r) => { years[r.wdYear] = (years[r.wdYear] || 0) + 1; });
const byTeam = {};
known.forEach((r) => {
  const t = (byTeam[r.team] = byTeam[r.team] || { n: 0, app: 0, wd: 0, any: 0 });
  t.n++; if (r.appImg) t.app++; if (r.wdP18) t.wd++; if (r.appImg || r.wdP18 || r.arImg) t.any++;
});
const report = {
  updated: new Date().toISOString(),
  playersTotal: players.length,
  scanned: res.length,
  unknownDueToRequestFailures: unknownN,
  players: n,
  httpTally: TALLY,
  appStyleWikipediaImage: c((r) => r.appImg),
  appStylePageButNoImage: c((r) => r.appPage && !r.appImg),
  wikidataMatched: matched,
  wikidataAmbiguous: c((r) => r.wd === 'ambiguous'),
  wikidataNone: c((r) => r.wd === 'none'),
  wikidataImage: c((r) => r.wdP18),
  wikidataImageButNoAppImage: c((r) => r.wdP18 && !r.appImg),
  arabicWikipediaImage: c((r) => r.arImg),
  anyImage: anyImg,
  noImageAtAnySource: n - anyImg,
  wikidataImageYearHistogram: years,
  byTeam,
};
writeFileSync('photo_scan_report.json', JSON.stringify(report, null, 1));
writeFileSync('photo_scan_players.json', JSON.stringify(res.map(({ wdFile, ...r }) => r)));
console.log(JSON.stringify(report, null, 1));

// يجلب لكل نادٍ من الدوريات المدعومة كل لاعبيه عبر التاريخ من ويكيداتا → clubs/<slug>.json + clubs_index.json
import fs from 'fs';
const UA = { 'user-agent': 'FT-app-research/1.0 (github.com/uiopjh1/ft-data)', accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nz = (s) => { let t = String(s || '').toLowerCase(); try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {} return t.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); };
const LG = { spl: 'دوري روشن', epl: 'الدوري الإنجليزي', laliga: 'الدوري الإسباني', bundesliga: 'الدوري الألماني', seriea: 'الدوري الإيطالي' };
fs.mkdirSync('clubs', { recursive: true });
let manual = {};
try { manual = JSON.parse(fs.readFileSync('club_qids.json', 'utf8')); } catch (e) {}
const teams = [];
for (const lg of Object.keys(LG)) {
  try { for (const t of JSON.parse(fs.readFileSync(lg + '_players.json', 'utf8')).teams || []) teams.push({ lg, slug: t.slug, en: t.en, ar: t.ar }); } catch (e) {}
}
async function jget(u) { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, { headers: UA }); if (r.ok) return await r.json(); } catch (e) {} await sleep(2000); } return null; }
async function findQid(t) {
  if (manual[t.slug]) return manual[t.slug];
  const names = [t.en, t.en.replace(/^(\d+\.\s*)?(FC|SV|VfB|VfL|SC|TSG|1\.)\s+/i, '').replace(/\s+(FC|AFC|CF|04|1899|98|07)$/i, '')];
  for (const n of names) {
    const j = await jget('https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=8&search=' + encodeURIComponent(n));
    const ids = ((j && j.search) || []).map((x) => x.id);
    if (!ids.length) continue;
    const e = await jget('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|labels&languages=en&ids=' + ids.join('|'));
    for (const id of ids) {
      const ent = e && e.entities && e.entities[id];
      const isClub = ent && ent.claims && (ent.claims.P31 || []).some((c) => c.mainsnak.datavalue && ['Q476028', 'Q2735883'].includes(c.mainsnak.datavalue.value.id));
      const hasPlayers = true;
      if (isClub && hasPlayers) return id;
    }
    await sleep(300);
  }
  return null;
}
async function players(qid) {
  const q = `SELECT ?p ?en ?ar ?img ?start ?end WHERE { ?p p:P54 ?st . ?st ps:P54 wd:${qid} . OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end } OPTIONAL { ?p wdt:P18 ?img } ?p rdfs:label ?en . FILTER(LANG(?en)='en') OPTIONAL { ?p rdfs:label ?ar . FILTER(LANG(?ar)='ar') } }`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: { ...UA, accept: 'application/sparql-results+json' } });
      if (r.ok) return (await r.json()).results.bindings;
    } catch (e) {}
    await sleep(5000);
  }
  return null;
}
const index = [], unresolved = [];
for (const t of teams) {
  const qid = await findQid(t);
  if (!qid) { unresolved.push(t.lg + ':' + t.slug + ':' + t.en); continue; }
  const rows = await players(qid);
  if (!rows) { unresolved.push('NOROWS:' + t.slug); continue; }
  const by = {};
  for (const b of rows) {
    const o = by[b.p.value] || (by[b.p.value] = { en: b.en.value, ar: (b.ar && b.ar.value) || '', img: b.img ? decodeURIComponent(b.img.value.split('Special:FilePath/')[1] || '') : '', f: [], t: [], open: false });
    if (b.start) o.f.push(+b.start.value.slice(0, 4));
    if (b.end) o.t.push(+b.end.value.slice(0, 4)); else o.open = true;
  }
  const L = Object.values(by).map((o) => [o.en, o.ar, o.img, o.f.length ? Math.min(...o.f) : 0, o.t.length && !o.open ? Math.max(...o.t) : 0]);
  L.sort((a, b) => (b[2] ? 1 : 0) - (a[2] ? 1 : 0) || a[0].localeCompare(b[0]));
  fs.writeFileSync('clubs/' + t.slug + '.json', JSON.stringify(L));
  index.push({ slug: t.slug, en: t.en, ar: t.ar, lg: t.lg, lgAr: LG[t.lg], qid, n: L.length, img: L.filter((x) => x[2]).length });
  await sleep(1200);
}
fs.writeFileSync('clubs_index.json', JSON.stringify({ updated: new Date().toISOString(), clubs: index }));
fs.writeFileSync('clubs_report.json', JSON.stringify({ teams: teams.length, ok: index.length, unresolved }, null, 1));

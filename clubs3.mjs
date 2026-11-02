// تنظيف قوائم الأندية: حذف المدربين وغير اللاعبين، أسماء عربية من الأسماء البديلة، صور FotMob للدوري السعودي
import fs from 'fs';
const UA = { 'user-agent': 'FT-app-research/1.0 (github.com/uiopjh1/ft-data)', accept: 'application/sparql-results+json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nz = (s) => { let t = String(s || '').toLowerCase(); try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {} return t.replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); };
const tk = (s) => nz(s).split(' ').filter((x) => x.length > 1);
const idx = JSON.parse(fs.readFileSync('clubs_index.json', 'utf8')).clubs;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const PHOTOS = process.env.PHOTOS ? process.env.PHOTOS.split(',') : ['spl'];
const rep = { clubs: 0, failed: [], coachRemoved: 0, nonPlayerRemoved: 0, arAdded: 0, photos: 0, photoTry: 0, samples: [] };
const LOG = [];
const flush = () => fs.writeFileSync('clubs3_report_' + (process.env.TAG || 'all') + '.json', JSON.stringify({ t: new Date().toISOString(), rep, tail: LOG.slice(-30) }));
async function sp(q) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: UA, signal: AbortSignal.timeout(70000) });
      if (r.ok) return (await r.json()).results.bindings;
      if (r.status === 429) await sleep(10000 * (i + 1));
    } catch (e) { LOG.push('err ' + String(e.message).slice(0, 40)); }
    await sleep(4000);
  }
  return null;
}
const clean = (s) => String(s || '').replace(/\s*[(（][^)）]*[)）]\s*/g, ' ').trim();
const H = { 'user-agent': 'Mozilla/5.0', accept: 'application/json' };
async function fm(term) { const r = await fetch('https://apigw.fotmob.com/searchapi/suggest?term=' + encodeURIComponent(term) + '&lang=en', { headers: H }); if (!r.ok) throw new Error('fm ' + r.status); return r.json(); }
async function photo(en, teamEn) {
  const words = nz(en).split(' ').filter(Boolean);
  const qs = [en]; if (words.length > 2) qs.push(words[0] + ' ' + words[words.length - 1], words[words.length - 1]);
  const opts = [];
  for (const q of qs) { const j = await fm(q); for (const g of (j.squadMemberSuggest || [])) for (const o of (g.options || [])) opts.push(o); if (opts.length) break; }
  const pt = new Set(tk(en)), tt = tk(teamEn), pn = nz(en);
  for (const o of opts) {
    const [nm, id] = String(o.text || '').split('|'); if (!id) continue;
    const nt = tk(nm);
    const hit = nt.length && nt.filter((x) => pt.has(x)).length >= Math.min(2, nt.length);
    const blob = nz(JSON.stringify(o.payload || o));
    if (hit && (tt.some((x) => blob.includes(x)) || nz(nm) === pn)) return 'https://images.fotmob.com/image_resources/playerimages/' + id + '.png';
  }
  return null;
}
for (const c of idx) {
  if (ONLY && !ONLY.includes(c.slug)) continue;
  try {
    LOG.push(c.slug); flush();
    const f = 'clubs/' + c.slug + '.json';
    let rows = JSON.parse(fs.readFileSync(f, 'utf8'));
    const Q = c.qid;
    // 1) غير لاعبين: لهم مهنة لكن ليست لاعب كرة قدم
    const occ = await sp(`SELECT ?en (MAX(?f) AS ?fb) (COUNT(?o) AS ?n) WHERE { ?p p:P54/ps:P54 wd:${Q} . ?p wdt:P106 ?o . ?p rdfs:label ?en . FILTER(LANG(?en)='en') BIND(IF(?o=wd:Q937857,1,0) AS ?f) } GROUP BY ?en`);
    // 2) مدربو النادي
    const coach = await sp(`SELECT ?en ?cs WHERE { ?p p:P286 ?s . ?s ps:P286 wd:${Q} . OPTIONAL { ?s pq:P580 ?cs } ?p rdfs:label ?en . FILTER(LANG(?en)='en') }`);
    // 3) أسماء عربية بديلة
    const alt = await sp(`SELECT ?en ?alt WHERE { ?p p:P54/ps:P54 wd:${Q} . ?p rdfs:label ?en . FILTER(LANG(?en)='en') ?p skos:altLabel ?alt . FILTER(LANG(?alt)='ar') }`);
    if (!occ || !coach || !alt) { rep.failed.push(c.slug); continue; }
    const nonp = new Set(occ.filter((b) => +b.n.value > 0 && +b.fb.value === 0).map((b) => clean(b.en.value)));
    const co = {}; for (const b of coach) (co[clean(b.en.value)] = co[clean(b.en.value)] || []).push(b.cs ? +b.cs.value.slice(0, 4) : null);
    const al = {}; for (const b of alt) { const k = clean(b.en.value); if (!al[k] || b.alt.value.length < al[k].length) al[k] = b.alt.value; }
    const out = [];
    for (const r of rows) {
      const en = clean(r[0]);
      if (nonp.has(en)) { rep.nonPlayerRemoved++; if (rep.samples.length < 30) rep.samples.push('N:' + en + '@' + c.slug); continue; }
      const cs = co[en];
      if (cs && (!r[3] || cs.some((y) => y && Math.abs(y - r[3]) <= 1))) { rep.coachRemoved++; if (rep.samples.length < 30) rep.samples.push('C:' + en + '@' + c.slug); continue; }
      if (!/[؀-ۿ]/.test(r[1] || '') && al[en]) { r[1] = clean(al[en]); rep.arAdded++; }
      out.push(r);
    }
    rows = out;
    // 4) صور FotMob للدوري السعودي (لمن بلا صورة وفترته حديثة)
    if (PHOTOS.includes(c.lg)) {
      const need = rows.filter((r) => !r[2] && (!r[4] || r[4] >= 2008));
      let i = 0;
      await Promise.all(Array.from({ length: 5 }, async () => { while (i < need.length) { const r = need[i++]; rep.photoTry++; try { const u = await photo(r[0], c.en); if (u) { r[2] = u; rep.photos++; } } catch (e) { await sleep(1500); } await sleep(150); } }));
    }
    fs.writeFileSync(f, JSON.stringify(rows));
    rep.clubs++;
  } catch (e) { rep.failed.push(c.slug + ':' + String(e.message).slice(0, 40)); }
}
LOG.push('done'); flush();

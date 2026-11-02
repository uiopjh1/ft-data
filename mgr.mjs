import fs from 'fs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const idx = JSON.parse(fs.readFileSync('clubs_index.json', 'utf8')).clubs;
const clean = (s) => String(s || '').replace(/\s*[(（][^)）]*[)）]\s*/g, ' ').trim();
const out = {};
for (const c of idx) {
  const q = `SELECT DISTINCT ?en WHERE { ?p p:P54/ps:P54 wd:${c.qid} . ?p wdt:P106 wd:Q628099 . ?p rdfs:label ?en . FILTER(LANG(?en)='en') }`;
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: { 'user-agent': 'FT-app-research/1.0', accept: 'application/sparql-results+json' }, signal: AbortSignal.timeout(70000) }); if (r.ok) { out[c.slug] = (await r.json()).results.bindings.map((b) => clean(b.en.value)); break; } if (r.status === 429) await sleep(10000 * (i + 1)); } catch (e) {}
    await sleep(3000);
  }
  fs.writeFileSync('mgr_names.json', JSON.stringify(out));
}

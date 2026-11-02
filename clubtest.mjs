import fs from 'fs';
const q = `SELECT ?p ?en ?ar ?img ?start ?end WHERE {
  ?p p:P54 ?st . ?st ps:P54 wd:Q8682 .
  OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end }
  OPTIONAL { ?p wdt:P18 ?img }
  ?p rdfs:label ?en . FILTER(LANG(?en)='en')
  OPTIONAL { ?p rdfs:label ?ar . FILTER(LANG(?ar)='ar') }
}`;
const t0 = Date.now();
const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: { 'user-agent': 'FT-app-research/1.0 (contact via github uiopjh1)', accept: 'application/sparql-results+json' } });
const txt = await r.text();
let out = { status: r.status, ms: Date.now() - t0, len: txt.length };
try {
  const rows = JSON.parse(txt).results.bindings;
  const by = {};
  for (const b of rows) { const id = b.p.value; const o = by[id] || (by[id] = { en: b.en.value, ar: b.ar && b.ar.value, img: b.img && b.img.value, from: [], to: [] }); if (b.start) o.from.push(b.start.value.slice(0, 4)); if (b.end) o.to.push(b.end.value.slice(0, 4)); }
  const L = Object.values(by);
  out.rows = rows.length; out.players = L.length; out.withImg = L.filter((x) => x.img).length; out.withAr = L.filter((x) => x.ar).length; out.withYears = L.filter((x) => x.from.length).length;
  out.sample = L.slice(0, 8);
  fs.writeFileSync('club_rm.json', JSON.stringify(L));
} catch (e) { out.err = String(e.message); out.head = txt.slice(0, 300); }
fs.writeFileSync('clubtest_report.json', JSON.stringify(out, null, 1));

import fs from 'fs';
const UA = { 'user-agent': 'FT-app-research/1.0 (github.com/uiopjh1/ft-data)' };
const idx = JSON.parse(fs.readFileSync('clubs_index.json', 'utf8')).clubs;
const out = [];
for (let i = 0; i < idx.length; i += 40) {
  const part = idx.slice(i, i + 40);
  const j = await (await fetch('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels|descriptions|claims&languages=en&ids=' + part.map((c) => c.qid).join('|'), { headers: UA })).json();
  const cids = new Set();
  for (const c of part) { const e = j.entities[c.qid]; const cl = (e.claims.P17 || e.claims.P495 || [])[0]; const cid = cl && cl.mainsnak.datavalue && cl.mainsnak.datavalue.value.id; if (cid) cids.add(cid); c._cid = cid; c._label = e.labels.en && e.labels.en.value; c._desc = e.descriptions.en && e.descriptions.en.value; c._inst = (e.claims.P31 || []).map((x) => x.mainsnak.datavalue && x.mainsnak.datavalue.value.id).join(','); }
  const cj = await (await fetch('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languages=en&ids=' + [...cids].join('|'), { headers: UA })).json();
  for (const c of part) out.push({ slug: c.slug, lg: c.lg, en: c.en, qid: c.qid, label: c._label, desc: c._desc, country: c._cid && cj.entities[c._cid] && cj.entities[c._cid].labels.en.value, inst: c._inst });
  await new Promise((r) => setTimeout(r, 1500));
}
fs.writeFileSync('qidcheck.json', JSON.stringify(out, null, 1));

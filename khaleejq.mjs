import fs from 'fs';
const UA = { 'user-agent': 'FT-app-research/1.0 (github.com/uiopjh1/ft-data)' };
const out = [];
for (const q of ['Al-Khaleej', 'Al Khaleej FC', 'Al-Khaleej Club', 'Khaleej Saihat', 'Al-Khaleej Saudi Club', 'الخليج']) {
  const lang = /[ء-ي]/.test(q) ? 'ar' : 'en';
  const s = await (await fetch('https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=' + lang + '&type=item&limit=10&search=' + encodeURIComponent(q), { headers: UA })).json();
  const ids = (s.search || []).map((x) => x.id);
  if (!ids.length) continue;
  const e = await (await fetch('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|labels|descriptions&languages=en&ids=' + ids.join('|'), { headers: UA })).json();
  for (const id of ids) { const en = e.entities[id]; const c = en.claims || {}; out.push({ q, id, label: en.labels.en && en.labels.en.value, desc: en.descriptions.en && en.descriptions.en.value, p17: (c.P17 || []).map((x) => x.mainsnak.datavalue && x.mainsnak.datavalue.value.id).join(','), p31: (c.P31 || []).map((x) => x.mainsnak.datavalue && x.mainsnak.datavalue.value.id).join(',') }); }
}
fs.writeFileSync('khaleejq.json', JSON.stringify(out, null, 1));

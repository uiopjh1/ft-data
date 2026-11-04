// تجربة: اسم عربي من ويكيداتا للاعب بمطابقة تاريخ الميلاد (لا يغيّر أي ملف أسماء، فقط يكتب تقريراً)
import fs from 'fs';
const UA = { 'user-agent': 'FT-app-research/1.0 (github.com/uiopjh1/ft-data)', accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function J(u) { for (let i = 0; i < 5; i++) { try { const r = await fetch(u, { headers: UA }); if (r.ok) return await r.json(); if (r.status === 429) await sleep(6000 * (i + 1)); } catch (e) {} await sleep(1500 * (i + 1)); } return null; }
const TESTS = [
  ['Abdoulaye Toure', '2004-01-01'], ['Victor Henrique Cardoso Santos', '2003-04-27'], ['Victor Henrique', '2003-04-27'], ['Ali Hasan Saeed Isa', '1996-08-17'], ['Ali Hasan', '1996-08-17'],
  ['Alexandre Lacazette', '1991-05-28'], ['Cristiano Ronaldo', '1985-02-05'], ['Karim Benzema', '1987-12-19'], ['Salem Al-Dawsari', '1991-08-19'], ['Aleksandar Mitrovic', '1994-09-16'],
  ['Neymar', '1992-02-05'], ['Sadio Mane', '1992-04-10'], ['Yassine Bounou', '1991-04-05'], ['Malcom', '1997-02-26'], ['Ruben Neves', '1997-03-13'],
  ['Kalidou Koulibaly', '1991-06-20'], ['Joao Cancelo', '1994-05-27'], ['Seko Fofana', '1995-05-07'], ['Abdulelah Al-Amri', '1997-01-15'], ['Marcelo Brozovic', '1992-11-16'],
];
const names = {};
try { Object.assign(names, JSON.parse(fs.readFileSync('names.json', 'utf8')).players); } catch (e) {}
const out = [];
for (const [en, dob] of TESTS) {
  const row = { en, dob, mine: (names[en] && names[en].ar) || null, wd: null, status: 'none' };
  const variants = [en, en.replace(/-/g, ' ')];
  const qids = new Set();
  for (const v of variants) {
    const s = await J('https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&type=item&limit=8&language=en&search=' + encodeURIComponent(v));
    ((s && s.search) || []).forEach((x) => qids.add(x.id));
    await sleep(300);
  }
  if (qids.size) {
    const e = await J('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels|claims&languages=ar|en&ids=' + [...qids].join('|'));
    for (const id of qids) {
      const en_ = e && e.entities && e.entities[id];
      if (!en_) continue;
      const cl = en_.claims || {};
      const isHuman = (cl.P31 || []).some((c) => c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value.id === 'Q5');
      const b = (cl.P569 || []).map((c) => c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value.time).filter(Boolean)[0] || '';
      if (!isHuman || !b) continue;
      const d = b.replace(/^\+/, '').slice(0, 10);
      const same = d === dob || (d.slice(0, 4) === dob.slice(0, 4) && dob.endsWith('-01-01'));
      if (!same) continue;
      row.wd = (en_.labels && en_.labels.ar && en_.labels.ar.value) || null;
      row.qid = id; row.wdDob = d; row.status = row.wd ? 'matched' : 'matched-no-arabic';
      break;
    }
  }
  out.push(row);
}
fs.writeFileSync('wiki_names_test.json', JSON.stringify(out, null, 1));
console.table(out.map((r) => ({ en: r.en, mine: r.mine, wd: r.wd, status: r.status })));

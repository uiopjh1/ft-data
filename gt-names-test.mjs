// تجربة: ترجمة الأسماء بـ Google Translate (الواجهة المجانية) وLingva احتياطاً، للمقارنة فقط (لا يغيّر أي ملف أسماء)
import fs from 'fs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function google(t) {
  const r = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=' + encodeURIComponent(t), { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error('google ' + r.status);
  const j = await r.json();
  return (j[0] || []).map((x) => x[0]).join('').trim();
}
const LINGVA = ['https://lingva.ml', 'https://lingva.thedaviddelta.com', 'https://translate.plausibility.cloud'];
async function lingva(t) {
  let err = '';
  for (const b of LINGVA) {
    try {
      const r = await fetch(`${b}/api/v1/en/ar/${encodeURIComponent(t)}`, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) { err = b + ' ' + r.status; continue; }
      const j = await r.json();
      if (j && j.translation) return String(j.translation).trim();
    } catch (e) { err = b + ' ' + e.message; }
  }
  throw new Error('lingva ' + err);
}
const NAMES = [
  'Abdoulaye Toure', 'Victor Henrique', 'Ali Hasan Saeed Isa', 'Mevlin', 'Said Ben Rahma', 'Ramon Mierez', 'Alexandre Lacazette', 'Evyani Ize',
  'Cristiano Ronaldo', 'Karim Benzema', 'Salem Al-Dawsari', 'Aleksandar Mitrovic', 'Kalidou Koulibaly', 'Seko Fofana', 'Abdulelah Al-Amri', 'Marcelo Brozovic', 'Yassine Bounou',
  'Shabab Hadramout', 'Al-Riffa', 'Erbil', 'Kazma', 'Al-Zawraa', 'Qatar SC', 'Al-Shabab', 'Al-Duhail', 'Neom SC', 'Ajman', 'Al-Ettifaq',
];
const out = [];
for (const n of NAMES) {
  const row = { en: n, google: null, lingva: null };
  try { row.google = await google(n); } catch (e) { row.gErr = e.message; }
  await sleep(400);
  try { row.lingva = await lingva(n); } catch (e) { row.lErr = e.message; }
  await sleep(400);
  out.push(row);
}
fs.writeFileSync('gt_names_test.json', JSON.stringify(out, null, 1));
console.table(out.map((r) => ({ en: r.en, google: r.google || r.gErr, lingva: r.lingva || r.lErr })));

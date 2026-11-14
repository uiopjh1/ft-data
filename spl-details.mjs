// يجمع العمر والطول لكل لاعبي دوري روشن من صفحات الرابطة الرسمية → spl_details.json  { slug: { a: عمر, h: طول بالسم } }
// نحفظ فقط ما هو مكتوب فعلاً في الصفحة وضمن نطاق منطقي؛ ما لم يوجد يبقى غير موجود
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; FT-football-app/1.0)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const d = JSON.parse(readFileSync('spl_players.json', 'utf8'));
let prev = {};
if (existsSync('spl_details.json')) { try { prev = JSON.parse(readFileSync('spl_details.json', 'utf8')).p || {}; } catch (e) { prev = {}; } }
async function get(u) {
  for (let i = 0; i < 3; i++) {
    try {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 30000);
      try { const r = await fetch(u, { headers: UA, signal: c.signal }); if (r.ok) return await r.text(); if (r.status === 404) return null; } finally { clearTimeout(t); }
    } catch (e) { /* إعادة */ }
    await sleep(1500 * (i + 1));
  }
  return null;
}
const out = {};
let ok = 0, noA = 0, noH = 0, fail = 0;
async function one(p) {
  const h = await get(`https://www.spl.com.sa/en/players/${p.slug}/`);
  if (!h) { fail++; if (prev[p.slug]) out[p.slug] = prev[p.slug]; return; }
  const txt = h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' | ').replace(/\s+/g, ' ');
  const am = txt.match(/\bAge\s*(?:\|\s*)+(\d{2})\b/);
  const hm = txt.match(/\bHeight\s*(?:\|\s*)+(\d)[.,](\d{1,2})\s*m\b/);
  const rec = {};
  if (am) { const a = +am[1]; if (a >= 15 && a <= 50) rec.a = a; }
  if (hm) { const cm = Math.round(parseFloat(hm[1] + '.' + hm[2]) * 100); if (cm >= 150 && cm <= 220) rec.h = cm; }
  if (rec.a) ok++; else noA++;
  if (!rec.h) noH++;
  if (rec.a || rec.h) out[p.slug] = rec;
}
let idx = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (idx < d.players.length) { const p = d.players[idx++]; await one(p); await sleep(150); }
}));
console.log('players', d.players.length, 'age', ok, 'noAge', noA, 'noHeight', noH, 'fail', fail);
if (fail > d.players.length * 0.5) throw new Error('too many failures');
writeFileSync('spl_details.json', JSON.stringify({ updated: new Date().toISOString(), p: out }));

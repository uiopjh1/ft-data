// يصغّر صور اللاعبين الرسمية إلى نسخ خفيفة (~3KB) ليعرضها التطبيق فوراً في التشكيلة والقوائم
import fs from 'fs';
import sharp from 'sharp';
const FILES = ['spl_players.json', 'epl_players.json', 'laliga_players.json', 'bundesliga_players.json', 'seriea_players.json'];
// نفس دالة التجزئة في التطبيق (FNV-1a مرتين بقيمتين مختلفتين)
export function h(u) {
  let a = 0x811c9dc5, b = 0x12345678;
  for (let i = 0; i < u.length; i++) {
    const c = u.charCodeAt(i);
    a ^= c; a = Math.imul(a, 0x01000193) >>> 0;
    b ^= c; b = Math.imul(b, 0x01000193) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}
fs.mkdirSync('thumbs', { recursive: true });
const urls = new Set();
for (const f of FILES) {
  try { for (const p of JSON.parse(fs.readFileSync(f, 'utf8')).players || []) if (p.img) urls.add(p.img); } catch (e) { console.log('skip', f); }
}
const q = [...urls];
let ok = 0, fail = 0, skipped = 0;
const why = {};
async function one(u) {
  const out = 'thumbs/' + h(u) + '.webp';
  if (fs.existsSync(out)) { skipped++; return; }
  try {
    let r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!r.ok) {
      // لاعبون جدد: صورتهم الرسمية تحت مسار الموسم الجديد (premierleague25) لا المسار القديم
      const m = u.match(/premierleague\.com\/premierleague\/photos\/players\/\w+\/p(\d+)\.png/);
      if (m) r = await fetch('https://resources.premierleague.com/premierleague25/photos/players/110x140/' + m[1] + '.png', { headers: { 'user-agent': 'Mozilla/5.0' } });
    }
    if (!r.ok) throw new Error(String(r.status));
    const buf = Buffer.from(await r.arrayBuffer());
    const t = await sharp(buf).resize({ width: 128, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
    fs.writeFileSync(out, t);
    ok++;
  } catch (e) { fail++; const k = String(e && e.message).slice(0, 40); why[k] = (why[k] || 0) + 1; }
}
let i = 0;
await Promise.all(Array.from({ length: 8 }, async () => { while (i < q.length) await one(q[i++]); }));
// فهرس الصور المتاحة فعلاً (التطبيق لا يطلب إلا ما هو موجود)
const have = q.map(h).filter((k) => fs.existsSync('thumbs/' + k + '.webp'));
fs.writeFileSync('thumbs_index.json', JSON.stringify({ updated: new Date().toISOString(), h: have }));
const sizes = have.map((k) => fs.statSync('thumbs/' + k + '.webp').size);
console.log(JSON.stringify({ total: q.length, ok, skipped, fail, have: have.length, avgKB: sizes.length ? +(sizes.reduce((a, b) => a + b, 0) / sizes.length / 1024).toFixed(1) : 0 }));
fs.writeFileSync('thumbs_debug.json', JSON.stringify({ why, total: q.length, ok, skipped, fail, have: have.length, avgBytes: sizes.length ? Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length) : 0, maxBytes: Math.max(0, ...sizes) }));

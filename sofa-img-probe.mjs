// حجم صور Sofascore الفعلي (بكسل) من أكثر من عنوان
import fs from 'fs';
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', accept: '*/*' };
function dims(b) {
  if (b.length > 24 && b.toString('ascii', 1, 4) === 'PNG') return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20);
  if (b[0] === 0xff && b[1] === 0xd8) { let i = 2; while (i < b.length - 9) { if (b[i] !== 0xff) { i++; continue; } const m = b[i + 1]; if (m >= 0xc0 && m <= 0xc3) return b.readUInt16BE(i + 7) + 'x' + b.readUInt16BE(i + 5); i += 2 + b.readUInt16BE(i + 2); } }
  if (b.toString('ascii', 0, 4) === 'RIFF') return 'webp';
  return '?';
}
async function img(u) { try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(20000) }); const b = Buffer.from(await r.arrayBuffer()); return r.status + ' ' + b.length + 'B ' + (r.ok ? dims(b) : '') + ' ' + (r.headers.get('content-type') || ''); } catch (e) { return 'err ' + e.message; } }
const out = [];
for (const id of [750, 1441638]) {
  const row = { id, imgs: {} };
  for (const base of ['https://api.sofascore.app/api/v1/player/', 'https://api.sofascore.com/api/v1/player/', 'https://img.sofascore.com/api/v1/player/']) row.imgs[base] = await img(base + id + '/image');
  out.push(row);
}
fs.writeFileSync('sofa_img_probe.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));

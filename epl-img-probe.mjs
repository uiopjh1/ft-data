// هل للدوري الإنجليزي مجلد صور أحدث (premierleague25/26)؟ نفحص أكثر من مسار وأكثر من حجم
import fs from 'fs';
fs.mkdirSync('probe_imgs', { recursive: true });
const ids = { eze: 'p232413', zubimendi: 'p481655', hincapie: 'p448104', gyokeres: 'p224117', konsa: 'p199798', madueke: 'p248857' };
const dirs = ['premierleague', 'premierleague25', 'premierleague26', 'premierleague27'];
const sizes = ['250x250', '110x140', '40x40'];
const out = {};
for (const [k, id] of Object.entries(ids)) {
  out[k] = {};
  for (const d of dirs) for (const s of sizes) {
    const u = `https://resources.premierleague.com/${d}/photos/players/${s}/${id}.png`;
    try { const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0' } }); const b = Buffer.from(await r.arrayBuffer()); out[k][d + '/' + s] = r.status + ' ' + b.length; if (r.ok && s === '250x250') fs.writeFileSync(`probe_imgs/${k}_${d}.png`, b); } catch (e) { out[k][d + '/' + s] = 'err'; }
  }
}
fs.writeFileSync('probe_imgs/report.json', JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));

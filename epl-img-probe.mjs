// ينزّل صور الدوري الإنجليزي الرسمية لبعض لاعبي أرسنال لنفحصها بصرياً
import fs from 'fs';
fs.mkdirSync('probe_imgs', { recursive: true });
const ids = { eze: 'p232413', zubimendi: 'p481655', konsa: 'p199798', hincapie: 'p448104', gyokeres: 'p224117', madueke: 'p248857', rice: 'p204480', merino: 'p195384' };
const out = {};
for (const [k, id] of Object.entries(ids)) {
  const u = `https://ces.premierleague.com/premierleague/photos/players/250x250/${id}.png`;
  try { const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0' } }); const b = Buffer.from(await r.arrayBuffer()); out[k] = r.status + ' ' + b.length; if (r.ok) fs.writeFileSync(`probe_imgs/${k}.png`, b); } catch (e) { out[k] = 'err ' + e.message; }
}
fs.writeFileSync('probe_imgs/report.json', JSON.stringify(out, null, 1)); console.log(out);

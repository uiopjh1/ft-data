// فحص: هل FotMob يعطي صوراً أحسن للاعبي دوري أبطال الخليج؟ (تقرير فقط)
import fs from 'fs';
const H = { 'user-agent': 'Mozilla/5.0', accept: 'application/json' };
const T = [['Abdoulaye Toure', 'Al Nasr'], ['Ramon Mierez', 'Al Nasr'], ['Mevlin', 'Erbil'], ['Victor Henrique', 'Ajman'], ['Ali Hasan', 'Riffa'], ['Said Ben Rahma', 'Neom'], ['Alexandre Lacazette', 'Neom'], ['Evyani Ize', 'Erbil'], ['Valentin Fada', 'Neom'], ['Kwame Bonsu', 'Al Shabab']];
const out = [];
for (const [n, t] of T) {
  const row = { n, t, found: [] };
  try {
    const r = await fetch('https://apigw.fotmob.com/searchapi/suggest?term=' + encodeURIComponent(n) + '&lang=en', { headers: H });
    row.status = r.status;
    if (r.ok) {
      const j = await r.json();
      for (const g of j.squadMemberSuggest || []) for (const o of g.options || []) {
        const [nm, id] = String(o.text || '').split('|');
        row.found.push({ nm, id, p: JSON.stringify(o.payload || {}).slice(0, 160) });
      }
      row.found = row.found.slice(0, 4);
      for (const f of row.found.slice(0, 2)) {
        try {
          const im = await fetch('https://images.fotmob.com/image_resources/playerimages/' + f.id + '.png', { headers: H });
          const b = Buffer.from(await im.arrayBuffer());
          f.img = im.status + ' ' + b.length + 'B ' + (b.length > 24 && b.toString('ascii', 1, 4) === 'PNG' ? b.readUInt32BE(16) + 'x' + b.readUInt32BE(20) : '');
        } catch (e) { f.img = 'err ' + e.message; }
      }
    }
  } catch (e) { row.err = e.message; }
  out.push(row);
}
fs.writeFileSync('gulf_photo_probe.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));

// فحص مصادر صور اللاعبين: ESPN وTransfermarkt وSofascore (الحجم بالبكسل فقط، تقرير)
import fs from 'fs';
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', accept: '*/*' };
const NAMES = ['Abdoulaye Toure', 'Ramon Mierez', 'Victor Henrique', 'Alexandre Lacazette', 'Said Benrahma', 'Kwame Bonsu', 'Ali Hasan Saeed Isa', 'Valentin Vada'];
function dims(b) {
  if (b.length > 24 && b.toString('ascii', 1, 4) === 'PNG') return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20);
  if (b[0] === 0xff && b[1] === 0xd8) { let i = 2; while (i < b.length - 9) { if (b[i] !== 0xff) { i++; continue; } const m = b[i + 1]; if (m >= 0xc0 && m <= 0xc3) return b.readUInt16BE(i + 7) + 'x' + b.readUInt16BE(i + 5); i += 2 + b.readUInt16BE(i + 2); } }
  if (b.toString('ascii', 0, 4) === 'RIFF') return 'webp';
  return '?';
}
async function img(u) { try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(20000) }); const b = Buffer.from(await r.arrayBuffer()); return r.status + ' ' + b.length + 'B ' + (r.ok ? dims(b) : ''); } catch (e) { return 'err ' + e.message; } }
const out = [];
for (const n of NAMES) {
  const row = { n };
  // ESPN
  try {
    const r = await fetch('https://site.web.api.espn.com/apis/search/v2?limit=5&type=player&query=' + encodeURIComponent(n), { headers: UA });
    row.espnStatus = r.status;
    const j = r.ok ? await r.json() : null;
    const items = [];
    for (const g of (j && j.results) || []) for (const c of g.contents || []) items.push(c);
    const soc = items.filter((c) => /soccer/i.test(JSON.stringify(c.defaultLeagueSlug || c.sport || c.link || '')));
    row.espn = (soc.length ? soc : items).slice(0, 2).map((c) => ({ name: c.displayName, sub: c.subtitle, id: c.uid, img: c.image && (c.image.default || c.image) }));
    for (const e of row.espn) if (e.img && typeof e.img === 'string') e.size = await img(e.img);
  } catch (e) { row.espnErr = e.message; }
  // Transfermarkt
  try {
    const r = await fetch('https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query=' + encodeURIComponent(n), { headers: UA });
    row.tmStatus = r.status;
    const h = r.ok ? await r.text() : '';
    const m = [...h.matchAll(/<img[^>]+src="(https:\/\/img\.a\.transfermarkt\.technology\/portrait\/[^"]+)"[^>]*alt="([^"]*)"/g)].slice(0, 2);
    row.tm = [];
    for (const x of m) {
      const small = x[1];
      const big = small.replace('/small/', '/big/');
      row.tm.push({ alt: x[2], small: await img(small), big: await img(big), bigUrl: big });
    }
  } catch (e) { row.tmErr = e.message; }
  out.push(row);
}
fs.writeFileSync('photo_src_probe.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));

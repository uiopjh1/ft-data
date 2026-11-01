import fs from 'fs';
import sharp from 'sharp';
function h(u) { let a = 0x811c9dc5, b = 0x12345678; for (let i = 0; i < u.length; i++) { const c = u.charCodeAt(i); a ^= c; a = Math.imul(a, 0x01000193) >>> 0; b ^= c; b = Math.imul(b, 0x01000193) >>> 0; } return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0'); }
const nz = (s) => { let t = String(s || '').toLowerCase(); try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {} return t.replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); };
const STOP = new Set(['al', 'fc', 'sc', 'fk', 'club', 'the', 'cf', 'ac', 'as', 'ss', 'afc']);
const tk = (s) => nz(s).split(' ').filter((x) => x && !STOP.has(x));
const FILES = ['spl', 'epl', 'bundesliga', 'seriea'];
const bad = [];
for (const f of FILES) for (const p of JSON.parse(fs.readFileSync(f + '_players.json', 'utf8')).players) if (p.img && !fs.existsSync('thumbs/' + h(p.img) + '.webp')) bad.push({ f, ...p });
const H = { 'user-agent': 'Mozilla/5.0', accept: 'application/json', referer: 'https://www.sofascore.com/' };
const rep = { total: bad.length, ok: 0, nomatch: 0, err: 0, sample: [], fails: [] };
async function get(u) { const r = await fetch(u, { headers: H }); if (!r.ok) throw new Error(u.slice(0, 60) + ' ' + r.status); return r; }
async function one(p) {
  try {
    const q = encodeURIComponent(p.en);
    const j = await (await get('https://api.sofascore.com/api/v1/search/players/?q=' + q)).json().catch(() => null)
      || null;
    const res = (j && (j.results || [])).map((x) => x.entity).filter(Boolean);
    const pt = new Set(tk(p.en));
    let best = null;
    for (const e of res) {
      const nt = tk(e.name);
      const nameHit = nt.length && nt.filter((x) => pt.has(x)).length >= Math.min(2, Math.max(1, nt.length - 0));
      const tt = tk(p.teamEn), et = tk(e.team && e.team.name);
      const teamHit = tt.some((x) => et.includes(x));
      if (nameHit && teamHit) { best = e; break; }
    }
    if (!best) { rep.nomatch++; rep.fails.push(p.en + '@' + p.teamEn + ' n=' + res.length); return; }
    const img = Buffer.from(await (await get('https://api.sofascore.app/api/v1/player/' + best.id + '/image')).arrayBuffer());
    const t = await sharp(img).resize({ width: 128 }).webp({ quality: 72 }).toBuffer();
    fs.writeFileSync('thumbs/' + h(p.img) + '.webp', t);
    rep.ok++; if (rep.sample.length < 5) rep.sample.push(p.en + ' -> ' + best.name + ' (' + best.team.name + ')');
  } catch (e) { rep.err++; if (rep.fails.length < 15) rep.fails.push(String(e.message).slice(0, 80)); }
}
let i = 0;
await Promise.all(Array.from({ length: 4 }, async () => { while (i < bad.length) { await one(bad[i++]); await new Promise((r) => setTimeout(r, 150)); } }));
// حدّث الفهرس
const urls = new Set();
for (const f of FILES.concat(['laliga'])) for (const p of JSON.parse(fs.readFileSync(f + '_players.json', 'utf8')).players) if (p.img) urls.add(p.img);
const have = [...urls].map(h).filter((k) => fs.existsSync('thumbs/' + k + '.webp'));
fs.writeFileSync('thumbs_index.json', JSON.stringify({ updated: new Date().toISOString(), h: have }));
fs.writeFileSync('fill_report.json', JSON.stringify(rep, null, 1));

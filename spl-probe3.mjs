import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('spl_probe3', { recursive: true });
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; FT-football-app/1.0)', 'Accept-Language': 'en' };
const get = async (u) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), 25000); try { const r = await fetch(u, { headers: UA, signal: c.signal }); return { s: r.status, x: await r.text() }; } catch (e) { return { s: 0, x: '' }; } finally { clearTimeout(t); } };
const out = {};
for (const [k, u] of [['squad', 'https://www.spl.com.sa/en/teams/al-hilal/squad'], ['squad_ar', 'https://www.spl.com.sa/ar/teams/al-hilal/squad']]) {
  const r = await get(u);
  writeFileSync(`spl_probe3/${k}.html`, r.x.slice(0, 900000));
  out[k] = { status: r.s, len: r.x.length,
    playerImages: [...new Set(r.x.match(/https?:\/\/media-sdp\.spl\.com\.sa\/playerImages\/[^"'\s)\\<]+/g) || [])].slice(0, 60),
    playerLinks: [...new Set(r.x.match(/\/(?:en|ar)\/players\/[^"'\s)\\<]+/g) || [])].slice(0, 60),
    api: [...new Set(r.x.match(/https?:\/\/api-sdp\.spl\.com\.sa[^"'\s)\\<]*/g) || [])].slice(0, 20) };
}
writeFileSync('spl_probe3/summary.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [v.status, v.len, v.playerImages.length, v.playerLinks.length]]))));

import { writeFileSync } from 'node:fs';
const H = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', Accept: '*/*', 'Accept-Language': 'en' };
const get = async (u) => { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 30000); const r = await fetch(u, { headers: H, signal: c.signal }); clearTimeout(t); return { s: r.status, t: await r.text() }; } catch (e) { return { s: 0, t: '' }; } };
const out = { ctx: [], api: [] };
const pg = await get('https://ligue1.com/fr/player-sheet/l1_championship_player_2026_1_103843/statistics');
const chunks = [...new Set(pg.t.match(/\/_next\/static\/[^"'\s]+\.js/g) || [])];
out.chunks = chunks.length;
const seen = new Set();
for (const c of chunks) {
  const r = await get('https://ligue1.com' + c);
  const t = r.t;
  for (const re of [/ligue1\.image/g, /bustPictures|facePictures|fullBodyPictures/g, /api\/v\d|\/graphql|apollo|NEXT_PUBLIC_[A-Z_]+/g, /player-sheet|playerSheet/g]) {
    let m; let n = 0;
    while ((m = re.exec(t)) && n < 4) { n++; const ctx = t.slice(Math.max(0, m.index - 140), m.index + 200).replace(/\s+/g, ' '); const k = ctx.slice(60, 120); if (!seen.has(k)) { seen.add(k); out.ctx.push({ c: c.split('/').pop(), re: String(re), ctx }); } }
  }
}
out.ctx = out.ctx.slice(0, 40);
// SSR de la page statistiques : toutes les données JSON pertinentes
const nd = (pg.t.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/) || [])[1];
out.nd = nd ? nd.slice(0, 2500) : null;
out.htmlImgs = [...new Set(pg.t.match(/https?:\/\/[a-zA-Z0-9.\/_-]*(?:amazonaws|cloudfront|lfp)[a-zA-Z0-9.\/_%?=&-]*/g) || [])].slice(0, 20);
writeFileSync('probe_sites15.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out).slice(0, 2500));

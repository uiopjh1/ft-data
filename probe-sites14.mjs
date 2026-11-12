import { writeFileSync } from 'node:fs';
const H = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', Accept: '*/*', 'Accept-Language': 'en' };
const get = async (u) => { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 30000); const r = await fetch(u, { headers: H, signal: c.signal }); clearTimeout(t); return { s: r.status, t: await r.text() }; } catch (e) { return { s: 0, t: String(e) }; } };
const out = {};
for (const k of ['players', 'clubs']) {
  const r = await get('https://ligue1.com/api/sitemap/sitemap-' + k);
  const locs = (r.t.match(/<loc>[^<]+<\/loc>/g) || []).map((x) => x.slice(5, -6));
  out[k] = { s: r.s, len: r.t.length, n: locs.length, head: r.t.slice(0, 300), sample: locs.slice(0, 6), tail: locs.slice(-3) };
}
const pl = (out.players.sample || [])[0];
out.pages = [];
for (const u of (out.players.sample || []).slice(0, 3)) {
  const r = await get(u);
  const nd = (r.t.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/) || [])[1];
  out.pages.push({ u, s: r.s, len: r.t.length, title: (r.t.match(/<title>([^<]*)/) || [])[1], h1: (r.t.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1], imgs: [...new Set(r.t.match(/https?:\/\/[a-zA-Z0-9./_-]*ligue1\.image[a-zA-Z0-9./_%?=&-]*/g) || [])].slice(0, 10), og: (r.t.match(/<meta property="og:image" content="([^"]+)"/) || [])[1], ndHead: nd ? nd.slice(0, 1500) : null });
}
const cl = (out.clubs.sample || [])[0];
if (cl) { const r = await get(cl); out.clubPage = { u: cl, s: r.s, len: r.t.length, playerLinks: [...new Set(r.t.match(/https:\/\/ligue1\.com\/[a-z]{2}\/players\/[a-z0-9-]+/g) || [])].slice(0, 10), imgs: [...new Set(r.t.match(/https?:\/\/[a-zA-Z0-9./_-]*ligue1\.image[a-zA-Z0-9./_%?=&-]*/g) || [])].slice(0, 6) }; }
writeFileSync('probe_sites14.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out).slice(0, 3000));

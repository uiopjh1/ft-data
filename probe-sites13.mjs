import { writeFileSync } from 'node:fs';
const H = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', Accept: '*/*', 'Accept-Language': 'en' };
const get = async (u, h = {}) => { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 30000); const r = await fetch(u, { headers: { ...H, ...h }, signal: c.signal }); clearTimeout(t); return { s: r.status, t: await r.text() }; } catch (e) { return { s: 0, t: '' }; } };
const out = {};
const pg = await get('https://ligue1.com/en/competitions/ligue1ubereats/clubs');
out.len = pg.t.length;
const bid = (pg.t.match(/"buildId":"([^"]+)"/) || [])[1]; out.buildId = bid;
out.chunks = [...new Set(pg.t.match(/\/_next\/static\/[^"'\s]+\.js/g) || [])];
out.nextData = bid ? (await get(`https://ligue1.com/_next/data/${bid}/en/competitions/ligue1ubereats/clubs.json`)).t.slice(0, 600) : null;
const urls = new Set(); const hints = [];
for (const c of out.chunks.slice(0, 60)) {
  const r = await get('https://ligue1.com' + c);
  for (const m of r.t.match(/https?:\/\/[a-zA-Z0-9./_-]*(?:api|lfp|ligue1|cdn|player|club)[a-zA-Z0-9./_?=&-]*/g) || []) urls.add(m);
  for (const m of r.t.match(/["'`]\/?(?:api|v\d)\/[a-zA-Z0-9/_{}$.-]*(?:player|club|team|squad)[a-zA-Z0-9/_{}$.-]*["'`]/gi) || []) hints.push(m);
}
out.urls = [...urls].slice(0, 80); out.hints = [...new Set(hints)].slice(0, 40);
out.htmlUrls = [...new Set(pg.t.match(/https?:\/\/[a-zA-Z0-9./_-]*(?:api|lfp|cdn|player|squad)[a-zA-Z0-9./_?=&%-]*/g) || [])].slice(0, 40);
writeFileSync('probe_sites13.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out).slice(0, 2500));

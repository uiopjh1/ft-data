import { writeFileSync } from 'node:fs';
const H = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Accept': 'application/json,text/html,*/*', 'Accept-Language': 'en' };
const get = async (u, h = {}) => { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 25000); const r = await fetch(u, { headers: { ...H, ...h }, signal: c.signal }); clearTimeout(t); return { status: r.status, type: r.headers.get('content-type'), len: r.headers.get('content-length'), text: await r.text() }; } catch (e) { return { status: 0, text: '', err: String(e && e.message || e) }; } };
const out = {};
const pg = await get('https://www.laliga.com/en-GB/laliga-easports/clubs');
const rc = JSON.parse(pg.text.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)[1]).runtimeConfig;
const K = { 'Ocp-Apim-Subscription-Key': rc.backendSubscription, 'Origin': 'https://www.laliga.com', 'Referer': 'https://www.laliga.com/' };
const base = rc.backendUrl + '/api/v1'; const sub = 'laliga-easports-2026';
const r = await get(`${base}/players?subscriptionSlug=${sub}&limit=100&offset=0&teamSlug=real-madrid`, K);
const j = JSON.parse(r.text);
out.total = j.total;
const pl = j.players || [];
out.sampleSquad = pl.filter((p) => p.team && p.team.slug === 'real-madrid').slice(0, 3).map((p) => ({ name: p.nickname, squad: JSON.stringify(p.squad).slice(0, 900), keys: Object.keys(p).join(',') }));
out.withTeam = pl.filter((p) => p.team && p.team.slug === 'real-madrid').length;
out.noTeam = pl.filter((p) => !p.team).length;
// find image-like urls anywhere in first 5 players
const urls = [...new Set(JSON.stringify(pl.slice(0, 20)).match(/https?:\\?\/\\?\/[^"\\]+\.(?:png|jpg|jpeg|webp)/g) || [])].map((u) => u.replace(/\\\//g, '/'));
out.imageUrls = urls.filter((u) => !/escudo|shield|barcelona|madrid\.png/i.test(u)).slice(0, 12);
out.imgCheck = [];
for (const u of out.imageUrls.slice(0, 3)) { const x = await get(u); out.imgCheck.push({ u, status: x.status, type: x.type, len: x.len }); }
// team staff / squad endpoint guesses
out.alt = [];
for (const u of [`${base}/teams/real-madrid/squad?subscriptionSlug=${sub}`, `${base}/teams/real-madrid/players?subscriptionSlug=${sub}`, `${base}/players?subscriptionSlug=${sub}&limit=3&offset=0&teamSlug=real-madrid&include=image`]) {
  const x = await get(u, K); out.alt.push({ u: u.replace(base, ''), status: x.status, head: x.text.slice(0, 200) });
}
writeFileSync('probe_sites5.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1).slice(0, 3500));

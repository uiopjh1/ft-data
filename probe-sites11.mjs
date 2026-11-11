import { writeFileSync } from 'node:fs';
const H = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', Accept: 'text/html,application/json,*/*', 'Accept-Language': 'nl' };
const out = {};
const get = async (u) => { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 30000); const r = await fetch(u, { headers: H, signal: c.signal }); clearTimeout(t); return { s: r.status, u: r.url, t: await r.text() }; } catch (e) { return { s: 0, t: '', err: String(e) }; } };
const home = await get('https://eredivisie.nl/vriendenloterijeredivisie/');
const links = [...new Set((home.t.match(/href="([^"#]+)"/g) || []).map((x) => x.slice(6, -1)))];
out.homeLinks = links.filter((l) => /club|speler|player|team|selectie|squad|stats/i.test(l)).slice(0, 60);
out.homeLen = home.t.length;
out.playerImgs = [...new Set(home.t.match(/https:\/\/eredivisie\.b-cdn\.net\/production\/players\/[^"'\s<>]+/g) || [])].slice(0, 5);
out.apiHints = [...new Set(home.t.match(/(?:https?:)?\/\/[^"'\s<>]*(?:api|graphql|json)[^"'\s<>]*/gi) || [])].slice(0, 15);
const clubLink = links.find((l) => /club/i.test(l) && !/\.(png|jpg|css|js)/.test(l));
out.clubLink = clubLink;
if (clubLink) {
  const u = clubLink.startsWith('http') ? clubLink : 'https://eredivisie.nl' + clubLink;
  const c = await get(u);
  out.club = { u, s: c.s, len: c.t.length, imgs: [...new Set(c.t.match(/https:\/\/eredivisie\.b-cdn\.net\/production\/players\/[^"'\s<>]+/g) || [])].slice(0, 40), links: [...new Set((c.t.match(/href="([^"#]+)"/g) || []).map((x) => x.slice(6, -1)))].filter((l) => /speler|player|selectie|squad/i.test(l)).slice(0, 40) };
}
for (const u of ['https://eredivisie.nl/vriendenloterijeredivisie/spelers', 'https://eredivisie.nl/vriendenloterijeredivisie/clubs', 'https://eredivisie.nl/vriendenloterijeredivisie/sitemap.xml', 'https://eredivisie.nl/sitemap.xml']) {
  const r = await get(u); out[u] = { s: r.s, len: r.t.length, final: r.u, head: r.t.slice(0, 200).replace(/\s+/g, ' '), playerImgs: (r.t.match(/production\/players\/[^"'\s<>]+/g) || []).length, urls: (r.t.match(/<loc>[^<]+<\/loc>/g) || []).slice(0, 30) };
}
writeFileSync('probe_sites11.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out).slice(0, 1500));

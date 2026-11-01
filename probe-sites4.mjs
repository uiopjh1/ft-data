import { writeFileSync } from 'node:fs';
const H = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Accept': 'application/json,text/html,*/*', 'Accept-Language': 'en' };
const get = async (u, h = {}) => { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 25000); const r = await fetch(u, { headers: { ...H, ...h }, signal: c.signal, redirect: 'follow' }); clearTimeout(t); return { status: r.status, url: r.url, type: r.headers.get('content-type'), len: r.headers.get('content-length'), text: await r.text() }; } catch (e) { return { status: 0, text: '', err: String(e && e.message || e) }; } };
const out = {};
const pg = await get('https://www.laliga.com/en-GB/laliga-easports/clubs');
const rc = JSON.parse(pg.text.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)[1]).runtimeConfig;
const K = { 'Ocp-Apim-Subscription-Key': rc.backendSubscription, 'Origin': 'https://www.laliga.com', 'Referer': 'https://www.laliga.com/' };
const base = rc.backendUrl + '/api/v1'; const sub = 'laliga-easports-2026';
const first = await get(`${base}/players?subscriptionSlug=${sub}&limit=2&offset=0`, K);
try { const j = JSON.parse(first.text); out.playerKeys = Object.keys(j.players[0]).join(','); out.player0 = JSON.stringify(j.players[0]).slice(0, 1800); } catch (e) { out.playerErr = first.text.slice(0, 300); }
out.filters = [];
for (const q of ['teamSlug=fc-barcelona', 'team=fc-barcelona', 'teamId=4', 'team.slug=fc-barcelona', 'team_slug=fc-barcelona', 'teams=fc-barcelona', 'currentTeam=fc-barcelona', 'status=active&teamSlug=fc-barcelona']) {
  const r = await get(`${base}/players?subscriptionSlug=${sub}&limit=60&offset=0&${q}`, K);
  let o = { q, status: r.status };
  try { const j = JSON.parse(r.text); o.total = j.total; o.n = (j.players || []).length; o.names = (j.players || []).slice(0, 4).map((p) => p.nickname + '@' + (p.team && p.team.slug)); o.teamsSeen = [...new Set((j.players || []).map((p) => p.team && p.team.slug))].slice(0, 6); } catch (e) { o.head = r.text.slice(0, 200); }
  out.filters.push(o);
}
// Serie A
out.seriea = [];
for (const u of ['https://api-sdp.legaseriea.it/v1/', 'https://api-sdp.legaseriea.it/v1/competitions', 'https://api-sdp.legaseriea.it/v1/teams', 'https://api-sdp.legaseriea.it/v1/players']) {
  const r = await get(u, { Origin: 'https://en.legaseriea.it', Referer: 'https://en.legaseriea.it/' });
  out.seriea.push({ u, status: r.status, type: r.type, head: r.text.slice(0, 300) });
}
const sa = await get('https://en.legaseriea.it/');
out.saHome = { status: sa.status, title: (sa.text.match(/<title>([^<]*)/) || [])[1], hrefs: [...new Set([...sa.text.matchAll(/href="([^"#]+)"/g)].map((x) => x[1]))].slice(0, 30), head: sa.text.slice(0, 300).replace(/\s+/g, ' ') };
writeFileSync('probe_sites4.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1).slice(0, 3000));

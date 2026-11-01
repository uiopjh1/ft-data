import { writeFileSync } from 'node:fs';
const H = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Accept': 'application/json,text/html,*/*', 'Accept-Language': 'en' };
const get = async (u, h = {}) => { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 25000); const r = await fetch(u, { headers: { ...H, ...h }, signal: c.signal, redirect: 'follow' }); clearTimeout(t); return { status: r.status, url: r.url, type: r.headers.get('content-type'), text: await r.text() }; } catch (e) { return { status: 0, text: '', err: String(e && e.message || e) }; } };
const out = {};
const pg = await get('https://www.laliga.com/en-GB/laliga-easports/clubs');
const nd = JSON.parse(pg.text.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)[1]);
const pp = nd.props.pageProps; const rc = nd.runtimeConfig;
out.season = pp.season; out.seasons = (pp.seasons || []).slice(0, 4); out.competition = pp.competition && { slug: pp.competition.slug, name: pp.competition.name };
out.team0 = pp.teams && pp.teams[0] && { keys: Object.keys(pp.teams[0]).join(','), slug: pp.teams[0].slug, name: pp.teams[0].name, shortName: pp.teams[0].shortname || pp.teams[0].nickname };
out.teamCount = (pp.teams || []).length;
const K = { 'Ocp-Apim-Subscription-Key': rc.backendSubscription, 'Origin': 'https://www.laliga.com', 'Referer': 'https://www.laliga.com/' };
const base = rc.backendUrl + '/api/v1';
const sub = (pp.season && (pp.season.slug || pp.season.subscription && pp.season.subscription.slug)) || 'laliga-easports-2026';
out.sub = sub;
const tries = [
  `${base}/teams?subscriptionSlug=${sub}&limit=30&offset=0&orderField=nickname&orderType=ASC`,
  `${base}/subscriptions/${sub}/teams?limit=30&offset=0`,
  `${base}/players?subscriptionSlug=${sub}&limit=5&offset=0&orderField=fullName&orderType=ASC`,
  `${base}/subscriptions/${sub}/players?limit=5&offset=0`,
  `${base}/teams/fc-barcelona/players?subscriptionSlug=${sub}&limit=50&offset=0`,
  `${base}/teams/fc-barcelona?subscriptionSlug=${sub}`,
  `${base}/subscriptions/${sub}/teams/fc-barcelona/players?limit=50&offset=0`,
];
out.api = [];
for (const u of tries) { const r = await get(u, K); out.api.push({ u: u.replace(base, ''), status: r.status, head: r.text.slice(0, 500) }); }
// Serie A follow
const sa = await get('https://en.legaseriea.it/');
out.seriea = { status: sa.status, url: sa.url, len: sa.text.length, next: /__NEXT_DATA__/.test(sa.text), hrefs: [...new Set([...sa.text.matchAll(/href="([^"#]+)"/g)].map((x) => x[1]).filter((h) => /team|club|squadr|player/i.test(h)))].slice(0, 15) };
const sb = await get('https://en.legaseriea.it/serie-a/clubs');
out.seriea2 = { status: sb.status, url: sb.url, len: sb.text.length, apis: [...new Set(sb.text.match(/https?:\/\/[^"'\s\\<>]*(?:api|json|feed|cdn)[^"'\s\\<>]*/gi) || [])].slice(0, 15), imgs: [...new Set(sb.text.match(/https?:\/\/[^"'\s\\]+(?:player|calciator)[^"'\s\\]*\.(?:png|jpg|webp)/gi) || [])].slice(0, 8) };
// Ligue 1 next data
const l1 = await get('https://ligue1.com/');
const m = l1.text.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
out.ligue1 = { status: l1.status, hasNext: !!m };
if (m) { const j = JSON.parse(m[1]); out.ligue1.buildId = j.buildId; out.ligue1.pageProps = Object.keys((j.props && j.props.pageProps) || {}); out.ligue1.runtime = JSON.stringify(j.runtimeConfig || {}).slice(0, 400); out.ligue1.urls = [...new Set(m[1].match(/https?:\/\/[^"\\]+/g) || [])].filter((u) => /api|club|player|team/i.test(u)).slice(0, 20); }
writeFileSync('probe_sites3.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1).slice(0, 2500));

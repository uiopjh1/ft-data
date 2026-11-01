import { writeFileSync } from 'node:fs';
const H = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Accept': 'text/html,application/json,*/*', 'Accept-Language': 'en' };
const get = async (u, h = {}, manual = false) => {
  try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 25000); const r = await fetch(u, { headers: { ...H, ...h }, signal: c.signal, redirect: manual ? 'manual' : 'follow' }); clearTimeout(t); return { status: r.status, loc: r.headers.get('location'), url: r.url, text: await r.text() }; } catch (e) { return { status: 0, text: '', err: String(e && e.message || e) }; }
};
const out = {};
// LaLiga
{
  const r = await get('https://www.laliga.com/en-GB/laliga-easports/clubs');
  const m = r.text.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  const o = { status: r.status };
  if (m) {
    o.nextLen = m[1].length;
    const j = JSON.parse(m[1]);
    o.topKeys = Object.keys(j); o.pagePropsKeys = Object.keys((j.props && j.props.pageProps) || {});
    o.runtime = JSON.stringify(j.runtimeConfig || j.props && j.props.runtimeConfig || {}).slice(0, 600);
    const s = m[1];
    o.keyHits = [...new Set([...s.matchAll(/"([^"]*(?:key|Key|KEY|subscription)[^"]*)"\s*:\s*"([^"]{6,80})"/g)].map((x) => x[1] + '=' + x[2]))].slice(0, 20);
    o.teamSample = (s.match(/"slug":"[a-z0-9-]+"/g) || []).slice(0, 25);
    o.imgSample = [...new Set(s.match(/https?:\/\/[^"\\]+\.(?:png|webp|jpg)/g) || [])].slice(0, 10);
  }
  o.scriptSrcs = [...new Set([...r.text.matchAll(/<script[^>]*src="([^"]+)"/g)].map((x) => x[1]))].slice(0, 30);
  out.laliga = o;
  // try the public API without key
  const a = await get('https://apim.laliga.com/public-service/api/v1/teams?subscriptionSlug=laliga-easports-2026&limit=30&offset=0&orderField=nickname&orderType=ASC');
  out.laligaApiNoKey = { status: a.status, body: a.text.slice(0, 300) };
}
// Bundesliga
{
  const r = await get('https://www.bundesliga.com/en/bundesliga/clubs/fc-bayern-muenchen');
  const t = r.text;
  out.bundesliga = {
    status: r.status,
    playerImgs: [...new Set(t.match(/https?:\/\/[^"'\s\\]+(?:player|portrait|kader|squad|face)[^"'\s\\]*\.(?:png|jpg|webp)/gi) || [])].slice(0, 12),
    allImgHosts: [...new Set([...t.matchAll(/https?:\/\/([^\/"'\s\\]+)\/[^"'\s\\]*\.(?:png|jpg|webp)/gi)].map((x) => x[1]))].slice(0, 15),
    squadHints: [...t.matchAll(/.{80}(?:squad|Squad|kader)[^"]{0,80}/g)].slice(0, 6).map((x) => x[0]),
    playerLinks: [...new Set(t.match(/\/en\/bundesliga\/players\/[a-z0-9-]+/g) || [])].slice(0, 15),
    nextData: /__NEXT_DATA__/.test(t),
  };
  const a = await get('https://www.bundesliga.com/en/bundesliga/clubs/fc-bayern-muenchen/squad');
  out.bundesligaSquad = { status: a.status, len: a.text.length, playerLinks: [...new Set(a.text.match(/\/en\/bundesliga\/players\/[a-z0-9-]+/g) || [])].length };
}
// Serie A
{
  const r = await get('https://www.legaseriea.it/en/serie-a/clubs', {}, true);
  out.seriea = { status: r.status, loc: r.loc, head: r.text.slice(0, 300) };
}
// Ligue 1 / LFP
{
  const r = await get('https://www.lfp.fr/1-team-hub');
  out.lfp = { status: r.status, len: r.text.length, title: (r.text.match(/<title>([^<]*)/) || [])[1], hrefs: [...new Set([...r.text.matchAll(/href="([^"#]+)"/g)].map((x) => x[1]).filter((h) => /player|joueur|club|team/i.test(h)))].slice(0, 15), apis: [...new Set(r.text.match(/https?:\/\/[^"'\s\\<>]*(?:api|json|feed)[^"'\s\\<>]*/gi) || [])].slice(0, 15) };
}
writeFileSync('probe_sites2.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1).slice(0, 3000));

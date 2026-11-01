import { writeFileSync } from 'node:fs';
const H = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Accept': '*/*', 'Accept-Language': 'en' };
const get = async (u, h = {}) => { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 30000); const r = await fetch(u, { headers: { ...H, ...h }, signal: c.signal, redirect: 'follow' }); clearTimeout(t); return { status: r.status, url: r.url, text: await r.text() }; } catch (e) { return { status: 0, text: '', err: String(e && e.message || e) }; } };
const uniq = (a) => [...new Set(a)];
const out = {};
async function scan(name, pageUrl, extra = {}) {
  const o = { page: pageUrl };
  const pg = await get(pageUrl, extra);
  o.status = pg.status; o.final = pg.url; o.len = pg.text.length;
  const base = new URL(pg.url || pageUrl);
  const scripts = uniq([...pg.text.matchAll(/<script[^>]*\ssrc=["']([^"']+\.js[^"']*)["']/g)].map((m) => { try { return new URL(m[1], base).href; } catch (e) { return null; } }).filter(Boolean));
  o.scriptCount = scripts.length;
  o.found = [];
  const pat = /https?:\/\/[A-Za-z0-9._\-]+(?:\/[A-Za-z0-9._~:\/?#\[\]@!$&'()*+,;=%\-{}]*)?/g;
  const texts = [pg.text];
  for (const sUrl of scripts.slice(0, 18)) { const r = await get(sUrl); if (r.status === 200) texts.push(r.text); }
  const all = texts.join('\n');
  o.totalChars = all.length;
  o.apiUrls = uniq((all.match(pat) || []).filter((u) => /api|sdp|dfl|feed|squad|player|team|club|graphql/i.test(u) && !/googletag|doubleclick|facebook|twitter|cookielaw|schema\.org|w3\.org|cloudflare|youtube|instagram|google|linkedin/i.test(u))).slice(0, 60);
  o.pathHints = uniq((all.match(/["'`]\/(?:api|v\d)\/[A-Za-z0-9_\-\/{}$.]+/g) || [])).slice(0, 40);
  out[name] = o;
  console.log(name, o.status, o.scriptCount, o.apiUrls.length);
}
await scan('bundesliga', 'https://www.bundesliga.com/en/bundesliga/clubs/fc-bayern-muenchen');
await scan('seriea', 'https://en.legaseriea.it/', { Referer: 'https://www.google.com/' });
await scan('ligue1', 'https://ligue1.com/');
writeFileSync('probe_sites6.json', JSON.stringify(out, null, 1));

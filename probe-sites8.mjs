import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const get = async (u, h = {}) => { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 30000); const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: '*/*', ...h }, signal: c.signal }); clearTimeout(t); return { status: r.status, text: await r.text(), url: r.url }; } catch (e) { return { status: 0, text: '', err: String(e && e.message || e) }; } };
const out = {};
async function bundles(name, pageUrl, pats, maxScripts = 70) {
  const pg = await get(pageUrl, { Referer: 'https://www.google.com/' });
  const base = new URL(pg.url || pageUrl);
  const scripts = [...new Set([...pg.text.matchAll(/(?:src|href)=["']([^"']+\.js[^"']*)["']/g)].map((m) => { try { return new URL(m[1], base).href; } catch (e) { return null; } }).filter(Boolean))];
  const o = { status: pg.status, scripts: scripts.length, ctx: {} };
  pats.forEach((p) => { o.ctx[p] = []; });
  for (const su of scripts.slice(0, maxScripts)) {
    const r = await get(su);
    if (r.status !== 200) continue;
    for (const p of pats) {
      let i = -1, k = 0;
      while ((i = r.text.indexOf(p, i + 1)) >= 0 && k < 2 && o.ctx[p].length < 6) { o.ctx[p].push(r.text.slice(Math.max(0, i - 200), i + 300).replace(/\s+/g, ' ')); k++; }
    }
  }
  out[name] = o; console.log(name, o.scripts);
}
await bundles('seriea', 'https://en.legaseriea.it/', ['api-sdp.legaseriea.it', '/api/sports/', 'media-sdp', 'x-api-key', 'Ocp-Apim', 'squad', 'players']);
await bundles('ligue1', 'https://ligue1.com/en', ['ligue1.fr', 'ma-api', 'api.ligue1', '/players', 'x-api-key', 'baseURL', 'NEXT_PUBLIC_']);
// candidate hosts for Ligue 1
out.l1hosts = [];
for (const u of ['https://ma-api.ligue1.fr/', 'https://api.ligue1.fr/', 'https://ligue1.com/api/', 'https://ligue1.com/en/players', 'https://ligue1.com/en/clubs/psg', 'https://ligue1.com/clubs/paris-saint-germain']) { const r = await get(u); out.l1hosts.push({ u, status: r.status, head: r.text.slice(0, 120).replace(/\s+/g, ' ') }); }
writeFileSync('probe_sites8.json', JSON.stringify(out, null, 1));

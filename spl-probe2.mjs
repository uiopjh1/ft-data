import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('spl_probe2', { recursive: true });
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; FT-football-app/1.0)', 'Accept-Language': 'en' };
const get = async (u) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), 20000); try { const r = await fetch(u, { headers: UA, signal: c.signal }); const x = await r.text(); return { s: r.status, x }; } catch (e) { return { s: 0, x: '' }; } finally { clearTimeout(t); } };
const out = { team: {}, js: {}, tries: {} };
const t = await get('https://www.spl.com.sa/en/teams/al-hilal/');
out.team.status = t.s; out.team.len = t.x.length;
writeFileSync('spl_probe2/al-hilal.html', t.x.slice(0, 600000));
out.team.media = [...new Set(t.x.match(/https?:\/\/media-sdp\.spl\.com\.sa[^"'\s)\\<]+/g) || [])].slice(0, 40);
out.team.playerLinks = [...new Set(t.x.match(/\/en\/players\/[^"'\s)\\<]+/g) || [])].slice(0, 60);
out.team.sdpRefs = [...new Set(t.x.match(/[^"'\s]{0,60}(?:squad|players)[^"'\s]{0,60}/gi) || [])].slice(0, 40);
const html = (await get('https://www.spl.com.sa/en/players')).x;
const chunks = [...new Set((html.match(/\/en\/_next\/static\/chunks\/[^"']+\.js/g) || []))];
out.js.count = chunks.length;
const hits = new Set();
for (const c of chunks) {
  const r = await get('https://www.spl.com.sa' + c);
  const x = r.x;
  for (const m of x.matchAll(/[`"']([^`"'\n]{0,80}(?:football|\/players?\/|squad|persons?\/)[^`"'\n]{0,100})[`"']/gi)) if (/\{|\$|\/|:/.test(m[1]) && m[1].length < 180) hits.add(m[1]);
}
out.js.paths = [...hits].slice(0, 150);
writeFileSync('spl_probe2/summary.json', JSON.stringify(out, null, 1));
console.log('done', chunks.length, hits.size);

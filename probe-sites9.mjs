import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const out = [];
const H = { 'User-Agent': UA, Accept: 'application/json,text/html,*/*', 'Accept-Language': 'en' };
for (const u of [
  'https://en.legaseriea.it/api/sports/players', 'https://en.legaseriea.it/api/sports/teams', 'https://en.legaseriea.it/api/sports/stadiums',
  'https://www.legaseriea.it/api/sports/players', 'https://www.legaseriea.it/api/sports/teams', 'https://www.legaseriea.it/it', 'https://www.legaseriea.it/it/serie-a/squadre', 'https://www.legaseriea.it/en/serie-a/clubs',
  'https://it.legaseriea.it/', 'https://legaseriea.it/', 'https://en.legaseriea.it/en', 'https://en.legaseriea.it/serie-a/teams', 'https://en.legaseriea.it/teams/inter',
]) {
  const r = { u };
  try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 30000); const res = await fetch(u, { headers: H, signal: c.signal, redirect: 'follow' }); clearTimeout(t); const tx = await res.text(); r.status = res.status; r.final = res.url; r.type = res.headers.get('content-type'); r.len = tx.length; r.head = tx.slice(0, 250).replace(/\s+/g, ' '); r.nextErr = /__next_error__/.test(tx); r.imgs = [...new Set(tx.match(/https?:\/\/[^"'\s\\]*(?:player|calciator|squad)[^"'\s\\]*\.(?:png|jpg|webp)/gi) || [])].slice(0, 4); } catch (e) { r.err = String(e && e.message || e); }
  out.push(r); console.log(u, r.status, r.len, r.nextErr ? 'NEXTERR' : '');
}
writeFileSync('probe_sites9.json', JSON.stringify(out, null, 1));

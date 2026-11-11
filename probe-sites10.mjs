import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const out = [];
const H = { 'User-Agent': UA, Accept: 'application/json,text/html,*/*', 'Accept-Language': 'en' };
for (const u of [
  'https://ligue1.com/', 'https://ligue1.com/en', 'https://ligue1.com/en/clubs', 'https://ligue1.com/clubs', 'https://ligue1.com/players', 'https://ligue1.com/en/players',
  'https://www.ligue1.com/', 'https://www.ligue1.com/en/clubs', 'https://ligue1.com/en/clubs/paris-saint-germain', 'https://ligue1.com/clubs/paris-saint-germain',
  'https://www.eredivisie.nl/', 'https://www.ligaportugal.pt/en/', 'https://www.tff.org/',
]) {
  const r = { u };
  try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 30000); const res = await fetch(u, { headers: H, signal: c.signal, redirect: 'follow' }); clearTimeout(t); const tx = await res.text(); r.status = res.status; r.final = res.url; r.type = res.headers.get('content-type'); r.len = tx.length; r.head = tx.slice(0, 250).replace(/\s+/g, ' '); r.imgs = [...new Set(tx.match(/https?:\/\/[^"'\s\\]*(?:player|joueur|squad|portrait)[^"'\s\\]*\.(?:png|jpg|jpeg|webp)/gi) || [])].slice(0, 6); r.apis = [...new Set(tx.match(/https?:\/\/[^"'\s\\]*(?:api|cdn|media)[^"'\s\\]*/gi) || [])].slice(0, 8); } catch (e) { r.err = String(e && e.message || e); }
  out.push(r); console.log(u, r.status, r.len);
}
writeFileSync('probe_sites10.json', JSON.stringify(out, null, 1));

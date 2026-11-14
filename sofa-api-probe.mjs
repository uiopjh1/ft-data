import fs from 'fs';
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', accept: 'application/json' };
const urls = [
  'https://api.sofascore.com/api/v1/unique-tournament/955/seasons',
  'https://api.sofascore.com/api/v1/player/350060',
  'https://api.sofascore.com/api/v1/search/all?q=%D8%A3%D8%AD%D9%85%D8%AF%20%D8%B9%D8%B3%D9%8A%D8%B1%D9%8A&page=0',
  'https://api.sofascore.app/api/v1/player/350060',
  'https://www.sofascore.com/api/v1/player/350060',
];
const out = {};
for (const u of urls) {
  try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(20000) }); const t = await r.text(); out[u] = r.status + ' ' + t.slice(0, 80); }
  catch (e) { out[u] = 'err ' + e.message; }
}
fs.writeFileSync('sofa_api_probe.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));

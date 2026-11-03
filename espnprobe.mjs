import fs from 'fs';
const out = {};
for (const u of ['https://site.api.espn.com/apis/v2/sports/soccer/afc.cup/standings', 'https://site.api.espn.com/apis/site/v2/sports/soccer/afc.cup/teams?limit=100']) {
  try { const r = await fetch(u); const j = await r.json(); const s = JSON.stringify(j); const hits = []; const re = /\{[^{}]*"(?:displayName|name)":"[^"]*(?:Khald|Faisal)[^"]*"[^{}]*\}/gi; let m; while ((m = re.exec(s))) hits.push(m[0].slice(0, 500)); out[u] = { s: r.status, hits }; } catch (e) { out[u] = String(e.message); }
}
fs.writeFileSync('espnprobe_result.json', JSON.stringify(out, null, 1));

import fs from 'fs';
const r = await fetch('https://site.api.espn.com/apis/v2/sports/soccer/afc.cup/standings'); const j = await r.json();
const out = [];
for (const g of j.children || []) for (const e of (g.standings && g.standings.entries) || []) { const t = e.team || {}; out.push([g.name, t.id, t.displayName, t.abbreviation, (t.logos && t.logos[0] && t.logos[0].href) || (t.logo || '')]); }
fs.writeFileSync('espnprobe_result.json', JSON.stringify(out));

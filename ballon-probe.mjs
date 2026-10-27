import { writeFileSync } from 'node:fs';
const H = { 'user-agent': 'Mozilla/5.0' };
const g = async (u, f) => { const r = await fetch(u, { headers: H }); const t = await r.text(); console.log(r.status, u, t.length); writeFileSync(f, t); };
await g('https://site.web.api.espn.com/apis/common/v3/sports/soccer/athletes/142200/gamelog?season=2025', 'probe-gamelog.json');
await g('https://site.web.api.espn.com/apis/common/v3/sports/soccer/athletes/142200/stats', 'probe-stats.json');

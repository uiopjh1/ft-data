import { writeFileSync } from 'node:fs';
const H = { 'user-agent': 'Mozilla/5.0' };
const j = async (u) => { const r = await fetch(u, { headers: H }); return r.ok ? r.json() : { __status: r.status }; };
const B = 'https://site.web.api.espn.com/apis/common/v3/sports/soccer/athletes/142200';
// كأس العالم 2026: أحداث كين مع إنجلترا
const gl = await j(`${B}/gamelog?season=2026&league=fifa.world&team=448`);
const evs = [];
const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (Array.isArray(o.events) && o.events[0] && o.events[0].eventId) evs.push(...o.events); Object.values(o).forEach(walk); } };
walk(gl.seasonTypes);
let out = `events ${evs.length}\n`;
for (const e of evs) {
  const meta = gl.events[e.eventId];
  const s = await j(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${e.eventId}`);
  out += `\n## ${e.eventId} ${meta && meta.gameDate} status=${s.__status || 'ok'}\n`;
  const rosters = s.rosters || [];
  for (const r of rosters) for (const p of r.roster || []) if (p.athlete && String(p.athlete.id) === '142200') out += JSON.stringify({ starter: p.starter, subbedIn: p.subbedIn, subbedOut: p.subbedOut, stats: (p.stats || []).slice(0, 4), keys: Object.keys(p) }) + '\n';
  if (e === evs[0]) out += 'ROSTER SAMPLE ' + JSON.stringify((rosters[0] && rosters[0].roster || []).slice(0, 2)).slice(0, 1800) + '\n';
}
writeFileSync('probe-out.txt', out);

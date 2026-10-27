import { writeFileSync } from 'node:fs';
const H = { 'user-agent': 'Mozilla/5.0' };
let out = '';
const B = 'https://site.web.api.espn.com/apis/common/v3/sports/soccer/athletes/142200';
for (const q of ['stats?season=2025&league=ger.1', 'stats?season=2025', 'stats?league=uefa.champions&season=2025', 'gamelog?season=2025&league=ger.1', 'gamelog?season=2025&league=uefa.champions']) {
  const r = await fetch(`${B}/${q}`, { headers: H });
  const j = await r.json().catch(() => null);
  out += `\n## ${r.status} ${q}\n`;
  if (!j) continue;
  if (j.categories) for (const c of j.categories) for (const s of c.statistics || []) out += `${c.displayName} team=${s.teamSlug} league=${s.leagueSlug} season=${s.season && s.season.year} stats=${JSON.stringify(s.stats)} labels=${c.labels}\n`;
  if (j.seasonTypes) for (const st of j.seasonTypes) for (const c of st.categories) out += `${st.displayName}/${c.displayName} n=${(c.events||[]).length} totals=${JSON.stringify(c.totals)}\n`;
  out += 'filters=' + JSON.stringify((j.filters || []).map((f) => [f.name, f.value])) + '\n';
}
writeFileSync('probe-out.txt', out);

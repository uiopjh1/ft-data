import { writeFileSync } from 'node:fs';
const H = { 'user-agent': 'Mozilla/5.0', accept: 'application/json' };
const out = {};
const get = async (k, url) => {
  try {
    const r = await fetch(url, { headers: H });
    const t = await r.text();
    out[k] = { status: r.status, head: t.slice(0, 700) };
    try { return JSON.parse(t); } catch (e) { return null; }
  } catch (e) { out[k] = { err: String(e) }; return null; }
};
const s = await get('search', 'https://api.sofascore.com/api/v1/search/all?q=' + encodeURIComponent('Africa Cup of Nations Qualification') + '&page=0');
const ut = ((s && s.results) || []).filter((r) => r.type === 'uniqueTournament').map((r) => ({ id: r.entity.id, name: r.entity.name, cat: r.entity.category && r.entity.category.name }));
out.uniqueTournaments = ut;
const hit = ut.find((x) => /qualif/i.test(x.name));
if (hit) {
  const se = await get('seasons', `https://api.sofascore.com/api/v1/unique-tournament/${hit.id}/seasons`);
  const sid = se && se.seasons && se.seasons[0] && se.seasons[0].id;
  out.season = se && se.seasons && se.seasons[0];
  if (sid) {
    await get('topPlayers', `https://api.sofascore.com/api/v1/unique-tournament/${hit.id}/season/${sid}/top-players/overall`);
    await get('topPlayersGoals', `https://api.sofascore.com/api/v1/unique-tournament/${hit.id}/season/${sid}/top-players/goals`);
  }
}
await get('espnCore', 'https://sports.core.api.espn.com/v2/sports/soccer/leagues/caf.nations_qual/seasons/2026/leaders');
await get('espnCore2', 'https://sports.core.api.espn.com/v2/sports/soccer/leagues/caf.nations_qual/leaders');
await get('espnSite', 'https://site.api.espn.com/apis/site/v2/sports/soccer/caf.nations_qual/statistics');
writeFileSync('probe_afq.json', JSON.stringify(out, null, 1));

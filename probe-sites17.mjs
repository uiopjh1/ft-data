import { writeFileSync } from 'node:fs';
const H = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', Accept: 'application/json,*/*', 'Accept-Language': 'en' };
const get = async (u) => { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 30000); const r = await fetch(u, { headers: H, signal: c.signal }); clearTimeout(t); return { s: r.status, t: await r.text() }; } catch (e) { return { s: 0, t: String(e) }; } };
const out = { paths: [], tests: [] };
const pg = await get('https://ligue1.com/fr/club-sheet/l1_championship_club_2026_1/squad');
const chunks = [...new Set(pg.t.match(/\/_next\/static\/[^"'\s]+\.js/g) || [])];
const paths = new Set();
for (const c of chunks) {
  const t = (await get('https://ligue1.com' + c)).t;
  for (const m of t.match(/\.(?:get|post)\(\s*[`"']\/[a-zA-Z0-9\/_${}.\-]*(?:club|player|squad|championship)[a-zA-Z0-9\/_${}.\-]*/g) || []) paths.add(m.replace(/^\.(get|post)\(\s*/, '$1 '));
  for (const m of t.match(/[`"']\/(?:championship|club|player)[a-zA-Z0-9\/_${}.\-]{3,90}[`"']/g) || []) paths.add(m);
}
out.paths = [...paths].slice(0, 80);
const base = 'https://ma-api.ligue1.fr';
const club = 'l1_championship_club_2026_1';
for (const p of ['/championship-clubs', '/championships', '/championship-players/' + club, '/championship-club/' + club, '/championship-clubs/' + club, '/championship-clubs/' + club + '/players', '/championship-clubs/' + club + '/squad', '/championship-players?clubId=' + club, '/championship-player/l1_championship_player_2026_1_103843', '/championship-players/l1_championship_player_2026_1_103843']) {
  const r = await get(base + p);
  out.tests.push({ p, s: r.s, head: r.t.slice(0, 300) });
}
writeFileSync('probe_sites17.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out).slice(0, 3500));

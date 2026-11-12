import { writeFileSync } from 'node:fs';
const H = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', Accept: 'application/json,*/*' };
const get = async (u) => { try { const r = await fetch(u, { headers: H }); return { s: r.status, t: await r.text() }; } catch (e) { return { s: 0, t: String(e) }; } };
const base = 'https://ma-api.ligue1.fr';
const out = {};
const p = await get(base + '/championship-player/l1_championship_player_2026_1_103843');
out.player = p.t.slice(0, 5000);
const c = await get(base + '/championship-club/l1_championship_club_2026_1');
out.club = c.t.slice(0, 5000);
const cs = await get(base + '/championship-clubs');
try { const j = JSON.parse(cs.t); const ks = Object.keys(j.championshipsClubs || {}); out.clubsN = ks.length; out.clubIds = ks.slice(0, 100); out.clubsTop = Object.keys(j); } catch (e) { out.clubsErr = String(e); }
const pool = await get(base + '/championship-players-pool/1/best-players');
out.pool = pool.s + ' ' + pool.t.slice(0, 800);
for (const q of ['/championship-players-pool/1', '/championship-players-pool/l1_championship_club_2026_1', '/championship-club-players/l1_championship_club_2026_1', '/championship-squad/l1_championship_club_2026_1', '/championship-players/1', '/championship-players']) {
  const r = await get(base + q); out['t ' + q] = r.s + ' ' + r.t.slice(0, 200).replace(/\s+/g, ' ');
}
writeFileSync('probe_sites18.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out).slice(0, 3000));

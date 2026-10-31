import { writeFileSync } from 'node:fs';
const H = { 'User-Agent': 'Mozilla/5.0 (compatible; FT-football-app/1.0)', 'Accept': 'application/json', 'Origin': 'https://www.premierleague.com', 'Referer': 'https://www.premierleague.com/' };
const out = {};
async function gj(u) { const r = await fetch(u, { headers: H }); const t = await r.text(); return { status: r.status, body: t }; }
const cs = await gj('https://footballapi.pulselive.com/football/competitions/1/compseasons');
out.compseasons = cs.status; let list = []; try { list = JSON.parse(cs.body).content || []; } catch (e) {}
out.latestSeasons = list.slice(0, 3).map((x) => ({ id: x.id, label: x.label }));
const sid = list[0] && list[0].id; out.sid = sid;
const tm = await gj(`https://footballapi.pulselive.com/football/teams?pageSize=30&compSeasons=${sid}&altIds=true`);
out.teamsStatus = tm.status; let teams = []; try { teams = JSON.parse(tm.body).content || []; } catch (e) {}
out.teams = teams.map((t) => ({ id: t.id, name: t.name && t.name.label || t.club && t.club.name })).slice(0, 25);
const t0 = teams[0];
if (t0) {
  const sq = await gj(`https://footballapi.pulselive.com/football/teams/${t0.id}/compseasons/${sid}/staff?altIds=true`);
  out.squadStatus = sq.status; let pl = []; try { pl = JSON.parse(sq.body).players || []; } catch (e) {}
  out.squadN = pl.length;
  out.samplePlayers = pl.slice(0, 4).map((p) => ({ name: p.name && p.name.display, id: p.id, altIds: p.altIds, keys: Object.keys(p).join(',') }));
  out.photos = [];
  for (const p of pl.slice(0, 4)) {
    const opta = p.altIds && p.altIds.opta;
    if (!opta) continue;
    for (const size of ['250x250', '110x140']) {
      const u = `https://resources.premierleague.com/premierleague/photos/players/${size}/${opta}.png`;
      try { const r = await fetch(u, { headers: H }); out.photos.push({ name: p.name && p.name.display, u, status: r.status, type: r.headers.get('content-type'), len: r.headers.get('content-length') }); } catch (e) { out.photos.push({ u, error: String(e) }); }
    }
  }
}
writeFileSync('probe_epl.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));

// صور لاعبي الدوري الإنجليزي الممتاز الرسمية من واجهة الرابطة → epl_players.json (نفس صيغة spl_players.json)
import { writeFileSync, existsSync } from 'node:fs';
const H = { 'User-Agent': 'Mozilla/5.0 (compatible; FT-football-app/1.0; +github.com/uiopjh1/ft-data)', Accept: 'application/json', Origin: 'https://www.premierleague.com', Referer: 'https://www.premierleague.com/' };
const API = 'https://footballapi.pulselive.com/football';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function gj(u, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
      const r = await fetch(u, { headers: H, signal: ctrl.signal }); clearTimeout(t);
      if (r.ok) return await r.json();
    } catch (e) { /* إعادة */ }
    await sleep(1500 * (i + 1));
  }
  return null;
}
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cs = await gj(`${API}/competitions/1/compseasons`);
const season = cs && (cs.content || [])[0];
if (!season) { console.log('no season'); process.exit(1); }
console.log('season', season.id, season.label);
const tm = await gj(`${API}/teams?pageSize=40&compSeasons=${season.id}&altIds=true`);
const teams = ((tm && tm.content) || []).map((t) => ({ id: t.id, name: (t.name && t.name.label) || (t.club && t.club.name) || '' })).filter((t) => t.name);
console.log('teams', teams.length);
const players = [];
const seen = new Set();
for (const t of teams) {
  const sq = await gj(`${API}/teams/${t.id}/compseasons/${season.id}/staff?altIds=true`);
  const list = (sq && sq.players) || [];
  list.forEach((p) => {
    const opta = p.altIds && p.altIds.opta;
    const en = p.name && p.name.display;
    if (!opta || !en) return;
    const k = opta + '|' + t.id;
    if (seen.has(k)) return;
    seen.add(k);
    players.push({ slug: slug(en), en, ar: '', team: slug(t.name), teamEn: t.name, img: `https://resources.premierleague.com/premierleague/photos/players/250x250/${opta}.png` });
  });
  console.log(t.name, list.length);
  await sleep(300);
}
console.log('players', players.length);
if (teams.length < 15 || players.length < 400) { console.log('too few, not writing'); process.exit(1); }
writeFileSync('epl_players.json', JSON.stringify({ updated: new Date().toISOString(), season: season.label, teams: teams.map((t) => ({ slug: slug(t.name), en: t.name, ar: '', n: players.filter((p) => p.teamEn === t.name).length })), players }));

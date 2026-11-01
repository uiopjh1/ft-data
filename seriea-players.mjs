// صور لاعبي الدوري الإيطالي الرسمية من مسار موقع الرابطة الداخلي /api/sports/{players,teams} → seriea_players.json
import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const DBG = { steps: [] };
const flush = () => writeFileSync('seriea_debug.json', JSON.stringify(DBG, null, 1));
process.on('uncaughtException', (e) => { DBG.crash = String(e && e.stack || e).slice(0, 800); flush(); process.exit(1); });
process.on('unhandledRejection', (e) => { DBG.crash = String(e && e.stack || e).slice(0, 800); flush(); process.exit(1); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function gj(u, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 60000); const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: c.signal }); clearTimeout(t); if (r.ok) return await r.json(); } catch (e) { /* إعادة */ }
    await sleep(2000 * (i + 1));
  }
  return null;
}
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const B = 'https://en.legaseriea.it/api/sports';
const players = await gj(`${B}/players`); const teams = await gj(`${B}/teams`);
if (!Array.isArray(players) || !Array.isArray(teams)) { DBG.error = 'no data'; flush(); process.exit(1); }
DBG.playersRaw = players.length; DBG.teamsRaw = teams.length;
DBG.playerSample = JSON.stringify(players[0]).slice(0, 1600); DBG.teamSample = JSON.stringify(teams[0]).slice(0, 900);
DBG.playerKeys = Object.keys(players[0]).join(','); DBG.teamKeys = Object.keys(teams[0]).join(',');
flush();
const teamById = {}; teams.forEach((t) => { teamById[t.teamId] = t; });
// أي صيغة للصورة تعمل؟ (middle أو left)
const urlOf = (p) => { const js = JSON.stringify(p); const m = js.match(/https?:\/\/media-sdp\.legaseriea\.it\/playerImages\/[^"\\]+\/home\/[^"\\]+\.webp/); return m ? m[0] : ''; };
const sample = players.map(urlOf).find(Boolean) || '';
DBG.sampleUrl = sample;
let variant = '';
if (sample) {
  for (const v of ['_middle', '_left']) {
    const u = sample.replace(/_(left|middle|right)\.webp$/, v + '.webp');
    try { const r = await fetch(u, { headers: { 'User-Agent': UA } }); DBG.steps.push(v + ':' + r.status); if (r.ok) { variant = v; break; } } catch (e) { DBG.steps.push(v + ':err'); }
  }
}
DBG.variant = variant; flush();
const out = []; const noImg = []; const seen = new Set();
for (const p of players) {
  const t = teamById[p.teamId] || teamById[p.currentTeamId] || null;
  const img0 = urlOf(p);
  const teamEn = t ? (t.mediaName || t.officialName || t.teamSlug) : '';
  const names = Object.keys(p).filter((k) => /name/i.test(k) && typeof p[k] === 'string' && p[k]).map((k) => p[k]);
  const first = p.mediaFirstName || p.firstName || '';
  const last = p.mediaLastName || p.lastName || '';
  const en = [first, last].filter(Boolean).join(' ') || p.mediaName || p.playerSlug;
  if (!en || !teamEn) { noImg.push('noteam:' + (p.playerSlug || en)); continue; }
  if (!img0) { noImg.push(en); continue; }
  const k = p.playerId; if (seen.has(k)) continue; seen.add(k);
  const img = variant ? img0.replace(/_(left|middle|right)\.webp$/, variant + '.webp') : img0;
  const alt = [...new Set(names.concat([String(p.playerSlug || '').replace(/-/g, ' ')]).filter((x) => x && x !== en))];
  out.push({ slug: p.playerSlug || slug(en), en, alt, ar: '', team: (t && t.teamSlug) || '', teamEn, img });
}
const tlist = teams.map((t) => ({ slug: t.teamSlug, en: t.mediaName || t.officialName, ar: '', n: out.filter((x) => x.team === t.teamSlug).length })).filter((t) => t.n > 0);
DBG.outN = out.length; DBG.teamsN = tlist.length; DBG.noImg = noImg.slice(0, 40); flush();
console.log('players', out.length, 'teams', tlist.length);
if (tlist.length < 15 || out.length < 300) { console.log('too few, not writing'); process.exit(1); }
writeFileSync('seriea_players.json', JSON.stringify({ updated: new Date().toISOString(), teams: tlist, players: out }));

// صور لاعبي البوندسليغا الرسمية من صفحات الأندية في bundesliga.com (حالة Angular المضمّنة ng-state) → bundesliga_players.json
import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const DBG = { steps: [] };
const flush = () => writeFileSync('bundesliga_debug.json', JSON.stringify(DBG, null, 1));
process.on('uncaughtException', (e) => { DBG.crash = String(e && e.stack || e).slice(0, 800); flush(); process.exit(1); });
process.on('unhandledRejection', (e) => { DBG.crash = String(e && e.stack || e).slice(0, 800); flush(); process.exit(1); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(u, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 40000); const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, signal: c.signal }); clearTimeout(t); if (r.ok) return await r.text(); } catch (e) { /* إعادة */ }
    await sleep(1500 * (i + 1));
  }
  return null;
}
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const idx = await get('https://www.bundesliga.com/en/bundesliga/clubs');
if (!idx) { DBG.error = 'no clubs page'; flush(); process.exit(1); }
const clubSlugs = [...new Set([...idx.matchAll(/\/en\/bundesliga\/clubs\/([a-z0-9-]+)/g)].map((m) => m[1]))].filter((s) => s && s !== 'clubs');
DBG.clubSlugs = clubSlugs; flush();
function walk(o, fn, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 40) return;
  fn(o);
  if (Array.isArray(o)) o.forEach((x) => walk(x, fn, depth + 1)); else Object.keys(o).forEach((k) => walk(o[k], fn, depth + 1));
}
const players = []; const teams = []; let sampleObj = null;
for (const cs of clubSlugs) {
  const html = await get(`https://www.bundesliga.com/en/bundesliga/clubs/${cs}`);
  if (!html) { DBG.steps.push('fail ' + cs); continue; }
  const m = html.match(/<script id="ng-state"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) { DBG.steps.push('nostate ' + cs); continue; }
  let st; try { st = JSON.parse(m[1]); } catch (e) { DBG.steps.push('badjson ' + cs); continue; }
  const title = (html.match(/<title>([^<|]*)/) || [])[1] || cs;
  let teamName = title.replace(/\s*[-–|].*$/, '').trim();
  if (cs === 'sport-club-freiburg') teamName = 'SC Freiburg'; // العنوان يُقطع عند الشرطة (Sport-Club)
  const seen = new Set(); let n = 0;
  walk(st, (o) => {
    if (o && o.players && typeof o.players === 'object' && !Array.isArray(o.players)) {
      Object.keys(o.players).forEach((pos) => {
        (Array.isArray(o.players[pos]) ? o.players[pos] : []).forEach((p) => {
          if (!p || !p.id || !p.name || seen.has(p.id)) return;
          seen.add(p.id);
          if (!sampleObj) sampleObj = JSON.stringify(p).slice(0, 1400);
          const js = JSON.stringify(p);
          const urls = js.match(/https?:\/\/[^"\\]+\.(?:png|jpg|webp)[^"\\]*/g) || [];
          const img = urls.find((u) => /circle/.test(u)) || urls[0] || '';
          const en = p.name.alias || p.name.full || [p.name.first, p.name.last].filter(Boolean).join(' ');
          if (!en || !img) { DBG.steps.push('noimg ' + cs + ':' + en); return; }
          const alt = [...new Set([p.name.full, [p.name.first, p.name.last].filter(Boolean).join(' '), p.name.short].filter((x) => x && x !== en))];
          players.push({ slug: slug(en), en, alt, ar: '', team: cs, teamEn: teamName, img });
          n++;
        });
      });
    }
  });
  teams.push({ slug: cs, en: teamName, ar: '', n });
  console.log(cs, teamName, n);
  await sleep(400);
}
DBG.sample = sampleObj; DBG.playersN = players.length; DBG.teamsN = teams.length; flush();
console.log('players', players.length, 'teams', teams.length);
if (teams.length < 15 || players.length < 300) { console.log('too few, not writing'); process.exit(1); }
writeFileSync('bundesliga_players.json', JSON.stringify({ updated: new Date().toISOString(), teams, players }));

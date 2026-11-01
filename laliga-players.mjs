// صور لاعبي الدوري الإسباني الرسمية من واجهة laliga.com → laliga_players.json (نفس صيغة spl_players.json)
import { writeFileSync } from 'node:fs';
const DBG = { steps: [] };
const flush = () => writeFileSync('laliga_debug.json', JSON.stringify(DBG, null, 1));
process.on('uncaughtException', (e) => { DBG.crash = String(e && e.stack || e).slice(0, 800); flush(); process.exit(1); });
process.on('unhandledRejection', (e) => { DBG.crash = String(e && e.stack || e).slice(0, 800); flush(); process.exit(1); });
const H = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', Accept: 'application/json,text/html,*/*', 'Accept-Language': 'en' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(u, h = {}, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 25000);
      const r = await fetch(u, { headers: { ...H, ...h }, signal: c.signal }); clearTimeout(t);
      if (r.ok) return await r.text();
    } catch (e) { /* إعادة */ }
    await sleep(1500 * (i + 1));
  }
  return null;
}
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const page = await get('https://www.laliga.com/en-GB/laliga-easports/clubs');
const m = page && page.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
DBG.pageLen = page ? page.length : 0;
if (!m) { DBG.error = 'no next data'; flush(); console.log('no next data'); process.exit(1); }
const nd = JSON.parse(m[1]);
const rc = nd.runtimeConfig; const teams = nd.props.pageProps.teams || [];
const season = String(rc.currentSeason || nd.props.pageProps.season || '');
const sub = `laliga-easports-${season}`;
const K = { 'Ocp-Apim-Subscription-Key': rc.backendSubscription, Origin: 'https://www.laliga.com', Referer: 'https://www.laliga.com/' };
const base = rc.backendUrl + '/api/v1';
console.log('season', season, 'teams', teams.length);
DBG.season = season; DBG.teams = teams.length; DBG.sub = sub; flush();
const players = []; const noImg = []; let sample = null;
for (const t of teams) {
  const txt = await get(`${base}/teams/${t.slug}/squad?subscriptionSlug=${sub}&limit=100&offset=0`, K);
  if (!txt) { console.log('fail', t.slug); DBG.steps.push('fail ' + t.slug); continue; }
  let j; try { j = JSON.parse(txt); } catch (e) { continue; }
  const list = j.squads || [];
  if (!sample && list[0]) sample = JSON.stringify(list[0]).slice(0, 1500);
  let n = 0;
  for (const e of list) {
    if (e.current === false) continue;
    const p = e.person || e.player || e;
    const name = p.nickname || p.name;
    if (e.loan_to) continue; // معار لنادٍ آخر: ليس في هذا الفريق حالياً
    if (!name) continue;
    const js = JSON.stringify(e);
    const urls = (js.match(/https?:\\?\/\\?\/assets\.laliga\.com\\?\/squad\\?\/[^"\\]+_001_000\.png/g) || []).map((u) => u.replace(/\\\//g, '/'));
    let img = urls.find((u) => /\/256x278\//.test(u)) || (urls[0] && urls[0].replace(/\/\d+x\d+\//, '/256x278/')) || '';
    if (!img) { noImg.push(t.slug + ':' + name); continue; }
    players.push({ slug: slug(name), en: name, ar: '', team: t.slug, teamEn: t.nickname || t.name, img });
    n++;
  }
  console.log(t.slug, list.length, n);
  await sleep(250);
}
console.log('players', players.length, 'noImg', noImg.length);
DBG.sample = sample; DBG.noImg = noImg.slice(0, 40); DBG.playersN = players.length; flush();
if (players.length < 300) { console.log('too few, not writing'); process.exit(1); }
writeFileSync('laliga_players.json', JSON.stringify({ updated: new Date().toISOString(), season: sub, teams: teams.map((t) => ({ slug: t.slug, en: t.nickname || t.name, ar: '', n: players.filter((p) => p.team === t.slug).length })), players }));

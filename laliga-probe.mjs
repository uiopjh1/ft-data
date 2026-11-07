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

const out = { notes: [] };
for (const t of teams.filter((x) => ['elche-c-f','real-madrid'].includes(x.slug))) {
  const txt = await get(`${base}/teams/${t.slug}/squad?subscriptionSlug=${sub}&limit=100&offset=0`, K);
  const j = JSON.parse(txt);
  for (const e of j.squads || []) {
    const p = e.person || e.player || e;
    const nm = (p.nickname || p.name || '');
    if (/Ponce|Sergio|Revivo/.test(nm) && !/Garcia|Ramos/.test('')) {
      out[t.slug + ':' + nm] = e;
      const js = JSON.stringify(e);
      const urls = (js.match(/https?:\\?\/\\?\/assets\.laliga\.com\\?\/[^"\\]+/g) || []).map((u) => u.replace(/\\\//g, '/'));
      out[t.slug + ':' + nm + ':urls'] = urls;
      const tried = {};
      for (const u of urls) {
        for (const v of [u, u.replace('_1_001_000', '_0_001_000'), u.replace('_1_001_000', '_2_001_000'), u.replace('/1024x1113/', '/2048x2225/')]) {
          try { const r = await fetch(v, { headers: H }); tried[v] = r.status + ' ' + (r.headers.get('content-length') || '') + ' ' + (r.headers.get('last-modified') || ''); } catch (er) { tried[v] = 'err'; }
        }
      }
      out[t.slug + ':' + nm + ':tried'] = tried;
    }
  }
}
writeFileSync('laliga_probe.json', JSON.stringify(out, null, 1));

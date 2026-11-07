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
    const urls = (js.match(/https?:\\?\/\\?\/assets\.laliga\.com\\?\/squad\\?\/[^"\\]+_001_000\.png/g) || []).map((u) => u.replace(/\\\//g, '/')).filter((u) => u.includes('/squad/' + season + '/')); // موسم الدوري الحالي فقط (لا نلتقط صوراً من موسم سابق)
    let img = urls.find((u) => /\/1024x1113\//.test(u)) || (urls[0] && urls[0].replace(/\/\d+x\d+\//, '/1024x1113/')) || ''; // 1024x1113 للتكبير (القوائم تستعمل النسخة المصغّرة)
    if (!img || /\/default\//.test(img)) { noImg.push(t.slug + ':' + name); continue; }
    const alt = [...new Set([p.name, [p.firstname, p.lastname].filter(Boolean).join(' '), [p.firstname, p.nickname].filter(Boolean).join(' '), [p.firstname, String(p.lastname || '').split(' ')[0]].filter(Boolean).join(' ')].filter((x) => x && x !== name))];
    players.push({ slug: slug(name), en: name, alt, ar: '', team: t.slug, teamEn: t.nickname || t.name, img });
    n++;
  }
  console.log(t.slug, list.length, n);
  await sleep(250);
}
console.log('players', players.length, 'noImg', noImg.length);
DBG.sample = sample; DBG.noImg = noImg.slice(0, 40); DBG.playersN = players.length; flush();
// صور الظل الافتراضية: صورة مطابقة بايتاً لأكثر من لاعب في نفس الفريق = ليست صورة لاعب حقيقية
import { createHash } from 'node:crypto';
const hashOf = async (u) => {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(u, { headers: H });
      if (r.ok) return createHash('sha1').update(Buffer.from(await r.arrayBuffer())).digest('hex');
    } catch (e) { /* إعادة */ }
    await sleep(800);
  }
  return null;
};
const hs = new Array(players.length).fill(null);
let hi = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (hi < players.length) { const i = hi++; hs[i] = await hashOf(players[i].img); }
}));
const cnt = {};
players.forEach((p, i) => { if (hs[i]) { const k = p.team + ':' + hs[i]; cnt[k] = (cnt[k] || 0) + 1; } });
const dropped = [];
for (let i = players.length - 1; i >= 0; i--) {
  if (hs[i] && cnt[players[i].team + ':' + hs[i]] >= 2) { dropped.push(players[i].team + ':' + players[i].en); players.splice(i, 1); }
}
console.log('silhouettes dropped', dropped.length, dropped.slice(0, 60).join(', '));
DBG.silhouettes = dropped; flush();
// ظل افتراضي بدرجات بايتات مختلفة: نقارن شكل الصورة نفسه بصورة الفريق الافتراضية (شبكة 24×24 للإضاءة فوق خلفية بيضاء)
let PNGlib = null;
try { PNGlib = (await import('pngjs')).PNG; } catch (e) { DBG.pngjs = 'missing'; }
if (PNGlib) {
  const N = 24;
  const gridOf = async (u) => {
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch(u, { headers: H });
        if (!r.ok) { await sleep(500); continue; }
        const png = PNGlib.sync.read(Buffer.from(await r.arrayBuffer()));
        const g = new Array(N * N).fill(0); const c = new Array(N * N).fill(0);
        for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
          const k = (y * png.width + x) * 4; const a = png.data[k + 3] / 255;
          const lum = 0.299 * png.data[k] + 0.587 * png.data[k + 1] + 0.114 * png.data[k + 2];
          const v = lum * a + 255 * (1 - a);
          const gi = Math.floor(y / png.height * N) * N + Math.floor(x / png.width * N);
          g[gi] += v; c[gi]++;
        }
        return g.map((s, i) => (c[i] ? s / c[i] : 255));
      } catch (e) { await sleep(500); }
    }
    return null;
  };
  const defUrl = (u) => u.replace(/\/(?:p|man)\d+\/(\d+x\d+)\/(?:p|man)\d+_/, '/default/$1/default_');
  const defs = {};
  for (const p of players) { if (!defs[p.team]) { const du = defUrl(p.img); defs[p.team] = du !== p.img ? await gridOf(du) : null; } }
  const dist = new Array(players.length).fill(null);
  let vi = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (vi < players.length) {
      const i = vi++; const d0 = defs[players[i].team];
      if (!d0) continue;
      const g = await gridOf(players[i].img);
      if (g) dist[i] = g.reduce((s, v, k) => s + Math.abs(v - d0[k]), 0) / g.length;
    }
  }));
  const TH = 6;
  const rep = players.map((p, i) => ({ n: p.team + ':' + p.en, d: dist[i] })).filter((x) => x.d != null).sort((a, b) => a.d - b.d);
  DBG.nearest = rep.slice(0, 80).map((x) => x.n + '=' + x.d.toFixed(2));
  const vdrop = [];
  for (let i = players.length - 1; i >= 0; i--) {
    if (dist[i] != null && dist[i] < TH) { vdrop.push(players[i].team + ':' + players[i].en + '=' + dist[i].toFixed(2)); players.splice(i, 1); }
  }
  DBG.visualDropped = vdrop; flush();
  console.log('visual silhouettes dropped', vdrop.length, vdrop.join(', '));
}
if (players.length < 300) { console.log('too few, not writing'); process.exit(1); }
writeFileSync('laliga_players.json', JSON.stringify({ updated: new Date().toISOString(), season: sub, teams: teams.map((t) => ({ slug: t.slug, en: t.nickname || t.name, ar: '', n: players.filter((p) => p.team === t.slug).length })), players }));

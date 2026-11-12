// صور لاعبي الدوري الفرنسي الرسمية من واجهة ligue1.com (ma-api.ligue1.fr) → ligue1_players.json (نفس صيغة laliga_players.json)
import { writeFileSync } from 'node:fs';
const DBG = { steps: [] };
const flush = () => writeFileSync('ligue1_debug.json', JSON.stringify(DBG, null, 1));
process.on('uncaughtException', (e) => { DBG.crash = String(e && e.stack || e).slice(0, 800); flush(); process.exit(1); });
process.on('unhandledRejection', (e) => { DBG.crash = String(e && e.stack || e).slice(0, 800); flush(); process.exit(1); });
const H = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', Accept: 'application/json,*/*' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const base = 'https://ma-api.ligue1.fr';
async function getJ(p, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 25000);
      const r = await fetch(base + p, { headers: H, signal: c.signal }); clearTimeout(t);
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
    } catch (e) { /* إعادة */ }
    await sleep(1000 * (i + 1));
  }
  return null;
}
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const all = await getJ('/championship-clubs');
const clubs = Object.values((all && all.championshipsClubs) || {}).filter((c) => c.championships && c.championships['1'] && c.championships['1'].active === 1);
DBG.clubsN = clubs.length; DBG.clubNames = clubs.map((c) => c.displayName || c.name); flush();
console.log('clubs', clubs.length);
if (clubs.length < 16) { DBG.error = 'too few clubs'; flush(); process.exit(1); }
const jobs = [];
for (const c of clubs) for (const id of c.championships['1'].playersIds || []) jobs.push({ c, id });
console.log('players to fetch', jobs.length);
const players = []; const noImg = []; const failed = [];
let idx = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (idx < jobs.length) {
    const { c, id } = jobs[idx++];
    const p = await getJ('/championship-player/' + id);
    if (!p) { failed.push(id); continue; }
    const ch = p.championships && p.championships['1'];
    if (!ch || ch.active === 0 || ch.championshipClubId !== c.id) continue; // معار أو غير نشط في هذا النادي
    const a = ch.assets || {};
    const img = (a.fullBodyPictures && (a.fullBodyPictures.large || a.fullBodyPictures.small)) || '';
    const en = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
    if (!en) continue;
    if (!img || /default/i.test(img)) { noImg.push(c.displayName + ':' + en); continue; }
    if (!DBG.keys) DBG.keys = Object.keys(p);
    if (/vitor|vitinha|joao neves|kvara/i.test(en)) { (DBG.samples = DBG.samples || []).push({ en, name: p.name, nick: p.nickname || p.nickName || p.knownName || p.shortName || p.displayName || p.commonName || null, others: Object.fromEntries(Object.entries(p).filter(([k, v]) => typeof v === 'string' && !/Url|birth|country|foot|id$/i.test(k)).slice(0, 14)) }); }
    const first = String(p.firstName || '').split(' ')[0];
    const nicks = ['nickname', 'nickName', 'knownName', 'shortName', 'displayName', 'commonName', 'matchName', 'name'].map((k) => p[k]).filter((x) => typeof x === 'string' && x.trim());
    const alt = [...new Set([first && p.lastName ? first + ' ' + p.lastName : '', p.lastName || ''].filter((x) => x && x !== en && x.split(' ').length >= 2).concat(nicks.filter((x) => x !== en)))];
    const teamEn = [...new Set([c.name, c.officialName, c.displayName].filter(Boolean))].join(' ');
    players.push({ slug: slug(en), en, alt, ar: '', team: slug(c.officialName || c.name), teamEn, img });
  }
}));
const cnt = {}; players.forEach((p) => { cnt[p.img] = (cnt[p.img] || 0) + 1; });
const shared = [];
for (let i = players.length - 1; i >= 0; i--) if (cnt[players[i].img] > 1) { shared.push(players[i].en); players.splice(i, 1); }
const teams = clubs.map((c) => ({ slug: slug(c.officialName || c.name), en: [...new Set([c.name, c.officialName, c.displayName].filter(Boolean))].join(' '), ar: '', n: players.filter((p) => p.team === slug(c.officialName || c.name)).length }));
console.log('players', players.length, 'noImg', noImg.length, 'failed', failed.length, 'shared', shared.length);
DBG.playersN = players.length; DBG.noImg = noImg.slice(0, 40); DBG.noImgN = noImg.length; DBG.failed = failed.slice(0, 20); DBG.shared = shared; DBG.teams = teams; flush();
if (players.length < 100) { DBG.error = 'too few players: not writing'; flush(); process.exit(1); }
writeFileSync('ligue1_players.json', JSON.stringify({ updated: new Date().toISOString(), season: 'ligue1-2026', teams, players }));

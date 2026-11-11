// صور لاعبي الدوري الهولندي الرسمية من eredivisie.nl → eredivisie_players.json (نفس صيغة laliga_players.json)
import { writeFileSync } from 'node:fs';
const DBG = { steps: [] };
const flush = () => writeFileSync('eredivisie_debug.json', JSON.stringify(DBG, null, 1));
process.on('uncaughtException', (e) => { DBG.crash = String(e && e.stack || e).slice(0, 800); flush(); process.exit(1); });
process.on('unhandledRejection', (e) => { DBG.crash = String(e && e.stack || e).slice(0, 800); flush(); process.exit(1); });
const H = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', Accept: 'text/html,*/*', 'Accept-Language': 'nl' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(u, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 25000);
      const r = await fetch(u, { headers: H, signal: c.signal }); clearTimeout(t);
      if (r.ok) return await r.text();
      if (r.status === 404) return null;
    } catch (e) { /* إعادة */ }
    await sleep(1200 * (i + 1));
  }
  return null;
}
const decode = (s) => String(s).replace(/&amp;/g, '&');
const titleCase = (s) => s.split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const hub = await get('https://eredivisie.nl/competitie/clubs/');
if (!hub) { DBG.error = 'no clubs page'; flush(); process.exit(1); }
const clubSlugs = [...new Set((hub.match(/\/competitie\/clubs\/([a-z0-9-]+)\//g) || []).map((x) => x.split('/')[3]))];
DBG.clubSlugs = clubSlugs; flush();
console.log('clubs', clubSlugs.length);
const teams = []; const players = []; const noImg = [];
for (const cs of clubSlugs) {
  const page = await get(`https://eredivisie.nl/competitie/clubs/${cs}/`);
  if (!page) { DBG.steps.push('club fail ' + cs); continue; }
  const teamEn = (page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1];
  const clubName = teamEn ? teamEn.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : titleCase(cs);
  const plinks = [...new Set((page.match(new RegExp('/clubs/' + cs + '/spelers/[a-z0-9-]+/', 'g')) || []))];
  DBG.steps.push(cs + ' ' + clubName + ' links=' + plinks.length);
  let n = 0;
  let idx = 0;
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (idx < plinks.length) {
      const l = plinks[idx++];
      const ps = l.split('/')[4];
      const pp = await get('https://eredivisie.nl' + l);
      if (!pp) continue;
      const key = ps.toUpperCase().replace(/-/g, '_');
      const all = [...new Set((pp.match(/https:\/\/eredivisie\.b-cdn\.net\/production\/players\/[^"'\s<>]+/g) || []).map(decode))];
      let img = all.find((u) => u.toUpperCase().includes(key));
      if (!img) {
        // اسم الصفحة طويل (الاسم القانوني) والصورة باسم مختصر: نطابق بكلمات الاسم ونقبل فقط أفضل مطابقة وحيدة
        const toks = ps.toUpperCase().split('-').filter((t) => t.length >= 4);
        const sc = all.map((u) => ({ u, n: toks.filter((t) => u.toUpperCase().includes('_' + t + '_') || u.toUpperCase().includes('_' + t + '.')).length })).filter((x) => x.n >= 1).sort((x, y) => y.n - x.n);
        if (sc.length && (sc.length === 1 || sc[0].n > sc[1].n)) img = sc[0].u;
      }
      if (!img) { noImg.push(cs + ':' + ps); continue; }
      img = img.split('?')[0] + '?width=550&height=776&format=png&quality=80';
      const h1 = (pp.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1];
      const short = h1 ? h1.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').replace(/^\s*\d+\s+/, '').trim() : '';
      const en = titleCase(ps);
      const alt = [...new Set([short].filter((x) => x && x.length < 40 && x !== en))];
      players.push({ slug: ps, en, alt, ar: '', team: cs, teamEn: clubName, img });
      n++;
    }
  }));
  teams.push({ slug: cs, en: clubName, ar: '', n });
  console.log(cs, plinks.length, n);
  await sleep(300);
}
const cnt = {};
players.forEach((p) => { cnt[p.img] = (cnt[p.img] || 0) + 1; });
const shared = players.filter((p) => cnt[p.img] > 1).map((p) => p.team + ':' + p.slug);
for (let i = players.length - 1; i >= 0; i--) if (cnt[players[i].img] > 1) players.splice(i, 1);
DBG.sharedDropped = shared;
console.log('players', players.length, 'noImg', noImg.length, 'shared', shared.length);
DBG.noImg = noImg.slice(0, 40); DBG.playersN = players.length; flush();
if (players.length < 100) { DBG.error = 'too few players: not writing'; flush(); process.exit(1); }
writeFileSync('eredivisie_players.json', JSON.stringify({ updated: new Date().toISOString(), season: 'eredivisie', teams, players }));

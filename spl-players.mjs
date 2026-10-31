// يجمع لاعبي دوري روشن (الأسماء العربية والإنجليزية + الصور الرسمية) من صفحات تشكيلات موقع الرابطة → spl_players.json
import { writeFileSync, mkdirSync } from 'node:fs';
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; FT-football-app/1.0)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(u, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 25000);
      try { const r = await fetch(u, { headers: UA, signal: c.signal }); if (r.ok) return await r.text(); if (r.status === 404) return null; } finally { clearTimeout(t); }
    } catch (e) { /* إعادة */ }
    await sleep(1500 * (i + 1));
  }
  return null;
}
const teamsHtml = await get('https://www.spl.com.sa/en/teams');
if (!teamsHtml) throw new Error('teams page unavailable');
const slugs = [...new Set((teamsHtml.match(/\/en\/teams\/([a-z0-9-]+)\//g) || []).map((x) => x.split('/')[3]))].filter((s) => s && !/^team-name$/.test(s));
console.log('team slugs', slugs.length, slugs.join(','));

function parse(h, lang) {
  const re = new RegExp(`aria-label="([^"]+?) profile link" href="https://www\\.spl\\.com\\.sa/${lang}/players/([^/"]+)/"`, 'g');
  const ms = [...h.matchAll(re)];
  return ms.map((m, i) => {
    const seg = h.slice(m.index + m[0].length, i + 1 < ms.length ? ms[i + 1].index : h.length);
    const img = seg.match(/https:\/\/media-sdp\.spl\.com\.sa\/playerImages\/[^"\s]+/);
    const tm = seg.match(/alt="([^"]+?) logo"/);
    return { slug: m[2], name: m[1], img: img ? img[0] : null, team: tm ? tm[1] : '' };
  });
}
const players = [];
const teamsOut = [];
for (const s of slugs) {
  const en = await get(`https://www.spl.com.sa/en/teams/${s}/squad`);
  await sleep(300);
  const ar = await get(`https://www.spl.com.sa/ar/teams/${s}/squad`);
  await sleep(300);
  if (!en) { console.log('no squad', s); continue; }
  const E = parse(en, 'en');
  const A = ar ? parse(ar, 'ar') : [];
  const am = Object.fromEntries(A.map((x) => [x.slug, x]));
  if (!E.length) { console.log('empty', s); continue; }
  teamsOut.push({ slug: s, en: E[0].team, ar: (A[0] && A[0].team) || '', n: E.length });
  E.forEach((p) => players.push({ slug: p.slug, en: p.name, ar: (am[p.slug] && am[p.slug].name) || '', team: s, teamEn: p.team, img: p.img }));
  console.log(s, E.length, E.filter((x) => x.img).length);
}
writeFileSync('spl_players.json', JSON.stringify({ updated: new Date().toISOString(), teams: teamsOut, players }, null, 0));
// عيّنة صور للفحص البصري (مؤقتة)
mkdirSync('spl_sample', { recursive: true });
const pick = [players.find((p) => /summerville/.test(p.slug)), players.find((p) => /mahzari/.test(p.slug)), players.find((p) => p.team === 'al-ahli' && p.img), players.find((p) => p.team === 'neom-sc' && p.img) || players[players.length - 1]].filter((p) => p && p.img);
for (const [i, p] of pick.entries()) {
  try { const r = await fetch(p.img, { headers: UA }); if (r.ok) writeFileSync(`spl_sample/${i}_${p.slug}.webp`, Buffer.from(await r.arrayBuffer())); } catch (e) { /* تجاهل */ }
}
console.log('players', players.length, 'with img', players.filter((p) => p.img).length, 'with ar', players.filter((p) => p.ar).length);

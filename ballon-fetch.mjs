// يجلب مسودة إحصائيات مرشحي حفل الجوائز من ESPN (يُشغَّل على خوادم GitHub) ويكتبها في ballon_auto.json
// المسودة لا يقرؤها التطبيق: تُراجَع وتُقارَن بمصدر ثانٍ قبل نقل أي رقم إلى ملف الإحصائيات الرسمي.
// الاستخدام: node ballon-fetch.mjs [مفتاح الحدث في events.json] [الموسم، مثل 2025 لموسم 2025-26]
import { readFileSync, writeFileSync } from 'node:fs';

const H = { 'user-agent': 'Mozilla/5.0' };
const API = 'https://site.web.api.espn.com/apis/common/v3';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = JSON.parse(readFileSync('events.json', 'utf8'));
const key = process.argv[2] || (Array.isArray(ev.events) ? 'events' : 'ballon');
const e = key === 'events' ? ev.events[ev.events.length - 1] : ev[key];
if (!e || !Array.isArray(e.players)) throw new Error('الحدث غير موجود أو بدون قائمة لاعبين');
const from = new Date(e.from || Date.now());
const SEASON = Number(process.argv[3] || e.season || (from.getMonth() >= 7 ? from.getFullYear() - 1 : from.getFullYear() - 1));

const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
async function getJson(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: H });
      if (r.ok) return await r.json();
      if (r.status === 404 || r.status === 400) return null;
    } catch (err) { /* إعادة المحاولة */ }
    await sleep(1500 * (i + 1));
  }
  return null;
}
const walk = (o, f) => { if (Array.isArray(o)) o.forEach((x) => walk(x, f)); else if (o && typeof o === 'object') { f(o); Object.values(o).forEach((x) => walk(x, f)); } };

async function findPlayer(name) {
  const j = await getJson(`${API}/search?query=${encodeURIComponent(name)}&limit=10&type=player&sport=soccer`);
  const hits = [];
  walk(j, (o) => { if (o.type === 'player' && o.id && o.displayName) hits.push(o); });
  const want = norm(name);
  const exact = hits.filter((h) => norm(h.displayName) === want);
  return { id: exact.length ? exact[0].id : null, ambiguous: exact.length > 1, found: hits.length };
}

const out = { asOf: new Date().toISOString().slice(0, 10), season: SEASON, source: 'ESPN (سجل مباريات اللاعب)', scope: 'النادي الحالي + المنتخب الأول؛ الموسم من 1 أغسطس إلى 31 يوليو؛ المباريات الرسمية فقط (بدون الودية والشباب)', players: {} };
for (const p of e.players) {
  const rec = { ar: p.ar };
  try {
    const f = await findPlayer(p.en);
    if (!f.id) { rec.error = f.found ? 'لا تطابق دقيق للاسم' : 'غير موجود في ESPN'; out.players[p.en] = rec; continue; }
    rec.espnId = f.id;
    if (f.ambiguous) rec.warn = 'أكثر من لاعب بنفس الاسم، راجع يدوياً';
    const base = `${API}/sports/soccer/athletes/${f.id}`;
    const st = await getJson(`${base}/stats`);
    await sleep(250);
    if (!st) { rec.error = 'لا إحصائيات'; out.players[p.en] = rec; continue; }
    const team = (st.filters || []).find((x) => x.name === 'team');
    const lg = (st.filters || []).find((x) => x.name === 'league');
    rec.club = team && team.options ? (team.options.find((o) => o.value === team.value) || {}).displayValue : null;
    const lo = Date.parse(`${SEASON}-08-01T00:00:00Z`), hi = Date.parse(`${SEASON + 1}-08-01T00:00:00Z`);
    const OFFICIAL_BAD = /friend|joan_gamper|club\.friendly|\.u\d\d|youth|\.w\b|women/i;
    // يجمع مباريات (فريق، بطولة) داخل نافذة الموسم الرسمي من سجل المباريات، ويستبعد الودية
    async function collect(teamId, league) {
      let apps = 0, goals = 0, assists = 0;
      for (const yr of [SEASON, SEASON + 1]) {
        const gl = await getJson(`${base}/gamelog?season=${yr}&league=${encodeURIComponent(league)}${teamId ? '&team=' + teamId : ''}`);
        await sleep(200);
        if (!gl) continue;
        const labels = gl.labels || [];
        const iG = labels.indexOf('G'), iA = labels.indexOf('A');
        const seen = new Set();
        walk(gl.seasonTypes, (x) => {
          if (!Array.isArray(x.events)) return;
          for (const m of x.events) {
            if (!m || !Array.isArray(m.stats) || seen.has(m.eventId)) continue;
            const meta = gl.events && gl.events[m.eventId];
            const d = meta && Date.parse(meta.gameDate);
            if (!d || d < lo || d >= hi) continue;
            seen.add(m.eventId);
            apps++;
            goals += Number(m.stats[iG]) || 0;
            assists += Number(m.stats[iA]) || 0;
          }
        });
      }
      return { apps, goals, assists };
    }
    const comps = [];
    for (const o of (lg && lg.options) || []) {
      if (OFFICIAL_BAD.test(o.value)) continue;
      const r = await collect(team && team.value, o.value);
      if (r.apps) comps.push({ league: o.value, name: o.displayValue, ...r });
    }
    rec.comps = comps;
    // المنتخب الأول: فريق تضم بطولاته كأس العالم أو الودية الدولية (يُستبعد الشباب)
    let nat = null;
    for (const tm of (team && team.options) || []) {
      if (tm.value === team.value || /U\d\d|Women/i.test(tm.displayValue)) continue;
      const sx = await getJson(`${base}/stats?team=${tm.value}`);
      await sleep(200);
      const lgs = ((sx && sx.filters) || []).find((x) => x.name === 'league');
      const opts = (lgs && lgs.options) || [];
      if (!opts.some((o) => /^fifa\.(world|friendly)/.test(o.value))) continue;
      const nc = [];
      for (const o of opts) {
        if (OFFICIAL_BAD.test(o.value)) continue;
        const r = await collect(tm.value, o.value);
        if (r.apps) nc.push({ league: o.value, name: o.displayValue, ...r });
      }
      nat = { team: tm.displayValue, comps: nc };
      break;
    }
    if (nat) rec.national = nat;
    const sum = (arr, k) => arr.reduce((a, c) => a + c[k], 0);
    rec.clubTotals = { apps: sum(comps, 'apps'), goals: sum(comps, 'goals'), assists: sum(comps, 'assists') };
    const nl = (nat && nat.comps) || [];
    rec.natTotals = { apps: sum(nl, 'apps'), goals: sum(nl, 'goals'), assists: sum(nl, 'assists') };
    rec.apps = rec.clubTotals.apps + rec.natTotals.apps;
    rec.goals = rec.clubTotals.goals + rec.natTotals.goals;
    rec.assists = rec.clubTotals.assists + rec.natTotals.assists;
    if (!comps.length) rec.warn = (rec.warn ? rec.warn + '؛ ' : '') + 'لا أرقام لهذا الموسم';
  } catch (err) {
    rec.error = String(err.message || err);
  }
  out.players[p.en] = rec;
  console.log(p.en, rec.club, rec.apps, rec.goals, rec.assists, rec.error || rec.warn || '');
}
writeFileSync('ballon_auto.json', JSON.stringify(out, null, 1));

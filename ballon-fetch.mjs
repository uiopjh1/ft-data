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

const out = { asOf: new Date().toISOString().slice(0, 10), season: SEASON, source: 'ESPN (سجل مباريات اللاعب)', scope: 'النادي الحالي فقط؛ الموسم من 1 أغسطس إلى 31 يوليو؛ بدون الودية', players: {} };
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
    const comps = [];
    for (const o of (lg && lg.options) || []) {
      // نحسب من سجل المباريات نفسه بتواريخها: الموسم الرسمي من 1 أغسطس إلى 31 يوليو (يستبعد كأس العالم للأندية الصيفية وما قبل الموسم)
      const gl = await getJson(`${base}/gamelog?season=${SEASON}&league=${encodeURIComponent(o.value)}`);
      await sleep(250);
      if (!gl) continue;
      const labels = gl.labels || [];
      const iG = labels.indexOf('G'), iA = labels.indexOf('A');
      const lo = Date.parse(`${SEASON}-08-01T00:00:00Z`), hi = Date.parse(`${SEASON + 1}-08-01T00:00:00Z`);
      let apps = 0, goals = 0, assists = 0, skipped = 0;
      walk(gl.seasonTypes, (x) => {
        if (!Array.isArray(x.events)) return;
        for (const m of x.events) {
          if (!m || !Array.isArray(m.stats)) continue;
          const meta = gl.events && gl.events[m.eventId];
          const d = meta && Date.parse(meta.gameDate);
          if (!d || d < lo || d >= hi) { skipped++; continue; }
          apps++;
          goals += Number(m.stats[iG]) || 0;
          assists += Number(m.stats[iA]) || 0;
        }
      });
      if (!apps) continue;
      const g = (lab) => (lab === 'G' ? goals : lab === 'A' ? assists : 0);
      comps.push({ league: o.value, name: o.displayValue, apps, goals: g('G'), assists: g('A'), outsideWindow: skipped || undefined });
    }
    // استبعاد البطولات الودية/غير الرسمية
    rec.comps = comps.filter((c) => !/friend|joan_gamper|club\.friendly/i.test(c.league));
    rec.apps = rec.comps.reduce((a, c) => a + c.apps, 0);
    rec.goals = rec.comps.reduce((a, c) => a + c.goals, 0);
    rec.assists = rec.comps.reduce((a, c) => a + c.assists, 0);
    if (!rec.comps.length) rec.warn = (rec.warn ? rec.warn + '؛ ' : '') + 'لا أرقام لهذا الموسم';
  } catch (err) {
    rec.error = String(err.message || err);
  }
  out.players[p.en] = rec;
  console.log(p.en, rec.club, rec.apps, rec.goals, rec.assists, rec.error || rec.warn || '');
}
writeFileSync('ballon_auto.json', JSON.stringify(out, null, 1));

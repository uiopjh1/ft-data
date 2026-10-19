// يُشغَّل على خوادم GitHub كل 30 دقيقة ويكتب stats.json الذي يقرؤه التطبيق (طلب واحد بدل المئات)
import { writeFileSync } from 'node:fs';

const COMPS = [
  { slug: 'ksa.1', key: 'league', label: 'دوري روشن' },
  { slug: 'ksa.kings.cup', key: 'kings', label: 'كأس الملك' },
  { slug: 'ksa.super_cup', key: 'super', label: 'كأس السوبر' },
  { slug: 'afc.champions', key: 'asia', label: 'دوري أبطال آسيا' },
  { slug: 'afc.champions.two', key: 'asia', label: 'دوري أبطال آسيا 2' },
];
const now = new Date();
const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
const B = 'https://site.api.espn.com/apis';

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
      if (r.status === 404 || r.status === 400) throw new Error('HTTP ' + r.status);
    } catch (e) {
      if (i === tries - 1) throw e;
    }
    await new Promise((s) => setTimeout(s, 800 * (i + 1)));
  }
  throw new Error('failed ' + url);
}
async function pool(jobs, size) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < jobs.length) {
        const k = i++;
        out[k] = await jobs[k]().then((v) => ({ ok: true, v }), (e) => ({ ok: false, e }));
      }
    })
  );
  return out;
}
const scoreOf = (c) => {
  const sc = c && c.score;
  if (sc && typeof sc === 'object') return Number(sc.value !== undefined ? sc.value : sc.displayValue);
  if (sc === undefined || sc === null || sc === '') return NaN;
  return Number(sc);
};
const stat = (e, n) => {
  const q = (e.stats || []).find((z) => z.name === n);
  return q ? Number(q.value) : NaN;
};
const isDone = (st) => st.state === 'post' || st.completed;
const statusOf = (ev) => {
  const c = ev.competitions && ev.competitions[0];
  return (c && c.status && c.status.type) || (ev.status && ev.status.type) || {};
};

// 1) أندية الدوري الحالية
const st = await getJson(`${B}/v2/sports/soccer/ksa.1/standings`);
const entries = ((st.children && st.children[0] ? st.children[0] : st).standings || {}).entries || [];
const teams = {};
entries.forEach((e) => {
  const t = e.team || {};
  if (t.id) teams[String(t.id)] = { id: String(t.id), name: t.displayName || t.name || '-', logo: t.logos && t.logos[0] ? t.logos[0].href : t.logo };
});
const ids = Object.keys(teams);
if (!ids.length) throw new Error('no teams');
let leagueChamp = null;
const top = entries.find((e) => stat(e, 'rank') === 1);
if (top && top.team && stat(top, 'gamesPlayed') >= (ids.length - 1) * 2) leagueChamp = String(top.team.id);

// 2) جداول كل نادٍ في كل بطولة
const lists = await Promise.all(
  COMPS.filter((c) => c.slug !== 'ksa.1').map((c) =>
    getJson(`${B}/site/v2/sports/soccer/${c.slug}/teams?limit=300`)
      .then((j) => (((((j.sports || [])[0] || {}).leagues || [])[0] || {}).teams || []).map((t) => String(t.team && t.team.id)))
      .catch(() => null)
  )
);
const extra = COMPS.filter((c) => c.slug !== 'ksa.1');
async function season(year, onlyParticipants) {
  const jobs = [];
  ids.forEach((id) =>
    COMPS.forEach((c) => {
      const k = extra.indexOf(c);
      if (onlyParticipants && k >= 0 && lists[k] && lists[k].length && lists[k].indexOf(id) < 0) return;
      jobs.push(() => getJson(`${B}/site/v2/sports/soccer/${c.slug}/teams/${id}/schedule?season=${year}`).then((j) => ({ id, c, events: j.events || [] })));
    })
  );
  return (await pool(jobs, 6)).filter((x) => x.ok).map((x) => x.v);
}

// 3) الموسم الحالي
const cur = await season(y, true);
if (!cur.some((x) => x.events.length)) throw new Error('no schedule data');
const start = new Date(y, 6, 1).getTime();
const games = [];
const finals = {};
cur.forEach((x) =>
  x.events.forEach((ev) => {
    const comp = ev.competitions && ev.competitions[0];
    if (!comp || !comp.competitors) return;
    const s = statusOf(ev);
    const rn = (ev.seasonType && ev.seasonType.name) || '';
    const when = new Date(ev.date).getTime();
    if (/^final$/i.test(rn) && !isDone(s) && when > Date.now() - 6 * 3600 * 1000) finals[ev.id] = { label: x.c.label, when, name: ev.name || '' };
    if (!isDone(s)) return;
    const me = comp.competitors.find((c) => String((c.team && c.team.id) || c.id) === x.id);
    const op = comp.competitors.find((c) => c !== me);
    if (!me || !op) return;
    const gf = scoreOf(me);
    const ga = scoreOf(op);
    if (Number.isNaN(gf) || Number.isNaN(ga) || when < start) return;
    games.push({ id: x.id, mid: ev.id, key: x.c.key, when, gf, ga, opp: (op.team && op.team.displayName) || '', label: x.c.label, round: rn, won: me.winner === true });
  })
);

// 4) الموسم الماضي: أبطال آخر بطولات
const prevSeason = await season(y - 1, false);
const prev = [];
const lastLeague = {};
const pts = {};
const played = {};
prevSeason.forEach((x) =>
  x.events.forEach((ev) => {
    const comp = ev.competitions && ev.competitions[0];
    if (!comp || !isDone(statusOf(ev))) return;
    const me = (comp.competitors || []).find((c) => String((c.team && c.team.id) || c.id) === x.id);
    const op = (comp.competitors || []).find((c) => c !== me);
    if (!me || !op) return;
    const when = new Date(ev.date).getTime();
    if (x.c.key === 'league') {
      lastLeague[x.id] = Math.max(lastLeague[x.id] || 0, when);
      const a = scoreOf(me);
      const b = scoreOf(op);
      if (!Number.isNaN(a) && !Number.isNaN(b)) {
        played[x.id] = (played[x.id] || 0) + 1;
        pts[x.id] = (pts[x.id] || 0) + (a > b ? 3 : a === b ? 1 : 0);
      }
      return;
    }
    if (/^final$/i.test((ev.seasonType && ev.seasonType.name) || '') && me.winner === true) prev.push({ id: x.id, label: x.c.label, when });
  })
);
const ranked = Object.keys(pts).filter((id) => played[id] >= 34).sort((a, b) => pts[b] - pts[a]);
if (ranked.length && (ranked.length === 1 || pts[ranked[0]] > pts[ranked[1]]) && lastLeague[ranked[0]]) {
  prev.push({ id: ranked[0], label: 'دوري روشن', when: lastLeague[ranked[0]] });
}

writeFileSync(
  'stats.json',
  JSON.stringify({ updated: Date.now(), year: y, teams, games, leagueChamp, finals: Object.values(finals).sort((a, b) => a.when - b.when), prev })
);
console.log('teams', ids.length, 'games', games.length, 'prev titles', prev.length);

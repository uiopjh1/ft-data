// يعيد بناء قوائم الأندية الأوروبية من مجموعة بيانات Transfermarkt المفتوحة (انتقالات + مشاركات)، ويدمج أسماء/صور/سنوات قديمة من ويكيداتا
import fs from 'fs';
import zlib from 'zlib';
import { tr } from './translit.mjs';
const B = 'https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/';
const DRY = !!process.env.DRY;
const nz = (s) => { let t = String(s || '').toLowerCase(); try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {} return t.replace(/ø/g, 'o').replace(/ß/g, 'ss').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); };
const STOP = new Set(['fc', 'cf', 'ac', 'as', 'sc', 'sv', 'ssc', 'us', 'ssd', 'afc', 'club', 'calcio', 'real', 'de', 'the', 'bsc', 'fsv', 'tsg', 'vfl', 'vfb', 'rb', 'cd', 'ud', 'rcd', 'ca', 'ss', 'sd', 'cfc', '1', '04', '05', '07', '1899', '1846', '1900', '1848', '98', '96', '1909', '1913', '1893', '1907', '1910', '1920', '1913', 'balompie', 'futbol', 'football', 'and', 'hove', 'albion', 'hotspur']);
const ctk = (s) => nz(s).split(' ').filter((x) => x && !STOP.has(x));
async function csv(name) {
  const r = await fetch(B + name + '.csv.gz'); if (!r.ok) throw new Error(name + ' ' + r.status);
  const txt = zlib.gunzipSync(Buffer.from(await r.arrayBuffer())).toString('utf8');
  const lines = txt.split('\n'); const head = parseLine(lines[0]);
  const rows = []; for (let i = 1; i < lines.length; i++) { if (!lines[i]) continue; const p = parseLine(lines[i]); const o = {}; head.forEach((h, k) => (o[h] = p[k])); rows.push(o); }
  return rows;
}
function parseLine(l) { const out = []; let cur = '', q = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (c === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (c === ',' && !q) { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; }
const LG = { epl: 'GB1', laliga: 'ES1', bundesliga: 'L1', seriea: 'IT1' };
const idx = JSON.parse(fs.readFileSync('clubs_index.json', 'utf8')).clubs.filter((c) => LG[c.lg]);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const rep = { matched: 0, unmatched: [], built: 0, years: {}, cut: null, stats: [] };
const flush = () => fs.writeFileSync('clubs4_report' + (DRY ? '_dry' : '') + '.json', JSON.stringify(rep, null, 1));
console.log('download'); 
const clubsT = await csv('clubs'); const players = await csv('players'); const transfers = await csv('transfers'); const apps = await csv('appearances');
console.log('loaded', clubsT.length, players.length, transfers.length, apps.length);
const P = {}; for (const p of players) P[p.player_id] = p;
const yr = (d) => (d && /^\d{4}/.test(d) ? +d.slice(0, 4) : null);
const sy = (s) => { const m = /^(\d\d)\/(\d\d)$/.exec(s || ''); if (!m) return null; const a = +m[1]; return a >= 50 ? 1900 + a : 2000 + a; };
const NOW = 2026;
const tyear = (t) => { const d = yr(t.transfer_date); const s = sy(t.transfer_season); if (d && d <= NOW) return d; return s; };
for (const t of transfers) { const y = tyear(t); if (y) rep.years[y] = (rep.years[y] || 0) + 1; }
const ys = Object.keys(rep.years).map(Number).sort(); rep.cut = ys.find((y) => rep.years[y] >= 1500) || 2000;
// ربط أنديتنا بأندية Transfermarkt
const tmByLg = {}; for (const c of clubsT) (tmByLg[c.domestic_competition_id] = tmByLg[c.domestic_competition_id] || []).push(c);
const ALIAS = { 'inter': 'inter', 'internazionale': 'inter', 'milan': 'milan', 'roma': 'roma', 'bayern munich': 'bayern munchen', 'borussia monchengladbach': 'monchengladbach', 'borussia moenchengladbach': 'monchengladbach', 'koln': 'koln', 'cologne': 'koln', 'bayer leverkusen': 'leverkusen', 'eintracht frankfurt': 'frankfurt' };
function findTm(c) {
  const list = tmByLg[LG[c.lg]] || []; const a = new Set(ctk(c.en).map((x) => ALIAS[x] || x)); let best = null, bs = 0;
  for (const t of list) { const b = ctk(t.name).map((x) => ALIAS[x] || x); if (!a.size || !b.length) continue; const inter = b.filter((x) => a.has(x)).length; const sc = inter / Math.max(a.size, b.length); if (sc > bs || (sc === bs && best && +t.last_season > +best.last_season)) { bs = sc; best = t; } }
  return bs >= 0.5 ? best : null;
}
const tmId = {}; const MAN = { lazio: '398', roma: '12' }; const EXCL = new Set(['coventry-city', 'rc-deportivo', 'sv-elversberg']); rep.map = [];
for (const c of idx) { const t = findTm(c); if (MAN[c.slug]) { tmId[c.slug] = MAN[c.slug]; rep.matched++; } else if (t) { tmId[c.slug] = t.club_id; rep.matched++; rep.map.push(c.en + ' = ' + t.name); } else rep.unmatched.push(c.slug + '|' + c.en); }
// تجميع المشاركات لكل (لاعب، نادٍ)
const A = {}; for (const a of apps) { const y = yr(a.date); if (!y) continue; const k = a.player_club_id + '|' + a.player_id; const o = A[k] || (A[k] = [y, y]); if (y < o[0]) o[0] = y; if (y > o[1]) o[1] = y; }
// الانتقالات لكل نادٍ
const IN = {}, OUT = {};
for (const t of transfers) { const y = tyear(t); if (!y) continue; (IN[t.to_club_id] = IN[t.to_club_id] || []).push([t.player_id, y]); (OUT[t.from_club_id] = OUT[t.from_club_id] || []).push([t.player_id, y]); }
const appsByClub = {}; for (const k of Object.keys(A)) { const [cid, pid] = k.split('|'); (appsByClub[cid] = appsByClub[cid] || []).push(pid); }
const hasAr = (s) => /[؀-ۿ]/.test(s || '');
function same(a, b) { // تطابق أسماء
  const x = nz(a), y = nz(b); if (x === y) return true; const tx = x.split(' '), ty = y.split(' ');
  const [s, l] = tx.length <= ty.length ? [tx, ty] : [ty, tx];
  if (s.length >= 2 && s.every((w) => l.includes(w))) return true;
  if (tx.length >= 2 && ty.length >= 2 && tx[tx.length - 1] === ty[ty.length - 1] && tx[0][0] === ty[0][0] && (tx[0].startsWith(ty[0]) || ty[0].startsWith(tx[0]))) return true;
  return false;
}
for (const c of idx) {
  if (ONLY && !ONLY.includes(c.slug)) continue;
  const cid = tmId[c.slug]; if (!cid || EXCL.has(c.slug)) continue;
  const f = 'clubs/' + c.slug + '.json'; const old = JSON.parse(fs.readFileSync(f, 'utf8'));
  const sp = {};
  const add = (pid, a, b) => { const o = sp[pid] || (sp[pid] = { a: a, b: b }); if (a != null && (o.a == null || a < o.a)) o.a = a; if (b != null && (o.b == null || b > o.b)) o.b = b; };
  const ins = IN[cid] || [], outs = OUT[cid] || [];
  for (const [pid, y] of ins) add(pid, y, null);
  for (const [pid, y] of outs) add(pid, null, y);
  for (const pid of appsByClub[cid] || []) { const [a, b] = A[cid + '|' + pid]; add(pid, a, b); }
  const rows = [];
  const used = new Set();
  for (const pid of Object.keys(sp)) {
    const p = P[pid]; if (!p || !p.name) continue; const o = sp[pid];
    const cur = p.current_club_id === cid && +p.last_season >= NOW - 1;
    let from = o.a, to = cur ? null : o.b;
    if (to != null && from != null && to < from) to = from;
    const m = old.find((r) => !used.has(r[0]) && same(r[0], p.name));
    if (m) used.add(m[0]);
    let img = m && /^https?:/.test(m[2] || '') ? m[2] : (p.image_url && !/default/.test(p.image_url) ? p.image_url : (m ? m[2] : ''));
    let ar = m && hasAr(m[1]) && m[5] !== 1 ? m[1] : tr(p.name);
    rows.push([p.name, ar, img || '', from, to]);
  }
  // لاعبون قدامى من ويكيداتا قبل تغطية Transfermarkt
  const CUT = rep.cut; let legacy = 0;
  for (const r of old) { if (used.has(r[0])) continue; if (r[3] && r[3] < CUT) { rows.push(r); legacy++; } }
  rows.sort((a, b) => (b[3] || 0) - (a[3] || 0));
  rep.stats.push(c.slug + ': old ' + old.length + ' -> ' + rows.length + ' (tm ' + (rows.length - legacy) + ', legacy ' + legacy + ')');
  rep.built++;
  if (!DRY) fs.writeFileSync(f, JSON.stringify(rows));
  flush();
}
flush();

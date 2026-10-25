// يجلب ترتيب البطولات من ESPN مرة واحدة على خوادم GitHub ويحفظه ملفات يقرؤها التطبيق (بدل أن يطلبها كل جوال)
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
const SLUGS = ['ksa.1', 'eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1', 'uefa.champions', 'uefa.europa', 'uefa.europa.conf', 'afc.champions'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync('espn/standings', { recursive: true });
let ok = 0, bad = 0;
for (const slug of SLUGS) {
  const file = `espn/standings/${slug}.json`;
  try {
    const res = await fetch(`https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings`, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    const hasRows = (j.children && j.children.length ? j.children : [j]).some((g) => g.standings && g.standings.entries && g.standings.entries.length);
    if (!hasRows) throw new Error('no rows');
    let same = false;
    if (existsSync(file)) {
      try { const o = JSON.parse(readFileSync(file, 'utf8')); delete o._ts; same = JSON.stringify(o) === JSON.stringify(j); } catch (e) {}
    }
    if (!same) writeFileSync(file, JSON.stringify({ ...j, _ts: Date.now() }));
    ok++;
  } catch (e) {
    bad++;
    console.log(slug, String(e.message || e));
  }
  await sleep(1500);
}
console.log('ok', ok, 'bad', bad);

// ---- مباريات الأيام (scoreboard) تُنشر على فرع espn-data (يُستبدل كل مرة، فلا يتضخم تاريخ المستودع) ----
const BOARD = ['ksa.1','eng.1','esp.1','ita.1','ger.1','fra.1','uefa.champions','uefa.europa','uefa.europa.conf','afc.champions','afc.cup','ksa.kings.cup','fifa.cwc','fifa.intercontinental_cup','eng.fa','esp.copa_del_rey','fifa.world','fifa.worldq.afc','fifa.worldq.uefa','afc.asian.cup','caf.nations','fifa.friendly'];
const riyadh = new Date(Date.now() + 3 * 3600000);
const keyFor = (off) => {
  const d = new Date(riyadh.getTime() + off * 86400000);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
};
mkdirSync('out/scoreboard', { recursive: true });
let bOk = 0, bBad = 0;
for (const slug of BOARD) {
  const days = {};
  for (let off = -3; off <= 8; off++) {
    const k = keyFor(off);
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${k}`, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      days[k] = j.events || [];
      bOk++;
    } catch (e) {
      bBad++;
    }
    await sleep(250);
  }
  if (Object.keys(days).length) writeFileSync(`out/scoreboard/${slug}.json`, JSON.stringify({ _ts: Date.now(), days }));
}
console.log('board ok', bOk, 'bad', bBad);

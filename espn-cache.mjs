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

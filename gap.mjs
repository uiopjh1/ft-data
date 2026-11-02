import fs from 'fs';
const UA = { 'user-agent': 'FT-app-research/1.0 (github.com/uiopjh1/ft-data)' };
const nz = (s) => { let t = String(s || '').toLowerCase(); try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {} return t.replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); };
const T = [
  ['real-madrid', ['List of Real Madrid CF players', 'List of Real Madrid CF players (25–99 appearances)', 'List of Real Madrid CF players (1–24 appearances)']],
  ['manchester-united', ['List of Manchester United F.C. players', 'List of Manchester United F.C. players (25–99 appearances)', 'List of Manchester United F.C. players (1–24 appearances)']],
  ['chelsea', ['List of Chelsea F.C. players', 'List of Chelsea F.C. players (25–99 appearances)', 'List of Chelsea F.C. players (1–24 appearances)']],
];
const out = {};
for (const [slug, pages] of T) {
  let mine = []; try { mine = JSON.parse(fs.readFileSync('clubs/' + slug + '.json', 'utf8')); } catch (e) {}
  const have = new Set(mine.map((r) => nz(r[0])));
  const lastKeys = new Set(mine.map((r) => nz(r[0]).split(' ').slice(-1)[0] + '|' + nz(r[0]).split(' ')[0]));
  const res = { mine: mine.length, pages: {} };
  for (const pg of pages) {
    const r = await fetch('https://en.wikipedia.org/w/api.php?action=parse&format=json&prop=links&redirects=1&page=' + encodeURIComponent(pg), { headers: UA });
    const j = await r.json().catch(() => null);
    const links = j && j.parse ? j.parse.links.filter((l) => l.ns === 0 && l.exists !== undefined).map((l) => l['*']) : [];
    const names = links.map((n) => n.replace(/\s*\(.*\)$/, ''));
    const miss = names.filter((n) => !have.has(nz(n)) && !lastKeys.has(nz(n).split(' ').slice(-1)[0] + '|' + nz(n).split(' ')[0]));
    res.pages[pg] = { links: names.length, missing: miss.length, sample: miss.slice(0, 12), status: r.status, err: j && j.error && j.error.code };
  }
  out[slug] = res;
}
fs.writeFileSync('gap.json', JSON.stringify(out, null, 1));

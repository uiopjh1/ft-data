// يكمّل clubs/<slug>.json بلاعبي تصنيف ويكيبيديا "<النادي> players" (كل من له صفحة ولعب للنادي) مع صورهم وأسمائهم العربية
import fs from 'fs';
const UA = { 'user-agent': 'FT-app-research/1.0 (github.com/uiopjh1/ft-data)', accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nz = (s) => { let t = String(s || '').toLowerCase(); try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {} return t.replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); };
async function J(u) { for (let i = 0; i < 6; i++) { try { const r = await fetch(u, { headers: UA }); if (r.ok) return await r.json(); if (r.status === 429) await sleep(8000 * (i + 1)); } catch (e) {} await sleep(2000 * (i + 1)); } return null; }
const W = 'https://en.wikipedia.org/w/api.php?format=json&origin=*&';
const idx = JSON.parse(fs.readFileSync('clubs_index.json', 'utf8')).clubs;
// عناوين صفحات الأندية في ويكيبيديا دفعة واحدة (50 نادياً في الطلب) لتفادي حدّ الطلبات
const TITLES = {};
for (let i = 0; i < idx.length; i += 40) {
  const ids = idx.slice(i, i + 40).map((c) => c.qid);
  const e = await J('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks&sitefilter=enwiki&ids=' + ids.join('|'));
  for (const id of ids) { const en = e && e.entities && e.entities[id] && e.entities[id].sitelinks && e.entities[id].sitelinks.enwiki; if (en) TITLES[id] = en.title; }
  await sleep(1500);
}
const rep = { clubs: 0, added: 0, nocat: [], perClub: {} };
for (const c of idx) {
  const file = 'clubs/' + c.slug + '.json';
  let list = []; try { list = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { continue; }
  const title = TITLES[c.qid];
  if (!title) { rep.nocat.push(c.slug + ':notitle'); continue; }
  const cats = [title + ' players', title.replace(/ F\.C\.$/, '') + ' players'];
  let members = [];
  for (const cat of cats) {
    let cont = '';
    for (let page = 0; page < 12; page++) {
      const j = await J(W + 'action=query&list=categorymembers&cmtitle=' + encodeURIComponent('Category:' + cat) + '&cmtype=page&cmnamespace=0&cmlimit=500' + cont);
      if (!j || !j.query) break;
      members = members.concat(j.query.categorymembers.map((m) => m.title));
      await sleep(600);
      if (j.continue && j.continue.cmcontinue) cont = '&cmcontinue=' + encodeURIComponent(j.continue.cmcontinue); else break;
    }
    if (members.length) break;
  }
  if (!members.length) { rep.nocat.push(c.slug + ':' + title); continue; }
  const have = new Set(list.map((r) => nz(r[0])));
  const add = [...new Set(members)].filter((t) => !/^(List of|\d{4}|Category)/.test(t)).filter((t) => !have.has(nz(t.replace(/\s*\(.*\)$/, ''))));
  // صور وأسماء عربية على دفعات
  const info = {};
  for (let i = 0; i < add.length; i += 50) {
    const part = add.slice(i, i + 50);
    const j = await J(W + 'action=query&prop=pageimages|langlinks&piprop=name&pilimit=50&lllang=ar&lllimit=500&redirects=1&titles=' + encodeURIComponent(part.join('|')));
    const pages = (j && j.query && j.query.pages) || {};
    for (const p of Object.values(pages)) info[p.title] = { img: p.pageimage || '', ar: (p.langlinks && p.langlinks[0] && p.langlinks[0]['*']) || '' };
    await sleep(200);
  }
  let n = 0;
  for (const t of add) {
    const i = info[t] || {};
    list.push([t.replace(/\s*\(.*\)$/, ''), i.ar ? i.ar.replace(/\s*\(.*\)$/, '') : '', i.img || '', 0, 0]);
    n++;
  }
  list.sort((a, b) => (b[2] ? 1 : 0) - (a[2] ? 1 : 0) || a[0].localeCompare(b[0]));
  fs.writeFileSync(file, JSON.stringify(list));
  c.n = list.length; c.img = list.filter((x) => x[2]).length;
  await sleep(1500);
  rep.clubs++; rep.added += n; rep.perClub[c.slug] = n;
}
fs.writeFileSync('clubs_index.json', JSON.stringify({ updated: new Date().toISOString(), clubs: idx }));
fs.writeFileSync('clubs_wiki_report.json', JSON.stringify(rep, null, 1));

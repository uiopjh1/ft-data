// يعيد بناء clubs/<slug>.json: ويكيداتا (رجال فقط) + تصنيف ويكيبيديا، مع دمج المكرر بمعرّف ويكيداتا وترتيب بالسنوات
import fs from 'fs';
const UA = { 'user-agent': 'FT-app-research/1.0 (github.com/uiopjh1/ft-data)', accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nz = (s) => { let t = String(s || '').toLowerCase(); try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {} return t.replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); };
async function J(u) { for (let i = 0; i < 6; i++) { try { const r = await fetch(u, { headers: UA }); if (r.ok) return await r.json(); if (r.status === 429) await sleep(8000 * (i + 1)); } catch (e) {} await sleep(2000 * (i + 1)); } return null; }
const W = 'https://en.wikipedia.org/w/api.php?format=json&origin=*&';
const D = 'https://www.wikidata.org/w/api.php?format=json&';
const MALE = 'Q6581097';
const idx = JSON.parse(fs.readFileSync('clubs_index.json', 'utf8')).clubs;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const LOG = [];
const flush = () => fs.writeFileSync('clubs2_log_' + (process.env.TAG || 'all') + '.json', JSON.stringify({ t: new Date().toISOString(), rep, tail: LOG.slice(-40) }));
const rep = { done: 0, failed: [], dupMerged: 0, womenDropped: 0 };

const QFIX = { 'al-khaleej': 'Q2027718' }; // نادي الخليج السعودي (الكيان القديم كان نادياً إماراتياً)

async function sparql(qid) {
  const q = `SELECT ?p ?g ?en ?ar ?img ?start ?end WHERE { ?p p:P54 ?st . ?st ps:P54 wd:${qid} . OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end } OPTIONAL { ?p wdt:P18 ?img } OPTIONAL { ?p wdt:P21 ?g } ?p rdfs:label ?en . FILTER(LANG(?en)='en') OPTIONAL { ?p rdfs:label ?ar . FILTER(LANG(?ar)='ar') } }`;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: { ...UA, accept: 'application/sparql-results+json' }, signal: AbortSignal.timeout(80000) });
      LOG.push('sparql ' + qid + ' ' + r.status);
      if (r.ok) return (await r.json()).results.bindings;
      if (r.status === 429) await sleep(10000 * (i + 1));
    } catch (e) { LOG.push('sparql err ' + qid + ' ' + String(e.message).slice(0, 40)); }
    await sleep(5000);
  }
  return null;
}

const titles = {};
for (let i = 0; i < idx.length; i += 40) {
  const ids = idx.slice(i, i + 40).map((c) => c.qid);
  const e = await J(D + 'action=wbgetentities&props=sitelinks&sitefilter=enwiki&ids=' + ids.join('|'));
  for (const id of ids) { const en = e && e.entities && e.entities[id] && e.entities[id].sitelinks && e.entities[id].sitelinks.enwiki; if (en) titles[id] = en.title; }
  await sleep(1500);
}
const EXTRA = { fiorentina: 'ACF Fiorentina' };

for (const c of idx) {
  if (ONLY && !ONLY.includes(c.slug)) continue;
  try {
    LOG.push('club ' + c.slug); flush();
    if (QFIX[c.slug]) { c.qid = QFIX[c.slug]; const e = await J(D + 'action=wbgetentities&props=sitelinks&sitefilter=enwiki&ids=' + c.qid); const en = e && e.entities[c.qid].sitelinks && e.entities[c.qid].sitelinks.enwiki; if (en) titles[c.qid] = en.title; }
    const rows = await sparql(c.qid);
    if (!rows) { rep.failed.push(c.slug + ':sparql'); continue; }
    const by = {};
    for (const b of rows) {
      const id = b.p.value.split('/').pop();
      if (b.g && b.g.value.split('/').pop() !== MALE) { rep.womenDropped++; continue; }
      const o = by[id] || (by[id] = { id, en: b.en.value, ar: (b.ar && b.ar.value) || '', img: b.img ? decodeURIComponent(b.img.value.split('Special:FilePath/')[1] || '') : '', f: [], t: [], open: false });
      if (b.start) o.f.push(+b.start.value.slice(0, 4));
      if (b.end) o.t.push(+b.end.value.slice(0, 4)); else o.open = true;
    }
    const ids = new Set(Object.keys(by));
    // تصنيف ويكيبيديا
    const title = titles[c.qid] || EXTRA[c.slug];
    let members = [];
    if (title) {
      const cats = [title + ' players', title.replace(/ F\.C\.$/, '') + ' players', title + ' footballers', title.replace(/ F\.C\.$/, '') + ' footballers'];
      for (const cat of cats) {
        let cont = '';
        for (let page = 0; page < 12; page++) {
          const j = await J(W + 'action=query&list=categorymembers&cmtitle=' + encodeURIComponent('Category:' + cat) + '&cmtype=page&cmnamespace=0&cmlimit=500' + cont);
          if (!j || !j.query) break;
          members = members.concat(j.query.categorymembers.map((m) => m.title));
          if (j.continue && j.continue.cmcontinue) cont = '&cmcontinue=' + encodeURIComponent(j.continue.cmcontinue); else break;
          await sleep(500);
        }
        if (members.length) break;
      }
    }
    members = [...new Set(members)].filter((t) => !/^(List of|\d{4}|Category)/.test(t));
    const add = [];
    for (let i = 0; i < members.length; i += 50) {
      const part = members.slice(i, i + 50);
      const j = await J(W + 'action=query&prop=pageprops|pageimages|langlinks&ppprop=wikibase_item&piprop=name&pilimit=50&lllang=ar&lllimit=500&redirects=1&titles=' + encodeURIComponent(part.join('|')));
      const pages = (j && j.query && j.query.pages) || {};
      for (const p of Object.values(pages)) {
        const qid = p.pageprops && p.pageprops.wikibase_item;
        if (!qid) continue;
        if (ids.has(qid)) { const o = by[qid]; if (!o.img && p.pageimage) o.img = p.pageimage; if (!o.ar && p.langlinks && p.langlinks[0]) o.ar = p.langlinks[0]['*'].replace(/\s*\(.*\)$/, ''); rep.dupMerged++; continue; }
        add.push({ id: qid, en: p.title.replace(/\s*\(.*\)$/, ''), ar: p.langlinks && p.langlinks[0] ? p.langlinks[0]['*'].replace(/\s*\(.*\)$/, '') : '', img: p.pageimage || '', f: [], t: [], open: true });
      }
      await sleep(300);
    }
    // استبعاد غير الرجال من الإضافات (جنس ويكيداتا)
    const keep = [];
    for (let i = 0; i < add.length; i += 50) {
      const part = add.slice(i, i + 50);
      const e = await J(D + 'action=wbgetentities&props=claims&ids=' + part.map((x) => x.id).join('|'));
      for (const x of part) {
        const cl = e && e.entities && e.entities[x.id] && e.entities[x.id].claims;
        const g = cl && cl.P21 && cl.P21[0] && cl.P21[0].mainsnak.datavalue && cl.P21[0].mainsnak.datavalue.value.id;
        if (g && g !== MALE) { rep.womenDropped++; continue; }
        keep.push(x);
      }
      await sleep(300);
    }
    const all = Object.values(by).concat(keep);
    const L = all.map((o) => [o.en, o.ar, o.img, o.f.length ? Math.min(...o.f) : 0, o.t.length && !o.open ? Math.max(...o.t) : 0]);
    // من لهم سنوات مؤكدة أولاً (الأحدث أولاً)، ثم الباقون بالأبجدية
    L.sort((a, b) => (b[3] ? 1 : 0) - (a[3] ? 1 : 0) || (a[3] && b[3] ? b[3] - a[3] : 0) || a[0].localeCompare(b[0]));
    fs.writeFileSync('clubs/' + c.slug + '.json', JSON.stringify(L));
    c.n = L.length; c.img = L.filter((x) => x[2]).length;
    rep.done++; flush();
    await sleep(1200);
  } catch (e) { rep.failed.push(c.slug + ':' + String(e.message).slice(0, 60)); }
}
if (!process.env.NOINDEX) fs.writeFileSync('clubs_index.json', JSON.stringify({ updated: new Date().toISOString(), clubs: idx }));
fs.writeFileSync('clubs2_report_' + (process.env.TAG || 'all') + '.json', JSON.stringify(rep, null, 1));

import fs from 'fs';
const d = JSON.parse(fs.readFileSync('presidents.json','utf8'));
const uniq = {};
for (const [k,v] of Object.entries(d)) if (v && typeof v==='object') { const n=v.en||v.name; if(!uniq[n]) uniq[n]={...v,club:k}; }
globalThis.ERR={};
const j = async (u)=>{ try{ const r=await fetch(u,{headers:{'user-agent':'ft-football-app/1.0 (https://github.com/uiopjh1/ft-data)'}}); if(!r.ok){ERR[u.slice(0,90)]=r.status;return null;} return await r.json();}catch(e){ERR[u.slice(0,90)]=String(e);return null;} };
const out = {};
for (const [n,v] of Object.entries(uniq)) {
  if (v.image) { out[n]={club:v.club,src:'manual'}; continue; }
  let img='', how='';
  const en = v.en;
  if (en) {
    const s = await j(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(en.replace(/ /g,'_'))}`);
    if (s && s.thumbnail) { img=s.thumbnail.source; how='enwiki'; }
    if (!img) {
      const w = await j(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(en)}&language=en&format=json&limit=3`);
      for (const h of (w&&w.search)||[]) {
        const e = await j(`https://www.wikidata.org/wiki/Special:EntityData/${h.id}.json`);
        const c = e&&e.entities&&e.entities[h.id]&&e.entities[h.id].claims;
        const f = c&&c.P18&&c.P18[0]&&c.P18[0].mainsnak&&c.P18[0].mainsnak.datavalue&&c.P18[0].mainsnak.datavalue.value;
        if (f) { img='commons:'+f; how='wikidata:'+h.id+' '+h.description; break; }
      }
    }
  }
  out[n]={club:v.club,img,how};
}
out._errors=Object.fromEntries(Object.entries(ERR).slice(0,8));
fs.writeFileSync('pres_photos_probe.json',JSON.stringify(out,null,1));

import fs from 'fs';
const d = JSON.parse(fs.readFileSync('presidents.json','utf8'));
const miss = {};
for (const [k,v] of Object.entries(d)) if (v&&typeof v==='object'&&v.en&&!v.image&&/^[A-Za-z]/.test(v.en)&&!miss[v.en]) miss[v.en]=k;
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
globalThis.E={};
const to = async (u)=>{ for(let i=0;i<4;i++){ await sleep(700); try{ const r=await fetch(u,{headers:{'user-agent':'ft-football-app/1.0 (https://github.com/uiopjh1/ft-data; contact via github)'},signal:AbortSignal.timeout(15000)}); if(r.status===429){await sleep(4000*(i+1));continue;} if(!r.ok){E[u.slice(8,40)]=r.status;return null;} return await r.json(); }catch(e){E.last=String(e);} } return null; };
const out={};
const langs=['en','es','it','de','fr','pt'];
for (const [name,club] of Object.entries(miss)) {
  const c=[];
  for (const l of langs) {
    const j = await to(`https://${l}.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent('"'+name+'"')}&gsrlimit=3&prop=pageimages|extracts&piprop=original|thumbnail&pithumbsize=400&exintro=1&explaintext=1&exchars=300`);
    const pages = j&&j.query&&Object.values(j.query.pages)||[];
    for (const p of pages) if (p.thumbnail||p.original) c.push({l,title:p.title,thumb:p.thumbnail&&p.thumbnail.source,extract:(p.extract||'').slice(0,220)});
  }
  const cm = await to(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(name)}&gsrlimit=4&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=400`);
  for (const p of (cm&&cm.query&&Object.values(cm.query.pages))||[]) { const ii=p.imageinfo&&p.imageinfo[0]; if(ii) c.push({l:'commons',title:p.title,thumb:ii.thumburl,extract:((ii.extmetadata&&ii.extmetadata.ImageDescription&&ii.extmetadata.ImageDescription.value)||'').replace(/<[^>]+>/g,'').slice(0,200)}); }
  out[name]={club,c};
}
out._E=E;fs.writeFileSync('pp_probe.json',JSON.stringify(out,null,1));

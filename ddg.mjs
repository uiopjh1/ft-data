import fs from 'fs';
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const d = JSON.parse(fs.readFileSync('presidents.json','utf8'));
const skip=new Set(['Joan Laporta','Khaldoon Al Mubarak','Herbert Hainer','Florentino Pérez','Nasser Al-Khelaifi','Enrique Cerezo','Beppe Marotta','Hans-Joachim Watzke','Michele Kang']);
const people={};
for (const [k,v] of Object.entries(d)) if (v&&typeof v==='object'&&!v.image&&v.en&&/^[A-Za-z]/.test(v.en)&&!people[v.en]&&!skip.has(v.en)) people[v.en]={club:k,ar:v.name};
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
async function search(q){
  for(let t=0;t<3;t++){ try{
    const r=await fetch('https://duckduckgo.com/?q='+encodeURIComponent(q)+'&iax=images&ia=images',{headers:{'user-agent':UA},signal:AbortSignal.timeout(15000)});
    const h=await r.text(); const vqd=(h.match(/vqd=["']?([\d-]+)/)||[])[1]; if(!vqd){await sleep(3000);continue;}
    const j=await fetch(`https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(q)}&vqd=${vqd}&f=,,,,,&p=1`,{headers:{'user-agent':UA,referer:'https://duckduckgo.com/'},signal:AbortSignal.timeout(15000)});
    if(j.status!==200){await sleep(4000);continue;}
    return (await j.json()).results||[];
  }catch(e){await sleep(2000);} } return [];
}
async function ok(u){ try{ const r=await fetch(u,{headers:{'user-agent':UA},signal:AbortSignal.timeout(12000)}); return r.ok&&/^image\//.test(r.headers.get('content-type')||'')&&Number(r.headers.get('content-length')||1000)<4e6; }catch{return false;} }
const out={};
for (const [en,p] of Object.entries(people)) {
  const sn=en.split(' ').pop().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  let res=[];
  for (const q of [`${en} ${p.club} president`, `${en} ${p.club} presidente`]) { res=res.concat(await search(q)); await sleep(1500); if(res.length>12) break; }
  const c=[]; const seen=new Set();
  for (const r of res) {
    const t=(r.title||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    if(!t.includes(sn)||seen.has(r.image)) continue; seen.add(r.image);
    if(r.width<250||r.height<250) continue;
    if(/alamy|shutterstock|dreamstime|istock|pinterest|facebook|tiktok|instagram/i.test(r.image+r.url)) continue;
    if(await ok(r.image)) c.push({img:r.image,title:r.title,url:r.url,w:r.width,h:r.height});
    if(c.length>=4) break;
  }
  out[en]={club:p.club,ar:p.ar,c};
}
fs.writeFileSync('ddg_probe.json',JSON.stringify(out,null,1));

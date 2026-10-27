import fs from 'fs';
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const q='Fernando Roig Villarreal presidente';
const r=await fetch('https://duckduckgo.com/?q='+encodeURIComponent(q)+'&iax=images&ia=images',{headers:{'user-agent':UA}});
const h=await r.text(); const vqd=(h.match(/vqd=["']?([\d-]+)/)||[])[1];
let out={status:r.status,vqd};
if(vqd){ const j=await fetch(`https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(q)}&vqd=${vqd}&f=,,,,,&p=1`,{headers:{'user-agent':UA,referer:'https://duckduckgo.com/'}}); out.i=j.status; const t=await j.text(); out.sample=t.slice(0,1500);}
fs.writeFileSync('ddg_probe.json',JSON.stringify(out,null,1));

import fs from 'fs';
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const T=JSON.parse(fs.readFileSync('cand_urls.json','utf8'));
fs.mkdirSync('cand',{recursive:true});
for (const [k,u] of Object.entries(T)) { try{ const r=await fetch(u,{headers:{'user-agent':UA}}); fs.writeFileSync(`cand/${k}.webp`,Buffer.from(await r.arrayBuffer())); }catch(e){} }

import fs from 'fs';
const d=JSON.parse(fs.readFileSync('presidents.json','utf8'));
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const H={'user-agent':'ft-football-app/1.0 (https://github.com/uiopjh1/ft-data)'};
const j=async(u)=>{for(let i=0;i<4;i++){await sleep(500);try{const r=await fetch(u,{headers:H,signal:AbortSignal.timeout(20000)});if(r.status===429){await sleep(4000*(i+1));continue;}return r.ok?await r.json():null;}catch{}}return null;};
const seen=new Set(); const out=[];
for(const [club,v] of Object.entries(d)){
  if(!v||typeof v!=='object'||!v.en) continue;
  const key=club; if(seen.has(v.en)) continue; seen.add(v.en);
  const s=await j(`https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(club+' football club')}&srlimit=2`);
  const title=s&&s.query&&s.query.search[0]&&s.query.search[0].title;
  let fields='';
  if(title){
    const p=await j(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(title)}&rvsection=0`);
    const pg=p&&p.query&&Object.values(p.query.pages)[0];
    const txt=pg&&pg.revisions&&pg.revisions[0].slots.main['*']||'';
    const m=[...txt.matchAll(/\|\s*(chairman|president|owner|chair|chief executive)\s*=\s*([^\n]*)/gi)].map(x=>x[1]+': '+x[2].replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g,'$2').replace(/<[^>]+>|\{\{[^}]*\}\}/g,'').trim());
    fields=m.join(' ; ');
  }
  const sn=v.en.split(' ').pop().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  const f=fields.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  out.push({club,en:v.en,since:v.since||null,role:v.role||'',title,wiki:fields.slice(0,250),match:f.includes(sn)});
}
fs.writeFileSync('rev_out.json',JSON.stringify(out,null,1));

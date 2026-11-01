import fs from 'fs';
const L = JSON.parse(fs.readFileSync('bad_list.json','utf8'));
const st = async (u, ref) => { try { const r = await fetch(u,{headers:{'user-agent':'Mozilla/5.0', ...(ref?{referer:ref}:{})}}); const ct=r.headers.get('content-type')||''; const len=+(r.headers.get('content-length')||0); return r.status+(r.ok&&!/image/.test(ct)?'!ct':'')+(r.ok&&len&&len<20000&&/premierleague/.test(u)?'~small'+len:''); } catch(e){ return 'ERR'; } };
const out = [];
let i = 0;
async function one(o) {
  const v = {};
  if (o.lg==='epl') {
    const id = (o.img.match(/p(\d+)\.png/)||[])[1];
    v.a = await st(`https://resources.premierleague.com/premierleague25/photos/players/110x140/${id}.png`);
    v.b = await st(`https://resources.premierleague.com/premierleague26/photos/players/110x140/${id}.png`);
    v.c = await st(`https://resources.premierleague.com/premierleague26/photos/players/250x250/${id}.png`);
    v.d = await st(`https://resources.premierleague.com/premierleague/photos/players/110x140/p${id}.png`);
  } else if (o.lg==='bundesliga') {
    v.a = await st(o.img);
    v.b = await st(o.img.replace('-circle','-medium'));
    v.c = await st(o.img.replace('-circle.png','.png'));
    v.d = await st(o.img, 'https://www.bundesliga.com/');
  } else {
    v.a = await st(o.img);
    v.b = await st(o.img, o.lg==='spl'?'https://www.spl.com.sa/':'https://www.legaseriea.it/');
    v.c = await st(o.img.replace('_middle','_big'));
    v.d = await st(o.img.replace('_middle','_small'));
    v.e = await st(o.img.replace('_middle.webp','.webp'));
  }
  out.push({ lg:o.lg, en:o.en, team:o.team, v });
}
await Promise.all(Array.from({length:8}, async()=>{ while(i<L.length) await one(L[i++]); }));
fs.writeFileSync('probe2.json', JSON.stringify(out));

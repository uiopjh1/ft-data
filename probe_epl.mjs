import fs from 'fs';
const P = JSON.parse(fs.readFileSync('epl_players.json','utf8')).players;
const names = ['Mike Penders','Estêvão','Jorrel Hato','Jamie Gittens','Geovany Quenda','Emmanuel Emegha','Marco Palestra','Pep Chavarría'];
const out = {};
for (const n of names) {
  const p = P.find((x)=>x.en===n); if(!p) continue;
  const id = (p.img.match(/p(\d+)\.png/)||[])[1];
  const V = [
    `https://resources.premierleague.com/premierleague25/photos/players/250x250/${id}.png`,
    `https://resources.premierleague.com/premierleague25/photos/players/250x250/p${id}.png`,
    `https://resources.premierleague.com/premierleague25/photos/players/110x140/${id}.png`,
    `https://resources.premierleague.com/premierleague/photos/players/110x140/p${id}.png`,
    `https://resources.premierleague.com/premierleague/photos/players/40x40/p${id}.png`,
    `https://resources.premierleague.com/premierleague/photos/players/250x250/Photo-Missing.png`,
    `https://www.premierleague.com/resources/prod/v6.131.2-5099/i/elements/photo-unavailable.png`,
  ];
  out[n] = {};
  for (const u of V) { try { const r = await fetch(u,{headers:{'user-agent':'Mozilla/5.0'}}); out[n][u]=r.status+' '+(r.headers.get('content-type')||'')+' '+(r.headers.get('content-length')||''); } catch(e){ out[n][u]='ERR '+e.message; } }
}
fs.writeFileSync('probe_epl.json', JSON.stringify(out,null,1));

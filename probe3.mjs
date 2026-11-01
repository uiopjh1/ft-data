import fs from 'fs';
const U = {
 fotmob_search: 'https://apigw.fotmob.com/searchapi/suggest?term=Ali%20Majrashi&lang=en',
 fotmob_search2: 'https://www.fotmob.com/api/search/suggest?term=Ali%20Majrashi',
 fotmob_img: 'https://images.fotmob.com/image_resources/playerimages/1000000.png',
 tm_search: 'https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query=Ali+Majrashi',
 tm_ceapi: 'https://tmapi-alpha.transfermarkt.technology/players?ids[]=1',
 wiki: 'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=Ali+Majrashi+footballer&format=json',
 wikidata: 'https://www.wikidata.org/w/api.php?action=wbsearchentities&search=Ali%20Majrashi&language=en&format=json',
 livescore: 'https://prod-cdn-search.livescore.com/api/search/all?q=Majrashi',
 soccerway: 'https://int.soccerway.com/search/?q=Majrashi',
 espn_new: 'https://site.web.api.espn.com/apis/common/v3/search?limit=5&type=player&query=Majrashi',
 flashscore: 'https://s.livesport.services/api/v2/search/?q=Majrashi&l=1&s=1&f=1&pid=2&sid=1',
 sofa2: 'https://www.sofascore.com/api/v1/search/all?q=Majrashi',
};
const out = {};
for (const [k,u] of Object.entries(U)) { try { const r = await fetch(u,{headers:{'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',accept:'*/*'}}); const t = (await r.text()).slice(0,200).replace(/\s+/g,' '); out[k]=r.status+' '+(r.headers.get('content-type')||'')+' | '+t; } catch(e){ out[k]='ERR '+e.message; } }
fs.writeFileSync('probe3.json', JSON.stringify(out,null,1));

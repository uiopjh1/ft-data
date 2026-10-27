import fs from 'fs';
const T = {
 'Kroenke':['https://arsenal.com/the-arsenal-board','https://www.arsenal.com/news/arsenal-announces-leadership-and-board-update-acCJ42D4lJXO'],
 'Glazer':['https://ir.manutd.com/corporate-governance/board-of-directors.aspx'],
 'Friedkin':['https://www.asroma.com/en/news/58433/the-friedkin-group-are-the-new-owners-of-as-roma'],
 'Roig':['https://villarrealcf.es/en/fernando-roig-celebrates-26-years-at-villarreal/'],
 'DelNido':['https://sevillafc.es/en/actual/news/del-nido-carrasco-new-president'],
 'Ferrero':['https://www.juventus.com/it/news/articoli/buon-compleanno-presidente-x6428'],
};
const out={};
for (const [k,urls] of Object.entries(T)) for (const u of urls) {
  try {
    const r = await fetch(u,{headers:{'user-agent':'Mozilla/5.0 (compatible; ft-football-app)'}});
    const h = await r.text();
    const og = (h.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i)||h.match(/content=["']([^"']+)["'][^>]*property=["']og:image/i)||[])[1]||'';
    const imgs = [...h.matchAll(/<img[^>]+>/gi)].map(m=>m[0]).filter(t=>/kroenke|glazer|friedkin|roig|nido|ferrero|president|board/i.test(t)).slice(0,12).map(t=>t.slice(0,300));
    out[k+'|'+u]={status:r.status,og,imgs};
  } catch(e){ out[k+'|'+u]={err:String(e)}; }
}
fs.writeFileSync('img_probe.json',JSON.stringify(out,null,1));

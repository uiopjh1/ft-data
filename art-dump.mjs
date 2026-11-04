// تشخيص: يطبع كل صور المقالات (المقاس والمعرّف) لنفهم لماذا صور التتويج قليلة
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; FT-app-dev/1.0)', 'Accept-Language': 'ar' };
for (const id of (process.env.ART_IDS || '890816,890817,890825,890822').split(',')) {
  try {
    const r = await fetch(`https://arriyadiyah.com/${id}`, { headers: UA, redirect: 'follow' });
    const art = await r.text();
    console.log(`ART ${id} http ${r.status} len ${art.length} final ${r.url.slice(0, 80)}`);
    const og = art.match(/property="og:image"[^>]*content="([^"]+)"/) || art.match(/content="([^"]+)"[^>]*property="og:image"/);
    console.log(`  og: ${og ? og[1] : '-'}`);
    const seen = new Set();
    for (const tg of art.match(/<img[^>]*>/gi) || []) {
      const src = tg.match(/(?:data-src|src)="([^"]*\/media\/[^"]+)"/);
      if (!src || seen.has(src[1])) continue;
      seen.add(src[1]);
      const alt = ((tg.match(/alt="([^"]*)"/) || [])[1] || '').slice(0, 50);
      console.log(`  img: ${src[1]} | alt: ${alt}`);
    }
  } catch (e) { console.log(`ART ${id} ERR ${e.message}`); }
}

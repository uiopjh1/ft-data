// فحص قصير: هل موقع رابطة دوري روشن يعطي صور اللاعبين، وما واجهة البيانات؟
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('spl_probe', { recursive: true });
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; FT-football-app/1.0)', 'Accept-Language': 'en' };
const out = { pages: {}, found: {} };
const urls = ['https://www.spl.com.sa/en/teams', 'https://www.spl.com.sa/en/fixtures-results', 'https://www.spl.com.sa/en/players', 'https://www.spl.com.sa/en'];
for (const u of urls) {
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(u, { headers: UA, signal: ctrl.signal, redirect: 'follow' }); clearTimeout(t);
    const html = await r.text();
    out.pages[u] = { status: r.status, len: html.length, final: r.url };
    const name = u.replace(/[^a-z0-9]+/gi, '_').slice(-40);
    writeFileSync(`spl_probe/${name}.html`, html.slice(0, 400000));
    const uniq = (re) => [...new Set((html.match(re) || []))].slice(0, 60);
    out.found[u] = {
      images: uniq(/https?:\/\/images\.spl\.com\.sa[^"'\s)\\<]+/g),
      api: uniq(/https?:\/\/[a-z0-9.-]*(?:api|cdn|data)[a-z0-9.-]*\.[a-z]+\/[^"'\s)\\<]*/gi),
      playerLinks: uniq(/\/(?:en|ar)\/(?:players?|teams?)\/[^"'\s)\\<]+/g),
      nextData: /__NEXT_DATA__/.test(html),
    };
  } catch (e) { out.pages[u] = { error: String(e && e.message || e).slice(0, 80) }; }
}
writeFileSync('spl_probe/summary.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.pages));

// فحص: هيكل المواقع الرسمية (روابط اللاعبين/الصور/واجهات البيانات) → probe_sites.json
import { writeFileSync } from 'node:fs';
const H = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Accept': 'text/html,application/json,*/*', 'Accept-Language': 'en' };
const SITES = [
  ['bundesliga', ['https://www.bundesliga.com/en/bundesliga/clubs', 'https://www.bundesliga.com/en/bundesliga/clubs/fc-bayern-muenchen', 'https://www.bundesliga.com/en/bundesliga/players']],
  ['laliga', ['https://www.laliga.com/en-ES/laliga-easports/clubs', 'https://www.laliga.com/en-GB/laliga-easports/clubs', 'https://www.laliga.com/en-ES/clubs', 'https://www.laliga.com/en-GB/laliga-easports/players']],
  ['seriea', ['https://www.legaseriea.it/en/serie-a/teams', 'https://www.legaseriea.it/en/serie-a/clubs', 'https://www.legaseriea.it/en', 'https://www.legaseriea.it/en/serie-a/players']],
  ['ligue1', ['https://ligue1.com/clubs', 'https://ligue1.com/en/clubs', 'https://ligue1.com/', 'https://ligue1.com/en/players']],
];
const out = {};
for (const [name, urls] of SITES) {
  out[name] = [];
  for (const url of urls) {
    const r = { url };
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 25000);
      const res = await fetch(url, { headers: H, signal: ctrl.signal, redirect: 'follow' }); clearTimeout(t);
      r.status = res.status; r.final = res.url; const txt = await res.text(); r.len = txt.length;
      r.nextData = /__NEXT_DATA__/.test(txt);
      const uniq = (a) => [...new Set(a)];
      r.hrefs = uniq([...txt.matchAll(/href=["']([^"'#]+)["']/g)].map((m) => m[1]).filter((h) => /squad|player|team|club|kader|joueur|plantilla|rosa/i.test(h))).slice(0, 25);
      r.imgs = uniq([...txt.matchAll(/(?:src|srcset|data-src|content)=["']([^"'\s]+\.(?:png|jpg|jpeg|webp)[^"'\s]*)["']/gi)].map((m) => m[1]).filter((h) => /player|joueur|jugador|giocatore|squad|face|portrait/i.test(h))).slice(0, 12);
      r.apis = uniq([...txt.matchAll(/https?:\/\/[^"'\s\\<>]*(?:api|json|feed|cdn)[^"'\s\\<>]*/gi)].map((m) => m[0])).slice(0, 25);
      r.title = (txt.match(/<title>([^<]*)/) || [])[1];
    } catch (e) { r.error = String(e && e.message || e); }
    out[name].push(r); console.log(name, url, r.status, r.len, r.error || '');
  }
}
writeFileSync('probe_sites.json', JSON.stringify(out, null, 1));

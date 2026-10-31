// فحص لمرة واحدة: هل تُقرأ المواقع الرسمية للدوريات من خوادم GitHub؟ يكتب probe_report.json
import { writeFileSync } from 'node:fs';
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; FT-football-app/1.0; +github.com/uiopjh1/ft-data)', 'Accept': 'text/html,application/json,*/*', 'Origin': 'https://www.premierleague.com', 'Referer': 'https://www.premierleague.com/' };
const URLS = [
  ['EPL site players', 'https://www.premierleague.com/en/players'],
  ['EPL sdp api', 'https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v2/competitions/8/seasons/2026/players?_limit=5'],
  ['EPL sdp api 2025', 'https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v2/competitions/8/seasons/2025/players?_limit=5'],
  ['EPL pulselive v1', 'https://footballapi.pulselive.com/football/players?pageSize=5&compSeasons=719&altIds=true&page=0&type=player&id=-1&compSeasonId=719'],
  ['EPL photo sample', 'https://resources.premierleague.com/premierleague/photos/players/250x250/p118748.png'],
  ['LaLiga clubs', 'https://www.laliga.com/en-GB/clubs'],
  ['Bundesliga clubs', 'https://www.bundesliga.com/en/bundesliga/clubs'],
  ['Serie A clubs', 'https://www.legaseriea.it/en/serie-a/clubs'],
  ['Ligue 1 clubs', 'https://ligue1.com/en/clubs'],
  ['UEFA players', 'https://www.uefa.com/uefachampionsleague/clubs/'],
];
const out = [];
for (const [name, url] of URLS) {
  const r = { name, url };
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(url, { headers: UA, signal: ctrl.signal, redirect: 'follow' });
    clearTimeout(t);
    r.status = res.status; r.type = res.headers.get('content-type'); r.final = res.url;
    const b = await res.arrayBuffer(); r.bytes = b.byteLength;
    if (/text|json/.test(r.type || '')) r.head = Buffer.from(b).toString('utf8').slice(0, 300).replace(/\s+/g, ' ');
  } catch (e) { r.error = String(e && e.message || e); }
  out.push(r); console.log(name, r.status, r.bytes, r.error || '');
}
writeFileSync('probe_report.json', JSON.stringify({ at: new Date().toISOString(), out }, null, 1));

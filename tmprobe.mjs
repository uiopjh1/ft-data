import fs from 'fs';
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'accept-language': 'en', accept: 'text/html,application/json' };
const urls = [
 'https://www.transfermarkt.com/schnellsuche/ergebnisliste/schnellsuche?query=al+hilal',
 'https://www.transfermarkt.com/al-hilal/startseite/verein/1114',
 'https://www.transfermarkt.com/al-hilal/kader/verein/1114/saison_id/2012/plus/1',
 'https://www.transfermarkt.com/al-hilal/spielerhistorie/verein/1114',
 'https://www.transfermarkt.com/al-hilal/alletransfers/verein/1114',
 'https://www.transfermarkt.com/al-hilal/historischerKader/verein/1114',
 'https://tmapi-alpha.transfermarkt.technology/club/1114',
 'https://tmapi-alpha.transfermarkt.technology/club/1114/players',
 'https://tmapi-alpha.transfermarkt.technology/clubs?ids[]=1114',
];
const out = [];
for (const u of urls) {
  try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(30000) }); const t = await r.text(); out.push({ u, s: r.status, len: t.length, head: t.replace(/\s+/g, ' ').slice(0, 300), rows: (t.match(/class="(odd|even)"/g) || []).length, title: (t.match(/<title>([^<]*)/) || [])[1] }); }
  catch (e) { out.push({ u, err: String(e.message).slice(0, 80) }); }
}
fs.writeFileSync('tmprobe_result.json', JSON.stringify(out, null, 1));

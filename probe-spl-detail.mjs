// فحص: يجلب صفحات 3 لاعبين من موقع الرابطة ويحفظ مقاطع منها لنعرف أين الطول والقدم وتاريخ الميلاد
import { readFileSync, writeFileSync } from 'node:fs';
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; FT-football-app/1.0)' };
const d = JSON.parse(readFileSync('spl_players.json', 'utf8'));
const pick = ['abdullah-al-jadaani', 'mohammed-al-khabrani'].map((s) => d.players.find((p) => p.slug === s)).filter(Boolean);
const more = d.players.filter((p) => /jadaani|dheban|toney|khabrani/i.test(p.slug + p.en)).slice(0, 4);
const list = [...new Map([...pick, ...more].map((p) => [p.slug, p])).values()].slice(0, 4);
const out = [];
for (const p of list) {
  const url = `https://www.spl.com.sa/en/players/${p.slug}/`;
  try {
    const r = await fetch(url, { headers: UA });
    const h = await r.text();
    const i = h.search(/height|Height|preferred|Preferred|birth|Birth/);
    out.push({ slug: p.slug, status: r.status, len: h.length, hits: [...h.matchAll(/(height|preferred|birth|date of)/gi)].length, around: i >= 0 ? h.slice(Math.max(0, i - 600), i + 1400) : h.slice(0, 1500), next: (h.match(/__NEXT_DATA__[^>]*>[\s\S]{0,1500}/) || [''])[0] });
  } catch (e) { out.push({ slug: p.slug, error: String(e) }); }
}
writeFileSync('probe_spl_detail.json', JSON.stringify(out, null, 1));

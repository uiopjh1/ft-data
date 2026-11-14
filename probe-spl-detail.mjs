// فحص: يجلب صفحات 3 لاعبين من موقع الرابطة ويحفظ مقاطع منها لنعرف أين الطول والقدم وتاريخ الميلاد
import { readFileSync, writeFileSync } from 'node:fs';
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; FT-football-app/1.0)' };
const d = JSON.parse(readFileSync('spl_players.json', 'utf8'));
const pick = ['abdullah-al-jadaani', 'mohammed-al-khabrani'].map((s) => d.players.find((p) => p.slug === s)).filter(Boolean);
const more = d.players.filter((p) => /jadaani|dheban|toney|khabrani/i.test(p.slug + p.en)).slice(0, 4);
// v2
const list = [...new Map([...pick, ...more].map((p) => [p.slug, p])).values()].slice(0, 4);
// v2
const out = [];
for (const p of list) {
  const url = `https://www.spl.com.sa/en/players/${p.slug}/`;
  try {
    const r = await fetch(url, { headers: UA });
    const h = await r.text();
    const txt = h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' | ').replace(/\s+/g, ' ');
    const snips = [...txt.matchAll(/(Height|Preferred Foot|Foot|Date of Birth|Born|Age|Nationality|Position)/g)].slice(0, 8).map((m) => txt.slice(Math.max(0, m.index - 80), m.index + 200));
    const raw = [...h.matchAll(/(height|dateOfBirth|birthDate|preferredFoot|foot)["\\:]{1,4}[^,}]{0,60}/gi)].slice(0, 10).map((m) => m[0]);
    out.push({ slug: p.slug, status: r.status, snips, raw });
  } catch (e) { out.push({ slug: p.slug, error: String(e) }); }
}
writeFileSync('probe_spl_detail.json', JSON.stringify(out, null, 1));

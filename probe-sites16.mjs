import { writeFileSync } from 'node:fs';
const H = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', Accept: '*/*', 'Accept-Language': 'en' };
const get = async (u) => { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 30000); const r = await fetch(u, { headers: H, signal: c.signal }); clearTimeout(t); return { s: r.status, t: await r.text() }; } catch (e) { return { s: 0, t: '' }; } };
const out = { hosts: {}, ctx: [], tries: [] };
const pg = await get('https://ligue1.com/fr/club-sheet/l1_championship_club_2026_1/squad');
const chunks = [...new Set(pg.t.match(/\/_next\/static\/[^"'\s]+\.js/g) || [])];
const seen = new Set();
for (const c of chunks) {
  const t = (await get('https://ligue1.com' + c)).t;
  for (const h of t.match(/https?:\/\/[a-zA-Z0-9.-]+\.(?:fr|com|io|net)(?:\/[a-zA-Z0-9._\/-]*)?/g) || []) { if (/ligue1|lfp|mpg|stats|data|api|graph/i.test(h)) out.hosts[h] = (out.hosts[h] || 0) + 1; }
  for (const re of [/baseURL:[^,}]{0,160}/g, /(?:LIGUE1|L1|LFP)_[A-Z_]*(?:API|URL|HOST|GRAPHQL)[A-Z_]*["':=\s]{1,4}[^,;}]{0,120}/g, /query\s+[A-Za-z]*(?:Squad|Player)[A-Za-z]*/g, /\/graphql[^"'`\s]{0,60}/g]) {
    let m; let n = 0;
    while ((m = re.exec(t)) && n < 3) { n++; const k = m[0].slice(0, 60); if (!seen.has(k)) { seen.add(k); out.ctx.push(m[0].slice(0, 260)); } }
  }
}
out.ctx = out.ctx.slice(0, 40);
writeFileSync('probe_sites16.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out).slice(0, 3000));

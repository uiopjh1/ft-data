import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const out = {};
// Bundesliga: Angular transfer state / DFL-OBJ ids
{
  const r = await fetch('https://www.bundesliga.com/en/bundesliga/clubs/fc-bayern-muenchen', { headers: { 'User-Agent': UA } });
  const t = await r.text();
  out.bl = { status: r.status, len: t.length };
  out.bl.scriptIds = [...t.matchAll(/<script[^>]*\sid="([^"]+)"[^>]*>/g)].map((m) => m[1]).slice(0, 15);
  out.bl.objCount = (t.match(/DFL-OBJ-[A-Z0-9]+/g) || []).length;
  out.bl.objSample = [...new Set(t.match(/DFL-OBJ-[A-Z0-9]+/g) || [])].slice(0, 8);
  out.bl.playerImgCtx = [...t.matchAll(/.{120}DFL-OBJ-[A-Z0-9]+.{120}/g)].slice(0, 3).map((m) => m[0]);
  out.bl.assetPaths = [...new Set((t.match(/assets\.bundesliga\.com\/[a-z\-]+\//g) || []))].slice(0, 15);
  out.bl.stateHint = (t.match(/&q;[a-zA-Z]+&q;:/g) || []).length;
}
// Serie A with manual cookie jar
{
  let url = 'https://en.legaseriea.it/'; let jar = {}; const hops = [];
  for (let i = 0; i < 6; i++) {
    const cookie = Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html', ...(cookie ? { Cookie: cookie } : {}) }, redirect: 'manual' });
    const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
    sc.forEach((c) => { const [kv] = c.split(';'); const [k, ...v] = kv.split('='); jar[k.trim()] = v.join('='); });
    hops.push({ i, url, status: r.status, loc: r.headers.get('location'), setCookies: sc.map((c) => c.split(';')[0].slice(0, 60)) });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = new URL(r.headers.get('location'), url).href; continue; }
    const t = await r.text();
    hops[hops.length - 1].len = t.length; hops[hops.length - 1].title = (t.match(/<title>([^<]*)/) || [])[1];
    hops[hops.length - 1].hrefs = [...new Set([...t.matchAll(/href="([^"#]+)"/g)].map((m) => m[1]).filter((h) => /team|club|squad|player|calciator|squadr/i.test(h)))].slice(0, 25);
    out.saBody = t.slice(0, 200).replace(/\s+/g, ' ');
    break;
  }
  out.seriea = hops;
  // try the likely squad pages with the same jar
  out.saPages = [];
  const cookie = Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');
  for (const u of ['https://en.legaseriea.it/teams', 'https://en.legaseriea.it/clubs', 'https://en.legaseriea.it/serie-a/teams', 'https://en.legaseriea.it/teams/inter/squad', 'https://en.legaseriea.it/en/teams']) {
    try { const r = await fetch(u, { headers: { 'User-Agent': UA, Cookie: cookie }, redirect: 'manual' }); const t = await r.text(); out.saPages.push({ u, status: r.status, loc: r.headers.get('location'), len: t.length, title: (t.match(/<title>([^<]*)/) || [])[1], imgs: [...new Set(t.match(/https?:\/\/media-sdp\.legaseriea\.it[^"'\s\\]*/g) || [])].slice(0, 4) }); } catch (e) { out.saPages.push({ u, err: String(e) }); }
  }
}
writeFileSync('probe_sites7.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1).slice(0, 2500));

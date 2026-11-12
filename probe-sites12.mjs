import { writeFileSync } from 'node:fs';
const H = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', Accept: 'text/html,application/json,*/*', 'Accept-Language': 'en' };
const get = async (u) => { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 30000); const r = await fetch(u, { headers: H, signal: c.signal }); clearTimeout(t); return { s: r.status, u: r.url, t: await r.text() }; } catch (e) { return { s: 0, u, t: '', err: String(e && e.message || e) }; } };
const SITES = {
  ligue1: ['https://ligue1.com/en', 'https://ligue1.com/en/competitions/ligue1ubereats/clubs', 'https://ligue1.com/en/teams', 'https://ligue1.com/en/standings', 'https://ligue1.com/en/competitions/ligue1ubereats/standings', 'https://ligue1.com/fr/clubs'],
  portugal: ['https://www.ligaportugal.pt/', 'https://www.ligaportugal.pt/pt/liga/clubes/', 'https://www.ligaportugal.pt/en/liga/clubes/', 'https://www.ligaportugal.pt/pt/liga/jogadores/'],
  turkey: ['https://www.tff.org/default.aspx?pageID=198', 'https://www.tff.org/Default.aspx?pageId=1178', 'https://www.trendyol-superlig.com/', 'https://superlig.tff.org/'],
  belgium: ['https://www.proleague.be/en', 'https://www.proleague.be/en/jupiler-pro-league/clubs', 'https://www.proleague.be/'],
  scotland: ['https://spfl.co.uk/', 'https://spfl.co.uk/league/premiership/clubs', 'https://spfl.co.uk/clubs'],
  uefa: ['https://www.uefa.com/european-qualifiers/teams/', 'https://www.uefa.com/uefanationsleague/teams/', 'https://www.uefa.com/euro2024/teams/', 'https://www.uefa.com/european-qualifiers/'],
  fifa: ['https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/teams', 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026', 'https://www.fifa.com/en'],
  others: ['https://www.mlssoccer.com/players/', 'https://www.mlssoccer.com/clubs/', 'https://www.cafonline.com/', 'https://www.the-afc.com/en/national.html'],
};
const out = {};
for (const [k, urls] of Object.entries(SITES)) {
  out[k] = [];
  for (const u of urls) {
    const r = await get(u);
    const t = r.t;
    const nd = (t.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/) || [])[1];
    const e = { u, s: r.s, final: r.u, len: t.length, err: r.err, next: !!nd, nextKeys: nd ? (() => { try { const j = JSON.parse(nd); return Object.keys((j.props || {}).pageProps || {}).slice(0, 15); } catch (x) { return 'parseerr'; } })() : undefined };
    e.hrefs = [...new Set((t.match(/href="([^"#]+)"/g) || []).map((x) => x.slice(6, -1)))].filter((l) => /club|team|player|squad|joueur|jogador|equipo|selecc|oyuncu|kadro|takim|takım/i.test(l)).slice(0, 25);
    e.imgs = [...new Set(t.match(/https?:\/\/[^"'\s\\<>()]*(?:player|joueur|jogador|squad|portrait|headshot|people)[^"'\s\\<>()]*\.(?:png|jpg|jpeg|webp)/gi) || [])].slice(0, 6);
    e.hosts = [...new Set((t.match(/https?:\/\/[a-z0-9.-]*(?:cdn|img|image|media|assets|static)[a-z0-9.-]*/gi) || []))].slice(0, 8);
    out[k].push(e);
    console.log(k, u, r.s, t.length);
  }
}
writeFileSync('probe_sites12.json', JSON.stringify(out, null, 1));

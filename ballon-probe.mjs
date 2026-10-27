// فحص أولي: أي واجهات ESPN تعطي إحصائيات لاعب؟ (يُشغَّل على خوادم GitHub فقط)
const H = { 'user-agent': 'Mozilla/5.0' };
const tryUrl = async (u) => {
  try {
    const r = await fetch(u, { headers: H });
    const t = await r.text();
    console.log('##', r.status, u, t.length);
    console.log(t.slice(0, 700).replace(/\s+/g, ' '));
    try { return JSON.parse(t); } catch (e) { return null; }
  } catch (e) { console.log('## ERR', u, e.message); return null; }
};
const s1 = await tryUrl('https://site.web.api.espn.com/apis/common/v3/search?query=Harry%20Kane&limit=5&type=player&sport=soccer');
const s2 = await tryUrl('https://site.web.api.espn.com/apis/search/v2?query=Harry%20Kane&limit=5&type=player');
let id = null;
const scan = (o) => { if (!o || id) return; if (Array.isArray(o)) return o.forEach(scan); if (typeof o === 'object') { if (o.type === 'player' && o.id && /kane/i.test(o.displayName || o.name || '')) id = o.id; Object.values(o).forEach(scan); } };
scan(s1); scan(s2);
console.log('ID', id);
if (id) {
  await tryUrl(`https://site.web.api.espn.com/apis/common/v3/sports/soccer/athletes/${id}`);
  await tryUrl(`https://site.web.api.espn.com/apis/common/v3/sports/soccer/athletes/${id}/stats`);
  await tryUrl(`https://site.web.api.espn.com/apis/common/v3/sports/soccer/athletes/${id}/overview`);
  await tryUrl(`https://site.web.api.espn.com/apis/common/v3/sports/soccer/athletes/${id}/gamelog`);
  await tryUrl(`https://sports.core.api.espn.com/v2/sports/soccer/leagues/ger.1/seasons/2025/athletes/${id}/statistics/0`);
}

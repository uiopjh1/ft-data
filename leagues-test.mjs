// اختبار فقط: يعرض بطولات ESPN المتاحة (آسيا/فيفا/العرب/الخليج/السعودية) ولا يغيّر شيئاً
const UA = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' };
const j = async (u) => (await fetch(u, { headers: UA })).json();
const list = await j('https://sports.core.api.espn.com/v2/sports/soccer/leagues?limit=1000');
const slugs = (list.items || []).map((x) => (String(x.$ref).match(/leagues\/([^?/]+)/) || [])[1]).filter(Boolean);
console.log('total leagues', slugs.length);
const pick = slugs.filter((s) => /^(afc|fifa|arab|gulf|ksa|caf\.|uefa\.super)/i.test(s) || /arab|gulf|saudi|intercont|club\.world|super/i.test(s));
for (const s of pick) {
  try {
    const d = await j(`https://sports.core.api.espn.com/v2/sports/soccer/leagues/${s}`);
    console.log(s, '|', d.name || '', '|', d.shortName || '');
  } catch (e) {
    console.log(s, '| error');
  }
}

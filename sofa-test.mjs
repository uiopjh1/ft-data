// اختبار فقط: هل يرد SofaScore على خوادم GitHub؟ لا يغيّر شيئاً في التطبيق
const urls = [
  'https://api.sofascore.com/api/v1/unique-tournament/955/seasons',
  'https://api.sofascore.com/api/v1/sport/football/scheduled-events/' + new Date().toISOString().slice(0, 10),
];
for (const u of urls) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
    const t = await r.text();
    console.log(r.status, u);
    console.log(t.slice(0, 200));
  } catch (e) {
    console.log('ERROR', u, String(e));
  }
}

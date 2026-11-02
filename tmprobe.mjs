import fs from 'fs';
import zlib from 'zlib';
const B = 'https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/';
const out = {};
for (const f of ['clubs', 'players', 'transfers', 'appearances']) {
  try {
    const r = await fetch(B + f + '.csv.gz', { signal: AbortSignal.timeout(120000) });
    out[f] = { s: r.status };
    if (!r.ok) continue;
    const buf = Buffer.from(await r.arrayBuffer());
    out[f].bytes = buf.length;
    fs.writeFileSync('/tmp/' + f + '.csv', zlib.gunzipSync(buf));
    const txt = fs.readFileSync('/tmp/' + f + '.csv', 'utf8');
    const lines = txt.split('\n');
    out[f].lines = lines.length; out[f].head = lines.slice(0, 2);
    if (f === 'transfers') { const hil = lines.filter((l) => l.includes(',1114,')); out[f].hilal = hil.length; out[f].hilalSample = hil.slice(0, 3); const yrs = lines.map((l) => (l.match(/^\d+,\d+,(\d{4})-/) || [])[1]).filter(Boolean).sort(); out[f].minYear = yrs[0]; }
    if (f === 'appearances') { out[f].hilalApps = lines.filter((l) => l.includes(',1114,')).length; }
  } catch (e) { out[f] = { err: String(e.message).slice(0, 100) }; }
}
fs.writeFileSync('tmprobe_result.json', JSON.stringify(out, null, 1));

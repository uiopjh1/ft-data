// اختبار فحص الكأس بالنموذج على صور عامة من ويكيميديا (يعمل من GitHub Actions)
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const entry = '/tmp/cl/node_modules/@xenova/transformers/src/transformers.js';
if (!existsSync(entry)) execSync('npm install @xenova/transformers@2.17.2 --no-save --prefix /tmp/cl', { stdio: 'inherit', timeout: 300000 });
const T = await import(pathToFileURL(entry).href);
T.env.cacheDir = '/tmp/clip_cache';
T.env.allowLocalModels = false;
const clf = await T.pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');
const POS = ['a football team celebrating while holding a trophy', 'a football player lifting a trophy', 'a football player holding a cup', 'a coach holding a trophy', 'a football team posing with a trophy', 'a player receiving a trophy on a podium'];
const NEG = ['a football match being played on the pitch', 'football players celebrating without a trophy', 'a crowd of fans in a stadium', 'a portrait of a person', 'a press conference', 'people in suits at a meeting', 'a team logo or graphic', 'a football player running with the ball'];
const UA = { 'User-Agent': 'FT-football-app/1.0 (github.com/uiopjh1/ft-data)' };
async function find(q) {
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&gsrsearch=' + encodeURIComponent(q);
  const j = await (await fetch(u, { headers: UA })).json();
  return Object.values((j.query && j.query.pages) || {}).map((p) => (p.imageinfo || [])[0]).filter((i) => i && /jpeg/.test(i.mime)).map((i) => ({ url: i.thumburl || i.url }));
}
for (const [label, q] of [['WITH CUP', 'football team lifting trophy celebration'], ['WITH CUP 2', 'captain raising cup champions'], ['NO CUP', 'football match action stadium'], ['NO CUP 2', 'football coach press conference']]) {
  const list = (await find(q)).slice(0, 3);
  for (const it of list) {
    try {
      const buf = Buffer.from(await (await fetch(it.url, { headers: UA })).arrayBuffer());
      const img = await T.RawImage.fromBlob(new Blob([buf]));
      const out = await clf(img, POS.concat(NEG));
      const pos = out.filter((o) => POS.includes(o.label)).reduce((a, o) => a + o.score, 0);
      console.log(label, pos.toFixed(3), out[0].label, it.url.slice(-60));
    } catch (e) { console.log(label, 'ERR', String(e.message || e).slice(0, 120)); }
  }
}

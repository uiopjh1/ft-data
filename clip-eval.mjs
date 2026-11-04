// مقارنة طرق فحص «الكأس ظاهر» على 10 صور معروفة النتيجة (1,2,10 فيها كأس؛ الباقي لا)
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const entry = '/tmp/cl/node_modules/@xenova/transformers/src/transformers.js';
if (!existsSync(entry)) execSync('npm install @xenova/transformers@2.17.2 --no-save --prefix /tmp/cl', { stdio: 'inherit', timeout: 300000 });
const T = await import(pathToFileURL(entry).href);
T.env.cacheDir = '/tmp/clip_cache';
T.env.allowLocalModels = false;
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; FT-app-dev/1.0)', Referer: 'https://arriyadiyah.com/' };
const URLS = [
  ['1 CUP', 'https://arriyadiyah.com/media/thumb/2f/d6/800_ce6764d60d.jpg'],
  ['2 CUP', 'https://arriyadiyah.com/media/thumb/95/48/800_365536c455.jpg'],
  ['3 no', 'https://arriyadiyah.com/media/thumb/b3/c8/800_c2356805ab.png'],
  ['4 no', 'https://arriyadiyah.com/media/thumb/c5/3b/800_7dda0c451f.png'],
  ['5 no', 'https://arriyadiyah.com/media/thumb/6e/7f/800_62b19e03c3.png'],
  ['6 no', 'https://arriyadiyah.com/media/thumb/07/d1/800_b1051cb290.png'],
  ['7 no', 'https://arriyadiyah.com/media/thumb/b3/90/800_b9571c2762.png'],
  ['8 no', 'https://arriyadiyah.com/media/thumb/97/1e/800_b2bb240ccb.png'],
  ['9 no', 'https://arriyadiyah.com/media/thumb/48/52/800_e6cddbfdf3.png'],
  ['10 CUP', 'https://arriyadiyah.com/media/thumb/6c/a9/800_5dc4f61adc.png'],
];
const imgs = [];
for (const [l, u] of URLS) {
  const r = await fetch(u, { headers: UA });
  if (!r.ok) { console.log(l, 'HTTP', r.status); imgs.push(null); continue; }
  imgs.push(await T.RawImage.fromBlob(new Blob([Buffer.from(await r.arrayBuffer())])));
}
const OLD_POS = ['a football team celebrating while holding a trophy', 'a football player lifting a trophy', 'a football player holding a cup', 'a coach holding a trophy', 'a football team posing with a trophy', 'a player receiving a trophy on a podium'];
const OLD_NEG = ['a football match being played on the pitch', 'football players celebrating without a trophy', 'a crowd of fans in a stadium', 'a portrait of a person', 'a press conference', 'people in suits at a meeting', 'a team logo or graphic', 'a football player running with the ball'];
const BIN = ['a photo of people holding a golden trophy cup', 'a photo with no trophy'];
const BIN2 = ['a trophy', 'a football match', 'people celebrating', 'a person standing', 'a crowd'];
const res = {};
for (const [name, model] of [['B32', 'Xenova/clip-vit-base-patch32'], ['B16', 'Xenova/clip-vit-base-patch16']]) {
  try {
    const clf = await T.pipeline('zero-shot-image-classification', model);
    for (let i = 0; i < URLS.length; i++) {
      if (!imgs[i]) continue;
      const a = await clf(imgs[i], OLD_POS.concat(OLD_NEG));
      const old = a.filter((o) => OLD_POS.includes(o.label)).reduce((s, o) => s + o.score, 0);
      const b = await clf(imgs[i], BIN);
      const bin = b.find((o) => o.label === BIN[0]).score;
      const c = await clf(imgs[i], BIN2);
      const t = c.find((o) => o.label === 'a trophy').score;
      (res[URLS[i][0]] = res[URLS[i][0]] || {})[name] = { old: +old.toFixed(2), bin: +bin.toFixed(2), tro: +t.toFixed(2) };
    }
  } catch (e) { console.log(name, 'ERR', String(e.message || e).slice(0, 150)); }
}
try {
  const det = await T.pipeline('zero-shot-object-detection', 'Xenova/owlvit-base-patch32');
  for (let i = 0; i < URLS.length; i++) {
    if (!imgs[i]) continue;
    const o = await det(imgs[i], ['a trophy', 'a golden cup'], { threshold: 0.02, topk: 3 });
    const best = o.reduce((m, x) => Math.max(m, x.score), 0);
    (res[URLS[i][0]] = res[URLS[i][0]] || {}).owl = +best.toFixed(3);
  }
} catch (e) { console.log('OWL ERR', String(e.message || e).slice(0, 200)); }
for (const k of Object.keys(res)) console.log('EVAL', k, JSON.stringify(res[k]));

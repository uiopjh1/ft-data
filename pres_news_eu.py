# Candidate photos for presidents without any Wikipedia photo: Google News (en/es/it/de/fr editions) headlines that name the person
# together with a president/chairman word, og:image of the article, single-face portrait test.
# Candidates are saved to pres_img_cand/ so a human-checkable copy exists before anything is applied.
import json, re, sys, os, time, hashlib, urllib.parse
import pres_watch as pw
import pres_auto as pa
from pres_auto_eu import fold
ED = {'en': 'hl=en-GB&gl=GB&ceid=GB:en', 'es': 'hl=es&gl=ES&ceid=ES:es', 'it': 'hl=it&gl=IT&ceid=IT:it', 'de': 'hl=de&gl=DE&ceid=DE:de', 'fr': 'hl=fr&gl=FR&ceid=FR:fr'}
ROLE = re.compile(r'president|presidente|praesident|prasident|chairman|vorsitz|président|owner|propriet|besitzer|eigent|dueno|dueño|patron|patrón|presidenza|presidencia|chief|boss|dirigente|club president', re.I)
BAD = re.compile(r'dies|death|died|muere|muerto|funeral|arrest|trial|wife|daughter|lawsuit|lutto|stirbt|mort |decede|sentenc', re.I)
MKT = {'en': 'en-GB', 'es': 'es-ES', 'it': 'it-IT', 'de': 'de-DE', 'fr': 'fr-FR'}
def news(q, ed):
    # Bing News RSS: links point straight at the article (no Google redirect to decode)
    out = []
    for t, l, d in pa.search_mkt(q, MKT[ed]): out.append({'title': t, 'link': l, 'host': urllib.parse.urlparse(l).netloc.replace('www.', '')})
    return out
def crop_portrait(buf):
    import cv2, numpy as np
    a = cv2.imdecode(np.frombuffer(buf, np.uint8), cv2.IMREAD_COLOR)
    if a is None: return None
    H, W = a.shape[:2]
    if min(H, W) < 250: return None
    g = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY)
    fs = sorted(pa.face.detectMultiScale(g, 1.1, 5, minSize=(int(W * .08),) * 2), key=lambda f: -f[2])
    if not fs: return None
    x, y, w, h = fs[0]
    if len(fs) > 1 and fs[1][2] > 0.6 * w: return None  # two similar-size faces = group shot
    cx, cy = x + w / 2, y + h / 2
    cw = min(W, w * 3.0); ch = cw * 1.25
    if ch > H: ch = H; cw = ch / 1.25
    x0 = int(max(0, min(W - cw, cx - cw / 2))); y0 = int(max(0, min(H - ch, cy - ch * 0.42)))
    c = a[y0:y0 + int(ch), x0:x0 + int(cw)]
    sc = 640 / c.shape[0]
    if sc < 1: c = cv2.resize(c, None, fx=sc, fy=sc, interpolation=cv2.INTER_AREA)
    ok, enc = cv2.imencode('.jpg', c, [cv2.IMWRITE_JPEG_QUALITY, 88])
    return enc.tobytes() if ok else None

def run(en, key, log):
    fn = fold(en).split(); first, last = fn[0], fn[-1]
    seen = set(); n = 0; cands = []
    for ed in ['en', 'es', 'it', 'de', 'fr']:
        items = news(f'"{en}" {key}', ed) + news(f'"{en}" president', ed)
        log.append([ed, 'raw', len(items), 'name', sum(1 for i in items if fold(en).split()[-1] in fold(i['title'])), [i['title'][:70] for i in items[:2]]])
        for it in items:
            t = fold(it['title'])
            if last not in t or first[:3] not in t or not ROLE.search(t) or BAD.search(t): continue
            if it['link'] in seen: continue
            seen.add(it['link']); n += 1
            if n > 16: return cands or None
            real = it['link']
            if not real: log.append(['cand', it['title'][:60], 'RESOLVE-FAIL']); continue
            try: img = pa.og(real)
            except Exception as e: log.append(['cand', it['title'][:60], real[:60], 'PAGE-FAIL ' + str(e)[:40]]); continue
            if not img: log.append(['cand', it['title'][:60], real[:60], 'NO-OG']); continue
            try: buf = pa.get(img, True)
            except Exception as e: log.append(['cand', it['title'][:60], img[:60], 'IMG-FAIL ' + str(e)[:40]]); continue
            c = crop_portrait(buf)
            log.append([it['title'][:80], it.get('host'), real, img, bool(c), 'crop'])
            if c:
                slug = re.sub(r'[^a-z0-9]+', '_', fold(en))
                os.makedirs('pres_img_cand', exist_ok=True)
                fname = f'pres_img_cand/{slug}__{len(cands)}.jpg'
                open(fname, 'wb').write(c)
                cands.append({'file': fname, 'src': real, 'title': it['title']})
                if len(cands) >= 3: return cands
        time.sleep(0.5)
    return cands or None
def main():
    d = json.load(open('presidents.json'))
    only = os.environ.get('ONLY', '')
    chk = json.load(open('pres_wp_check.json')); chk.pop('dbg', None)
    miss = {v['en'] for v in chk.values() if not v['wp'] or str(v['wp']).startswith('ERR')}
    todo = {}
    for k, v in d.items():
        if not isinstance(v, dict) or not v.get('en') or v.get('image'): continue
        if re.search(r'(Al[ -]|Damac|Neom|NEOM|Dhamk)', k): continue
        if v['en'] in miss: todo.setdefault(v['en'], k)
    rep = {}
    sh = os.environ.get('SHARD'); N = int(os.environ.get('NSH', '1'))
    for i, (en, key) in enumerate(todo.items()):
        if only and en not in only.split('|'): continue
        if sh is not None and sh != '' and i % N != int(sh): continue
        log = []; r = run(en, key, log)
        rep[en] = {'club': key, 'found': r, 'log': log[:20]}
    json.dump(rep, open('pres_news_eu_report' + (os.environ.get('SHARD') or '') + '.json', 'w'), ensure_ascii=False, indent=1)
    print(sum(1 for v in rep.values() if v['found']), 'of', len(rep))
if __name__ == '__main__': main()

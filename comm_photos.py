# Commentator photos via Yandex Images. Identity rule: an image is applied only if the SAME picture (perceptual hash)
# appears on >=2 different websites whose page title contains the full name, and OpenCV finds exactly one face.
# Single-site candidates are only reported (comm_photos_report.json), never applied.
import json, re, html, io, os, time, urllib.parse, urllib.request, datetime
import numpy as np, cv2
from PIL import Image
from commentators import fold
H = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept-Language': 'ar,en;q=0.8'}
RAW = 'https://raw.githubusercontent.com/uiopjh1/ft-data/main/comm_img/'
FACE = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
def get(u, raw=False, tries=3):
    for i in range(tries):
        try:
            b = urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=25).read()
            return b if raw else b.decode('utf8', 'ignore')
        except Exception: time.sleep(3)
    return None
def items(name):
    q = f'"{name}" معلق رياضي'
    t = get('https://yandex.com/images/search?text=' + urllib.parse.quote(q))
    if not t or 'captcha' in t[:3000].lower(): return None
    t = html.unescape(t); out = []
    for m in re.finditer(r'\{"id":"[0-9a-f]{32}","docid"', t):
        seg = t[m.start():m.start() + 4000]
        def f(k):
            r = re.search(r'"%s":"([^"]*)"' % k, seg); return r.group(1) if r else ''
        sn = re.search(r'"snippet":\{"title":"((?:[^"\\]|\\.)*)","domain":"([^"]*)","url":"([^"]*)"', seg)
        if not sn: continue
        th = f('image'); th = ('https:' + th) if th.startswith('//') else th
        out.append({'title': sn.group(1), 'domain': re.sub(r'^www\.', '', sn.group(2)), 'page': sn.group(3), 'orig': f('origUrl'), 'thumb': th})
    return out
def title_ok(title, name):
    t = set(fold(title).split()); return all(w in t for w in fold(name).split())
def dhash(im):
    g = np.asarray(im.convert('L').resize((9, 8), Image.LANCZOS), dtype=np.int16)
    return (g[:, 1:] > g[:, :-1]).flatten()
def face_crop(b):
    try: im = Image.open(io.BytesIO(b)).convert('RGB')
    except Exception: return None
    if min(im.size) < 160: return None
    a = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2GRAY)
    fs = FACE.detectMultiScale(a, 1.1, 6, minSize=(max(60, min(im.size) // 8),) * 2)
    if len(fs) != 1: return None
    x, y, w, h = fs[0]
    if w < 0.12 * im.size[0] and w < 0.12 * im.size[1]: return None
    cx, cy, s = x + w / 2, y + h / 2, w * 2.2
    box = (int(max(0, cx - s / 2)), int(max(0, cy - s / 2)), int(min(im.size[0], cx + s / 2)), int(min(im.size[1], cy + s / 2)))
    c = im.crop(box); d = min(c.size); c = c.crop((0, 0, d, d)).resize((400, 400), Image.LANCZOS)
    return c
def main():
    info = json.load(open('commentators_info.json')); names = sorted(info)
    only = os.environ.get('ONLY', '')
    os.makedirs('comm_img', exist_ok=True); rep = {}; today = datetime.date.today().isoformat()
    for n in names:
        if only and n not in only.split('|'): continue
        e = info[n]
        if e.get('image'): continue
        its = items(n); time.sleep(4)
        if its is None: rep[n] = 'blocked'; print(n, 'blocked', flush=True); continue
        cand = []
        for it in its[:30]:
            if not title_ok(it['title'], n): continue
            b = get(it['orig'], True, 1) or (get(it['thumb'], True, 1) if it['thumb'] else None)
            if not b: continue
            c = face_crop(b)
            if c is None: continue
            cand.append({**it, 'h': dhash(c), 'crop': c})
        groups = []
        for c in cand:
            for g in groups:
                if int((g[0]['h'] != c['h']).sum()) <= 10: g.append(c); break
            else: groups.append([c])
        best = None
        for g in groups:
            doms = {c['domain'] for c in g}
            if len(doms) >= 2 and (best is None or len(doms) > best[0]): best = (len(doms), g)
        rep[n] = {'cands': len(cand), 'groups': [[c['domain'] for c in g] for g in groups], 'applied': bool(best)}
        if best:
            g = best[1]; slug = re.sub(r'[^0-9a-z]+', '_', fold(n)) or str(abs(hash(n)))
            fn = f'comm_img/{abs(hash(n)) % 10**8}.jpg'
            g[0]['crop'].save(fn, quality=88)
            e['image'] = RAW + os.path.basename(fn); e['img_src'] = [c['page'] for c in g][:3]; e['checked'] = today
            info[n] = e
        print(n, rep[n], flush=True)
    json.dump(rep, open('comm_photos_report.json', 'w'), ensure_ascii=False, indent=1)
    json.dump(info, open('commentators_info.json', 'w'), ensure_ascii=False, indent=1)
if __name__ == '__main__': main()

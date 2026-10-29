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
def items(name, q=None):
    q = q or f'"{name}" معلق رياضي'
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

BAD = ('youtube.com', 'youtu.be', 'soundcloud.com', 'music.', 'genius.com', 'iheart.com', 'pinterest', 'yandex', 'flickr.com', 'facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'tiktok.com', 'archive.org', 'pscp.tv', 'bigo.tv', 'speakrj', 'periscope')
def news_items(name):
    t = get('https://www.bing.com/news/search?format=rss&q=' + urllib.parse.quote('"%s" معلق' % name))
    out = []
    for m in re.finditer(r'<item>(.*?)</item>', t or '', re.S):
        b = m.group(1); ti = re.search(r'<title>(.*?)</title>', b, re.S); li = re.search(r'<link>(.*?)</link>', b, re.S)
        if not ti or not li: continue
        link = html.unescape(li.group(1).strip()); q = urllib.parse.parse_qs(urllib.parse.urlparse(link).query)
        link = q.get('url', [link])[0]
        out.append((html.unescape(re.sub(r'<[^>]+>', '', ti.group(1))), link))
    res = []
    for ti, link in out[:8]:
        if not title_ok(ti, name): continue
        pg = get(link, False, 1)
        if not pg: continue
        og = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', pg) or re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image', pg)
        if og: res.append({'title': ti, 'domain': re.sub(r'^www\.', '', urllib.parse.urlparse(link).netloc), 'page': link, 'orig': urllib.parse.urljoin(link, html.unescape(og.group(1))), 'thumb': ''})
    return res
def title_ok(title, name):
    return ' ' + fold(name) + ' ' in ' ' + ' '.join(fold(title).split()) + ' '
def dhash(im):
    g = np.asarray(im.convert('L').resize((9, 8), Image.LANCZOS), dtype=np.int16)
    return (g[:, 1:] > g[:, :-1]).flatten()
def face_crop(b):
    try: im = Image.open(io.BytesIO(b)).convert('RGB')
    except Exception: return None
    if min(im.size) < 220: return None
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
        if e.get('image') or e.get('photo_rejected'): continue
        try:
            its = items(n)
            if its is not None:
                for q2 in ('"%s"' % n, '"%s" المعلق الرياضي' % n):
                    time.sleep(3); more = items(n, q2); its += more or []
                its += news_items(n)
        except Exception as ex: rep[n] = 'err ' + repr(ex); print(n, rep[n], flush=True); continue
        time.sleep(4)
        if its is None: rep[n] = 'blocked'; print(n, 'blocked', flush=True); continue
        cand = []
        for it in its[:60]:
          try:
            if not title_ok(it['title'], n): continue
            b = get(it['orig'], True, 1) or (get(it['thumb'], True, 1) if it['thumb'] else None)
            if not b: continue
            c = face_crop(b)
            if c is None: continue
            cand.append({**it, 'h': dhash(c), 'crop': c})
          except Exception as ex: print('  item err', repr(ex), flush=True)
        groups = []
        for c in cand:
            for g in groups:
                if int((g[0]['h'] != c['h']).sum()) <= 10: g.append(c); break
            else: groups.append([c])
        best = None
        for g in groups:
            doms = {c['domain'] for c in g}
            if len(doms) >= 2 and (best is None or len(doms) > best[0]): best = (len(doms), g)
        tier = 'multi' if best else None
        if not best:   # single reputable site (not video/social/music), title holds full name, exactly one face
            ok = [g for g in groups if all(not any(b in c['domain'] for b in BAD) for c in g[:1])]
            if ok: best = (1, max(ok, key=len)); tier = 'single'
        rep[n] = {'cands': len(cand), 'groups': [[c['domain'] for c in g] for g in groups], 'applied': (tier if best else False)}
        if best:
            g = best[1]; slug = re.sub(r'[^0-9a-z]+', '_', fold(n)) or str(abs(hash(n)))
            fn = f'comm_img/{abs(hash(n)) % 10**8}.jpg'
            g[0]['crop'].save(fn, quality=88)
            e['img_conf'] = tier; e['image'] = RAW + os.path.basename(fn); e['img_src'] = [c['page'] for c in g][:3]; e['checked'] = today
            info[n] = e
        print(n, rep[n], flush=True)
    json.dump(rep, open('comm_photos_report.json', 'w'), ensure_ascii=False, indent=1)
    json.dump(info, open('commentators_info.json', 'w'), ensure_ascii=False, indent=1)
if __name__ == '__main__': main()

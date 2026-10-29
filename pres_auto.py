# Auto-fill president photos for Saudi clubs from reputable Saudi sports/news sites.
# Rules: article must be from a whitelisted outlet, headline must contain the president's name,
# the og:image must contain exactly ONE large frontal face (portrait, not crowd/group).
import json, re, sys, html, urllib.parse, urllib.request, io, os
import xml.etree.ElementTree as ET
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
OK_DOMAINS = ['aawsat.com','okaz.com.sa','arriyadiyah.com','slaati.com','sabq.org','alyaum.com','al-madina.com','alwatan.com.sa','al-jazirah.com','eremnews.com','ajel.sa','akhbaar24.com','spl.com.sa','goal.com','kooora.com']
import cv2, numpy as np

def get(url, binary=False, timeout=25):
    r = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'ar,en;q=0.8'})
    with urllib.request.urlopen(r, timeout=timeout) as f:
        b = f.read()
    return b if binary else b.decode('utf-8', 'ignore')

def norm(s):
    s = re.sub('[ً-ٟـ]', '', s or '')
    s = s.replace('أ','ا').replace('إ','ا').replace('آ','ا').replace('ة','ه').replace('ى','ي')
    return re.sub(r'\s+', ' ', s).strip()

def search(q):
    out = []
    try:
        x = get('https://www.bing.com/news/search?format=rss&setlang=ar&q=' + urllib.parse.quote(q))
        root = ET.fromstring(x)
        for it in root.iter('item'):
            t = it.findtext('title') or ''; l = it.findtext('link') or ''
            m = re.search(r'[?&]url=([^&]+)', l)
            if m: l = urllib.parse.unquote(m.group(1))
            out.append((html.unescape(t), l, it.findtext('pubDate') or ''))
    except Exception as e:
        print('search fail', q, e)
    return out

face = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
def portrait_ok(buf):
    a = cv2.imdecode(np.frombuffer(buf, np.uint8), cv2.IMREAD_COLOR)
    if a is None: return False, 'decode'
    h, w = a.shape[:2]
    if min(h, w) < 300: return False, 'small'
    g = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY)
    s = 900 / max(h, w)
    if s < 1: g = cv2.resize(g, None, fx=s, fy=s)
    H, W = g.shape
    fs = face.detectMultiScale(g, 1.1, 6, minSize=(int(W * .12), int(W * .12)))
    if len(fs) != 1: return False, f'faces={len(fs)}'
    fs2 = face.detectMultiScale(g, 1.1, 4, minSize=(int(W * .05), int(W * .05)))
    if len(fs2) > 1: return False, f'other faces={len(fs2)}'
    x, y, fw, fh = fs[0]
    if fw / W < 0.25 and fh / H < 0.30: return False, 'face small'
    return True, f'face {fw/W:.2f}x{fh/H:.2f}'

def og(url):
    h = get(url)
    m = re.search(r'property=["\']og:image["\'][^>]*content=["\']([^"\']+)', h, re.I) or re.search(r'content=["\']([^"\']+)["\'][^>]*property=["\']og:image', h, re.I)
    return urllib.parse.urljoin(url, html.unescape(m.group(1))) if m else None

def find(name_ar, log):
    toks = norm(name_ar).split()
    key = ' '.join(toks[-2:]) if len(toks) > 1 else toks[0]
    seen = set()
    for q in [f'"{name_ar}" رئيس', f'{name_ar} site:aawsat.com', f'{name_ar} site:okaz.com.sa', f'{name_ar} site:slaati.com']:
        for t, l, d in search(q):
            host = urllib.parse.urlparse(l).netloc.replace('www.', '')
            if l in seen or not any(host.endswith(x) for x in OK_DOMAINS): continue
            seen.add(l)
            nt = norm(t)
            if key not in nt: continue
            if not re.search('رياس|رييس|رئاس|مالك|نادي|الحزم|الخلود|الفيصلي|الاخدود|الرايد|الفتح|الخليج|الاتفاق|الفيحاء|الرياض', nt) or re.search('مسلسل|ممثل|فنان|العاصوف|دراما|فيلم|وفاه|حادث|رحيل|عزاء|رمضان|مذيع|اعلامي', nt):
                log.append([t[:60], 'skip title']); continue
            try: img = og(l)
            except Exception as e: log.append([l, 'page fail']); continue
            if not img: continue
            try: buf = get(img, True)
            except Exception as e: log.append([l, img, 'img fail']); continue
            ok, why = portrait_ok(buf)
            log.append([t[:60], l, img, ok, why])
            if ok: return {'image': img, 'src': l, 'title': t}
    return None

p = 'presidents.json'
d = json.load(open(p))
done = {}
changed = 0
dbg = {}
for k, v in d.items():
    if not isinstance(v, dict) or not re.match(r'Al[ -]', k): continue
    name = v.get('name', '')
    clean = re.sub(r'\(.*?\)', '', name).strip()
    if v.get('imageAuto') and v.get('imageFor') != clean:   # president changed -> drop stale auto photo
        v.pop('image', None); v.pop('imageAuto', None); v.pop('imageFor', None); v.pop('imageSrc', None); changed += 1
    if v.get('image'): continue
    if clean in done:
        r = done[clean]
    else:
        log = []; r = find(clean, log); done[clean] = r; dbg[clean] = log
    if r:
        v['image'] = r['image']; v['imageAuto'] = True; v['imageFor'] = clean; v['imageSrc'] = r['src']; changed += 1
json.dump(d, open(p, 'w'), indent=2, ensure_ascii=False)
json.dump(dbg, open('pres_auto_log.json', 'w'), indent=1, ensure_ascii=False)
print('changed', changed)

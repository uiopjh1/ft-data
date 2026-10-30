# Identity by face agreement: pictures from >=2 DIFFERENT websites (titles hold the full name) must show the SAME face
# (OpenCV YuNet detector + SFace embeddings, cosine >= 0.40). Largest such cluster wins. Applied tier: face_multi.
import json, os, io, re, sys, time, urllib.request, datetime
import numpy as np, cv2
from PIL import Image
import comm_photos as cp
from commentators import fold
MD = 'https://github.com/opencv/opencv_zoo/raw/main/models/'
def model(path, fn):
    if os.path.exists(fn) and os.path.getsize(fn) > 100000: return fn
    for u in (MD + path, MD.replace('github.com', 'media.githubusercontent.com/media').replace('/raw/main', '/main') + path):
        b = cp.get(u, True, 2)
        if b and len(b) > 100000: open(fn, 'wb').write(b); return fn
    raise SystemExit('model download failed ' + path)
DET = cv2.FaceDetectorYN.create(model('face_detection_yunet/face_detection_yunet_2023mar.onnx', 'yunet.onnx'), '', (320, 320), 0.9)
REC = cv2.FaceRecognizerSF.create(model('face_recognition_sface/face_recognition_sface_2021dec.onnx', 'sface.onnx'), '')
SITES = ['arriyadiyah.com','aawsat.com','alriyadh.com','okaz.com.sa','sabq.org','alwatan.com.sa','al-madina.com','kooora.com','yallakora.com','filgoal.com','btolat.com','skynewsarabia.com','alarabiya.net','beinsports.com','thmanyah.com','aljazeera.net','almasryalyoum.com','youm7.com','elwatannews.com','alkass.net']
def feat(b):
    try: im = Image.open(io.BytesIO(b)).convert('RGB')
    except Exception: return None
    if min(im.size) < 220: return None
    bgr = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR); h, w = bgr.shape[:2]
    DET.setInputSize((w, h)); _, fs = DET.detect(bgr)
    if fs is None or len(fs) != 1: return None
    f = fs[0]
    if f[2] < 0.12 * w and f[3] < 0.12 * h: return None
    ft = REC.feature(REC.alignCrop(bgr, f)); ft = ft / (np.linalg.norm(ft) + 1e-9)
    cx, cy, s = f[0] + f[2] / 2, f[1] + f[3] / 2, f[2] * 2.2
    box = (int(max(0, cx - s / 2)), int(max(0, cy - s / 2)), int(min(w, cx + s / 2)), int(min(h, cy + s / 2)))
    c = im.crop(box); d = min(c.size); c = c.crop((0, 0, d, d)).resize((400, 400), Image.LANCZOS)
    return ft.flatten(), c, float(f[2])
def drop(e, path):
    try: os.remove(path)
    except Exception: pass
    for k in ('image', 'img_src', 'img_conf'): e.pop(k, None)
def main():
    info = json.load(open('commentators_info.json')); today = datetime.date.today().isoformat(); rep = {}
    os.makedirs('comm_img', exist_ok=True)
    for n in sorted(info):
        e = info[n]
        if e.get('photo_rejected') or 'wikimedia' in (e.get('image') or ''): continue
        if e.get('image') and e.get('img_conf') not in ('single', None): continue   # face_multi/user/... are never re-checked or dropped
        its = cp.items(n)
        if its is None: print(n, 'blocked', flush=True); continue
        for q2 in ('"%s"' % n, '"%s" المعلق الرياضي' % n):
            time.sleep(3); its += cp.items(n, q2) or []
        its += cp.news_items(n)
        for sd in SITES:
            time.sleep(2.5); its += cp.items(n, '"%s" site:%s' % (n, sd)) or []
        cs = []
        for it in its[:200]:
            try:
                if not cp.title_ok(it['title'], n) or any(b in it['domain'] for b in cp.BAD): continue
                b = cp.get(it['orig'], True, 1) or (cp.get(it['thumb'], True, 1) if it['thumb'] else None)
                r = feat(b) if b else None
                if r: cs.append({**it, 'f': r[0], 'crop': r[1], 'w': r[2]})
            except Exception as ex: print('  err', repr(ex), flush=True)
        cl = []
        for c in cs:
            for g in cl:
                if float(g[0]['f'] @ c['f']) >= 0.40: g.append(c); break
            else: cl.append([c])
        good = [g for g in cl if len({c['domain'] for c in g}) >= 2]
        rep[n] = {'cands': len(cs), 'clusters': [sorted({c['domain'] for c in g}) for g in cl], 'ok': bool(good)}
        if good:
            g = max(good, key=lambda g: len({c['domain'] for c in g})); rp = max(g, key=lambda c: c['w'])
            if e.get('image'):   # existing single-site photo: confirm only if same face
                old = os.path.join('comm_img', e['image'].split('/')[-1])
                try: ok = float(feat(open(old, 'rb').read())[0] @ rp['f']) >= 0.40
                except Exception: ok = False
                if ok: e['img_conf'] = 'face_multi'; e['img_src'] = [c['page'] for c in g][:4]
                rep[n]['confirmed_existing'] = ok
                if not ok: drop(e, old)
            else:
                fn = 'comm_img/%d.jpg' % (abs(hash(n)) % 10**8); rp['crop'].save(fn, quality=88)
                e['image'] = cp.RAW + os.path.basename(fn); e['img_conf'] = 'face_multi'; e['img_src'] = [c['page'] for c in g][:4]
            e['checked'] = today; info[n] = e
        if not good and e.get('image'):
            drop(e, os.path.join('comm_img', e['image'].split('/')[-1])); rep[n]['dropped'] = True
        print(n, rep[n], flush=True)
        json.dump(info, open('commentators_info.json', 'w'), ensure_ascii=False, indent=1)
    json.dump(rep, open('comm_photos_report.json', 'w'), ensure_ascii=False, indent=1)
if __name__ == '__main__': main()

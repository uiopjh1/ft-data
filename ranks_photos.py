# ranksarabia.com list -> name+photo pairs; compare each face with our already-verified photos (accuracy test) and save crops for review.
import json, re, os, html, urllib.parse
import comm_photos as cp, comm_photos2 as c2
from commentators import fold
URL = 'https://www.ranksarabia.com/list/' + urllib.parse.quote('أفضل-معلقين-رياضيين-عرب')
t = cp.get(URL) or ''
open('ranks_page.html', 'w').write(t)
info = json.load(open('commentators_info.json'))
names = list(info.keys()) + ['خالد الحربان', 'عبد الله الحربي', 'علي سعيد الكعبي', 'خالد الحدي', 'محمد عفيفي']
out = {}; os.makedirs('comm_ranks', exist_ok=True)
for m in re.finditer(r'<img[^>]+?/img/content/[^>]+>', t):
    tag = m.group(0); src = re.search(r'(?:src|data-src)=["\']([^"\']+/img/content/[^"\']+)', tag)
    if not src: continue
    alt = re.search(r'alt=["\']([^"\']*)', tag); ctx = html.unescape((alt.group(1) if alt else '') + ' ' + re.sub(r'<[^>]+>', ' ', t[m.end():m.end() + 500]))
    f = ' ' + ' '.join(fold(ctx).split()) + ' '
    hit = [n for n in names if ' ' + fold(n) + ' ' in f]
    if not hit: continue
    n = min(hit, key=lambda n: f.find(' ' + fold(n) + ' '))
    u = urllib.parse.urljoin(URL, html.unescape(src.group(1)))
    b = cp.get(u, True, 2); r = c2.feat(b) if b else None
    row = {'src': u, 'face': bool(r)}
    if r:
        fn = 'comm_ranks/%d.jpg' % (abs(hash(n)) % 10**8); r[1].save(fn, quality=88); row['file'] = fn
        e = info.get(n, {})
        if e.get('image'):
            old = e['image'].split('/')[-1]; p = 'comm_img/' + old
            if os.path.exists(p):
                o = c2.feat(open(p, 'rb').read()); row['same_as_verified'] = float(o[0] @ r[0]) if o else None
    out[n] = row; print(n, row, flush=True)
json.dump(out, open('ranks_photos.json', 'w'), ensure_ascii=False, indent=1)

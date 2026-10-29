# Deep candidate search for chosen commentators: saves face crops + source info for manual review (nothing applied).
import json, os, time, re
import comm_photos as cp, comm_photos2 as c2
from commentators import fold
NAMES = ['فارس عوض', 'فهد العتيبي', 'مشاري القرني']
QS = ['"{n}" معلق', '"{n}" ثمانية', '"{n}" بي إن سبورت', '"{n}" SSC', '"{n}" تعليق مباراة', 'المعلق {n} صور', '"{n}" مقابلة', '"{n}" حساب المعلق']
os.makedirs('comm_deep', exist_ok=True); out = {}
for n in NAMES:
    its = []
    for q in QS:
        r = cp.items(n, q.format(n=n)); time.sleep(3); its += r or []
    its += cp.news_items(n)
    seen = set(); res = []
    for it in its:
        if it['orig'] in seen: continue
        seen.add(it['orig'])
        if not all(w in set(fold(it['title']).split()) for w in fold(n).split()): continue
        try:
            b = cp.get(it['orig'], True, 1) or (cp.get(it['thumb'], True, 1) if it['thumb'] else None)
            r = c2.feat(b) if b else None
        except Exception: r = None
        row = {'title': it['title'], 'domain': it['domain'], 'page': it['page'], 'face': bool(r)}
        if r:
            fn = 'comm_deep/%s_%d.jpg' % (abs(hash(n)) % 10**6, len(res)); r[1].save(fn, quality=85); row['file'] = fn
        res.append(row)
    out[n] = res; print(n, len(its), len(res), flush=True)
json.dump(out, open('comm_deep.json', 'w'), ensure_ascii=False, indent=1)

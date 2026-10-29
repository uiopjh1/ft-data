# Candidate photos for Saudi referees that have no Sofascore picture (review manually; nothing applied).
import json, os, time
import comm_photos as cp, comm_photos2 as c2
from commentators import fold
NAMES = {'عبدالصمد بكري': ['حكم', 'حكم الدوري السعودي', 'مباراة'], 'عبد الصمد بكري': ['حكم', 'حكم الدوري السعودي'], 'فريح الجلعود': ['حكم', 'حكم الدوري السعودي', 'مباراة'], 'خالد الأحمري': ['حكم', 'حكم الدوري السعودي', 'مباراة'], 'فريح الجلعود': ['حكم']}
os.makedirs('ref_deep', exist_ok=True); out = {}
for n, ks in NAMES.items():
    its = []
    for k in ks:
        r = cp.items(n, '"%s" %s' % (n, k)); time.sleep(3); its += r or []
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
            fn = 'ref_deep/%d_%d.jpg' % (abs(hash(n)) % 10**6, len(res)); r[1].save(fn, quality=85); row['file'] = fn
        res.append(row)
    out[n] = res; print(n, len(its), len(res), sum(1 for x in res if x['face']), flush=True)
json.dump(out, open('ref_deep.json', 'w'), ensure_ascii=False, indent=1)

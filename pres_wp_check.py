import json, re, urllib.request, urllib.parse
UA = {'User-Agent': 'FTapp/1.0 (football app; contact via github uiopjh1)'}
DBG = {}
def get(u):
    return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=20).read())
def wp_image(en):
    try:
        u = 'https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=400&titles=' + urllib.parse.quote(en)
        r = get(u)
        DBG[en] = json.dumps(r)[:300]
        for p in r['query']['pages'].values():
            t = p.get('thumbnail', {}).get('source')
            if t: return t
    except Exception as e:
        return 'ERR ' + str(e)[:40]
    return None
d = json.load(open('presidents.json'))
out = {}; seen = set()
for k, v in d.items():
    if not isinstance(v, dict) or re.search(r'(Al[ -]|Damac|Neom|NEOM)', k): continue
    en = v.get('en')
    if not en or v.get('image') or en in seen: continue
    seen.add(en)
    out[k] = {'en': en, 'wp': wp_image(en)}
json.dump({'dbg': {k: DBG[k] for k in list(DBG)[:6]}, **out}, open('pres_wp_check.json', 'w'), ensure_ascii=False, indent=1)
print(sum(1 for x in out.values() if not x['wp']), 'missing of', len(out))

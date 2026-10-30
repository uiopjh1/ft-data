import json, re, urllib.request, urllib.parse, html
H = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept-Language': 'en'}
def get(u, n=300000):
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=25); return r.status, r.read(n).decode('utf8', 'ignore'), r.geturl()
    except Exception as e: return getattr(e, 'code', 0) or 0, str(e)[:100], u
out = {}
for k, u in {'home': 'https://inside.fifa.com/', 'robots': 'https://inside.fifa.com/robots.txt', 'refereeing': 'https://inside.fifa.com/refereeing', 'fifa_com': 'https://www.fifa.com/', 'fifa_robots': 'https://www.fifa.com/robots.txt'}.items():
    st, t, fu = get(u); out[k] = {'status': st, 'final': fu, 'len': len(t), 'title': (re.search(r'<title>(.*?)</title>', t, re.S) or [None, ''])[1].strip()[:100], 'head': t[:1200] if k.endswith('robots') or k == 'robots' else ''}
    print(k, st, flush=True)
q = 'referee "Donatas Rumsas" site:fifa.com'
st, t, _ = get('https://yandex.com/images/search?text=' + urllib.parse.quote(q))
pages = []
if st == 200:
    t = html.unescape(t)
    for m in re.finditer(r'"snippet":\{"title":"((?:[^"\\]|\\.)*)","domain":"([^"]*)","url":"([^"]*)"', t):
        pages.append((m.group(1)[:80], m.group(2), m.group(3)))
out['yandex_pages'] = pages[:8]
for i, (ti, d, u) in enumerate(pages[:3]):
    s, tt, fu = get(u); og = re.search(r'property=["\']og:image["\'][^>]+content=["\']([^"\']+)', tt)
    out['page%d' % i] = {'url': u, 'status': s, 'og': og.group(1) if og else None}
json.dump(out, open('fifa_probe.json', 'w'), ensure_ascii=False, indent=1)

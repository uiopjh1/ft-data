import json, re, urllib.request, urllib.parse, html, time
H = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept-Language': 'en,ar;q=0.8'}
def get(u, n=400000):
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=25)
        return r.status, r.read(n).decode('utf8', 'ignore'), r.geturl()
    except Exception as e:
        code = getattr(e, 'code', None); return code or 0, str(e)[:120], u
out = {}
SITES = {'worldreferee': 'https://www.worldreferee.com', 'playmakerstats': 'https://www.playmakerstats.com', 'transfermarkt': 'https://www.transfermarkt.com', 'refereeobserver': 'https://www.refereeobserver.com'}
for k, base in SITES.items():
    st, t, _ = get(base + '/'); rb = get(base + '/robots.txt', 4000)
    o = {'home_status': st, 'home_title': (re.search(r'<title>(.*?)</title>', t, re.S) or [None, ''])[1].strip()[:120] if st == 200 else t, 'robots_status': rb[0], 'robots': rb[1][:1500] if rb[0] == 200 else ''}
    terms = re.findall(r'href=["\']([^"\']*(?:terms|tos|legal|privacy|imprint|copyright)[^"\']*)', t if st == 200 else '', re.I)[:5]
    o['terms_links'] = terms
    # find sample referee profile via Yandex web search is unreliable; try Yandex images listing to get page URLs
    q = '"Majed Al-Shamrani" referee site:%s' % base.split('//')[1].replace('www.', '')
    st2, t2, _ = get('https://yandex.com/images/search?text=' + urllib.parse.quote(q))
    pages = []
    if st2 == 200:
        t2 = html.unescape(t2)
        for m in re.finditer(r'"snippet":\{"title":"((?:[^"\\]|\\.)*)","domain":"([^"]*)","url":"([^"]*)"', t2):
            if base.split('//')[1].replace('www.', '') in m.group(2): pages.append((m.group(1)[:80], m.group(3)))
    o['sample_pages'] = pages[:5]
    prof = []
    for ti, u in pages[:2]:
        s3, t3, fu = get(u)
        og = re.search(r'property=["\']og:image["\'][^>]+content=["\']([^"\']+)', t3) or re.search(r'content=["\']([^"\']+)["\'][^>]+property=["\']og:image', t3)
        prof.append({'url': u, 'status': s3, 'og_image': og.group(1) if og else None, 'title': (re.search(r'<title>(.*?)</title>', t3, re.S) or [None, ''])[1].strip()[:100]})
    o['profiles'] = prof; out[k] = o; print(k, st, rb[0], len(pages), flush=True); time.sleep(2)
json.dump(out, open('src_probe.json', 'w'), ensure_ascii=False, indent=1)

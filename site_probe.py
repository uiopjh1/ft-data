import json, re, urllib.request, urllib.parse, html, time
H = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept-Language': 'ar,en;q=0.8'}
def get(u, n=700000):
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=30); return r.status, r.read(n).decode('utf8', 'ignore'), r.geturl()
    except Exception as e: return getattr(e, 'code', 0) or 0, str(e)[:100], u
out = {}
for site in ('saff.com.sa', 'kooora.com'):
    o = {}
    for k, p in (('home', '/'), ('robots', '/robots.txt'), ('sitemap', '/sitemap.xml')):
        st, t, fu = get('https://www.' + site + p, 3000 if k == 'robots' else 120000)
        o[k] = {'status': st, 'final': fu, 'title': (re.search(r'<title>(.*?)</title>', t, re.S) or [None, ''])[1].strip()[:100] if st == 200 else t}
        if k == 'robots' and st == 200: o[k]['text'] = t[:900]
        if k == 'home' and st == 200: o[k]['ref_links'] = list(dict.fromkeys(re.findall(r'href=["\']([^"\']*(?:referee|referees|hakam|حكام|%D8%AD%D9%83%D8%A7%D9%85)[^"\']*)', t, re.I)))[:12]
    o['names'] = {}
    for n in ('ماجد الشمراني', 'عبد الصمد بكري', 'فريح الجلعود', 'خالد الأحمري', 'عبدالله الشهري'):
        st, t, _ = get('https://yandex.com/images/search?text=' + urllib.parse.quote('"%s" حكم site:%s' % (n, site)))
        res = []
        if st == 200:
            t = html.unescape(t)
            for m in re.finditer(r'"origUrl":"([^"]*)"[^}]{0,600}?"snippet":\{"title":"((?:[^"\\]|\\.)*)","domain":"([^"]*)","url":"([^"]*)"', t):
                if site in m.group(3): res.append({'img': m.group(1), 'title': m.group(2)[:80], 'page': m.group(4)})
        o['names'][n] = res[:4]; time.sleep(3)
    out[site] = o; print(site, flush=True)
json.dump(out, open('site_probe.json', 'w'), ensure_ascii=False, indent=1)

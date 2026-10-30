import json, re, urllib.request, urllib.parse, html, time
H = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept-Language': 'ar,en;q=0.8'}
def get(u, n=900000):
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=30); return r.status, r.read(n).decode('utf8', 'ignore'), r.geturl()
    except Exception as e: return getattr(e, 'code', 0) or 0, str(e)[:100], u
out = {}
for site, bases in (('spl.com.sa', ['https://www.spl.com.sa/', 'https://www.spl.com.sa/ar', 'https://www.spl.com.sa/ar/referees', 'https://www.spl.com.sa/en/referees']), ('filgoal.com', ['https://www.filgoal.com/', 'https://www.filgoal.com/referees', 'https://www.filgoal.com/ar'])):
    o = {'pages': {}}
    for u in bases:
        st, t, fu = get(u)
        links = list(dict.fromkeys(re.findall(r'href=["\']([^"\']*(?:referee|refere|hakam|حكام|%D8%AD%D9%83%D8%A7%D9%85|%D8%A7%D9%84%D8%AD%D9%83%D8%A7%D9%85)[^"\']*)', t, re.I)))[:10] if st == 200 else []
        o['pages'][u] = {'status': st, 'final': fu, 'title': (re.search(r'<title>(.*?)</title>', t, re.S) or [None, ''])[1].strip()[:90] if st == 200 else t, 'ref_links': links, 'imgs_ref': re.findall(r'https?://[^"\'\s<>]*(?:referee|refere)[^"\'\s<>]*\.(?:jpg|png|webp)', t, re.I)[:6]}
    st, t, _ = get('https://www.' + site + '/robots.txt', 3000); o['robots'] = {'status': st, 'text': t[:700] if st == 200 else ''}
    o['names'] = {}
    for n in ('ماجد الشمراني', 'عبد الصمد بكري', 'فريح الجلعود', 'خالد الأحمري', 'دوناتاس رومساس'):
        st, t, _ = get('https://yandex.com/images/search?text=' + urllib.parse.quote('"%s" حكم site:%s' % (n, site)), 700000)
        res = []
        if st == 200:
            t = html.unescape(t)
            for m in re.finditer(r'"origUrl":"([^"]*)"[^}]{0,600}?"snippet":\{"title":"((?:[^"\\]|\\.)*)","domain":"([^"]*)","url":"([^"]*)"', t):
                if site in m.group(3): res.append({'img': m.group(1), 'title': m.group(2)[:80], 'page': m.group(4)})
        o['names'][n] = res[:4]; time.sleep(3)
    out[site] = o; print(site, flush=True)
json.dump(out, open('site_probe.json', 'w'), ensure_ascii=False, indent=1)

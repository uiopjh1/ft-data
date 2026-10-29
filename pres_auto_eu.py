# Auto-fill photos for European club presidents lacking a Wikipedia lead image.
# Order: Wikimedia Commons (free-licence files whose name contains the person's surname) -> reputable English news og:image.
# Every candidate must pass the same portrait test (exactly one large face).
import json, re, sys, time, unicodedata, urllib.parse, urllib.request
import pres_auto as pa
UA = {'User-Agent': 'FTapp/1.0 (football app; github uiopjh1)'}
NEWS_OK = ['bbc.co.uk','bbc.com','theguardian.com','skysports.com','espn.com','reuters.com','goal.com','football-italia.net','independent.co.uk','telegraph.co.uk','lequipe.fr','marca.com','as.com','mundodeportivo.com','kicker.de','gazzetta.it','corrieredellosport.it','transfermarkt.com','uefa.com','fifa.com']

def fold(s):
    s = unicodedata.normalize('NFKD', s or '')
    s = ''.join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r'[^a-z0-9 ]+', ' ', s).strip()

def jget(u):
    for i in range(4):
        try: return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=25).read())
        except Exception as e: time.sleep(3 * (i + 1))
    return {}

def surname(en):
    t = fold(en).split()
    return t[-1] if t else ''

def commons(en, log):
    sn = surname(en); first = fold(en).split()[0]
    q = f'"{en}"'
    u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=' + urllib.parse.quote(q) + '&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=600'
    pages = (jget(u).get('query') or {}).get('pages', {})
    for p in sorted(pages.values(), key=lambda p: p.get('index', 99)):
        title = p.get('title', ''); ii = (p.get('imageinfo') or [{}])[0]
        ft = fold(title)
        if sn not in ft or first[:3] not in ft: continue
        if ii.get('mime') not in ('image/jpeg', 'image/png'): continue
        if re.search(r'signature|logo|stadium|crest|badge|map|coat|autograph|team|squad|match|vs', ft): continue
        img = ii.get('thumburl') or ii.get('url')
        try: buf = pa.get(img, True)
        except Exception as e: log.append([title, 'img fail']); continue
        ok, why = pa.portrait_ok(buf)
        log.append([title, img, ok, why])
        if ok: return {'image': img, 'src': 'https://commons.wikimedia.org/wiki/' + urllib.parse.quote(title.replace(' ', '_')), 'title': title}
    return None

def news(en, club, log):
    sn = surname(en)
    seen = set()
    for q in [f'"{en}" {club} president', f'"{en}" {club} chairman']:
        for t, l, d in pa.search(q):
            host = urllib.parse.urlparse(l).netloc.replace('www.', '')
            if l in seen or not any(host.endswith(x) for x in NEWS_OK): continue
            seen.add(l)
            nt = fold(t)
            if sn not in nt: continue
            if re.search(r'dies|death|died|funeral|arrest|court|trial|wife|son |daughter', nt): continue
            try: img = pa.og(l)
            except Exception: continue
            if not img: continue
            try: buf = pa.get(img, True)
            except Exception: continue
            ok, why = pa.portrait_ok(buf)
            log.append([t[:70], l, img, ok, why])
            if ok: return {'image': img, 'src': l, 'title': t}
    return None

def main():
    d = json.load(open('presidents.json'))
    chk = json.load(open('pres_wp_check.json')); chk.pop('dbg', None)
    todo = {}
    for k, v in chk.items():
        if v['wp'] and not str(v['wp']).startswith('ERR'): continue
        todo.setdefault(v['en'], []).append(k)
    only = sys.argv[1:]
    report = {}
    for en, keys in todo.items():
        if only and en not in only: continue
        ent = d[keys[0]]
        if re.search(r'(Al[ -]|Damac|Neom|NEOM|Dhamk)', keys[0]): continue
        if ent.get('image'): continue
        log = []
        r = commons(en, log) or news(en, keys[0], log)
        report[en] = {'keys': keys, 'found': bool(r), 'src': (r or {}).get('src'), 'tried': log[:6]}
        if r:
            for kk, vv in d.items():
                if isinstance(vv, dict) and vv.get('en') == en and not vv.get('image'):
                    vv.update({'image': r['image'], 'imageAuto': True, 'imageFor': en, 'imageSrc': r['src']})
        time.sleep(1)
    json.dump(d, open('presidents.json', 'w'), ensure_ascii=False, indent=1)
    json.dump(report, open('pres_auto_eu_report.json', 'w'), ensure_ascii=False, indent=1)
    print(sum(1 for x in report.values() if x['found']), 'found of', len(report))

if __name__ == '__main__':
    main()

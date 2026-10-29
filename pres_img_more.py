# More photo candidates for presidents with no photo: Wikidata P18 (Commons), Commons file search, Bing Images (title must hold the surname).
# Everything goes to pres_img_cand2/ + report; nothing is applied automatically.
import json, re, os, time, html, urllib.parse, urllib.request
import pres_auto as pa
from pres_auto_eu import fold
from pres_news_eu import crop_portrait
UAH = {'User-Agent': 'FTapp/1.0 (football app; github uiopjh1)'}
def jget(u):
    for i in range(5):
        try: return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=UAH), timeout=20).read())
        except Exception as e: time.sleep(3 * (i + 1))
    return {}
def dl(u):
    r = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/605 Safari/605', 'Referer': 'https://www.bing.com/'}), timeout=25)
    return r.read()
def wikidata(en, last):
    out = []
    r = jget('https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&limit=5&search=' + urllib.parse.quote(en))
    for e in r.get('search', []):
        if last not in fold(e.get('label', '')): continue
        c = jget(f"https://www.wikidata.org/w/api.php?action=wbgetclaims&format=json&property=P18&entity={e['id']}")
        for cl in c.get('claims', {}).get('P18', []):
            fn = cl['mainsnak']['datavalue']['value']
            out.append(('wikidata ' + e['id'] + ' ' + (e.get('description') or ''), 'https://commons.wikimedia.org/wiki/Special:FilePath/' + urllib.parse.quote(fn) + '?width=900', fn))
    return out
def commons(en, last):
    out = []
    r = jget('https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url&iiurlwidth=900&gsrsearch=' + urllib.parse.quote(en))
    for p in (r.get('query') or {}).get('pages', {}).values():
        t = p.get('title', '')
        if last in fold(t) and fold(en).split()[0][:3] in fold(t):
            ii = (p.get('imageinfo') or [{}])[0]
            if ii.get('thumburl'): out.append(('commons', ii['thumburl'], t))
    return out
DBG = []
def bing(q, last):
    out = []
    try: h = pa.get('https://www.bing.com/images/search?q=' + urllib.parse.quote(q) + '&form=HDRSC2&first=1', timeout=25)
    except Exception as e: return out
    DBG.append([q, len(h), h.count('murl'), h.count('iusc'), re.sub(r'\s+', ' ', h[:150])])
    for m in re.finditer(r'm="(\{[^"]*?murl[^"]*?\})"', h):
        try: j = json.loads(html.unescape(m.group(1)))
        except Exception: continue
        t = j.get('t', '') + ' ' + j.get('desc', '')
        if last in fold(t): out.append(('bing ' + j.get('purl', '')[:80], j.get('murl'), j.get('t', '')))
    return out
def run(en, key, club_words):
    fn = fold(en).split(); last = fn[-1]
    srcs = wikidata(en, last) + commons(en, last)
    for q in (f'{en} {club_words} presidente', f'{en} president {club_words}', f'"{en}"'):
        srcs += bing(q, last); time.sleep(1)
    res = []; seen = set(); slug = re.sub(r'[^a-z0-9]+', '_', fold(en))
    for s, u, t in srcs:
        if not u or u in seen: continue
        seen.add(u)
        if len(res) >= 5: break
        try: buf = dl(u)
        except Exception as e: continue
        c = crop_portrait(buf)
        if not c: continue
        os.makedirs('pres_img_cand2', exist_ok=True)
        f = f'pres_img_cand2/{slug}__{len(res)}.jpg'; open(f, 'wb').write(c)
        res.append({'file': f, 'from': s, 'url': u, 'title': t})
    return res, len(srcs)
CLUB = {"Denis Le Saint": "Brest", "Ángel Torres": "Getafe", "Jokin Aperribay": "Real Sociedad", "Saverio Sticchi Damiani": "Lecce", "Carlo Rossi": "Sassuolo", "Cliff Crown": "Brentford", "Dan Friedkin": "Roma", "Franco Soldati": "Udinese", "James Zhou": "Auxerre", "Jon Uriarte": "Athletic Club", "Jörn Stobbe": "Köln", "Mirwan Suwarso": "Como", "Romain Chabane": "Angers"}
if __name__ == '__main__':
    only = os.environ.get('ONLY', ''); rep = {}
    for en, cl in CLUB.items():
        if only and en not in only.split('|'): continue
        r, n = run(en, None, cl); rep[en] = {'sources': n, 'cands': r}; print(en, n, len(r), flush=True)
    rep['_dbg'] = DBG[:12]; json.dump(rep, open('pres_img_more_report.json', 'w'), ensure_ascii=False, indent=1)

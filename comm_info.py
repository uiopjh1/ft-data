# Photo + short bio candidates for commentators (names from commentators.json): ar.wikipedia first, then Wikidata (P18).
# Identity check: page title holds the full name tokens AND the intro mentions commentary/broadcasting. Candidates are saved
# to comm_img_cand/ for visual review; nothing is applied automatically.
import json, re, os, time, urllib.parse, urllib.request, urllib.error, socket
from commentators import fold
socket.setdefaulttimeout(20)
UAH = {'User-Agent': 'FTapp/1.0 (football app; github uiopjh1)'}
ROLE = re.compile(r'معلق|تعليق|مذيع|إعلامي|اعلامي|صحفي|مقدم|commentator|broadcast|sportscaster|announcer', re.I)
def jget(u):
    for i in range(6):
        try: return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=UAH), timeout=20).read())
        except urllib.error.HTTPError as e:
            ra = e.headers.get('Retry-After') if e.headers else None
            time.sleep(min(int(ra), 40) if ra and ra.isdigit() else 3 * (i + 1))
        except Exception: time.sleep(3)
    return {}
def dl(u):
    for i in range(4):
        try: return urllib.request.urlopen(urllib.request.Request(u, headers=UAH), timeout=25).read()
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(5 * (i + 1)); continue
            return None
        except Exception: time.sleep(2)
    return None
def same_name(title, name):
    t = set(fold(title).split()); n = fold(name).split()
    return bool(n) and sum(1 for w in n if w in t) >= min(2, len(n)) and (n[0] in t) and (n[-1] in t)
def ar_wiki(name, log):
    u = ('https://ar.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=6&gsrsearch=' + urllib.parse.quote(f'"{name}"') +
         '&prop=pageimages|extracts&piprop=thumbnail&pithumbsize=600&exintro=1&explaintext=1&exlimit=6&exchars=420')
    pages = (jget(u).get('query') or {}).get('pages', {})
    log.append(['ar', [(p.get('title'), bool(p.get('thumbnail'))) for p in pages.values()][:5]])
    for p in sorted(pages.values(), key=lambda p: p.get('index', 99)):
        if not same_name(p.get('title', ''), name): continue
        ex = p.get('extract', '')
        if not ROLE.search(ex): log.append(['ar', p.get('title'), 'role not in intro']); continue
        return {'title': p['title'], 'bio': ex.strip(), 'thumb': (p.get('thumbnail') or {}).get('source'), 'src': 'ar.wikipedia.org/wiki/' + urllib.parse.quote(p['title'].replace(' ', '_'))}
    return None
def wikidata(name, log):
    r = jget('https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=ar&uselang=ar&limit=6&search=' + urllib.parse.quote(name))
    for e in r.get('search', []):
        if not same_name(e.get('label', ''), name): continue
        if not ROLE.search(e.get('description', '') or ''): log.append(['wd', e.get('label'), e.get('description'), 'role?']); continue
        c = jget(f"https://www.wikidata.org/w/api.php?action=wbgetclaims&format=json&property=P18&entity={e['id']}")
        cl = (c.get('claims') or {}).get('P18') or []
        th = ('https://commons.wikimedia.org/wiki/Special:FilePath/' + urllib.parse.quote(cl[0]['mainsnak']['datavalue']['value']) + '?width=600') if cl else None
        return {'title': e['label'], 'bio': e.get('description', ''), 'thumb': th, 'src': 'wikidata.org/wiki/' + e['id']}
    return None
def main():
    names = set()
    for v in json.load(open('commentators.json'))['days'].values():
        for r in v['rows']: names.update(r['comm'])
    only = os.environ.get('ONLY', '')
    try: done = json.load(open('commentators_info.json'))
    except Exception: done = {}
    rep = {}
    for n in sorted(names):
        if only and n not in only.split('|'): continue
        if n in done: continue
        log = []
        r = ar_wiki(n, log) or wikidata(n, log)
        time.sleep(1.2)
        if r and r.get('thumb'):
            b = dl(r['thumb'])
            if b and len(b) > 3000:
                os.makedirs('comm_img_cand', exist_ok=True)
                f = 'comm_img_cand/' + re.sub(r'[^0-9a-zA-Z؀-ۿ]+', '_', n) + '.jpg'
                open(f, 'wb').write(b); r['file'] = f
        rep[n] = {'found': r, 'log': log}
        print(n, bool(r), bool(r and r.get('file')), flush=True)
    json.dump(rep, open('commentators_info_report.json', 'w'), ensure_ascii=False, indent=1)
if __name__ == '__main__': main()

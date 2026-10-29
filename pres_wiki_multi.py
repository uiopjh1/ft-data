# Photos for presidents with no English-Wikipedia lead image: look in other-language Wikipedias (de/es/it/fr/pt/nl/tr/ca/eu/gl).
# Identity check: page title holds first+last name AND the intro text mentions the club (or its alias) AND a president/chair word.
import json, re, sys, time, urllib.parse
import pres_auto as pa
from pres_auto_eu import fold
import urllib.request
UAH = {'User-Agent': 'FTapp/1.0 (football app; github uiopjh1)'}
def jget(u):
    for i in range(2):
        try: return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=UAH), timeout=12).read())
        except Exception as e: time.sleep(2)
    return {}
LANGS = ['es', 'de', 'it', 'fr', 'pt']
import socket, concurrent.futures
socket.setdefaulttimeout(12)
ROLE = re.compile(r'president|presidente|praesident|prasident|chairman|vorsitz|president|presidente|presidenten|chairwoman|presidenta|dirigente|business|empresari|unternehmer|imprenditor|entrepreneur|owner|propietari|besitzer|proprietar|eigenaar|baskan|iskadam', re.I)
STOP = {'fc', 'ac', 'as', 'rc', 'sc', 'cf', 'sv', 'club', 'united', 'city', 'de', 'real', 'athletic', '1', 'calcio', 'town', 'afc', 'ssc', 'us', 'ud'}
def club_tokens(key):
    t = [w for w in fold(key).split() if w not in STOP and len(w) > 2]
    return t or fold(key).split()
def find(en, key, log):
    fn = fold(en).split(); first, last = fn[0], fn[-1]
    toks = club_tokens(key)
    for lang in LANGS:
        u = (f'https://{lang}.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=6&gsrsearch=' + urllib.parse.quote(f'"{en}"') +
             '&prop=pageimages|extracts&piprop=thumbnail&pithumbsize=500&exintro=1&explaintext=1&exlimit=6')
        resp = jget(u)
        pages = (resp.get('query') or {}).get('pages', {})
        log.append([lang, 'resp' if resp else 'EMPTY-RESP', [ (p.get('title'), bool(p.get('thumbnail'))) for p in pages.values()][:4]])
        time.sleep(1.0)
        for p in sorted(pages.values(), key=lambda p: p.get('index', 99)):
            title = fold(p.get('title', '')); ex = fold(p.get('extract', ''))
            th = (p.get('thumbnail') or {}).get('source')
            if not th or last not in title or first[:3] not in title: continue
            if not any(t in ex for t in toks) or not ROLE.search(ex):
                log.append([lang, p.get('title'), 'club/role not in intro']); continue
            try: buf = pa.get(th, True)
            except Exception: log.append([lang, p.get('title'), 'img fail']); continue
            ok, why = pa.portrait_ok(buf)
            log.append([lang, p.get('title'), th, ok, why])
            if ok: return {'image': th, 'src': f'https://{lang}.wikipedia.org/wiki/' + urllib.parse.quote(p['title'].replace(' ', '_')), 'lang': lang, 'intro': p.get('extract', '')[:160]}
    return None
def main():
    d = json.load(open('presidents.json'))
    chk = json.load(open('pres_wp_check.json')); chk.pop('dbg', None)
    todo = {}
    for k, v in chk.items():
        if v['wp'] and not str(v['wp']).startswith('ERR'): continue
        if re.search(r'(Al[ -]|Damac|Neom|NEOM|Dhamk)', k): continue
        todo.setdefault(v['en'], []).append(k)
    rep = {}
    def work(item):
        en, keys = item
        log = []; r = find(en, keys[0], log)
        return en, keys, log, r
    items = [(e, k) for e, k in todo.items() if not d[k[0]].get('image')]
    with concurrent.futures.ThreadPoolExecutor(3) as ex:
        results = list(ex.map(work, items))
    for en, keys, log, r in results:
        rep[en] = {'keys': keys, 'found': r, 'log': log[:12]}
        if r:
            for vv in d.values():
                if isinstance(vv, dict) and vv.get('en') == en and not vv.get('image'):
                    vv.update({'image': r['image'], 'imageAuto': True, 'imageFor': en, 'imageSrc': r['src']})
    json.dump(d, open('presidents.json', 'w'), ensure_ascii=False, indent=1)
    json.dump(rep, open('pres_wiki_multi_report.json', 'w'), ensure_ascii=False, indent=1)
    print(sum(1 for v in rep.values() if v['found']), 'of', len(rep))
if __name__ == '__main__': main()

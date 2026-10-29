# Candidate photos for presidents without any Wikipedia photo: Google News (en/es/it/de/fr editions) headlines that name the person
# together with a president/chairman word, og:image of the article, single-face portrait test.
# Candidates are saved to pres_img_cand/ so a human-checkable copy exists before anything is applied.
import json, re, sys, os, time, hashlib, urllib.parse
import pres_watch as pw
import pres_auto as pa
from pres_auto_eu import fold
ED = {'en': 'hl=en-GB&gl=GB&ceid=GB:en', 'es': 'hl=es&gl=ES&ceid=ES:es', 'it': 'hl=it&gl=IT&ceid=IT:it', 'de': 'hl=de&gl=DE&ceid=DE:de', 'fr': 'hl=fr&gl=FR&ceid=FR:fr'}
ROLE = re.compile(r'president|presidente|praesident|prasident|chairman|vorsitz|président|owner|propriet|besitzer|eigent|dueno|dueño|patron|patrón|presidenza|presidencia|chief|boss|dirigente|club president', re.I)
BAD = re.compile(r'dies|death|died|muere|muerto|funeral|arrest|trial|wife|daughter|lawsuit|lutto|stirbt|mort |decede|sentenc', re.I)
def news(q, ed):
    return pw.rss('https://news.google.com/rss/search?' + ED[ed] + '&q=' + urllib.parse.quote(q + ' when:365d'), True)
def run(en, key, log):
    fn = fold(en).split(); first, last = fn[0], fn[-1]
    seen = set(); n = 0
    for ed in ['en', 'es', 'it', 'de', 'fr']:
        for it in news(f'"{en}" {key}', ed):
            t = fold(it['title'])
            if last not in t or first[:3] not in t or not ROLE.search(t) or BAD.search(t): continue
            if it['link'] in seen: continue
            seen.add(it['link']); n += 1
            if n > 8: return None
            real = pw.resolve(it['link'])
            if not real: continue
            try: img = pa.og(real)
            except Exception: continue
            if not img: continue
            try: buf = pa.get(img, True)
            except Exception: continue
            ok, why = pa.portrait_ok(buf)
            log.append([it['title'][:80], it.get('host'), real, img, ok, why])
            if ok:
                fname = 'pres_img_cand/' + re.sub(r'[^a-z0-9]+', '_', fold(en)) + '.jpg'
                os.makedirs('pres_img_cand', exist_ok=True)
                open(fname, 'wb').write(buf)
                return {'file': fname, 'image': img, 'src': real, 'title': it['title']}
        time.sleep(0.5)
    return None
def main():
    d = json.load(open('presidents.json'))
    only = os.environ.get('ONLY', '')
    todo = {}
    for k, v in d.items():
        if not isinstance(v, dict) or not v.get('en') or v.get('image'): continue
        if re.search(r'(Al[ -]|Damac|Neom|NEOM|Dhamk)', k): continue
        todo.setdefault(v['en'], k)
    rep = {}
    for en, key in todo.items():
        if only and en not in only.split('|'): continue
        log = []; r = run(en, key, log)
        rep[en] = {'club': key, 'found': r, 'log': log[:6]}
    json.dump(rep, open('pres_news_eu_report.json', 'w'), ensure_ascii=False, indent=1)
    print(sum(1 for v in rep.values() if v['found']), 'of', len(rep))
if __name__ == '__main__': main()

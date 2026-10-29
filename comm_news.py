# Photo candidates for commentators without a Wikipedia photo: Bing News (Arabic) headlines naming the person + commentary word,
# og:image of the article, single-face portrait crop. Saved to comm_img_cand/ for visual review; nothing applied automatically.
import json, re, os, time, urllib.parse
import pres_auto as pa
from pres_news_eu import crop_portrait, tw
from commentators import fold
ROLE = re.compile(r'معلق|تعليق|المعلق|صوت|مذيع')
BAD = re.compile(r'وفاه|رحيل|وفاة|اعتقال|يهاجم|زوجه|ابنه')
def run(name, log):
    f = fold(name).split(); res = []; seen = set()
    for q in (f'"{name}" معلق', f'المعلق {name}', f'{name} تعليق مباراة ثمانية', f'{name} معلق رياضي'):
        for t, l, d in pa.search_mkt(q, 'ar-SA'):
            ft = fold(t)
            if not all(w in ft for w in f) or not ROLE.search(ft) or BAD.search(ft) or l in seen: continue
            seen.add(l)
            try: img = pa.og(l) or tw(l)
            except Exception as e: log.append([t[:60], 'PAGE-FAIL']); continue
            if not img: log.append([t[:60], 'NO-OG']); continue
            try: buf = pa.get(img, True)
            except Exception: log.append([t[:60], 'IMG-FAIL']); continue
            c = crop_portrait(buf)
            log.append([t[:70], l[:70], bool(c)])
            if c:
                os.makedirs('comm_img_cand', exist_ok=True)
                fn = 'comm_img_cand/' + re.sub(r'[^0-9a-zA-Z؀-ۿ]+', '_', name) + f'__news{len(res)}.jpg'
                open(fn, 'wb').write(c); res.append({'file': fn, 'src': l, 'title': t})
                if len(res) >= 4: return res
        time.sleep(0.5)
    return res
def main():
    names = set()
    for v in json.load(open('commentators.json'))['days'].values():
        for r in v['rows']: names.update(r['comm'])
    only = os.environ.get('ONLY', '')
    skip = {'عصام الشوالي', 'أحمد الحامد'}
    rep = {}
    for n in sorted(names - skip):
        if only and n not in only.split('|'): continue
        log = []; r = run(n, log); rep[n] = {'found': r, 'log': log[:14]}; print(n, len(r), flush=True)
    json.dump(rep, open('comm_news_report.json', 'w'), ensure_ascii=False, indent=1)
if __name__ == '__main__': main()

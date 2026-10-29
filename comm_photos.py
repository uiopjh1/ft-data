# Photos for commentators without a Wikipedia photo. Sources: Bing Images + Bing News (Arabic). Identity: the result title/page must hold the full
# name AND a commentary word; image must be a single clear face (Haar) -> 4:5 crop saved to comm_img_cand/ (APPLY=1 also publishes to comm_img/).
import json, re, os, time, html, datetime, urllib.parse, urllib.request
import pres_auto as pa
from pres_news_eu import crop_portrait, tw
from commentators import fold
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
ROLE = re.compile(r'معلق|تعليق|المعلق|الصوت|commentator')
BAD = re.compile(r'وفاه|رحيل|اعتقال|زوجه|ابنه|لعبه|game|honor of kings|مسلسل|فيلم')
def slug(n): return re.sub(r'[^0-9a-zA-Z؀-ۿ]+', '_', n)
def bing_images(q):
    out = []
    try:
        h = urllib.request.urlopen(urllib.request.Request('https://www.bing.com/images/search?setlang=ar&cc=SA&q=' + urllib.parse.quote(q), headers={'User-Agent': UA, 'Accept-Language': 'ar,en;q=0.8'}), timeout=25).read().decode('utf8', 'ignore')
    except Exception as e:
        return out
    for m in re.finditer(r'm="(\{[^"]*?murl[^"]*?\})"', h):
        try: j = json.loads(html.unescape(m.group(1)))
        except Exception: continue
        out.append((j.get('t', '') + ' ' + j.get('desc', ''), j.get('murl'), j.get('purl', '')))
    return out
def dl(u):
    r = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': UA, 'Referer': 'https://www.bing.com/'}), timeout=25)
    return r.read()
def run(name, log):
    toks = fold(name).split(); res = []; seen = set()
    def ok_title(t): ft = fold(t); return all(w in ft for w in toks) and ROLE.search(ft) and not BAD.search(ft)
    cands = []
    for q in (f'{name} معلق', f'المعلق {name}', f'{name} معلق رياضي ثمانية'):
        bi = bing_images(q); log.append(['bing', q, len(bi), [x[0][:50] for x in bi[:3]]])
        for t, mu, pu in bi:
            if mu and ok_title(t): cands.append(('img', t, mu, pu))
        time.sleep(0.8)
    for q in (f'"{name}" معلق', f'{name} معلق ثمانية'):
        nn = pa.search_mkt(q, 'ar-SA'); log.append(['news', q, len(nn), [x[0][:50] for x in nn[:3]]])
        for t, l, d in nn:
            if ok_title(t): cands.append(('news', t, l, l))
        time.sleep(0.5)
    log.append(['cands', len(cands)])
    for kind, t, u, pu in cands:
        if u in seen: continue
        seen.add(u)
        try:
            iu = u if kind == 'img' else (pa.og(u) or tw(u))
            if not iu: continue
            buf = dl(iu); c = crop_portrait(buf)
        except Exception as e:
            continue
        log.append([kind, t[:70], iu[:80], bool(c)])
        if not c: continue
        os.makedirs('comm_img_cand', exist_ok=True)
        fn = f'comm_img_cand/{slug(name)}__{len(res)}.jpg'; open(fn, 'wb').write(c)
        res.append({'file': fn, 'src': pu, 'title': t})
        if len(res) >= 3: break
    return res
def main():
    only = os.environ.get('ONLY', ''); apply = os.environ.get('APPLY') == '1'
    try: info = json.load(open('commentators_info.json'))
    except Exception: info = {}
    names = set(info.keys())
    try: names |= set(json.load(open('comm_stats.json')).get('names', {}).keys())
    except Exception: pass
    today = datetime.date.today().isoformat(); old = (datetime.date.today() - datetime.timedelta(days=14)).isoformat()
    rep = {}
    for n in sorted(names):
        if only and n not in only.split('|'): continue
        cur = info.get(n, {})
        if cur.get('image') or cur.get('photoChecked', '') > old: continue
        log = []; r = run(n, log); rep[n] = {'found': r, 'log': log[:20]}
        print(n, len(r), flush=True)
        if apply:
            e = info.setdefault(n, {}); e['photoChecked'] = today
            if r:
                os.makedirs('comm_img', exist_ok=True)
                dst = f'comm_img/{slug(n)}.jpg'; open(dst, 'wb').write(open(r[0]['file'], 'rb').read())
                e['image'] = 'https://raw.githubusercontent.com/uiopjh1/ft-data/main/' + urllib.parse.quote(dst); e['imageAuto'] = True; e['imageSrc'] = r[0]['src']
    json.dump(rep, open('comm_photos_report.json', 'w'), ensure_ascii=False, indent=1)
    if apply: json.dump(info, open('commentators_info.json', 'w'), ensure_ascii=False, indent=1)
if __name__ == '__main__': main()

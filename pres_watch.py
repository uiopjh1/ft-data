# Near-real-time watcher for Saudi club president changes.
# Sources: Saudi news outlets via Bing News RSS (+ direct outlet RSS when available).
# Rule: a new president is applied ONLY when >=2 independent outlets report the same name for the same club
# (and the article page itself confirms it). Single-source news goes to presidents_alerts.json.
import json, re, os, sys, time, html, urllib.parse, urllib.request, datetime, email.utils
import xml.etree.ElementTree as ET
APPLY = os.environ.get('WATCH_APPLY') == '1'
BACKTEST = os.environ.get('WATCH_BACKTEST') == '1'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
SAUDI = ['aawsat.com','okaz.com.sa','arriyadiyah.com','slaati.com','sabq.org','alyaum.com','al-madina.com','alwatan.com.sa','al-jazirah.com','eremnews.com','ajel.sa','akhbaar24.com','spl.com.sa','kooora.com','goal.com','almowaten.net','argaam.com','mc-doualiya.com','alarabiya.net','skynewsarabia.com','alriyadh.com','24.ae']
CLUBS = {'Al Hilal':'الهلال','Al Nassr':'النصر','Al Ahli':'الأهلي','Al Ittihad':'الاتحاد','Al Taawoun':'التعاون','Al Ettifaq':'الاتفاق','Al Fayha':'الفيحاء','Al Qadsiah':'القادسية','Al Okhdood':'الأخدود','Al Fateh':'الفتح','Al Raed':'الرائد','Al Khaleej':'الخليج','Al Shabab':'الشباب','Al Riyadh':'الرياض','Al Hazem':'الحزم','Al Kholood':'الخلود','Al Faisaly':'الفيصلي','Damac':'ضمك'}
EXCL = r'مصري|المصري|القاهره|الزمالك|اتحاد الكره|(?:ال|لل|لا)تحاد\s+(?:السعودي|الدولي|الاسيوي|الافريقي|المصري|الاوروبي|العربي|الاماراتي|الكويتي|القطري|الاردني|العراقي|لكره)'
NOT_FINAL = r'مصادر|يقترب|يتجه|مرشح|ترشح|يترشح|ترشيح|يدرس|يرفض|ينفي|تفاصيل|من هو|ماذا|يتقدم|قائمه|قوايم|فتح باب'
STOP = set('رسميا رسميًا رسمياً تزكيه تزكية تكليف تعيين اعتماد انتخاب فوز عاجل بالتزكيه بالتزكية رسمي الان الآن'.split())
TITLES_RE = r'^(?:المهندس|الدكتور|الاستاذ|الأستاذ|الامير|الأمير|الشيخ|الكابتن|د\.|م\.|أ\.|سمو|الاستاذه)\s+'

def get(url, timeout=25):
    r = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'ar,en;q=0.8'})
    with urllib.request.urlopen(r, timeout=timeout) as f:
        return f.read().decode('utf-8', 'ignore')

def norm(s):
    s = re.sub('[ً-ٟـ]', '', s or '')
    s = s.replace('أ','ا').replace('إ','ا').replace('آ','ا').replace('ة','ه').replace('ى','ي').replace('ـ','')
    return re.sub(r'\s+', ' ', s).strip()

def host_of(u):
    return urllib.parse.urlparse(u).netloc.replace('www.', '').replace('m.', '')

def rss(url, gnews=False):
    """tolerant RSS parser (regex) - several Saudi feeds are not well-formed XML."""
    out = []
    try:
        x = get(url)
        for blk in re.findall(r'<item[ >].*?</item>', x, re.S):
            def tag(n):
                m = re.search(r'<' + n + r'[^>]*>(.*?)</' + n + '>', blk, re.S)
                if not m: return ''
                v = m.group(1).strip()
                v = re.sub(r'^<!\[CDATA\[(.*?)\]\]>$', r'\1', v, flags=re.S)
                return html.unescape(v).strip()
            t = tag('title'); l = tag('link') or (re.search(r'<link>(.*?)<', blk) or [None, ''])[1]
            if not l:
                m = re.search(r'<guid[^>]*>(.*?)</guid>', blk, re.S); l = html.unescape(m.group(1)).strip() if m else ''
            m = re.search(r'[?&]url=([^&]+)', l)
            if m and 'bing.com' in l: l = urllib.parse.unquote(m.group(1))
            host = ''
            sm = re.search(r'<source[^>]*url="([^"]+)"', blk)
            if sm: host = host_of(sm.group(1))
            try: dt = email.utils.parsedate_to_datetime(tag('pubDate')).replace(tzinfo=None)
            except Exception: dt = None
            out.append({'title': t, 'link': l, 'date': dt, 'host': host})
    except Exception as e:
        print('rss fail', url[:90], str(e)[:60])
    return out

def bing(q): return rss('https://www.bing.com/news/search?format=rss&setlang=ar&q=' + urllib.parse.quote(q))
def gnews(q, when): return rss('https://news.google.com/rss/search?hl=ar&gl=SA&ceid=SA:ar&q=' + urllib.parse.quote(q + ' when:' + when), True)

def resolve(link):
    """Google News redirect -> real article url (best effort)."""
    if 'news.google.com' not in link: return link
    try:
        from googlenewsdecoder import gnewsdecoder
        r = gnewsdecoder(link, interval=0.3)
        if r.get('status'): return r['decoded_url']
    except Exception as e:
        print('decode fail', str(e)[:60])
    return None

QUERIES = ['رئيسا لنادي', 'تكليف برئاسة نادي', 'استقالة رئيس نادي', 'تزكية رئيسا لنادي']
SITES = ['okaz.com.sa', 'aawsat.com', 'sabq.org', 'alyaum.com', 'arriyadiyah.com', 'al-madina.com', 'alwatan.com.sa', 'slaati.com', 'ajel.sa', 'alriyadh.com', 'al-jazirah.com']
FEEDS = ['https://aawsat.com/feed', 'https://arriyadiyah.com/rss', 'https://slaati.com/feed/', 'https://ajel.sa/rss', 'https://www.okaz.com.sa/rss', 'https://sabq.org/rss', 'https://sabq.org/rss/sports', 'https://www.alyaum.com/rss', 'https://www.alwatan.com.sa/rss']

def clean_name(n):
    n = re.sub(r'[‎‏«»"“”\(\)\[\]،,؛:\.\-–—]', ' ', n)
    t = [w for w in n.split() if norm(w) not in {norm(x) for x in STOP}]
    s = ' '.join(t)
    for _ in range(3): s = re.sub(TITLES_RE, '', s)
    t = s.split()
    return ' '.join(t[-5:]) if len(t) > 5 else s

_TBL = str.maketrans({'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ة': 'ه', 'ى': 'ي'})
def extract(title):
    """returns list of (club_key, kind, name|None, interim)"""
    t2 = re.sub(r'\s+', ' ', re.sub('[\u064b-\u065f\u0640]', '', title)).strip()
    nt = t2.translate(_TBL)
    if re.search(EXCL, nt) or re.search(NOT_FINAL, nt): return []
    res = []
    for key, ar in CLUBS.items():
        c = norm(ar)
        calt = '(?:' + re.escape(c) + '|ل' + re.escape(c[1:]) + ')'
        if not re.search(calt, nt): continue
        cl = r'(?:نادي\s+|شركه\s+نادي\s+|شركه\s+|ل?لنادي\s+)?\(?(?:النادي\s+)?' + calt
        # resignation
        if re.search(r'استقال|يستقيل', nt) and not re.search(r'مدرب|مدير|لاعب|حكم|سكرتير|مشرف|عضو|اداري|تدريب', nt):
            res.append((key, 'resign', None, False))
        m = re.search(r'تكليف\s+(?P<n>.+?)\s+(?:برياسه|برئاسه|برئاسة|برياسة)\s+' + cl, nt)
        if m: res.append((key, 'appoint', clean_name(t2[m.start('n'):m.end('n')]), True)); continue
        m = re.search(r'(?P<n>[^\n]{3,60}?)\s+(?:رييسا|رئيسا|رييس[اً]+)\s+(?:مكلفا|مؤقتا|تنفيذيا)?\s*(?:ل)?\s*(?:مجلس اداره\s+)?' + cl, nt)
        if m and not re.search(r'استقال', m.group('n')):
            nm = clean_name(t2[m.start('n'):m.end('n')])
            if 2 <= len(nm.split()) <= 5 or (len(nm.split()) == 1 and len(nm) > 4):
                res.append((key, 'appoint', nm, bool(re.search(r'مكلف|تكليف|مؤقت', nt))))
    return res

def confirm(url, name):
    """page must mention the name and Saudi-football context."""
    try: h = norm(re.sub(r'<[^>]+>', ' ', get(url)))
    except Exception: return None
    toks = [t for t in norm(name).split() if len(t) > 2]
    if not toks: return False
    ok_name = sum(1 for t in toks if t in h) >= min(2, len(toks))
    return bool(ok_name and re.search(r'روشن|الدوري السعودي|السعوديه|المملكه|الهيئه', h) and re.search(r'رياس|رييس|رئيس', h))

def confirm_src(url, name):
    real = resolve(url)
    if not real: return None   # cannot open page -> not confirmed
    return confirm(real, name)

def same_person(a, b):
    ta = {t for t in norm(re.sub(r'\(.*?\)', '', a)).split() if len(t) > 2 and t not in ('بن', 'ال')}
    tb = {t for t in norm(re.sub(r'\(.*?\)', '', b)).split() if len(t) > 2 and t not in ('بن', 'ال')}
    return len(ta & tb) >= min(2, len(ta), len(tb)) or (ta and tb and norm(a).split()[-1] == norm(b).split()[-1])

def load(p, dflt):
    try: return json.load(open(p))
    except Exception: return dflt

def main():
    state = load('pres_watch_state.json', {'seen': [], 'events': {}})
    alerts = load('presidents_alerts.json', [])
    now = datetime.datetime.utcnow()
    items = []
    when = '120d' if BACKTEST else '2d'
    for f in FEEDS: items += rss(f)
    for q in QUERIES: items += gnews(q, when)
    for st in SITES:
        items += gnews(f'site:{st} (استقالة OR رئيسا OR تكليف) نادي', when)
    seen = set(state['seen']); log = []
    for it in items:
        l = it['link']
        if not l or l in seen: continue
        h0 = it.get('host') or host_of(l)
        if not any(h0.endswith(d) for d in SAUDI): continue
        if not BACKTEST and it['date'] and (now - it['date']).days > 10: continue
        evs = extract(it['title'])
        if not evs: continue
        seen.add(l)
        for key, kind, name, interim in evs:
            log.append({'club': key, 'kind': kind, 'name': name, 'interim': interim, 'title': it['title'], 'link': l, 'host': h0, 'date': str(it['date'])})
    state['seen'] = list(seen)[-4000:]
    json.dump(log, open('pres_watch_log.json', 'w'), indent=1, ensure_ascii=False)
    if BACKTEST:
        print('events', len(log)); return
    d = load('presidents.json', {})
    changed = False
    for e in log:
        host = e.get('host') or host_of(e['link'])
        if e['kind'] == 'resign':
            alerts.append({'t': str(now), 'club': e['club'], 'type': 'resign', 'title': e['title'], 'src': e['link']}); continue
        cur = d.get(e['club'])
        if not cur: continue
        if same_person(cur['name'], e['name']): continue
        if len(e['name'].split()) < 2:
            alerts.append({'t': str(now), 'club': e['club'], 'type': 'partial-name', 'name': e['name'], 'src': e['link']}); continue
        ev = state['events'].setdefault(e['club'], {}).setdefault(norm(e['name']), {'name': e['name'], 'interim': e['interim'], 'sources': {}, 'first': str(now)})
        ev['sources'][host] = {'url': e['link'], 'title': e['title']}
        ev['interim'] = ev['interim'] and e['interim']
    for club, evs in list(state['events'].items()):
        for k, ev in list(evs.items()):
            cur = d.get(club)
            if cur and same_person(cur['name'], ev['name']): del evs[k]; continue
            if len(ev['sources']) >= 2:
                good = [h for h, s in ev['sources'].items() if confirm_src(s['url'], ev['name'])]
                if len(good) >= 2 and APPLY and cur:
                    old = cur['name']
                    group = [kk for kk, vv in d.items() if isinstance(vv, dict) and vv.get('name') == old and vv.get('en') == cur.get('en')]
                    nm = ev['name'] + (' (رئيس مكلّف)' if ev['interim'] else '')
                    for kk in group:
                        v = d[kk]
                        for f in ('image', 'imageAuto', 'imageFor', 'imageSrc', 'titles', 'titlesTotal', 'prev', 'titlesLabel', 'note'): v.pop(f, None)
                        v.update({'name': nm, 'en': '', 'since': now.year, 'noTitles': True})
                        if ev['interim']: v['interim'] = True
                        else: v.pop('interim', None)
                    alerts.append({'t': str(now), 'club': club, 'type': 'applied', 'old': old, 'new': nm, 'sources': {h: ev['sources'][h]['url'] for h in good}})
                    changed = True
                    del evs[k]
                    try:
                        import pres_auto
                        r = pres_auto.find(ev['name'], [])
                        if r:
                            for kk in group:
                                d[kk].update({'image': r['image'], 'imageAuto': True, 'imageFor': ev['name'], 'imageSrc': r['src']})
                    except Exception as ex: print('photo fail', ex)
                    continue
                if len(good) < 2:
                    alerts.append({'t': str(now), 'club': club, 'type': 'unconfirmed', 'name': ev['name'], 'sources': list(ev['sources'])}); ev['sources'] = {h: s for h, s in ev['sources'].items() if h in good}
            elif (now - datetime.datetime.fromisoformat(ev['first'])).days >= 7:
                alerts.append({'t': str(now), 'club': club, 'type': 'single-source', 'name': ev['name'], 'src': list(ev['sources'].values())[0]['url']}); del evs[k]
    json.dump(state, open('pres_watch_state.json', 'w'), indent=1, ensure_ascii=False)
    json.dump(alerts[-200:], open('presidents_alerts.json', 'w'), indent=1, ensure_ascii=False)
    if changed: json.dump(d, open('presidents.json', 'w'), indent=2, ensure_ascii=False)
    print('log', len(log), 'changed', changed)

if __name__ == '__main__':
    main()

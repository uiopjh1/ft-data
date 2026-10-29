# Near-real-time watcher for president/chairman changes at non-Saudi clubs (English-language sources).
# Same safety rules as pres_watch.py: >=2 independent reputable outlets, official wording, fresh (<=3 days),
# page confirms. Resignations -> vacancy text; appointments -> new name (+ Arabic label from Wikidata when it exists).
import json, re, os, html, urllib.parse, urllib.request, datetime
from pres_watch import get, rss, gnews, resolve, host_of, load, norm
APPLY = os.environ.get('WATCH_APPLY') == '1'
BACKTEST = os.environ.get('WATCH_BACKTEST') == '1'
SRC = ['bbc.co.uk', 'bbc.com', 'skysports.com', 'theguardian.com', 'espn.com', 'reuters.com', 'apnews.com', 'nytimes.com', 'theathletic.com', 'goal.com', 'marca.com', 'as.com', 'football-italia.net', 'bundesliga.com', 'premierleague.com', 'laliga.com', 'legaseriea.it', 'ligue1.com', 'uefa.com', 'independent.co.uk', 'telegraph.co.uk', 'standard.co.uk', 'dailymail.co.uk', 'mirror.co.uk', 'sportsmole.co.uk', '90min.com', 'fourfourtwo.com', 'forbes.com', 'bloomberg.com', 'ft.com', 'dw.com', 'france24.com', 'lequipe.fr', 'kicker.de', 'gazzetta.it', 'tuttosport.com', 'mundodeportivo.com', 'sport.es', 'record.pt', 'abola.pt', 'maisfutebol.iol.pt']
FEEDS = ['https://feeds.bbci.co.uk/sport/football/rss.xml', 'https://www.theguardian.com/football/rss', 'https://www.skysports.com/rss/12040', 'https://www.espn.com/espn/rss/soccer/news', 'https://football-italia.net/feed/', 'https://www.fourfourtwo.com/feeds/all', 'https://www.independent.co.uk/sport/football/rss']
QUERIES = ['club president resigns football', 'football club chairman steps down', 'new club president elected football', 'appointed chairman football club official', 'named president of football club', 'club president election result football']
SITES = ['bbc.co.uk', 'skysports.com', 'theguardian.com', 'espn.com', 'reuters.com', 'marca.com', 'football-italia.net', 'goal.com', 'as.com', 'theathletic.com']
ALIAS = {'Manchester City': ['Man City'], 'Manchester United': ['Man United', 'Man Utd'], 'Tottenham Hotspur': ['Spurs', 'Tottenham'], 'Atletico Madrid': ['Atletico', 'Atlético Madrid', 'Atlético de Madrid'], 'Paris Saint-Germain': ['PSG', 'Paris St-Germain', 'Paris Saint Germain'], 'Inter Milan': ['Inter', 'Internazionale'], 'AC Milan': ['Milan'], 'Bayern Munich': ['Bayern', 'Bayern München'], 'Borussia Dortmund': ['Dortmund'], 'Bayer Leverkusen': ['Leverkusen'], 'Newcastle United': ['Newcastle'], 'West Ham United': ['West Ham'], 'Leeds United': ['Leeds'], 'Nottingham Forest': ['Forest'], 'Aston Villa': ['Villa'], 'AFC Bournemouth': ['Bournemouth'], 'Wolves': ['Wolverhampton Wanderers', 'Wolverhampton'], 'Brighton': ['Brighton & Hove Albion', 'Brighton and Hove Albion'], 'Athletic Club': ['Athletic Bilbao', 'Athletic'], 'Real Betis': ['Betis'], 'Real Sociedad': ['La Real'], 'FC Porto': ['Porto'], 'Benfica': ['SL Benfica'], 'Lyon': ['Olympique Lyonnais', 'Olympique Lyon'], 'Marseille': ['Olympique de Marseille', 'Olympique Marseille'], 'AS Monaco': ['Monaco'], 'AS Roma': ['Roma'], 'Hamburg SV': ['Hamburg', 'Hamburger SV'], 'Werder Bremen': ['Bremen', 'SV Werder Bremen'], '1. FC Köln': ['Cologne', 'FC Köln', 'Koln'], 'Union Berlin': ['1. FC Union Berlin'], 'Mainz': ['Mainz 05', '1. FSV Mainz 05'], 'Heidenheim': ['1. FC Heidenheim'], 'Real Oviedo': ['Oviedo'], 'Celta Vigo': ['Celta'], 'RC Lens': ['Lens'], 'Atalanta': ['Atalanta BC'], 'Sevilla': ['Sevilla FC']}
VERB_OK = r'(?:named|appointed|elected|confirmed|re-?elected|unveiled|installed|names?|appoints?|elects?|confirms?|unveils?|installs?|becomes?)'
NOT_FINAL = r'(?i)\b(reportedly|set to|in talks|expected|could|may|might|rumou?r|tipped|favou?rite|candidate|bid|plans?|considering|likely|poised|sources?|wants?|eyeing|eyes|frontrunner|race|shortlist|would|should|will be|to be named|to appoint|to name|hopes?|denies|deny|denied|rejects?|claims?|speculation|why|how|what|who|\?)\b|\?'
OFFICIAL = r'(?i)\b(official|officially|confirm\w*|announce\w*|statement|elected|appointed|unveil\w*|named|ratif\w*|vote[sd]?)\b'
ROLE = r'(?:club\s+)?(?:president|chairman)'
NAME = r"(?P<n>[A-ZÀ-Ý][\w\.\'’\-À-ÿ]+(?:\s+(?:de|di|da|van|von|der|del|la|le|bin|al|el)?\s*[A-ZÀ-Ý][\w\.\'’\-À-ÿ]+){1,3})"

def build_clubs(d):
    groups = {}
    for k, v in d.items():
        if not isinstance(v, dict) or re.match(r'(Al[ -]|Damac|Neom)', k): continue
        groups.setdefault((v.get('name'), v.get('en')), []).append(k)
    out = []
    for g, keys in groups.items():
        keys = sorted(keys, key=len)
        primary = keys[0]
        al = set()
        for k in keys:
            al.add(k); al |= set(ALIAS.get(k, []))
            for suf in (' FC', ' CF', ' AFC'):
                if k.endswith(suf): al.add(k[:-len(suf)])
            for pre in ('FC ', 'AFC ', 'AC ', 'AS ', 'RC ', 'SV ', 'US ', 'RCD '):
                if k.startswith(pre): al.add(k[len(pre):])
        out.append((primary, sorted(al, key=len, reverse=True)))
    return out

def club_re(aliases):
    return '(?:' + '|'.join(re.escape(a) for a in aliases) + ')'

def extract(title, clubs):
    if ' - ' in title: title = title.rsplit(' - ', 1)[0]
    if ' | ' in title: title = title.split(' | ')[0]
    if re.search(NOT_FINAL, title): return []
    res = []
    for key, aliases in clubs:
        cr = club_re(aliases)
        if not re.search(r'\b' + cr + r'\b', title): continue
        # resignation
        if re.search(r'(?i)\b(resign\w*|steps? down|quits?|stepping down|leaves? (?:his|her) post|departs?|ousted|sacked|dismissed)\b', title) and re.search(r'(?i)\b(president|chairman)\b', title) and not re.search(r'(?i)\b(manager|coach|head coach|director|captain|player|striker|goalkeeper|defender|midfielder|vice|chief executive|ceo|sporting|boss|fifa|uefa|la liga|laliga|league|federation|association|concacaf|conmebol|afc|ex-|former|calls? for|demand\w*)\b', title, re.I):
            res.append((key, 'resign', None, False))
        m = re.search(r'\b' + cr + r"\b\s+(?:have\s+)?" + VERB_OK + r"\s+" + NAME + r"\s+(?:as\s+)?(?:their\s+)?(?:new\s+|interim\s+|acting\s+)?" + ROLE, title) \
            or re.search(NAME + r"\s+(?:is\s+|has been\s+|was\s+)?" + VERB_OK + r"\s+(?:as\s+)?(?:new\s+|interim\s+|acting\s+)?" + ROLE + r"\s+(?:of|at)\s+" + cr, title) \
            or re.search(NAME + r"\s+(?:elected|named|appointed)\s+" + cr + r"\s+(?:new\s+)?(?:club\s+)?(?:president|chairman)", title) \
            or re.search(r'\b' + cr + r"\b\s+(?:new\s+)?(?:president|chairman)\s*:?\s+" + NAME + r"\s+(?:elected|named|appointed|confirmed|unveiled)", title) \
            or re.search(r'\b' + cr + r"\b\W{0,3}" + NAME + r"\s+(?:is\s+|has been\s+)?" + VERB_OK + r"\s+as\s+(?:new\s+|interim\s+|acting\s+)?" + ROLE, title)
        if m:
            nm = m.group('n').strip()
            if len(nm.split()) >= 2 and nm not in sum([a for _, a in clubs], []):
                res.append((key, 'appoint', nm, bool(re.search(r'(?i)interim|acting|caretaker', title))))
    return res

def confirm_page(url, name, aliases, kind):
    real = resolve(url)
    if not real: return None
    try: h = norm_en(re.sub(r'<[^>]+>', ' ', get(real)))
    except Exception: return None
    toks = [t for t in norm_en(name).split() if len(t) > 2]
    ok = sum(1 for t in toks if t in h) >= min(2, len(toks)) and re.search(r'president|chairman', h) and any(norm_en(a) in h for a in aliases)
    if kind == 'resign': ok = ok and re.search(r'resign|step down|stepped down|quit|steps down|departure', h)
    return (bool(ok), bool(re.search(OFFICIAL.replace('(?i)', ''), h, re.I)))

def norm_en(s): return re.sub(r'\s+', ' ', (s or '').lower())

def same_person_en(cur_name, cur_en, new):
    toks = lambda s: {t for t in re.split(r'[\s\-]+', (s or '').lower()) if len(t) > 2 and t not in ('del', 'van', 'von', 'der')}
    a = toks(cur_en); b = toks(new)
    return bool(a and b and (len(a & b) >= min(2, len(a), len(b)) or (list(re.split(r'\s+', cur_en.strip()))[-1].lower() == list(re.split(r'\s+', new.strip()))[-1].lower() if cur_en else False)))

def ar_label(en):
    """Arabic label from Wikidata if the entity looks like a person in football/business/politics; else None."""
    try:
        u = 'https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&uselang=ar&limit=5&type=item&search=' + urllib.parse.quote(en)
        for r in json.loads(get(u)).get('search', []):
            lab = r.get('display', {}).get('label', {}).get('value') or r.get('label') or ''
            desc = (r.get('display', {}).get('description', {}) or {}).get('value') or r.get('description') or ''
            if re.search('[؀-ۿ]', lab) and re.search('رئيس|رجل أعمال|مالك|مصرف|إداري|كرة القدم|مستثمر|محام|سياسي|أعمال', desc) and lab.split()[-1] != en.split()[-1]:
                return lab
    except Exception as e:
        print('wikidata fail', str(e)[:60])
    return None


CLUB_AR = load('club_ar.json', {})

def ar_wikipedia(en):
    """Arabic Wikipedia title via the English page's language link (person must look like a football/business figure)."""
    try:
        u = 'https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=langlinks|extracts&lllang=ar&exintro=1&explaintext=1&exchars=400&titles=' + urllib.parse.quote(en)
        for pg in json.loads(get(u)).get('query', {}).get('pages', {}).values():
            ext = (pg.get('extract') or '').lower()
            ll = pg.get('langlinks') or []
            if ll and re.search(r'chairman|president|businessman|owner|executive|football|club|investor|banker|politician|lawyer', ext):
                t = ll[0].get('*') or ll[0].get('title') or ''
                t = re.sub(r'\s*\(.*?\)', '', t).strip()
                if re.search('[\u0600-\u06ff]', t): return t
    except Exception as e:
        print('wikipedia fail', str(e)[:60])
    return None

def ar_news(club_key, event_date, when='10d'):
    """Arabic outlets: >=2 distinct outlets naming the same new president of this club within a few days of the English news."""
    import pres_watch as pw
    car = CLUB_AR.get(club_key)
    if not car: return None
    old = pw.CLUBS
    pw.CLUBS = {club_key: car}
    try:
        items = pw.gnews('رئيسا لنادي ' + car, when) + pw.gnews('تكليف برئاسة نادي ' + car, when) + pw.gnews(car + ' رئيس جديد رسميا', when)
        votes = {}
        for it in items:
            if it['date'] and event_date and abs((it['date'] - event_date).days) > 7: continue
            for k, kind, name, interim in pw.extract(it['title']):
                if kind == 'appoint' and name and len(name.split()) >= 2:
                    votes.setdefault(pw.norm(name), {'name': name, 'hosts': set()})['hosts'].add(it.get('host') or host_of(it['link']))
        for v in votes.values():
            if len(v['hosts']) >= 2: return v['name']
    except Exception as e:
        print('ar_news fail', str(e)[:60])
    finally:
        pw.CLUBS = old
    return None

def resolve_arabic(en, club_key, event_date=None):
    return ar_label(en) or ar_wikipedia(en) or ar_news(club_key, event_date)

def upgrade_pending(d, alerts, now):
    """Entries that were applied with an English name wait for an Arabic name; retry every cycle."""
    done = False
    for k, v in list(d.items()):
        if not isinstance(v, dict) or not v.get('arPending'): continue
        en = v.get('en')
        club = next((kk for kk, vv in d.items() if vv is v), k)
        ar = resolve_arabic(en, v.get('arClub') or k, None)
        if ar:
            for kk, vv in d.items():
                if isinstance(vv, dict) and vv.get('arPending') and vv.get('en') == en:
                    vv['name'] = ar + (' (رئيس مكلّف)' if vv.get('interim') else '')
                    vv.pop('arPending', None); vv.pop('arClub', None)
            alerts.append({'t': str(now), 'club': k, 'type': 'arabic-name-resolved', 'en': en, 'ar': ar})
            done = True
    return done

def main():
    if os.environ.get('WATCH_TEST_AR'):
        out = {}
        for nm in os.environ['WATCH_TEST_AR'][3:].split('|'):
            if '@' in nm:
                en, ck = nm.split('@')
                import pres_watch as pw
                car = CLUB_AR.get(ck)
                pw.CLUBS = {ck: car}
                evs = []
                for q in ['رئيسا لنادي ' + car, 'تكليف برئاسة نادي ' + car, car + ' رئيس جديد رسميا']:
                    for it in pw.gnews(q, '900d'):
                        for e in pw.extract(it['title']): evs.append([e[1], e[2], it['title'][:70], it.get('host'), str(it['date'])[:10]])
                out[nm] = {'ar_news': ar_news(ck, None, '900d'), 'events': evs[:12]}
            else:
                out[nm] = {'wikidata': ar_label(nm), 'wikipedia': ar_wikipedia(nm)}
        json.dump(out, open('pres_ar_test.json', 'w'), ensure_ascii=False, indent=1)
        return
    d = load('presidents.json', {})
    state = load('pres_watch_state_eu.json', {'seen': [], 'events': {}, 'resign': {}})
    alerts = load('presidents_alerts.json', [])
    clubs = build_clubs(d); amap = dict(clubs)
    now = datetime.datetime.utcnow()
    items = []
    when = '120d' if BACKTEST else '2d'
    for f in FEEDS: items += rss(f)
    for q in QUERIES: items += gnews(q, when, 'en')
    for st in SITES: items += gnews('site:%s (president OR chairman) (resigns OR appointed OR elected OR named) club' % st, when, 'en')
    seen = set(state['seen']); log = []
    for it in items:
        l = it['link']
        if not l or l in seen: continue
        h0 = it.get('host') or host_of(l)
        if not any(h0.endswith(x) for x in SRC): continue
        if not BACKTEST and it['date'] and (now - it['date']).days > 10: continue
        evs = extract(it['title'], clubs)
        if not evs: continue
        seen.add(l)
        for key, kind, name, interim in evs:
            log.append({'club': key, 'kind': kind, 'name': name, 'interim': interim, 'title': it['title'], 'link': l, 'host': h0, 'date': str(it['date'])})
    state['seen'] = list(seen)[-4000:]
    from collections import Counter
    pc = [(it['title'][:90], it.get('host') or host_of(it['link']), str(it['date'])[:10]) for it in items if re.search(r'(?i)president|chairman', it['title'])]
    stats = {'n_items': len(items), 'hosts': Counter((it.get('host') or host_of(it['link'])) for it in items).most_common(25), 'n_pres_titles': len(pc), 'pres_titles': pc[:60]}
    json.dump({'events': log, 'stats': stats}, open('pres_watch_log_eu.json', 'w'), indent=1, ensure_ascii=False)
    if BACKTEST:
        print('events', len(log)); return
    changed = False
    for e in log:
        cur = d.get(e['club'])
        if not cur: continue
        host = e['host']; sc = {'url': e['link'], 'title': e['title'], 'date': e['date'] if e['date'] != 'None' else None}
        if e['kind'] == 'resign':
            if cur['name'].startswith('لم يُعلن'): continue
            sur = (cur.get('en') or '').split()[-1].lower() if cur.get('en') else ''
            if sur and sur in e['title'].lower():
                state['resign'].setdefault(e['club'], {'sources': {}, 'first': str(now), 'who': cur['name']})['sources'][host] = sc
            else:
                alerts.append({'t': str(now), 'club': e['club'], 'type': 'resign-other', 'title': e['title'], 'src': e['link']})
            continue
        if same_person_en(cur['name'], cur.get('en'), e['name']): continue
        ev = state['events'].setdefault(e['club'], {}).setdefault(norm_en(e['name']), {'name': e['name'], 'interim': e['interim'], 'sources': {}, 'first': str(now)})
        ev['sources'][host] = sc; ev['interim'] = ev['interim'] and e['interim']
    def group_of(cur): return [kk for kk, vv in d.items() if isinstance(vv, dict) and vv.get('name') == cur['name'] and vv.get('en') == cur.get('en')]
    def recent(srcs): return any(s.get('date') and (now - datetime.datetime.fromisoformat(s['date'])).days <= 3 for s in srcs.values())
    for club, rs in list(state['resign'].items()):
        cur = d.get(club)
        if not cur or cur['name'] != rs['who'] or (now - datetime.datetime.fromisoformat(rs['first'])).days > 5: del state['resign'][club]; continue
        if len(rs['sources']) >= 2:
            res = {h: confirm_page(s['url'], cur.get('en') or '', amap[club], 'resign') for h, s in rs['sources'].items()}
            good = [h for h, r in res.items() if r and r[0]]
            if len(good) >= 2 and recent(rs['sources']) and APPLY:
                old = re.sub(r'\s*\([^)]*\)', '', cur['name']).strip()
                months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
                nm = 'لم يُعلن الرئيس الجديد بعد (استقال ' + old + ' في ' + months[now.month - 1] + ' ' + str(now.year) + ')'
                for kk in group_of(cur):
                    v = d[kk]
                    for f in ('image', 'imageAuto', 'imageFor', 'imageSrc', 'titles', 'titlesTotal', 'prev', 'titlesLabel', 'note', 'interim'): v.pop(f, None)
                    v.update({'name': nm, 'en': '', 'since': None, 'noTitles': True})
                alerts.append({'t': str(now), 'club': club, 'type': 'vacancy', 'old': old, 'sources': {h: rs['sources'][h]['url'] for h in good}})
                changed = True; del state['resign'][club]
    for club, evs in list(state['events'].items()):
        for k, ev in list(evs.items()):
            cur = d.get(club)
            if cur and same_person_en(cur['name'], cur.get('en'), ev['name']): del evs[k]; continue
            if len(ev['sources']) >= 2:
                res = {h: confirm_page(s['url'], ev['name'], amap[club], 'appoint') for h, s in ev['sources'].items()}
                good = [h for h, r in res.items() if r and r[0]]
                official = any(res[h][1] or re.search(OFFICIAL, ev['sources'][h]['title']) for h in good)
                if len(good) >= 2 and official and recent(ev['sources']) and APPLY and cur:
                    ar = resolve_arabic(ev['name'], club, None)
                    nm = (ar or ev['name']) + (' (رئيس مكلّف)' if ev['interim'] else '')
                    for kk in group_of(cur):
                        v = d[kk]
                        for f in ('image', 'imageAuto', 'imageFor', 'imageSrc', 'titles', 'titlesTotal', 'prev', 'titlesLabel', 'note', 'interim'): v.pop(f, None)
                        v.update({'name': nm, 'en': ev['name'], 'since': now.year, 'noTitles': True})
                        if not ar: v['arPending'] = True; v['arClub'] = club
                        else: v.pop('arPending', None); v.pop('arClub', None)
                        if ev['interim']: v['interim'] = True
                    alerts.append({'t': str(now), 'club': club, 'type': 'applied', 'old': cur['name'], 'new': nm, 'arabic_label_found': bool(ar), 'sources': {h: ev['sources'][h]['url'] for h in good}})
                    changed = True; del evs[k]
            elif (now - datetime.datetime.fromisoformat(ev['first'])).days >= 7:
                alerts.append({'t': str(now), 'club': club, 'type': 'single-source', 'name': ev['name'], 'src': list(ev['sources'].values())[0]['url']}); del evs[k]
    if APPLY and upgrade_pending(d, alerts, now): changed = True
    json.dump(state, open('pres_watch_state_eu.json', 'w'), indent=1, ensure_ascii=False)
    json.dump(alerts[-200:], open('presidents_alerts.json', 'w'), indent=1, ensure_ascii=False)
    if changed: json.dump(d, open('presidents.json', 'w'), indent=2, ensure_ascii=False)
    print('log', len(log), 'changed', changed)

if __name__ == '__main__':
    main()

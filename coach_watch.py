# Watcher for Saudi club coach sackings / appointments.
# Rule: an event is published ONLY when >=2 independent outlets report it for the same club in the same window.
import json, re, os, sys, time, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
spec = importlib.util.spec_from_file_location('pw', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pres_watch.py'))
pw = importlib.util.module_from_spec(spec)
sys.argv = ['x']
spec.loader.exec_module(pw)
norm, gnews, bing = pw.norm, pw.gnews, pw.bing
CLUBS = pw.CLUBS
EXCL = pw.EXCL + r'|المصري|مصر|الزمالك|السعودي للاتحاد|منافس|الرجاء|المغرب|الكونفدراليه|الافريقيه|الاهلي القطري|الاهلي الليبي|الاهلي الاماراتي|الاهلي المصري|بيراميدز|القاهره|الجزائر|تونس'
SACK = r'اقاله|اقال|اقيل|يقيل|اعفاء|يعفي|انهاء عقد|ينهي عقد|ينهي تعاقده|فسخ عقد|رحيل المدرب|يرحل المدرب|الاستغناء عن المدرب|الاستغناء عن خدمات|تنهي علاقتها|ينفصل عن'
HIRE = r'تعيين|يعين|يتعاقد مع|تعاقد مع|تتعاقد مع|يعلن تعاقده|تعاقد النادي|مدربا جديدا|مدربا للفريق|يقود الفريق'
NOT_FINAL = r'مصادر|يقترب|يتجه|مرشح|ترشح|ترشيح|يدرس|يرفض|ينفي|من هو|ماذا|قائمه|فتح باب|شائعات|اشاعه|تسريب|بحسب|تردد|سيعلن|ينتظر|مرتقب|المنتظر|المحتمل|متوقع|توقعات|هل |؟|\?|قد يكون|ربما|حقيقه|مطالب|تطالب|يطالب|غضب|مصير|مستقبل|بين'
OUT = 'coach_news.json'
now = datetime.datetime.utcnow()
WINDOW = datetime.timedelta(days=4)
KEEP = datetime.timedelta(days=2)
try:
    old = json.load(open(OUT, encoding='utf-8')).get('items', [])
except Exception:
    old = []
found = {}
log = []
for en, ar in CLUBS.items():
    for q in ['إقالة مدرب ' + ar, 'تعيين مدرب جديد ' + ar]:
        for it in gnews(q, '3d'):
            t = it['title'] or ''
            nt = norm(t)
            nc = norm(ar)
            if nc not in nt: continue
            if re.search(EXCL, nt): continue
            if re.search(NOT_FINAL, nt): continue
            if not it['date'] or now - it['date'] > WINDOW: continue
            kind = 'sack' if re.search(SACK, nt) else ('hire' if re.search(HIRE, nt) and 'مدرب' in nt else None)
            if not kind: continue
            host = (it['host'] or '').replace('www.', '')
            if not host or host not in pw.SAUDI: continue
            k = (en, kind)
            e = found.setdefault(k, {'club': en, 'club_ar': ar, 'type': kind, 'hosts': {}, 'first': it['date']})
            e['hosts'][host] = {'title': t, 'link': it['link'], 'date': it['date'].isoformat()}
            if it['date'] < e['first']: e['first'] = it['date']
        time.sleep(0.4)

# ================= Europe top-5: official-only, >=2 independent reputable outlets =================
import unicodedata
def asc(x):
    x = unicodedata.normalize('NFD', x or '')
    x = ''.join(c for c in x if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9 ]+', ' ', x.lower()).strip()
EU_LEAGUES = [('eng.1', 'en', ['en']), ('esp.1', 'es', ['es', 'en']), ('ita.1', 'it', ['it', 'en']), ('ger.1', 'de', ['de', 'en']), ('fra.1', 'fr', ['fr', 'en'])]
GOOD = ['bbc.com','bbc.co.uk','skysports.com','theguardian.com','espn.com','espn.co.uk','reuters.com','apnews.com','telegraph.co.uk','theathletic.com','nytimes.com','goal.com','marca.com','as.com','mundodeportivo.com','sport.es','elpais.com','lequipe.fr','lemonde.fr','rmcsport.bfmtv.com','gazzetta.it','corrieredellosport.it','tuttosport.com','kicker.de','bild.de','sport1.de','sportschau.de','uefa.com','premierleague.com','laliga.com','football-italia.net','dailymail.co.uk','standard.co.uk','independent.co.uk','mirror.co.uk','eurosport.com','si.com','cbssports.com','foxsports.com','yahoo.com','sportsmole.co.uk','fourfourtwo.com','lavanguardia.com','elmundo.es','abc.es','ole.com.ar','tvn24.pl','cnn.com','france24.com','rfi.fr','liberation.fr','leparisien.fr','francetvinfo.fr','ouest-france.fr','sudouest.fr','footmercato.net','sofoot.com','spiegel.de','faz.net','sueddeutsche.de','tagesschau.de','dazn.com','ansa.it','repubblica.it','corriere.it','ilmessaggero.it','sportmediaset.mediaset.it','sport.sky.it','calciomercato.com']
def good(h):
    h = (h or '').replace('www.', '')
    return any(h == g or h.endswith('.' + g) for g in GOOD)
SACKS = {
 'en': r'sack(?:s|ed)?\b|fire[sd]?\b|dismiss(?:es|ed)?\b|part(?:s|ed)? (?:ways|company)|relieved of|axe[sd]?\b|leaves? (?:the )?club|steps? down|resign',
 'es': r'destituy|cesa(?:n|do)?\b|despide|despedid|rescinde|rescinden|salida del entrenador|dimite|dimisi',
 'it': r'esonera|esonerat|solleva|ha sollevato|separa|risolto il contratto|dimissioni|lascia la panchina',
 'de': r'entlass|freigestellt|trennt sich|trennen sich|beurlaubt|rücktritt|ruecktritt|tritt zurück',
 'fr': r'limog|licenci|se sépare|se separe|débarqu|debarqu|démission|demission|quitte le banc',
}
HIRES = {
 'en': r'appoint(?:s|ed)?\b|names? .{0,40}(?:head coach|manager)|unveil(?:s|ed)?\b|new (?:head coach|manager)|confirm(?:s|ed)? .{0,30}(?:head coach|manager)',
 'es': r'nuevo entrenador|ficha|presenta|nombra|oficializa',
 'it': r'nuovo allenatore|ufficiale|nominat|annuncia',
 'de': r'neuer trainer|neuer cheftrainer|präsentiert|praesentiert|verpflichtet|ernennt',
 'fr': r'nouvel entraîneur|nouvel entraineur|nomme|officialise|présente|presente',
}
DOUBT = r'\b(?:could|might|may|set to|expected|likely|reportedly|rumou?rs?|linked|considering|contemplat|on the brink|under pressure|future|odds|favou?rite|candidate|shortlist|wants?|eyes?|target|replace|replacement|who will|what next|analysis|opinion|why|should|would|must|talks?|close to|nears?|poised|ready to|plans? to|decid|pondering|doubts?)\b|puede|podría|podria|posible|candidato|sonar|suena|rumor|futuro|pressione|potrebbe|probabile|ipotesi|voci|favorito|vorrebbe|sondaggio|könnte|koennte|gerücht|geruecht|spekulation|kandidat|zukunft|wackelt|pourrait|rumeur|piste|candidat|avenir|sur la sellette|\?|¿'
CONTEXT_EXCL = r'women|femenin|femminile|frauen|feminin|u21|u19|u18|u23|reserve|youth|academy|primavera|castilla|b team|second team|ii\b'
EU_LOG = []
EU_FOUND = {}
for slug, lang, langs in EU_LEAGUES:
    try:
        teams = []
        j = json.loads(pw.get('https://site.api.espn.com/apis/site/v2/sports/soccer/%s/teams?limit=60' % slug))
        for t in (((j.get('sports') or [{}])[0].get('leagues') or [{}])[0].get('teams') or []):
            t = t.get('team') or {}
            names = set()
            for k in ('displayName', 'shortDisplayName', 'name'):
                v = asc(re.sub(r'\b(?:fc|afc|cf|ac|as|ssc|us|sc|ud|rc|cd|1\.|fsv|tsg|vfb|vfl|sv|rb|1|04|05|96|1899|1848)\b', ' ', asc(t.get(k, ''))))
                v = re.sub(r'\s+', ' ', v).strip()
                if len(v) >= 5 and ' ' in v or len(v) >= 6: names.add(v)
            if t.get('displayName'): teams.append({'club': t['displayName'], 'names': sorted(names, key=len, reverse=True)})
    except Exception as e:
        print('espn teams fail', slug, str(e)[:60]); continue
    for ed in langs:
        for q in {'en': ['manager sacked', 'head coach sacked', 'parts company with manager', 'appoints new head coach'],
                  'es': ['entrenador destituido', 'nuevo entrenador oficial'], 'it': ['allenatore esonerato', 'nuovo allenatore ufficiale'],
                  'de': ['Trainer entlassen', 'neuer Trainer offiziell'], 'fr': ['entraîneur limogé', 'nouvel entraîneur officiel']}[ed]:
            qq = q + ' ' + {'eng.1': 'Premier League', 'esp.1': 'LaLiga', 'ita.1': 'Serie A', 'ger.1': 'Bundesliga', 'fra.1': 'Ligue 1'}[slug]
            for it in gnews(qq, '3d', ed):
                t = it['title'] or ''
                at = asc(t)
                host = (it['host'] or '').replace('www.', '')
                if not it['date'] or now - it['date'] > WINDOW or not good(host): continue
                if re.search(DOUBT, t.lower()) or re.search(CONTEXT_EXCL, at): continue
                hit = [tm for tm in teams if any((' ' + n + ' ') in (' ' + at + ' ') for n in tm['names'])]
                if len(hit) != 1: continue
                L = ed
                kind = 'sack' if re.search(SACKS[L], t.lower()) else ('hire' if re.search(HIRES[L], t.lower()) else None)
                if not kind: continue
                if kind == 'hire' and not re.search(r'coach|manager|entrenador|allenatore|trainer|entra[iî]neur', t.lower()): continue
                k = (hit[0]['club'], kind)
                e = EU_FOUND.setdefault(k, {'club': hit[0]['club'], 'club_ar': '', 'type': kind, 'hosts': {}, 'first': it['date']})
                e['hosts'][host] = {'title': t, 'link': it['link'], 'date': it['date'].isoformat()}
                if it['date'] < e['first']: e['first'] = it['date']
            time.sleep(0.4)
for k, e in EU_FOUND.items():
    EU_LOG.append({'club': e['club'], 'type': e['type'], 'n': len(e['hosts']), 'hosts': list(e['hosts'])})
    found[('EU:' + k[0], k[1])] = e

items = []
for k, e in found.items():
    hosts = list(e['hosts'].items())
    log.append({'club': e['club'], 'type': e['type'], 'n': len(hosts), 'hosts': [h for h, _ in hosts]})
    if len(hosts) >= 2:
        items.append({'club': e['club'], 'club_ar': e['club_ar'], 'type': e['type'], 'first': e['first'].isoformat(), 'sources': [{'host': h, 'title': v['title'], 'link': v['link']} for h, v in hosts[:4]]})
# merge with old (keep confirmed items for 14 days)
seen = {(i['club'], i['type']) for i in items}
for o in old:
    try:
        if (o['club'], o['type']) in seen: continue
        if now - datetime.datetime.fromisoformat(o['first']) < KEEP: items.append(o)
    except Exception:
        pass
json.dump({'updated': int(time.time() * 1000), 'items': items}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump({'t': now.isoformat(), 'seen': log, 'eu': EU_LOG}, open('coach_watch_log.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('items', len(items), 'candidates', len(found))

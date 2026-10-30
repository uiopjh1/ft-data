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
EXCL = pw.EXCL + r'|المصري|مصر|الزمالك|السعودي للاتحاد'
SACK = r'اقاله|اقال|اقيل|يقيل|اعفاء|يعفي|انهاء عقد|ينهي عقد|ينهي تعاقده|فسخ عقد|رحيل المدرب|يرحل المدرب|الاستغناء عن المدرب|الاستغناء عن خدمات|تنهي علاقتها|ينفصل عن'
HIRE = r'تعيين|يعين|يتعاقد مع|تعاقد مع|تتعاقد مع|يعلن تعاقده|تعاقد النادي|مدربا جديدا|مدربا للفريق|يقود الفريق'
NOT_FINAL = r'مصادر|يقترب|يتجه|مرشح|ترشح|ترشيح|يدرس|يرفض|ينفي|من هو|ماذا|قائمه|فتح باب|شائعات|اشاعه|تسريب|بحسب|تردد|سيعلن|ينتظر|مرتقب|المنتظر|المحتمل|متوقع|توقعات|هل |؟|\?|قد يكون|ربما|حقيقه|مطالب|تطالب|يطالب|غضب|مصير|مستقبل|بين'
OUT = 'coach_news.json'
now = datetime.datetime.utcnow()
WINDOW = datetime.timedelta(days=4)
KEEP = datetime.timedelta(days=14)
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
            host = it['host'] or ''
            if not host: continue
            k = (en, kind)
            e = found.setdefault(k, {'club': en, 'club_ar': ar, 'type': kind, 'hosts': {}, 'first': it['date']})
            e['hosts'][host] = {'title': t, 'link': it['link'], 'date': it['date'].isoformat()}
            if it['date'] < e['first']: e['first'] = it['date']
        time.sleep(0.4)
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
json.dump({'t': now.isoformat(), 'seen': log}, open('coach_watch_log.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('items', len(items), 'candidates', len(found))

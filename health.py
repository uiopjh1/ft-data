# Daily health report -> health.json: is each automatic job still running and its data fresh? (no manual upkeep)
import json, os, datetime, urllib.request, subprocess
NOW = datetime.datetime.now(datetime.timezone.utc)
def iso(s): return datetime.datetime.fromisoformat(s.replace('Z', '+00:00'))
def gh(path):
    r = urllib.request.Request('https://api.github.com/repos/' + os.environ['GITHUB_REPOSITORY'] + path, headers={'Authorization': 'Bearer ' + os.environ.get('GITHUB_TOKEN', ''), 'Accept': 'application/vnd.github+json'})
    return json.loads(urllib.request.urlopen(r, timeout=30).read())
def last_ok(wf):
    runs = gh(f'/actions/workflows/{wf}/runs?per_page=30&status=completed').get('workflow_runs', [])
    ok = [r for r in runs if r['conclusion'] == 'success']
    return iso(ok[0]['updated_at']) if ok else None
def file_age(path):
    try:
        t = subprocess.check_output(['git', 'log', '-1', '--format=%cI', '--', path]).decode().strip()
        return iso(t) if t else None
    except Exception: return None
CHECKS = [  # name, kind, target, max age hours
    ('الرؤساء (فحص ساعي)', 'run', 'pres-live.yml', 3),
    ('المعلقون (الجدول)', 'run', 'commentators.yml', 8),
    ('صور المعلقين (يومي)', 'run', 'comm-photos.yml', 30),
    ('ملف المعلقين commentators.json', 'file', 'commentators.json', 12),
    ('ملف الرؤساء presidents.json', 'file', 'presidents.json', 24 * 14),
]
items = []
for name, kind, target, mx in CHECKS:
    try: t = last_ok(target) if kind == 'run' else file_age(target)
    except Exception as e: t = None
    age = round((NOW - t).total_seconds() / 3600, 1) if t else None
    items.append({'name': name, 'target': target, 'last_ok': t.isoformat() if t else None, 'age_h': age, 'max_h': mx, 'ok': age is not None and age <= mx})
try:
    hb = json.load(open('pres_live_status.json')); a = round((NOW - iso(hb['last_run_utc'])).total_seconds() / 3600, 1)
    items.append({'name': 'نبضة فحص الرؤساء', 'target': 'pres_live_status.json', 'last_ok': hb['last_run_utc'], 'age_h': a, 'max_h': 2, 'ok': a <= 2})
except Exception: items.append({'name': 'نبضة فحص الرؤساء', 'ok': False})
out = {'checked': NOW.isoformat(), 'all_ok': all(i['ok'] for i in items), 'items': items}
json.dump(out, open('health.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False, indent=1))

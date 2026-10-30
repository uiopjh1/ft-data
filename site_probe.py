import json, urllib.request, urllib.parse, time
H = {'User-Agent': 'FTapp/1.0 (football app; github uiopjh1)'}
def j(u):
    for i in range(3):
        try: return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=30).read())
        except Exception as e: err = str(e)[:100]; time.sleep(3)
    return {'err': err}
C = 'https://commons.wikimedia.org/w/api.php?format=json&'
out = {}
cats = ['Category:Association football referees from Saudi Arabia', 'Category:Saudi Arabian football referees', 'Category:Football referees from Saudi Arabia', 'Category:Referees from Saudi Arabia', 'Category:Association football referees by country']
for c in cats:
    r = j(C + 'action=query&list=categorymembers&cmlimit=100&cmtitle=' + urllib.parse.quote(c))
    out[c] = [(m['title'], m['ns']) for m in (r.get('query') or {}).get('categorymembers', [])][:100] if 'err' not in r else r
    print(c, len(out[c]) if isinstance(out[c], list) else out[c], flush=True)
for q in ['Saudi referee football', 'Majed Al-Shamrani referee', 'Al-Shamrani referee', 'Abdulsamad Bakri', 'Bakri referee Saudi', 'Fareeh Al-Jalaoud', 'Khalid Al-Ahmari referee', 'Donatas Rumsas', 'Rumšas referee', 'Abdullah Al-Shehri referee', 'Roshn Saudi League referee']:
    r = j(C + 'action=query&list=search&srnamespace=6&srlimit=10&srsearch=' + urllib.parse.quote(q))
    out['search: ' + q] = [x['title'] for x in (r.get('query') or {}).get('search', [])] if 'err' not in r else r
    print(q, len(out['search: ' + q]) if isinstance(out['search: ' + q], list) else 'err', flush=True)
json.dump(out, open('site_probe.json', 'w'), ensure_ascii=False, indent=1)

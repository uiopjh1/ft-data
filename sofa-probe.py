import json, urllib.request
H = {'user-agent': 'Mozilla/5.0'}
def get(u):
    try:
        return json.load(urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=20))
    except Exception as e:
        return {'error': str(e)}
B = 'https://api.sofascore.com/api/v1/unique-tournament/23674'
s = get(B + '/seasons')
print([(x['id'], x['year']) for x in s.get('seasons', [])[:3]], s.get('error'))
sid = s['seasons'][0]['id']
for d in ('last', 'next'):
    for p in (0, 1):
        j = get(f'{B}/season/{sid}/events/{d}/{p}')
        print('==', d, p, 'hasNext', j.get('hasNextPage'), 'err', j.get('error'))
        for e in j.get('events', []):
            print(e.get('startTimestamp'), (e.get('roundInfo') or {}).get('name'), e['homeTeam'].get('id'), e['homeTeam'].get('name'), '|', e['awayTeam'].get('id'), e['awayTeam'].get('name'), e['status'].get('type'))

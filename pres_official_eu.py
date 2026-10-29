# Try to find a president's portrait on the club's OFFICIAL website: crawl 2 levels from the home page,
# keep pages that mention the surname, take <img> tags whose alt/src/nearby text carry the surname, require a single-face portrait.
import json, re, sys, html, urllib.parse
import pres_auto as pa
from pres_auto_eu import fold, surname
SITES = {
 'Hoffenheim': ('André Kreuzwieser', 'https://www.tsg-hoffenheim.de'),
 'Union Berlin': ('Dirk Zingler', 'https://www.fc-union-berlin.de'),
 'Heidenheim': ('Holger Sanwald', 'https://www.fc-heidenheim.de'),
 'Werder Bremen': ('Hubertus Hess-Grunewald', 'https://www.werder.de'),
 'Mainz': ('Stefan Hofmann', 'https://www.mainz05.de'),
}
KW = re.compile(r'praesidium|präsidium|vorstand|verein|club|ueber|über|organ|gremien|aufsichtsrat|management|geschaeftsfuehrung|geschäftsführung|team|menschen|leitung', re.I)
def links(h, base):
    out = []
    for m in re.finditer(r'<a[^>]+href=["\']([^"\'#]+)', h, re.I):
        u = urllib.parse.urljoin(base, html.unescape(m.group(1)))
        if urllib.parse.urlparse(u).netloc == urllib.parse.urlparse(base).netloc: out.append(u.split('?')[0])
    return list(dict.fromkeys(out))
def imgs(h, base, sn):
    res = []
    for m in re.finditer(r'<img[^>]*>', h, re.I):
        tag = m.group(0); ctx = h[max(0, m.start() - 400): m.end() + 400]
        srcs = re.findall(r'(?:data-src|src|data-lazy-src)=["\']([^"\']+)', tag) + [s.split()[0] for ss in re.findall(r'srcset=["\']([^"\']+)', tag) for s in ss.split(',')]
        near = fold(re.sub(r'<[^>]+>', ' ', ctx)) + ' ' + fold(tag)
        if sn in near:
            for s in srcs:
                if not s.startswith('data:') and not re.search(r'\.(svg|gif)', s): res.append(urllib.parse.urljoin(base, html.unescape(s)))
    return list(dict.fromkeys(res))
def run(club, name, root, log):
    sn = surname(name); seen = set(); queue = [root]; pages = 0
    cands = []
    while queue and pages < 40:
        u = queue.pop(0)
        if u in seen: continue
        seen.add(u)
        try: h = pa.get(u)
        except Exception as e: log.append([u, 'fail ' + str(e)[:30]]); continue
        pages += 1
        if sn in fold(re.sub(r'<[^>]+>', ' ', h)) and u != root:
            for im in imgs(h, u, sn): cands.append((u, im))
        if len(seen) < 25:
            for l in links(h, u):
                if KW.search(l) and l not in seen: queue.append(l)
        if cands: break
    for page, im in cands[:8]:
        try: buf = pa.get(im, True)
        except Exception: continue
        ok, why = pa.portrait_ok(buf)
        log.append([page, im, ok, why])
        if ok: return {'image': im, 'src': page}
    return None
if __name__ == '__main__':
    rep = {}
    for club, (name, root) in SITES.items():
        log = []; r = run(club, name, root, log)
        rep[club] = {'name': name, 'found': r, 'log': log[:8]}
    json.dump(rep, open('pres_official_report.json', 'w'), ensure_ascii=False, indent=1)
    print(sum(1 for v in rep.values() if v['found']), 'of', len(rep))

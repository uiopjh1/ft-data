# Daily commentators + TV channels from Goal.com Arabic "جدول مباريات اليوم .. القنوات الناقلة والمعلقين".
# Source rule (user decision): one reputable outlet is accepted for commentators; every row keeps its source URL.
# Output: commentators.json {updated, days:{YYYY-MM-DD:{src, rows:[{comp, home, away, time, channel, comm:[...]}]}}}
import json, re, os, sys, html, datetime, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
WD = ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد']
MO = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
def fold(s):
    s = re.sub('[ً-ٰٟـ]', '', str(s or '')).lower()
    s = re.sub('[أإآٱ]', 'ا', s).replace('ى', 'ي').replace('ة', 'ه').replace('ٔ', '').replace('ٕ', '')
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9ء-ي ]+', ' ', s)).strip()
def get(url, timeout=40):
    r = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'ar,en;q=0.8'})
    return urllib.request.urlopen(r, timeout=timeout).read().decode('utf-8', 'ignore')
def bing(q):
    out = []
    try:
        x = get('https://www.bing.com/news/search?format=rss&mkt=ar-SA&q=' + urllib.parse.quote(q))
        for it in ET.fromstring(x).iter('item'):
            l = it.findtext('link') or ''
            m = re.search(r'[?&]url=([^&]+)', l)
            if m: l = urllib.parse.unquote(m.group(1))
            out.append((html.unescape(it.findtext('title') or ''), l))
    except Exception as e:
        print('search fail', e)
    return out
def discover(d):
    wd, mo = WD[d.weekday()], MO[d.month - 1]
    title = f'جدول مباريات اليوم {wd} {d.day} {mo} {d.year}'
    seen = []
    for q in (title + ' القنوات الناقلة والمعلقين', title + ' goal.com', f'جدول مباريات اليوم {d.day} {mo} {d.year} المعلقين'):
        for t, l in bing(q):
            ft = fold(t)
            if 'المعلق' not in ft or f'{d.day} {fold(mo)} {d.year}' not in ft: continue
            host = urllib.parse.urlparse(l).netloc
            if not re.search(r'(^|\.)(goal|kooora)\.com$', host): continue
            if l not in seen: seen.append(l)
    return seen
class TP(HTMLParser):
    def __init__(self):
        super().__init__(); self.tables = []; self.cur = None; self.row = None; self.cell = None; self.last = ''; self.buf = ''; self.depth = 0; self.hb = None
    def handle_starttag(self, t, a):
        if t in ('h1', 'h2', 'h3', 'h4') and self.cur is None: self.hb = ''
        if t == 'table':
            self.depth += 1
            if self.depth == 1: self.cur = {'comp': self.last, 'rows': []}
        elif self.cur is not None and t == 'tr': self.row = []
        elif self.cur is not None and t in ('td', 'th'): self.cell = ''
        elif t in ('br', 'p', 'div', 'li') and self.cell is not None: self.cell += '\n'
    def handle_endtag(self, t):
        if t in ('p', 'div', 'li') and self.cell is not None: self.cell += '\n'
        if t == 'table' and self.depth:
            self.depth -= 1
            if self.depth == 0 and self.cur is not None: self.tables.append(self.cur); self.cur = None
        elif t in ('td', 'th') and self.cell is not None and self.row is not None:
            self.row.append(self.cell); self.cell = None
        elif t == 'tr' and self.row is not None and self.cur is not None:
            self.cur['rows'].append(self.row); self.row = None
        elif t in ('h1', 'h2', 'h3', 'h4') and self.hb is not None:
            if self.hb.strip(): self.last = self.hb.strip()
            self.hb = None
    def handle_data(self, d):
        if self.cell is not None: self.cell += d
        elif self.hb is not None: self.hb += d
def names(cell):
    out = []
    for p in re.split(r'[\n،,]| و | - |/', cell or ''):
        p = re.sub(r'\s+', ' ', p).strip()
        if p and re.fullmatch(r'[؀-ۿ ]{3,40}', p) and 1 <= len(p.split()) <= 4: out.append(p)
    return out
def parse(page):
    p = TP(); p.feed(re.sub(r'<(script|style).*?</\1>', '', page, flags=re.S | re.I))
    rows = []
    for t in p.tables:
        hdr = None
        comp = re.sub(r'\s+', ' ', t['comp']).strip()
        for r in t['rows']:
            cells = [re.sub(r'[ \t]+', ' ', c).strip() for c in r]
            if not hdr:
                if any('المباراة' in c for c in cells):
                    hdr = {('m' if 'المباراة' in c else 't' if 'الموعد' in c else 'ch' if 'القنوات' in c else 'cm' if ('المعلق' in c or 'التعليق' in c) else str(i)): i for i, c in enumerate(cells)}
                elif len(cells) == 1 and cells[0]: comp = cells[0]
                continue
            if len(cells) == 1 and rows and 'cm' in hdr and rows[-1]['comp'] == comp:
                rows[-1]['comm'] += [n for n in names(cells[0]) if n not in rows[-1]['comm']]; continue
            if len(cells) < 3 or 'm' not in hdr or hdr['m'] >= len(cells): continue
            mt = [x.strip() for x in re.split(r'\s+[-–]\s+', cells[hdr['m']].replace('\n', ' '))]
            if len(mt) != 2 or not all(mt): continue
            g = lambda k: cells[hdr[k]] if k in hdr and hdr[k] < len(cells) else ''
            rows.append({'comp': comp, 'home': mt[0], 'away': mt[1], 'time': g('t').replace('\n', ' '), 'channel': re.sub(r'\s+', ' ', g('ch').replace('\n', ' ')).strip(), 'comm': names(g('cm'))})
    return rows
def main():
    now = datetime.datetime.utcnow() + datetime.timedelta(hours=3)
    today = now.date()
    try: out = json.load(open('commentators.json'))
    except Exception: out = {'days': {}}
    dbg = {}
    for k in (0, 1):
        d = today + datetime.timedelta(days=k); key = d.isoformat()
        urls = discover(d); dbg[key] = {'urls': urls[:4]}
        got = None
        for u in urls:
            try:
                pg = get(u); i = pg.find('الخلود', pg.find('الجولة 12') if 'الجولة 12' in pg else 0); dbg[key]['raw'] = re.sub(r'\s+', ' ', pg[max(0, i - 300):i + 900])
                rows = parse(pg)
            except Exception as e: dbg[key]['err'] = str(e)[:80]; continue
            dbg[key]['rows'] = len(rows)
            if len(rows) >= 2: got = {'src': u, 'rows': rows}; break
        if got: out.setdefault('days', {})[key] = got
    cut = (today - datetime.timedelta(days=3)).isoformat()
    out['days'] = {k: v for k, v in out.get('days', {}).items() if k >= cut}
    out['updated'] = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%MZ')
    json.dump(out, open('commentators.json', 'w'), ensure_ascii=False, indent=1)
    json.dump(dbg, open('commentators_debug.json', 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(dbg, ensure_ascii=False))
if __name__ == '__main__': main()

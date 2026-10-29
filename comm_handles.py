# Find X handles of commentators from the broadcaster's OWN posts: "بصوت معلّق «ثمانية» <name> @handle" (Bing web search titles/snippets),
# then fetch the profile picture through unavatar.io, keep it only if it is a single clear face. Output: comm_handles_report.json + candidates.
import json, re, os, time, html, urllib.parse, urllib.request
from commentators import fold
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
def bing_web(q):
    try:
        h = urllib.request.urlopen(urllib.request.Request('https://www.bing.com/search?setlang=ar&cc=SA&count=30&q=' + urllib.parse.quote(q), headers={'User-Agent': UA, 'Accept-Language': 'ar,en;q=0.8'}), timeout=25).read().decode('utf8', 'ignore')
    except Exception as e:
        return '', str(e)[:80]
    t = html.unescape(re.sub(r'<[^>]+>', ' ', re.sub(r'<(script|style).*?</\1>', '', h, flags=re.S)))
    return re.sub(r'\s+', ' ', t), ''
def main():
    only = os.environ.get('ONLY', '')
    names = [n for n in json.load(open('commentators_info.json')).keys()]
    rep = {}
    for n in names:
        if only and n not in only.split('|'): continue
        txt = ''; err = ''
        for q in (f'رياضة ثمانية بصوت معلّق «ثمانية» {n} @', f'"{n}" معلق @ x.com'):
            t, e = bing_web(q); txt += ' ' + t; err = err or e; time.sleep(1)
        pat = re.compile(re.escape(n).replace(r'\ ', r'\s+') + r'\s*[،,]?\s*(?:برفقة\s*)?@([A-Za-z0-9_]{3,15})')
        hs = {}
        for m in pat.finditer(txt): hs[m.group(1)] = hs.get(m.group(1), 0) + 1
        rep[n] = {'handles': hs, 'len': len(txt), 'err': err, 'sample': txt[:300]}
        print(n, hs, len(txt), err, flush=True)
    json.dump(rep, open('comm_handles_report.json', 'w'), ensure_ascii=False, indent=1)
if __name__ == '__main__': main()

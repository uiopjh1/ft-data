import json, re, urllib.request, html
H = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept-Language': 'en'}
def get(u, n=900000):
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=30); return r.status, r.read(n).decode('utf8', 'ignore')
    except Exception as e: return getattr(e, 'code', 0) or 0, str(e)[:100]
out = {}
for k, u in {'ksa': 'https://legal.fifa.com/en/associations/KSA/referees', 'ksa2': 'https://inside.fifa.com/associations/KSA/referees', 'lit': 'https://legal.fifa.com/en/associations/LTU/referees'}.items():
    st, t = get(u)
    txt = re.sub(r'\s+', ' ', re.sub(r'<script.*?</script>|<style.*?</style>', ' ', t, flags=re.S))
    txt = html.unescape(re.sub(r'<[^>]+>', ' ', txt))
    out[k] = {'status': st, 'len': len(t), 'imgs': re.findall(r'https?://[^"\'\s<>]+\.(?:jpg|jpeg|png|webp)', t)[:12], 'pic_api': re.findall(r'https?://api\.fifa\.com/api/v3/picture[^"\'\s<>]*', t)[:12], 'text': re.sub(r'\s+', ' ', txt)[:2500], 'has_next_data': '__NEXT_DATA__' in t}
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', t, re.S)
    if m: out[k]['next_data_head'] = m.group(1)[:3000]
    print(k, st, flush=True)
sm = get('https://inside.fifa.com/sitemap.xml', 200000)
out['sitemap'] = {'status': sm[0], 'refs': re.findall(r'<loc>([^<]*referee[^<]*)</loc>', sm[1], re.I)[:20], 'head': sm[1][:400]}
json.dump(out, open('fifa_probe.json', 'w'), ensure_ascii=False, indent=1)

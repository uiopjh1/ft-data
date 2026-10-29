import urllib.request, urllib.parse, re, json, sys
H={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36','Accept-Language':'ar,en;q=0.8'}
def get(u):
    try: return urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=25).read().decode('utf8','ignore')
    except Exception as e: return 'ERR %s'%e
out={}
q='معلق رياضي خالد الحربان'
tests={
 'ddg_html':'https://html.duckduckgo.com/html/?q='+urllib.parse.quote(q),
 'ddg_lite':'https://lite.duckduckgo.com/lite/?q='+urllib.parse.quote(q),
 'brave_img':'https://search.brave.com/images?q='+urllib.parse.quote(q),
 'yandex_img':'https://yandex.com/images/search?text='+urllib.parse.quote(q),
 'mojeek':'https://www.mojeek.com/search?q='+urllib.parse.quote(q),
 'commons':'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch='+urllib.parse.quote('خالد الحربان')+'&prop=imageinfo&iiprop=url',
 'startpage':'https://www.startpage.com/do/search?q='+urllib.parse.quote(q),
 'bing_news':'https://www.bing.com/news/search?q='+urllib.parse.quote('"خالد الحربان"')+'&format=rss',
 'google_news':'https://news.google.com/rss/search?q='+urllib.parse.quote('"خالد الحربان" معلق')+'&hl=ar&gl=SA&ceid=SA:ar',
}
for k,u in tests.items():
    t=get(u); out[k]={'len':len(t),'head':t[:300].replace('\n',' '),'imgs':re.findall(r'https?://[^"\'\s<>]+\.(?:jpg|jpeg|png|webp)',t)[:8]}
    print(k,len(t),len(out[k]['imgs']),flush=True)
json.dump(out,open('img_probe_out.json','w'),ensure_ascii=False,indent=1)

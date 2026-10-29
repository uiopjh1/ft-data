import urllib.request, urllib.parse, re, json
H={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36','Accept-Language':'ar,en;q=0.8'}
def get(u):
    try: return urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=25).read().decode('utf8','ignore')
    except Exception as e: return 'ERR %s'%e
t=get('https://yandex.com/images/search?text='+urllib.parse.quote('"خالد الحربان" معلق'))
open('yandex_sample.html','w').write(t)
m=re.findall(r'data-bem="([^"]*serp-item[^"]*)"',t)
print(len(t),len(m))

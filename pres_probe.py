import json, urllib.parse, urllib.request, re, html, email.utils
import xml.etree.ElementTree as ET
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
def get(u,t=20):
    r=urllib.request.Request(u,headers={'User-Agent':UA,'Accept-Language':'ar'})
    with urllib.request.urlopen(r,timeout=t) as f: return f.status,f.read().decode('utf-8','ignore')
out={}
def probe(name,u):
    try:
        st,b=get(u)
        try:
            root=ET.fromstring(b); its=list(root.iter('item'))
            items=[]
            for it in its[:60]:
                src=it.find('source'); 
                items.append([html.unescape(it.findtext('title') or '')[:80],(it.findtext('link') or '')[:90],it.findtext('pubDate') or '', (src.get('url') if src is not None else '')])
            out[name]={'status':st,'n':len(its),'sample':items[:6],'newest':items[0][2] if items else ''}
        except Exception as e:
            out[name]={'status':st,'parse':str(e)[:60],'head':b[:150]}
    except Exception as e:
        out[name]={'err':str(e)[:80]}
feeds=['https://aawsat.com/feed/sport','https://aawsat.com/feed','https://aawsat.com/rss.xml','https://aawsat.com/feed/sports','https://www.okaz.com.sa/rss','https://www.okaz.com.sa/rss/sport','https://www.okaz.com.sa/rss/saudi','https://www.okaz.com.sa/sport/rss','https://arriyadiyah.com/rss','https://arriyadiyah.com/feed','https://sabq.org/rss','https://sabq.org/rss/sports','https://slaati.com/feed/','https://slaati.com/category/sports/feed/','https://www.alyaum.com/rss','https://www.alwatan.com.sa/rss','https://www.al-jazirah.com/rss','https://www.eremnews.com/rss','https://www.eremnews.com/rss/sports','https://ajel.sa/rss','https://www.kooora.com/rss','https://www.goal.com/feeds/ar/news','https://www.spl.com.sa/ar/rss']
for f in feeds: probe(f,f)
q=urllib.parse.quote('رئيس نادي الأهلي')
for iv in ['4','7','8']:
    probe('bing_iv'+iv,'https://www.bing.com/news/search?format=rss&setlang=ar&q='+q+'&qft=interval%3d%22'+iv+'%22')
probe('bing_plain','https://www.bing.com/news/search?format=rss&setlang=ar&q='+q)
probe('bing_sort','https://www.bing.com/news/search?format=rss&setlang=ar&q='+q+'&qft=sortbydate%3d%221%22')
probe('google','https://news.google.com/rss/search?q='+urllib.parse.quote('رئيس نادي الأهلي when:7d')+'&hl=ar&gl=SA&ceid=SA:ar')
probe('google_aawsat','https://news.google.com/rss/search?q='+urllib.parse.quote('رئيس نادي site:aawsat.com when:3d')+'&hl=ar&gl=SA&ceid=SA:ar')
json.dump(out,open('pres_probe.json','w'),indent=1,ensure_ascii=False)

import urllib.request,json
H1={'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1','Accept':'*/*','Accept-Language':'en-US,en;q=0.9','Origin':'https://www.sofascore.com','Referer':'https://www.sofascore.com/'}
H2={'User-Agent':'okhttp/4.9.2'}
H3={}
res=[]
for host in ('api.sofascore.com','api.sofascore.app','www.sofascore.com/api'):
  for nm,H in (('safari',H1),('okhttp',H2),('none',H3)):
    for path in ('/api/v1/search/teams/Abha' if 'www' not in host else '/v1/search/teams/Abha','/api/v1/team/36256/image' if 'www' not in host else '/v1/team/36256/image'):
      u='https://'+host+path
      try:
        r=urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=20);res.append((u,nm,r.status))
      except Exception as e: res.append((u,nm,str(e)[:40]))
open('kit/probe.txt','w').write('\n'.join(map(str,res)))

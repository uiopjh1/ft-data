"""فحص لون قميص اللاعب في صورته مقابل ألوان ناديه الحالي (تجربة)."""
import json,sys,io,time,urllib.request,urllib.parse
import numpy as np
from PIL import Image
H={'User-Agent':'Mozilla/5.0','Accept':'application/json'}
def get(u,raw=False):
    for i in range(3):
        try:
            r=urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=25).read()
            import gzip
            if r[:2]==b'\x1f\x8b': r=gzip.decompress(r)
            if not raw and not r.strip().startswith(b'{'): open('kit/net.txt','a').write(u+' NONJSON '+repr(r[:120])+'\n'); time.sleep(2); continue
            return r if raw else json.loads(r)
        except Exception as e:
            open('kit/net.txt','a').write(u+' '+str(e)+'\n');time.sleep(2)
    return None
def hexrgb(h):
    h=h.lstrip('#');return np.array([int(h[i:i+2],16) for i in (0,2,4)],float)
def shirt_rgb(img):
    im=img.convert('RGB').resize((120,150))
    a=np.asarray(im).astype(float)
    t=a[85:140,30:90].reshape(-1,3)            # منطقة الصدر
    mx,mn=t.max(1),t.min(1)
    sat=(mx-mn)/np.maximum(mx,1)
    skin=(t[:,0]>t[:,1])&(t[:,1]>t[:,2])&(t[:,0]>90)&(sat>0.18)&(sat<0.6)
    bg=(mx>235)&(sat<0.08)
    k=t[~skin&~bg]
    if len(k)<80:return None
    q=(k//32).astype(int);key=q[:,0]*64+q[:,1]*8+q[:,2]
    v,c=np.unique(key,return_counts=True);b=v[c.argmax()]
    return k[key==b].mean(0)
def dist(a,b):return float(np.linalg.norm(a-b))

def main(team_name):
    L=get('https://site.api.espn.com/apis/site/v2/sports/soccer/ksa.1/teams')
    teams=[t['team'] for t in L['sports'][0]['leagues'][0]['teams']]
    t=[x for x in teams if team_name.lower() in x['displayName'].lower()][0]
    cols=[hexrgb(t[k]) for k in ('color','alternateColor') if t.get(k)]
    out={'team':t['displayName'],'id':t['id'],'colors':[t.get('color'),t.get('alternateColor')]}
    R=get(f"https://site.api.espn.com/apis/site/v2/sports/soccer/ksa.1/teams/{t['id']}/roster")
    ath=R.get('athletes',[]);rows=[];sheet=[]
    for p in ath:
        hs=(p.get('headshot') or {}).get('href')
        if not hs: rows.append({'name':p['displayName'],'v':'no_headshot'});continue
        raw=get(hs,True)
        if not raw: rows.append({'name':p['displayName'],'v':'no_image'});continue
        im=Image.open(io.BytesIO(raw));c=shirt_rgb(im)
        d=min(dist(c,x) for x in cols) if c is not None else None
        v='unknown' if d is None else ('match' if d<70 else 'suspect')
        rows.append({'name':p['displayName'],'v':v,'dist':None if d is None else round(d)})
        sheet.append((p['displayName'],v,im.convert('RGB').resize((120,150))))
    out['players']=rows;out['n']=len(ath)
    json.dump(out,open('kit/report.json','w'),ensure_ascii=False,indent=1)
    from PIL import ImageDraw
    n=len(sheet);c=8;S=Image.new('RGB',(c*125,max(1,(n+c-1)//c)*175),'white');d=ImageDraw.Draw(S)
    for i,(nm,v,im) in enumerate(sheet):
        x,y=(i%c)*125,(i//c)*175;S.paste(im,(x,y));d.text((x+2,y+152),nm[:20],fill='red' if v=='suspect' else 'black')
    S.save('kit/sheet.jpg',quality=80)
import traceback
try: main(sys.argv[1])
except Exception: open('kit/error.txt','w').write(traceback.format_exc())

"""فحص لون قميص اللاعب في صورته مقابل ألوان ناديه الحالي (تجربة)."""
import json,sys,io,time,urllib.request,urllib.parse
import numpy as np
from PIL import Image
H={'User-Agent':'Mozilla/5.0','Accept':'application/json'}
def get(u,raw=False):
    for i in range(3):
        try:
            r=urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=25).read()
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
    s=get('https://api.sofascore.app/api/v1/search/teams/'+urllib.parse.quote(team_name))
    out={'search':[(r['entity']['id'],r['entity']['name'],r['entity'].get('country',{}).get('name')) for r in (s or {}).get('results',[])[:5]]}
    tid=out['search'][0][0] if out['search'] else None
    t=get(f'https://api.sofascore.app/api/v1/team/{tid}')['team']
    tc=t.get('teamColors') or {}
    cols=[hexrgb(tc[k]) for k in ('primary','secondary') if tc.get(k)]
    out['team']=t['name'];out['colors']=tc
    pl=get(f'https://api.sofascore.app/api/v1/team/{tid}/players')['players']
    rows=[];sheet=[]
    for p in pl:
        p=p['player'];raw=get(f"https://api.sofascore.app/api/v1/player/{p['id']}/image",True)
        if not raw:rows.append({'name':p['name'],'id':p['id'],'v':'no_image'});continue
        try:im=Image.open(io.BytesIO(raw));c=shirt_rgb(im)
        except Exception as e:rows.append({'name':p['name'],'id':p['id'],'v':'bad'});continue
        d=min(dist(c,x) for x in cols) if c is not None and cols else None
        v='unknown' if d is None else ('match' if d<70 else 'suspect')
        rows.append({'name':p['name'],'id':p['id'],'v':v,'dist':None if d is None else round(d),'rgb':None if c is None else [int(x) for x in c]})
        sheet.append((p['name'],v,im.convert('RGB').resize((120,150))))
    out['players']=rows
    json.dump(out,open('kit/report.json','w'),ensure_ascii=False,indent=1)
    from PIL import ImageDraw
    n=len(sheet);cols_n=8;W=cols_n*125;Hh=((n+cols_n-1)//cols_n)*175
    S=Image.new('RGB',(W,Hh),'white');d=ImageDraw.Draw(S)
    for i,(nm,v,im) in enumerate(sheet):
        x,y=(i%cols_n)*125,(i//cols_n)*175;S.paste(im,(x,y))
        d.text((x+2,y+152),nm[:20],fill='red' if v=='suspect' else 'black')
    S.save('kit/sheet.jpg',quality=80)
import traceback
try: main(sys.argv[1])
except Exception: open('kit/error.txt','w').write(traceback.format_exc())

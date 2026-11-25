# summ.py <이름> — run.sh 결과(out.txt)를 경우마다 가운데 값으로
import json,sys,os,statistics as st
name=sys.argv[1]
root=os.environ.get('TW_BOOTM_OUT','/tmp/tw-bootm-e2e')
rows={}
for line in open(os.path.join(root,name,'out.txt')):
    k,i,j=line.split(' ',2)
    try: d=json.loads(j)
    except Exception: print('bad',line[:200]); continue
    rows.setdefault(k,[]).append(d)
def med(xs):
    xs=[x for x in xs if x is not None]
    return int(st.median(xs)) if xs else None
for k in ['cold','warm','update']:
    L=rows.get(k,[])
    if not L: continue
    print(f"{name:10s} {k:6s} n={len(L)} begin={med([d['begin'] for d in L])} face={med([d['face'] for d in L])} parts={med([d['parts'] for d in L])} face-begin={med([d['faceFromBegin'] for d in L])} parts-begin={med([d['partsFromBegin'] for d in L])} reqBeforeFace={med([d['reqBeforeFace'] for d in L])} apiBeforeFace={med([d['apiBeforeFace'] for d in L])} glbBeforeFace={med([d['glbBeforeFace'] for d in L])} glbTotal={med([d['glbTotal'] for d in L])} apiTotal={med([d['apiTotal'] for d in L])}")
    print('   faces', [d['face'] for d in L], 'parts', [d['parts'] for d in L])

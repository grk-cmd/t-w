# shape.py <측정 worktree> — e2e-local 주소 돌리기에 왕복 지연 · 공유 대역폭 흉내(TW_BOOTM_RTT ms · TW_BOOTM_BW 바이트/ms)를 넣고,
#   켤 때 확인을 /actuator/health/liveness 로 바꾼다(로컬 API 의 health 는 Firestore 에뮬레이터가 없으면 DOWN 이다). 측정 worktree 에만 — 커밋하지 않는다
import sys
p=sys.argv[1]+'/apps/desktop/tools/e2e-local/route-main.js'
s=open(p,encoding='utf8').read()
if 'TW_BOOTM_RTT' not in s:
  s=s.replace("""  async function https(ses, req){""","""  const RTT = Number(process.env.TW_BOOTM_RTT || 0), BW = Number(process.env.TW_BOOTM_BW || 0);
  let linkFree = 0;
  const nap = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
  async function shape(r){
    if(!RTT && !BW) return r;
    const nobody = r.status === 204 || r.status === 304 || r.status === 101;
    const buf = nobody ? null : Buffer.from(await r.arrayBuffer());
    await nap(RTT);
    if(BW && buf){ const now = Date.now(); const st = Math.max(now, linkFree); linkFree = st + buf.length / BW; await nap(linkFree - now); }
    const h = new Headers(r.headers); h.delete('content-length'); h.delete('content-encoding');
    return new Response(buf, { status: r.status, statusText: r.statusText, headers: h });
  }
  async function https(ses, req){""",1)
  s=s.replace("""        write(`REQ ${tag} ${r.status}`);
        return r;""","""        write(`REQ ${tag} ${r.status}`);
        return await shape(r);""",1)
  assert s.count('shape(r)')==2
  open(p,'w',encoding='utf8').write(s)
print('shape ok')
p=sys.argv[1]+'/apps/desktop/tools/e2e-local/lib.js'
s=open(p,encoding='utf8').read()
s=s.replace("/actuator/health`","/actuator/health/liveness`").replace("/^GET \\/actuator\\/health 200$/","/^GET \\/actuator\\/health\\/liveness 200$/")
open(p,'w',encoding='utf8').write(s)
print('liveness ok', s.count('health/liveness'))

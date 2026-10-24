/*
 * 🎰 가챠 노드(users/{uid}/gacha)를 트랜잭션으로 고치는 한 길 — 뽑기 · 합치기(gacha.js)가 쓴다.
 * apply(지금 서버 값) 가 새 값 또는 null(쓰지 않음)을 준다. firebase-init.js 는 db · SDK 함수를 넘겨 연결만 한다.
 *
 * - 먼저 연결을 본다 — 끊긴 채 트랜잭션을 걸면 SDK 가 다시 붙을 때까지 기다려 뽑기 창이 멈춘다.
 * - 사전 get 은 첫 시도의 cur=null 오해를 막는다 — SDK 는 «빈 노드» 와 «아직 모름» 을 가르지 않는다.
 * - 사전 get 부터 저장까지를 시간 상한 하나가 덮는다. 넘기면 «timeout» 으로 답하고 남은 재시도는 그만둔다.
 *   이미 서버로 간 시도가 늦게 붙으면 opt.onLate(값) 로 알린다 — 부르는 쪽이 사본에 합쳐 뽑기가 사라지지 않는다.
 *
 * deps: db · ref · get · runTransaction(Firebase SDK) · waitConnected(ms) → Promise<bool> · whenAuthReady() → Promise
 * @return updateGacha → { ok:true, committed, value:{owned, ts} } | { ok:false, reason:'offline'|'timeout'|'denied'|'error' }
 */
export const GACHA_CONNECT_WAIT_MS = 3000;
export const GACHA_TX_TIMEOUT_MS = 10000;

export function gachaFailReason(e){
  return /permission[_ ]denied/i.test(String((e && (e.code || e.message)) || e)) ? 'denied' : 'error';
}

export function createGachaTx(deps){
  const { db, ref, get, runTransaction, waitConnected, whenAuthReady } = deps;

  async function updateGacha(uid, apply, opt){
    if(!uid) return { ok:false, reason:'error' };
    await whenAuthReady();
    if(!(await waitConnected(GACHA_CONNECT_WAIT_MS))) return { ok:false, reason:'offline' };
    const r = ref(db, `users/${uid}/gacha`);
    let gaveUp = false, timer = null;
    const deadline = new Promise(res => { timer = setTimeout(() => res({ ok:false, reason:'timeout' }), GACHA_TX_TIMEOUT_MS); });
    const work = (async () => {
      let pre = null;
      try{ pre = (await get(r)).val(); }
      catch(e){ console.warn('[가챠] 읽기 실패', e); return { ok:false, reason:gachaFailReason(e) }; }
      if(gaveUp) return { ok:false, reason:'timeout' };
      try{
        const res = await runTransaction(r, cur => {
          if(gaveUp) return;                               // undefined = 그만둠
          const next = apply(cur == null ? pre : cur);
          return next == null ? undefined : next;
        });
        return { ok:true, committed: !!res.committed, value: res.snapshot.val() || {} };
      }catch(e){ console.warn('[가챠] 저장 실패', e); return { ok:false, reason:gachaFailReason(e) }; }
    })();
    const out = await Promise.race([work, deadline]);
    clearTimeout(timer);
    if(!out.ok && out.reason === 'timeout'){
      gaveUp = true;
      work.then(v => { if(v.ok && v.committed && opt && opt.onLate){ try{ opt.onLate(v.value); }catch(_){} } });
    }
    return out;
  }

  return { updateGacha };
}

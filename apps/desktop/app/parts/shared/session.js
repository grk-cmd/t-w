/* session.js — 🔐 로그인 세션 하나 (검사 sim-session.js)
   로그인(계정 확인 통과)마다 세션을 새로 만든다. 계정 코드 · me · 계정 칸 열기 · 타이머 · 구독 · 비우기 훅을 세션이 쥐고,
   로그아웃 · 계정 바뀜은 dispose() 한 번으로 전부 멈추고 비운다. 다음 로그인은 새 세션 — 앞 세션의 것은 하나도 이어받지 않는다.
   ⚠️ 세션을 받아 쓰는 기능은 아직 포커스 진척(focus-progress.js startFocus · onReset)뿐이다 — launcher/app-boot.js 가 만들어 들고 있다. 나머지 기능을 옮기는 일은 다음 묶음. */
(function(){
'use strict';

let seq = 0;   // 세션 번호 — 만든 차례. 늦게 도착한 답이 «내 세션 것인가» 를 가리는 데도 쓴다(id 비교)

/** @param {{
 *   me: { userCode: string },                                   // 서버가 확인해 준 계정(userCode 필수)
 *   openAccountStore: (code: string) => boolean,                // 계정 칸 열기(account-store.js open) — false 면 못 연 것
 *   closeAccountStore: () => void,                              // 계정 칸 닫기(account-store.js close)
 *   timers: { setInterval: Function, clearInterval: Function, setTimeout: Function, clearTimeout: Function },   // 창의 타이머(검사에서 가짜로 갈아 끼움)
 * }} deps */
function createSession(deps){
  const me = deps.me;
  if(!me || typeof me.userCode !== 'string' || !me.userCode) throw new Error('[session] 계정(me.userCode)이 없어요');
  const openAccountStore = deps.openAccountStore;
  const closeAccountStore = deps.closeAccountStore;
  const timers = deps.timers;

  const id = ++seq;
  const code = me.userCode;
  let alive = true;
  let storeOpened = false;
  const timerHandles = new Set();   // 아직 살아 있는 setInterval / setTimeout 손잡이
  const unsubs = new Set();         // 아직 안 푼 구독 해제 함수
  const resets = [];                // 비우기 훅 — 등록 순서

  function late(what){ console.warn('[session ' + id + '] 끝난 세션에 ' + what + '을(를) 등록하려 해서 바로 풀었어요'); }

  /** 계정 칸을 연다(옛 값 옮기기가 끝난 뒤 한 번). @return 열었으면 true */
  function openStore(){
    if(!alive){ console.warn('[session ' + id + '] 끝난 세션이라 계정 칸을 열지 않아요'); return false; }
    if(storeOpened) return true;
    storeOpened = openAccountStore(code) === true;
    return storeOpened;
  }

  /* 타이머 — 세션이 끝나면 dispose 가 전부 clear 한다. 손잡이를 못 받은 늦은 호출은 즉시 거절(null) */
  function setIntervalIn(fn, ms){
    if(!alive){ late('타이머'); return null; }
    const h = timers.setInterval(() => { if(alive) fn(); }, ms);
    timerHandles.add(h);
    return h;
  }
  function setTimeoutIn(fn, ms){
    if(!alive){ late('타이머'); return null; }
    const h = timers.setTimeout(() => { timerHandles.delete(h); if(alive) fn(); }, ms);
    timerHandles.add(h);
    return h;
  }
  function clearIntervalIn(h){ if(timerHandles.delete(h)) timers.clearInterval(h); }
  function clearTimeoutIn(h){ if(timerHandles.delete(h)) timers.clearTimeout(h); }

  /** 구독 해제 함수를 맡긴다(rt-hub on() · 서버 subscribe 가 돌려주는 것). 끝난 세션이면 바로 풀고 경고.
   *  @return 지금 풀고 싶을 때 부르는 함수(한 번만 풀린다) */
  function on(unsub){
    if(!alive){ late('구독'); runOnce(unsub, '구독 해제'); return () => {}; }
    unsubs.add(unsub);
    return () => { if(unsubs.delete(unsub)) runOnce(unsub, '구독 해제'); };
  }

  /** 세션이 끝날 때 메모리 값을 비우는 함수를 맡긴다. 끝난 세션이면 바로 한 번 부르고 경고. */
  function onReset(fn){
    if(!alive){ late('비우기 훅'); runOnce(fn, '비우기'); return; }
    resets.push(fn);
  }

  function runOnce(fn, label){
    try{ fn(); }catch(e){ console.warn('[session ' + id + '] ' + label + ' 실패', e); }
  }

  /** await · 콜백 뒤에 «이 세션 것인가» 를 가르는 한 길. 끝난 세션이면 부르지 않고 undefined. */
  function ifAlive(fn){
    return (...args) => (alive ? fn(...args) : undefined);
  }

  /** 전부 멈추고 비운다 — 타이머 clear → 구독 해제(나중에 등록한 것부터) → 비우기 훅(나중 것부터) → 계정 칸 닫기.
   *  하나가 던져도 나머지는 돈다. 두 번째부터는 아무 일도 안 하고 false. 올릴 게 남았으면 dispose 전에 끝낸다. */
  function dispose(){
    if(!alive) return false;
    alive = false;   // 먼저 — 이 아래에서 돌아오는 콜백 · 등록은 모두 «끝난 세션» 으로 본다
    for(const h of timerHandles){
      try{ timers.clearInterval(h); timers.clearTimeout(h); }catch(e){ console.warn('[session ' + id + '] 타이머 끄기 실패', e); }
    }
    timerHandles.clear();
    const subs = Array.from(unsubs).reverse();
    unsubs.clear();
    for(const u of subs) runOnce(u, '구독 해제');
    const hooks = resets.splice(0).reverse();
    for(const r of hooks) runOnce(r, '비우기');
    if(storeOpened){
      storeOpened = false;
      try{ closeAccountStore(); }catch(e){ console.warn('[session ' + id + '] 계정 칸 닫기 실패', e); }
    }
    return true;
  }

  return {
    id, code, me,
    alive: () => alive,
    openStore,
    setInterval: setIntervalIn, setTimeout: setTimeoutIn, clearInterval: clearIntervalIn, clearTimeout: clearTimeoutIn,
    on, onReset, ifAlive, dispose,
    /** 아직 풀리지 않고 남은 것의 수 — 검사 · 진단용 */
    counts: () => ({ timers: timerHandles.size, subs: unsubs.size, resets: resets.length, storeOpened }),
  };
}

window.TwSession = { createSession };
})();

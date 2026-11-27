/* auth-barrier.js — 🚧 로그인 복원 대기선(auth barrier) — Firebase Auth 가 저장된 로그인을 되읽고 처음 답할 때까지
   getAuth() 는 바로 돌아오지만 저장된 로그인을 되읽는 일은 비동기다 — 그 사이 currentUser 는 null 이다.
   기다림이 둘이다(쓰는 곳이 바라는 것이 다르다).
     ready()          — 소유권이 걸린 쓰기 · 토큰이 필요한 요청. 첫 답 또는 8초 뒤 **반드시** 풀린다
                        (로그인 없는 기기 · Auth 초기화 실패 · 콜백이 안 오는 판에서 부팅이 통째로 걸리지 않게).
     answered(maxMs)  — 켤 때 «누구인가» 판정(login-flow.js). 첫 답이 오면 true · maxMs 안에 안 오면 false.
                        8초가 지났다고 «로그인 없음» 으로 보지 않는다 — 렌더러가 바쁜 PC 는 복원이 8초를 넘겨 켤 때마다 로그인 화면으로 떨어졌다.
     restoring()      — 켤 때 저장된 로그인이 있었고 아직 첫 답이 없다. 저장된 로그인 판정은 login-diag.js hasStoredLogin 한 곳.
   첫 상태 · 오류 · 8초 시간 초과는 진단(login-diag.js store)에 알리기만 한다.
   classic script(window.TwAuthBarrier) — firebase-init.js(module) 보다 먼저 싣는다. 검사 sim-auth-barrier.js. */
(function(){
'use strict';

const READY_TIMEOUT_MS = 8000;   // ready() 의 상한 — 쓰기가 영영 걸리지 않게(«누구인가» 판정은 이 값을 쓰지 않는다)

/** @param {{
 *   subscribe: ((onUser: (u: any) => void, onError: (e: any) => void) => void) | null,   // onAuthStateChanged — Auth 초기화 실패면 null
 *   storedLogin: boolean,   // 켤 때 저장된 로그인이 있었나(TwLoginDiag.hasStoredLogin)
 *   later: (fn: Function, ms: number) => void,
 *   diag: { authState: (u: any) => void, authError: (e: any) => void, barrierTimeout: () => void },
 *   warn: (msg: string) => void,
 * }} deps */
function createAuthBarrier(deps){
  const later = deps.later;
  const diag = deps.diag;
  const storedLogin = !!deps.storedLogin;
  let answered = false, settled = false, onAnswer = null, onReady = null;
  const answerP = new Promise((r) => { onAnswer = r; });
  const readyP = new Promise((r) => { onReady = r; });
  const pass = () => { if(settled) return; settled = true; onReady(); };
  const answer = () => { if(answered) return; answered = true; onAnswer(); pass(); };
  const tell = (fn) => { try{ fn(); }catch(_){} };   // 진단이 던져도 대기선은 그대로

  if(!deps.subscribe) answer();
  else{
    try{ deps.subscribe((u) => { tell(() => diag.authState(u)); answer(); }, (e) => { tell(() => diag.authError(e)); answer(); }); }
    catch(_){ answer(); }
    if(!answered) later(() => { if(settled) return; tell(() => deps.warn('[auth] 세션 복원이 늦어 대기선을 통과시킴')); tell(() => diag.barrierTimeout()); pass(); }, READY_TIMEOUT_MS);
  }

  return {
    ready: () => (settled ? Promise.resolve() : readyP),
    restoring: () => storedLogin && !answered,
    /* maxMs 를 빼면 상한 없이(기다리는 화면이 첫 답을 받아 이어 가는 데 쓴다) */
    answered: (maxMs) => {
      if(answered) return Promise.resolve(true);
      if(maxMs == null) return answerP.then(() => true);
      return new Promise((resolve) => { answerP.then(() => resolve(true)); later(() => resolve(false), maxMs); });
    },
  };
}

const api = { READY_TIMEOUT_MS, createAuthBarrier };
if(typeof window !== 'undefined') window.TwAuthBarrier = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

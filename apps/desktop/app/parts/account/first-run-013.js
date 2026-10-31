/* first-run-013.js — 🚚 0.13 첫 실행 — 이 PC 에 남은 옛 값을 서버로 올리고 지우는 차례 한 곳 (검사 sim-first-run-013.js)
   [왜] 0.12 까지는 캐릭터 · 라이선스 키 같은 값이 이 PC(localStorage)에 원본처럼 있었다. 0.13 은 서버가 원본이라
     처음 켤 때 한 번 올리고(필요한 것만) 이 PC 키를 지운다. 순서가 틀리면 잃는다 — 올리기 전에 지우면 끝이다.
   [차례] ① 로그인(서버 계정 확인) → ② 캐릭터 올리기(legacy-sync — D1 묶음) → ③ 라이선스 키 등록(D8 묶음) → ④ 이 PC 키 지우기.
     단계는 { ok, wipe?:[키], pending?, reason? } 를 돌려준다. 하나라도 ok 가 아니면 거기서 멈추고 **아무것도 지우지 않는다** — 다음 실행에 처음부터.
     ④ 는 앞 단계들이 «이제 지워도 된다» 고 돌려준 키(wipe)만 지운다.
   [다시 해도 같게] 단계마다 서버 답으로 «이미 했다» 를 알아 같은 결과를 낸다(예: AVATAR_LEGACY_SYNC_DONE) — 여기는 차례만 지킨다.
     다 끝나면 이 PC 에 «이 계정으로 끝냈다»(DONE_KEY = userCode)를 적어 다음 실행엔 건너뛴다(지워져도 다시 돌 뿐 — 정본은 서버).
   [자리] 캐릭터 · 라이선스 단계는 아직 «기다림»(pendingStep) — D1 · D8 묶음이 app.js 의 이 모듈 만드는 줄에서 진짜 함수로 바꾼다.
     기다림이 있는 동안 ④ 는 돌지 않는다(그래서 로그인 단계의 키도 아직 안 지운다).
   classic script — app.js 보다 먼저 싣는다(window.TwFirstRun013). 서버 · DOM 을 모른다. */
(function(){
'use strict';

const DONE_KEY = 'tw.firstRun013';
const STEPS = Object.freeze(['login', 'legacySync', 'licenseKey']);   // ④ 지우기는 맨 끝 — 따로 두지 않는다
/* 로그인 단계가 «이제 지워도 된다» 고 돌려주는 0.12 계정 키 — 서버가 가입 · 초대 · 친구코드를 맡으면서 아무도 안 읽는다 */
const LOGIN_LEGACY_KEYS = Object.freeze(['tw.inviteToken', 'tw.signupPending', 'tw.invitePassed', 'tw.myFriendCodePrev']);

/* 아직 채우지 않은 단계 — 늘 «기다림»(그 뒤 단계 · 지우기를 막는다) */
function pendingStep(name){ return async () => ({ ok: false, pending: true, reason: name + ' 단계를 아직 채우지 않았다' }); }
/* 로그인 단계 — 서버가 계정을 돌려줬으면 끝(그 뒤에 부른다) */
function loginStep(isIn){ return async () => (isIn() ? { ok: true, wipe: LOGIN_LEGACY_KEYS.slice() } : { ok: false, reason: '서버 계정 확인 전' }); }

/** @param {{ steps: { login: () => Promise<object>, legacySync: () => Promise<object>, licenseKey: () => Promise<object> },
 *   storage: { getItem: Function, setItem: Function, removeItem: Function }, userCode: () => (string | null), log?: { warn: Function } }} deps */
function createFirstRun(deps){
  for(const n of STEPS) if(typeof deps.steps[n] !== 'function') throw new Error('[0.13 첫 실행] 단계 없음 — ' + n);
  const storage = deps.storage;
  const log = deps.log || console;
  let running = null;

  async function once(uc){
    const wipe = [];
    for(const name of STEPS){
      let r;
      try{ r = await deps.steps[name](); }catch(e){ r = { ok: false, reason: String((e && e.message) || e) }; }
      if(!r || r.ok !== true){
        if(!(r && r.pending)) try{ log.warn('[0.13 첫 실행] 멈춤 —', name, r && r.reason); }catch(_){}
        return { ok: false, at: name, pending: !!(r && r.pending), reason: (r && r.reason) || '' };
      }
      if(Array.isArray(r.wipe)) for(const k of r.wipe) if(typeof k === 'string' && k && wipe.indexOf(k) < 0) wipe.push(k);
    }
    for(const k of wipe){ try{ storage.removeItem(k); }catch(_){} }
    try{ storage.setItem(DONE_KEY, uc); }catch(_){}
    return { ok: true, wiped: wipe };
  }
  /* 한 번 돌리기 — 끝낸 계정이면 건너뜀 · 도는 중에 또 부르면 같은 약속 */
  function run(){
    const uc = deps.userCode();
    if(!uc) return Promise.resolve({ ok: false, at: 'login', reason: '내 코드 없음' });
    let done = null; try{ done = storage.getItem(DONE_KEY); }catch(_){}
    if(done === uc) return Promise.resolve({ ok: true, skipped: true, wiped: [] });
    if(running) return running;
    running = once(uc).finally(() => { running = null; });
    return running;
  }
  return { run };
}

const api = { DONE_KEY, STEPS, LOGIN_LEGACY_KEYS, pendingStep, loginStep, createFirstRun };
if(typeof window !== 'undefined') window.TwFirstRun013 = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

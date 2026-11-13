/* first-run-013.js — 🚚 0.13 첫 실행 — 이 PC 에 남은 옛 값을 서버로 올리고 지우는 차례 한 곳 (검사 sim-first-run-013.js)
   [왜] 0.12 까지는 캐릭터 · 라이선스 키 같은 값이 이 PC(localStorage)에 원본처럼 있었다. 0.13 은 서버가 원본이라
     처음 켤 때 한 번 올리고(필요한 것만) 이 PC 키를 지운다. 순서가 틀리면 잃는다 — 올리기 전에 지우면 끝이다.
   [차례] ① 로그인(서버 계정 확인) → ①-b 가챠 옛 키 · ①-c 말랑이 옛 칸 백업 · ①-d 마이홈 옛 키(책장 사본 · 방명록 박수 셈 — 셋 다 올릴 것 없이 지우기만) → ② 캐릭터 올리기(legacy-sync — D1 묶음) → ③ 라이선스 키 등록(D8 묶음) → ④ 이 PC 키 지우기.
     단계는 { ok, wipe?:[키], pending?, reason? } 를 돌려준다. 하나라도 ok 가 아니면 거기서 멈추고 **아무것도 지우지 않는다** — 다음 실행에 처음부터.
     ④ 는 앞 단계들이 «이제 지워도 된다» 고 돌려준 키(wipe)만 지운다.
   [다시 해도 같게] 단계마다 서버 답으로 «이미 했다» 를 알아 같은 결과를 낸다(예: AVATAR_LEGACY_SYNC_DONE) — 여기는 차례만 지킨다.
     다 끝나면 이 PC 에 «이 계정으로 끝냈다»(DONE_KEY = userCode)를 적어 다음 실행엔 건너뛴다(지워져도 다시 돌 뿐 — 정본은 서버).
   [자리] 캐릭터 단계는 옷장(closet.js legacyStep)이 채웠고, 라이선스 단계는 licenseKeyStep(아래)이다.
     아직 채우지 않은 단계가 생기면 pendingStep 으로 둔다 — 기다림이 있는 동안 ④ 는 돌지 않는다.
   [라이선스] 0.12 는 키를 이 PC 에 적어 뒀다(tw.licenseKey). 0.13 은 서버가 «계정 + 등록된 기기» 로 판정하므로 이 PC 가 키를 올리지 않으면 옮긴 라이선스에 기기가 없어 프리미엄이 안 켜진다.
     그래서 첫 실행이 키를 서버에 등록한다(키를 직접 넣을 때와 같은 함수 — license-premium.js activate). 올린 뒤에야 지운다 — 로그아웃은 이 키를 지우지 않는다.
   classic script — app.js 보다 먼저 싣는다(window.TwFirstRun013). 서버 · DOM 을 모른다. */
(function(){
'use strict';

const DONE_KEY = 'tw.firstRun013';
const STEPS = Object.freeze(['login', 'gacha', 'mallang', 'myhome', 'legacySync', 'licenseKey']);   // ④ 지우기는 맨 끝 — 따로 두지 않는다
/* 로그인 단계가 «이제 지워도 된다» 고 돌려주는 0.12 계정 키 — 서버가 가입 · 초대 · 친구코드를 맡으면서 아무도 안 읽는다 */
const LOGIN_LEGACY_KEYS = Object.freeze(['tw.inviteToken', 'tw.signupPending', 'tw.invitePassed', 'tw.myFriendCodePrev']);

/* 0.12 가챠가 이 PC 에 남긴 키 — 0.13 은 서버가 원본이라 올릴 것 없이 지우기만 한다(이 PC 에만 있던 뽑기는 올리지 않는다) */
const GACHA_LEGACY_KEYS = Object.freeze(['tw.gachaOwned', 'tw.gachaOwnedTs', 'tw.gachaBonus']);
function gachaStep(){ return async () => ({ ok: true, wipe: GACHA_LEGACY_KEYS.slice() }); }
/* 0.12 말랑이가 이 PC 에 남긴 칸 백업(tw.mallang.{코드|anon}) — 0.13 은 서버가 원본이라 올리지 않고 지우기만 한다(서버 칸은 컷오버가 옮긴다).
   키 뒤에 계정 코드가 붙어 이름을 다 적을 수 없어 이 PC 에 있는 것을 훑는다. ⚠️ 'tw.mallang.' 뒤가 있어야 한다 — 'tw.mallangGiftHidden' 은 이 접두가 아니다 */
const MALLANG_LEGACY_PREFIX = 'tw.mallang.';
function mallangStep(storage){
  return async () => {
    const wipe = [];
    for(let i = 0; i < storage.length; i++){
      const k = storage.key(i);
      if(typeof k === 'string' && k.length > MALLANG_LEGACY_PREFIX.length && k.indexOf(MALLANG_LEGACY_PREFIX) === 0) wipe.push(k);
    }
    return { ok: true, wipe };
  };
}
/* 0.12 마이홈이 이 PC 에 남긴 키 — 책장 사본(tw.bookmarks)과 방명록 박수 셈(gbClap:{주인}:{날짜} — 접두사 없는 PC 키).
   0.13 은 서버가 원본이라 올리지 않고 지우기만 한다(이 PC 에만 있던 책 · 박수 셈은 되살리지 않는다 — 서버 값이 전부다).
   ⚠️ 'tw.mhGbLastRead:' 는 계정 칸(tw.u.…)이라 이 접두가 아니다 — 남긴다 */
const MYHOME_LEGACY_KEYS = Object.freeze(['tw.bookmarks']);
const MYHOME_LEGACY_PREFIX = 'gbClap:';
function myhomeStep(storage){
  return async () => {
    const wipe = MYHOME_LEGACY_KEYS.filter((k) => { try{ return storage.getItem(k) !== null; }catch(_){ return false; } });
    for(let i = 0; i < storage.length; i++){
      const k = storage.key(i);
      if(typeof k === 'string' && k.length > MYHOME_LEGACY_PREFIX.length && k.indexOf(MYHOME_LEGACY_PREFIX) === 0) wipe.push(k);
    }
    return { ok: true, wipe };
  };
}
/* 아직 채우지 않은 단계 — 늘 «기다림»(그 뒤 단계 · 지우기를 막는다) */
function pendingStep(name){ return async () => ({ ok: false, pending: true, reason: name + ' 단계를 아직 채우지 않았다' }); }
/* 로그인 단계 — 서버가 계정을 돌려줬으면 끝(그 뒤에 부른다) */
function loginStep(isIn){ return async () => (isIn() ? { ok: true, wipe: LOGIN_LEGACY_KEYS.slice() } : { ok: false, reason: '서버 계정 확인 전' }); }

/* 라이선스 키 단계(D8-3) — 이 PC 의 옛 키(tw.licenseKey)를 서버에 올리고 지우라고 한다.
   · 키 없음 → 통과(남은 tw.licenseOptOut 만 지움) · OptOut(이 PC 만 해제했던 표시) 있음 → 올리지 않고 둘 다 지움(사용자가 일부러 뺀 PC)
   · 등록 성공(내 키 다시 등록 = 기기 갱신) → 지움(프리미엄 다시 확인은 activate 가 한다)
   · 서버가 «이 키는 더 쓸 길이 없다» 고 답함(남의 키 · 없는 키 · 회수된 키) → 지움 + 안내 한 번 · 이미 이 계정에 라이선스 있음 → 안내 없이 지움(이미 프리미엄) · 기기 가득 → 지움 + 기기 관리 안내
   · 그 밖(네트워크 · 5xx · 로그인 풀림 · 응답 모양)은 멈춤(ok:false) — 아무것도 안 지운다 · 다음 실행에 다시
   서버 code 는 license-api.js CODE 와 같은 글자(sim-first-run-013 이 맞춰 본다). */
const LICENSE_KEY_STORAGE = 'tw.licenseKey';
const LICENSE_OPTOUT_KEY = 'tw.licenseOptOut';
const LICENSE_CODE = Object.freeze({ DEVICE_FULL: 'LICENSE_DEVICE_FULL', NOT_FOUND: 'LICENSE_NOT_FOUND', REVOKED: 'LICENSE_REVOKED',
  OWNED_BY_OTHER: 'LICENSE_OWNED_BY_OTHER', ALREADY_HAVE: 'LICENSE_ALREADY_HAVE' });
const LICENSE_NOTICE = Object.freeze({
  UNUSABLE: '이 PC 에 있던 옛 라이선스 키는 쓸 수 없어요 — 키를 받은 곳에 문의해 주세요',
  DEVICE_FULL: '기기를 모두 썼어요 — 설정 › 라이선스에서 하나를 빼 주세요',
});
/** @param {{ storage: { getItem: Function }, activate: (key: string) => Promise<{ ok: boolean, registered?: boolean, err?: any, reason?: string }> }} deps
 *   activate 는 license-premium.js 의 키 등록(사용자가 키를 넣을 때와 같은 함수 — 주인 읽기 · 등록 · 프리미엄 다시 확인까지 한다) */
function licenseKeyStep(deps){
  const get = (k) => { try{ return deps.storage.getItem(k); }catch(_){ return null; } };
  return async () => {
    const optOut = get(LICENSE_OPTOUT_KEY);
    const key = String(get(LICENSE_KEY_STORAGE) || '').trim();
    const allWipe = [LICENSE_KEY_STORAGE, LICENSE_OPTOUT_KEY].filter((k) => get(k) !== null);
    if(!key || optOut) return { ok: true, wipe: allWipe };
    let r;
    try{ r = await deps.activate(key); }catch(e){ r = { ok: false, err: e }; }
    if(r && (r.ok === true || r.registered === true)) return { ok: true, wipe: allWipe };   // 등록됐다(확인이 늦은 것은 알림 · 다음 켜기가 맡는다)
    const e = (r && r.err) || null, code = String((e && e.code) || '');
    if(!e || e.kind === 'auth' || !Object.keys(LICENSE_CODE).some((n) => LICENSE_CODE[n] === code)) return { ok: false, reason: '라이선스 키 올리기 실패 — ' + String((r && r.reason) || code || '알 수 없음') };
    if(code === LICENSE_CODE.ALREADY_HAVE) return { ok: true, wipe: allWipe };
    return { ok: true, wipe: allWipe, notice: code === LICENSE_CODE.DEVICE_FULL ? LICENSE_NOTICE.DEVICE_FULL : LICENSE_NOTICE.UNUSABLE };
  };
}

/** @param {{ steps: { login: () => Promise<object>, gacha: () => Promise<object>, mallang: () => Promise<object>, myhome: () => Promise<object>, legacySync: () => Promise<object>, licenseKey: () => Promise<object> },
 *   storage: { getItem: Function, setItem: Function, removeItem: Function }, userCode: () => (string | null), log?: { warn: Function }, notify?: (msg: string) => unknown }} deps */
function createFirstRun(deps){
  for(const n of STEPS) if(typeof deps.steps[n] !== 'function') throw new Error('[0.13 첫 실행] 단계 없음 — ' + n);
  const storage = deps.storage;
  const log = deps.log || console;
  let running = null;

  async function once(uc){
    const wipe = [], notices = [];
    for(const name of STEPS){
      let r;
      try{ r = await deps.steps[name](); }catch(e){ r = { ok: false, reason: String((e && e.message) || e) }; }
      if(!r || r.ok !== true){
        if(!(r && r.pending)) try{ log.warn('[0.13 첫 실행] 멈춤 —', name, r && r.reason); }catch(_){}
        return { ok: false, at: name, pending: !!(r && r.pending), reason: (r && r.reason) || '' };
      }
      if(typeof r.notice === 'string' && r.notice) notices.push(r.notice);
      if(Array.isArray(r.wipe)) for(const k of r.wipe) if(typeof k === 'string' && k && wipe.indexOf(k) < 0) wipe.push(k);
    }
    for(const k of wipe){ try{ storage.removeItem(k); }catch(_){} }
    try{ storage.setItem(DONE_KEY, uc); }catch(_){}
    if(deps.notify) for(const m of notices){ try{ deps.notify(m); }catch(_){} }   // 지운 뒤 안내 — 한 번만(끝냄 표시가 다시 돌리지 않는다)
    return { ok: true, wiped: wipe, notices };
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

const api = { DONE_KEY, STEPS, LOGIN_LEGACY_KEYS, GACHA_LEGACY_KEYS, MALLANG_LEGACY_PREFIX, pendingStep, licenseKeyStep, LICENSE_KEY_STORAGE, LICENSE_OPTOUT_KEY, LICENSE_NOTICE, loginStep, gachaStep, mallangStep, myhomeStep, MYHOME_LEGACY_KEYS, MYHOME_LEGACY_PREFIX, createFirstRun };
if(typeof window !== 'undefined') window.TwFirstRun013 = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

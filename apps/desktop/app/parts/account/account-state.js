/* account-state.js — 🪪 계정 핵심 상태: 로그인 이메일 · 저장 키 · 친구코드 모양 · 라이선스 저장 키 · 초대 통과 표시 · 프리미엄 깃발 바꾸기 · 신원 놓음 · 다시 켜기 (검사 sim-account-state.js)
   계정(로그인 · 로그아웃 · 이전) · 초대 게이트 · 내 정보 · 포커스 레벨이 같이 쓰는 값이라 계정 묶음 맨 아래 이 파일에 둔다.
   초대 게이트(license-gate.js) · 계정(account.js) · 내 정보(my-info.js)에 흩어져 있어서 계정 ↔ 게이트 ↔ 내 정보가 서로를 불렀다(checks/sim-dep-cycles.js).
   ★ 아래 본문은 옮기기 전 글 그대로다(license-gate.js 의 키 셋 · _markInvitePassed · _setPremium, account.js 의 로그인 키 둘 · getMyLoginEmail · FRIEND_CODE_LOGIN_RE · _acctDetached, my-info.js 의 _acctRelaunchAfterDetach).
     바뀐 것은 둘 — _setPremium 이 다시 그리기를 직접 부르지 않고 «프리미엄이 바뀌었다» 알림(onPremiumChanged)을 돌린다(게이트가 건다) ·
     _acctDetached 는 계정이 쓰는 함수(setAcctDetached)로 올린다.
   ★ 원격 설정 한 벌 읽기(_rcStore)도 여기 — 초대 게이트 · 방 입장 · app.js 가 같이 쓴다.
   ★ 밖에서 부르는 이름: FRIEND_CODE_LOGIN_RE · _rcStore · INVITE_PASS_KEY · LOGIN_EMAIL_KEY · LOGIN_UID_KEY · getMyLoginEmail · LICENSE_KEY_STORAGE · LICENSE_OPTOUT_KEY · _markInvitePassed · _setPremium · onPremiumChanged · _acctDetached(읽는 함수) · setAcctDetached · _acctRelaunchAfterDetach — app.js 는 acctStateMod.이름 으로 부른다.
   ⚠️ 전역 이름은 TwAccountState — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   app.js · 쓰는 모듈보다 먼저 싣는 classic script. */
(function(){

function createAccountState(deps){
const isPremium = deps.isPremium;   // 읽는 함수 — 프리미엄 여부(app.js 의 let · 여러 모듈이 읽는다)
const setIsPremium = deps.setIsPremium;   // 쓰는 함수 — 바꾸는 곳은 아래 _setPremium 하나
/* 원격 설정 한 벌(remote-config.js 가 app.js 앞에 싣는다). 없으면(검사 · 옛 html) null — 부르는 쪽이 기본값으로.
   초대 게이트 스위치 · 방 정원 · 방 개수가 같이 읽어 계정 묶음 맨 아래 여기 한 벌(옮기기 전엔 초대 게이트에 있었다) */
function _rcStore(){ return (typeof window !== 'undefined' && window.TwRemoteConfig && window.TwRemoteConfig.store) || null; }
const _premiumFns = [];
function onPremiumChanged(fn){ _premiumFns.push(fn); }
function _premiumChanged(){ _premiumFns.forEach(fn=>fn()); }   // «프리미엄이 바뀌었다» — 초대 게이트가 _refreshPremiumGatedUI 를 건다
const INVITE_PASS_KEY = 'tw.invitePassed';  // 한 번 통과하면 로컬에 기록 → 다음 실행부터 바로 통과
function _markInvitePassed(){ try{ localStorage.setItem(INVITE_PASS_KEY, '1'); }catch(e){} }

const LICENSE_KEY_STORAGE = 'tw.licenseKey';
/* 🔑 [2026-09-15 제보 3] isPremium 은 **이 함수로만** 바꾼다.
   [증상] 프리미엄 전용 책상이 남에겐 보이고 본인 화면에서만 기본 책상으로 떨어졌다.
   [원인] 라이선스는 localStorage 에 있고 서버는 계정에 안 묶는다. 그래서 isPremium 이 뒤늦게 바뀌는
     통로가 셋 있는데(계정 이전 복원 _applyTransferSnapshot 은 키만 저장하고 isPremium 을 안 올렸다 ·
     온라인 재검증 실패 · 설정에서 활성화/해제), 어느 쪽도 **이미 그려진 내 좌석을 다시 그리지 않았다.**
     applyDeskCatalogRefToSeat 의 게이트는 그리는 순간의 isPremium 을 보므로, 그 뒤에 true 가 돼도
     내 책상은 기본 책상인 채 남는다. 남의 화면은 seat.remote 라 게이트를 안 타서 보인다.
   [대응] 값이 바뀌면 _refreshPremiumGatedUI 가 내 좌석의 책상·아이템을 다시 적용한다. 대입을 흩어 두면
     그 한 자리만 다시 그리기를 빠뜨린다 — sim-premium-desk.js 가 직접 대입이 0곳인지 센다. */
function _setPremium(v){
  v = !!v;
  if(isPremium() === v) return;
  setIsPremium(v);
  _premiumChanged();
}
const LICENSE_OPTOUT_KEY = 'tw.licenseOptOut';
let _acctDetached = false;   // 신원을 놓았다 — 이 뒤로 서버에 올리는 길(syncFocusTotalToServer 등)은 돌지 않는다
const LOGIN_EMAIL_KEY = 'tw.loginEmail';    // 이 기기에 로그인된 구글 계정 (표시·판정용)
const LOGIN_UID_KEY   = 'tw.loginAuthUid';  // Firebase Auth uid (디버그·대조용)

function getMyLoginEmail(){ try{ return localStorage.getItem(LOGIN_EMAIL_KEY) || null; }catch(_){ return null; } }
const FRIEND_CODE_LOGIN_RE = /^[A-Z]{4}-[A-Z0-9]{4}$/;
function _acctRelaunchAfterDetach(onFallback){
  if(window.companion && companion.relaunchApp){
    /* 살짝 늦춘다 — 안내 문구가 한 번은 그려지게. 갑자기 꺼지면 고장으로 읽힌다.
       (localStorage 쓰기는 동기라 이 지연과 무관하게 이미 끝나 있다) */
    setTimeout(()=>{ try{ companion.relaunchApp(); }catch(_){ if(onFallback) onFallback(); } }, 700);
    return true;
  }
  if(onFallback) onFallback();
  return false;
}

return {
  FRIEND_CODE_LOGIN_RE,
  _rcStore,
  INVITE_PASS_KEY,
  LOGIN_EMAIL_KEY,
  LOGIN_UID_KEY,
  getMyLoginEmail,
  LICENSE_KEY_STORAGE,
  LICENSE_OPTOUT_KEY,
  _markInvitePassed,
  _setPremium,
  onPremiumChanged,
  _acctDetached: ()=>_acctDetached,   // 읽는 함수
  setAcctDetached: (v)=>{ _acctDetached = v; },   // 쓰는 함수 — 계정이 신원을 놓을 때(_wipeAccountLocal)
  _acctRelaunchAfterDetach,
};
}

const api = { createAccountState };
if(typeof window !== 'undefined') window.TwAccountState = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

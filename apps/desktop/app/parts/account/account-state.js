/* account-state.js — 🪪 계정 핵심 상태: 로그인 이메일 · 저장 키 · 친구코드 모양 · 라이선스 저장 키(옛 값) · 프리미엄 깃발 바꾸기 · 프리미엄 «모름» · 신원 놓음 · 다시 켜기 (검사 sim-account-state.js)
   계정(로그인 · 로그아웃 · 이전) · 초대 게이트 · 내 정보 · 포커스 레벨이 같이 쓰는 값이라 계정 묶음 맨 아래 이 파일에 둔다.
   초대 게이트(license-gate.js) · 계정(account.js) · 내 정보(my-info.js)에 흩어져 있어서 계정 ↔ 게이트 ↔ 내 정보가 서로를 불렀다(checks/sim-dep-cycles.js).
   ★ 아래 본문은 옮기기 전 글 그대로다(license-gate.js 의 키 · _setPremium, account.js 의 로그인 키 둘 · getMyLoginEmail · FRIEND_CODE_LOGIN_RE · _acctDetached, my-info.js 의 _acctRelaunchAfterDetach).
     옮긴 뒤 바뀐 것 — _setPremium 이 다시 그리기를 직접 부르지 않고 «프리미엄이 바뀌었다» 알림(onPremiumChanged)을 돌린다(게이트가 건다) ·
     _acctDetached 는 계정이 쓰는 함수(setAcctDetached)로 올린다 · 프리미엄 «모름»(premiumKnown) · 전용 자산 막기 판단 한 곳(licenseAssetBlocked)이 더해졌다.
   ★ 원격 설정 한 벌 읽기(_rcStore)도 여기 — 초대 게이트 · 방 입장 · app.js 가 같이 쓴다.
   ★ 밖에서 부르는 이름: FRIEND_CODE_LOGIN_RE · _rcStore · LOGIN_EMAIL_KEY · LOGIN_UID_KEY · getMyLoginEmail · LICENSE_KEY_STORAGE · LICENSE_OPTOUT_KEY · _setPremium · resetPremium · premiumKnown · licenseAssetBlocked · onPremiumChanged · _acctDetached(읽는 함수) · setAcctDetached · _acctRelaunchAfterDetach — app.js 는 acctStateMod.이름 으로 부른다.
   ⚠️ 전역 이름은 TwAccountState — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   app.js · 쓰는 모듈보다 먼저 싣는 classic script. */
(function(){

function createAccountState(deps){
const isPremium = deps.isPremium;   // 읽는 함수 — 프리미엄 여부(app.js 의 let · 여러 모듈이 읽는다)
const isAdmin = deps.isAdmin;   // 읽는 함수 — 관리자 여부(app.js 의 let)
const setIsPremium = deps.setIsPremium;   // 쓰는 함수 — 바꾸는 곳은 아래 _setPremium 하나
/* 원격 설정 한 벌(remote-config.js 가 app.js 앞에 싣는다). 없으면(검사 · 옛 html) null — 부르는 쪽이 기본값으로.
   초대 게이트 스위치 · 방 정원 · 방 개수가 같이 읽어 계정 묶음 맨 아래 여기 한 벌(옮기기 전엔 초대 게이트에 있었다) */
function _rcStore(){ return (typeof window !== 'undefined' && window.TwRemoteConfig && window.TwRemoteConfig.store) || null; }
const _premiumFns = [];
function onPremiumChanged(fn){ _premiumFns.push(fn); }
function _premiumChanged(){ _premiumFns.forEach(fn=>fn()); }   // «프리미엄이 바뀌었다» — 초대 게이트가 _refreshPremiumGatedUI 를 건다

const LICENSE_KEY_STORAGE = 'tw.licenseKey';   // 0.12 까지 이 PC 가 들던 키 — 0.13 은 서버가 계정에 묶어 안다. 첫 실행에 올리고 지울 옛 값(읽기 전용)
/* 🔑 isPremium 은 **이 함수로만** 바꾼다 — 바뀌면 _refreshPremiumGatedUI 가 내 좌석의 책상 · 아이템을 다시 적용한다.
   [모름] 서버 확인(GET /v2/me)이 오기 전에는 «아직 모름» 이다 — isPremium 은 false 지만 «아님» 이 아니다. 모르는 동안 전용 자산을 접으면(pruneUnownedLicenseAssets)
     프리미엄 사용자의 책상이 잠깐 기본으로 떨어지고 방으로 나간다. 그래서 premiumKnown() 이 false 인 동안 접기는 건너뛴다(premium-assets.js).
   [부르는 곳] 서버가 «이 계정 + 이 기기» 로 판정해 준 값(license-premium.js)만. 확인 전 저장값으로 켜지 않는다.
   첫 확인은 값이 그대로 false 여도 «알림» 을 돌린다 — 모르는 동안 건너뛴 접기가 그때 돈다. */
let _premiumKnown = false;
function _setPremium(v){
  v = !!v;
  const wasKnown = _premiumKnown;
  _premiumKnown = true;
  if(isPremium() === v && wasKnown) return;
  setIsPremium(v);
  _premiumChanged();
}
/* 계정이 바뀌거나 세션을 놓을 때 «모름» 으로 되돌린다 — 알림 없이(다음 계정 확인이 다시 정한다 · license-premium.js reset) */
function resetPremium(){
  _premiumKnown = false;
  setIsPremium(false);
}
/* 🔒 «이 라이선스 전용 자산을 지금 막아야 하나» — 전용(licenseOnly)이고 프리미엄도 관리자도 아님. 전용 책상 · 아이템을 그리거나 고르는 모든 곳이 이 한 판단을 부른다
   (책상 그리기 · 아이템 장착 · 생성기 카드 · 슬롯 불러오기 · 프리셋). item = 책상 · 아이템 레코드 또는 { licenseOnly }.
   ★ 서버가 프리미엄을 확인해 주기 전(모름)에는 막지 않는다 — isPremium 의 false 는 «아님» 이 아니라서, 막으면 프리미엄 사용자가 켤 때마다 기본 책상 + «보유자만» 안내를 본다.
     확인이 오면 _setPremium 알림이 내 좌석 · 런처 미리보기를 다시 그린다(license-gate.js _refreshPremiumGatedUI). 계정 핵심 상태에 두는 까닭: 책상 모듈과 전용 자산 모듈이 서로를 부르는 층이라 그 아래여야 순환이 안 생긴다. */
function licenseAssetBlocked(item){
  return !!(item && item.licenseOnly) && _premiumKnown && !isPremium() && !isAdmin();
}
const LICENSE_OPTOUT_KEY = 'tw.licenseOptOut';   // 0.12 의 «이 기기에서 해제» 표시 — 더는 쓰지 않는 옛 값(0.13 은 서버 기기 목록에서 뺀다 · 첫 실행이 읽고 지운다)
let _acctDetached = false;   // 신원을 놓았다 — 이 뒤로 서버에 올리는 길(포커스 올리기 등)은 돌지 않는다
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
  LOGIN_EMAIL_KEY,
  LOGIN_UID_KEY,
  getMyLoginEmail,
  LICENSE_KEY_STORAGE,
  LICENSE_OPTOUT_KEY,
  _setPremium,
  resetPremium,
  licenseAssetBlocked,
  premiumKnown: () => _premiumKnown,   // 읽는 함수 — 서버가 확인해 준 적이 있나(없으면 isPremium 의 false 는 «모름»)
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

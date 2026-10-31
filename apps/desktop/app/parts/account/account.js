/* account.js — 🔑 계정 — 구글 로그인 · 친구코드 로그인 · 로그아웃 · 신원 지우기 · 서버 계정으로 이 PC 맞추기
   app.js «🔑 구글 로그인 (계정)» · «🧹 신원을 놓을 때 이 기기에서 지우는 것» · «📤 계정 이전 / 연동 / 연동 해제(걷은 흔적)» 세 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 23번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 3개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 49줄 —
     CHAL_KEY · FOCUS_TOTAL_KEY · GACHA_BONUS_KEY · GACHA_OWNED_KEY · GACHA_TS_KEY · LICENSE_REQ_ID_KEY · LS_KEY · _focusTodaySec · _focusTotalSec · charsMod · extraSeatSlots · focusLevelMod · gachaMod · slotSyncMod · weeklyChal 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setFocusTodaySec · setFocusTotalSec · setExtraSeatSlots(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 4개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 신원 핵심(로그인 이메일 · 저장 키 · 친구코드 모양 · 신원 놓음)과 라이선스 저장 키는 account-state.js 에서 받는다(모듈 순환 끊기 5).
   ★ «연동됨» 안내 창(_charsLinkedMaybeShow)은 보관함 화면이 있는 my-info.js 로 옮겼다 — 표시 키 CHARS_LINKED_KEY 는 쓰는 쪽(여기)에 두고 내놓는다.
   ★ 0.13 — 로그인 · 가입 판정은 login-flow.js(서버 GET /v1/me), 여기는 그 결과로 이 PC 를 맞춘다(_enterAccount). 계정 이전 사본(accountSnap)으로 복원하던 길은 걷었다 —
     다른 PC 이어받기는 같은 계정 로그인으로 끝난다(서버가 원본).
   ★ 밖에서 부르는 이름: CHARS_LINKED_KEY · _enterAccount · _loginDoFriendCode · _loginDoGoogle · _loginDoLogout · _loginDoDeleteAccount · _withdrawPreview · _wipeAccountLocal · refreshAccountTab — app.js 는 accountMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwAccount — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-account.js */
(function(){

function createAccount(deps){
const BELL_SEEN_KEY = deps.BELL_SEEN_KEY;
const CHAL_KEY = deps.CHAL_KEY;   // 읽는 함수
const CUR_SLOT_KEY = deps.CUR_SLOT_KEY;
const CUSTOM_STATUS_KEY = deps.CUSTOM_STATUS_KEY;
const EXTRA_SEAT_KEY = deps.EXTRA_SEAT_KEY;
const FOCUS_TOTAL_KEY = deps.FOCUS_TOTAL_KEY;   // 읽는 함수
const GACHA_BONUS_KEY = deps.GACHA_BONUS_KEY;   // 읽는 함수
const GACHA_OWNED_KEY = deps.GACHA_OWNED_KEY;   // 읽는 함수
const GACHA_TS_KEY = deps.GACHA_TS_KEY;   // 읽는 함수
const INBOX_BC_READ_KEY = deps.INBOX_BC_READ_KEY;
const LICENSE_REQ_ID_KEY = deps.LICENSE_REQ_ID_KEY;   // 읽는 함수
const LS_KEY = deps.LS_KEY;   // 읽는 함수
const MY_AD_BANNER_KEY = deps.MY_AD_BANNER_KEY;
const MY_FRIEND_CODE_KEY = deps.MY_FRIEND_CODE_KEY;
const MY_FRIEND_CODE_PREV_KEY = deps.MY_FRIEND_CODE_PREV_KEY;
const MY_USER_ID_KEY = deps.MY_USER_ID_KEY;
const USER_NAME_KEY = deps.USER_NAME_KEY;
const _focusTodaySec = deps._focusTodaySec;   // 읽는 함수
const _focusTotalSec = deps._focusTotalSec;   // 읽는 함수
const _rememberOldFriendCode = deps._rememberOldFriendCode;
const _setMyUserId = deps._setMyUserId;
const charsMod = deps.charsMod;   // 읽는 함수
const extraSeatSlots = deps.extraSeatSlots;   // 읽는 함수
const focusLevelMod = deps.focusLevelMod;   // 읽는 함수
const gachaMod = deps.gachaMod;   // 읽는 함수
const getMyUserId = deps.getMyUserId;
const acctStateMod = deps.acctStateMod;   // 🪪 계정 핵심 상태(account-state.js) — 라이선스 저장 키 · 초대 통과 · 프리미엄 · 신원 놓음
const setAcctDetached = deps.setAcctDetached;   // 쓰는 함수 — 신원을 놓을 때
const LOGIN_EMAIL_KEY = deps.LOGIN_EMAIL_KEY;   // 🪪 신원 핵심(account-state.js) — 로그인 이메일 · Auth uid 저장 키 · 친구코드 모양
const LOGIN_UID_KEY = deps.LOGIN_UID_KEY;
const getMyLoginEmail = deps.getMyLoginEmail;
const FRIEND_CODE_LOGIN_RE = deps.FRIEND_CODE_LOGIN_RE;
const plMod = deps.plMod;
const mhScheduler = deps.mhScheduler;   // 📅 스케줄러 — 계정을 놓을 때 비운다(다음 계정 것은 로그인 뒤 다시 켠 부팅이 받는다)
const slotSyncMod = deps.slotSyncMod;   // 읽는 함수
const toast = deps.toast;
const tricksMod = deps.tricksMod;
const weeklyChal = deps.weeklyChal;   // 읽는 함수
const loginFlowMod = deps.loginFlowMod;   // 🔑 로그인 흐름(login-flow.js) — 로그인 · 서버 가입 확인 · realtime · 로그아웃
const sessionLost = deps.sessionLost;   // () => boolean — 다른 기기에 밀렸나(realtime sessionLost) · 그 접속 표시는 이긴 쪽 것
const ME_CACHE_KEY = deps.ME_CACHE_KEY;   // 내 계정 사본(login-flow.js) — 계정 몫이라 로그아웃이 지운다
const userApiMod = deps.userApiMod;   // 🪪 계정 provider(user-api.js) — 비밀번호 붙이기 · 바꾸기 · 탈퇴 · 화면 문구(reasonOf)
const setFocusTodaySec = deps.setFocusTodaySec;   // 쓰는 함수
const setFocusTotalSec = deps.setFocusTotalSec;   // 쓰는 함수
const setExtraSeatSlots = deps.setExtraSeatSlots;   // 쓰는 함수

/* «연동됨» 안내 창 표시 키 — my-info.js 가 읽는다(쓰던 계정 이전 갈래는 0.13 에서 걷었다 — 캐릭터 올리기는 첫 실행 legacy-sync). */
const CHARS_LINKED_KEY = 'tw.charsLinked';

/* 🪪 서버가 돌려준 계정(me)으로 이 PC 를 맞춘다 — 켤 때 확인 · 로그인 · 가입이 같이 부르는 한 곳.
   login: { email, uid } — 이 PC 의 로그인 표시(계정 탭 얼굴 · 진단). 친구코드 · 이름은 서버 값이 정본이다.
   돌려주는 것: { ok, switched } — switched 면 이번 실행은 다른 uid 로 돌았다 = 부르는 쪽이 앱을 다시 켠다.
   ★ 이 PC 에 다른 코드가 있었을 때 — 그 코드로 **로그인했던** PC(로그인 표시가 있음)면 남의 계정일 수 있어 로그아웃처럼 전부 내려놓는다.
     로그인한 적 없이 쓰던 코드(0.12 의 묶이지 않은 사용자 — 서버로 옮기지 않았다)면 같은 사람으로 보고 신원 키만 바꾼다 —
     이 PC 의 캐릭터는 0.13 첫 실행(first-run-013.js 의 legacy-sync)이 이 계정으로 올린다.
   ⚠️ uid 기록은 `_setMyUserId` 하나로. 못 쓰면 실패 — 부르는 쪽이 로그인도 놓는다. */
const IDENTITY_KEYS = () => [MY_FRIEND_CODE_KEY, MY_FRIEND_CODE_PREV_KEY];
function _enterAccount(me, login){
  if(!me || !me.userCode) return { ok:false, reason:'계정을 확인하지 못했어요 — 다시 시도해 주세요' };
  let before = null; try{ before = localStorage.getItem(MY_USER_ID_KEY); }catch(_){}
  const switched = before !== me.userCode;
  if(switched && before){
    if(getMyLoginEmail()) _wipeAccountLocal();
    else for(const k of IDENTITY_KEYS()){ try{ localStorage.removeItem(k); }catch(_){} }
  }
  if(switched && !_setMyUserId(me.userCode)) return { ok:false, reason:'이 기기에 계정을 저장하지 못했어요 — 다시 시도해 주세요' };
  try{
    localStorage.setItem(LOGIN_EMAIL_KEY, (login && login.email) || '');
    localStorage.setItem(LOGIN_UID_KEY, (login && login.uid) || '');
  }catch(_){}
  let old = null; try{ old = localStorage.getItem(MY_FRIEND_CODE_KEY); }catch(_){}
  if(old && old !== me.friendCode) _rememberOldFriendCode(old);   // 진단 기록 — 코드가 바뀌었다는 제보가 오면 본다
  try{ localStorage.setItem(MY_FRIEND_CODE_KEY, me.friendCode); }catch(_){}
  try{ if(me.displayName) localStorage.setItem(USER_NAME_KEY, me.displayName); }catch(_){}
  return { ok:true, switched };
}
/* 로그인 흐름의 결과 → 이 PC 맞추기. 못 맞추면 로그인도 놓는다 — «로그인은 됐는데 이 기기는 딴 사람» 을 남기지 않는다. */
async function _afterLogin(r){
  const e = _enterAccount(r.me, loginFlowMod.identity());
  if(!e.ok){ try{ await loginFlowMod.logout(); }catch(_){} return e; }
  return { ok:true, switched:e.switched, email:r.email || null, me:r.me };
}

/* 구글 로그인 — 구글 창(main) → Auth → 서버 가입 확인(login-flow.js) → 이 PC 맞추기.
   @return { ok, switched, email } · { ok:false, needCode }(이 구글로 가입한 계정이 없다 — 초대 코드로 가입) · { ok:false, canceled }(창을 그냥 닫음 — 조용히) */
async function _loginDoGoogle(){
  const r = await loginFlowMod.loginGoogle();
  if(r.ok) return _afterLogin(r);
  if(r.state === 'signup') return { ok:false, needCode:true, reason:'이 구글 계정으로 가입한 기록이 없어요 — 초대 코드를 넣어 주세요' };
  return { ok:false, canceled:!!r.canceled, reason:r.reason || (r.canceled ? '' : '로그인에 실패했어요') };
}

/* 🔑 친구 코드 + 비밀번호 로그인 → 이 PC 맞추기. @return { ok, switched } — switched 면 부르는 쪽이 다시 켠다. */
async function _loginDoFriendCode(code, password){
  const r = await loginFlowMod.loginPassword(code, password);
  if(!r.ok) return { ok:false, reason:r.reason || '로그인에 실패했어요' };
  return _afterLogin(r);
}

/* 로그아웃 — Auth 세션만 끊는 게 아니라 **이 기기의 신원까지 놓는다.**
   [왜 그렇게까지 하는가] 세션만 끊으면 로컬 유저 코드가 그대로 남아, 로그아웃한 뒤에도
     그 계정의 마이홈·친구가 계속 보인다. 한 컴퓨터를 나눠 쓸 때 다음 사람이 앞사람 계정을
     그대로 보게 된다는 뜻이다. 그래서 계정 연동 해제(acctUnlinkYes)와 **같은 자리를 지운다.**
   ★ 예전에 해제가 무서웠던 이유(돌아오려면 유저 코드 22자리와 비밀번호가 필요했다)는
     이제 없다 — 게이트에 구글 버튼이 있어서 클릭 한 번으로 돌아온다. 계정은 서버에 그대로다. */

const ACCOUNT_LOCAL_KEYS = ()=>[
  /* 신원 */
  MY_USER_ID_KEY, MY_FRIEND_CODE_KEY, LOGIN_EMAIL_KEY, LOGIN_UID_KEY, ME_CACHE_KEY,
  MY_FRIEND_CODE_PREV_KEY,     // 이 기기가 버린 코드 기록(진단용) — 다음 사람에게는 남의 코드다
  /* 라이선스 — 이 PC 키 · 해제 표시도 계정 것이다(0.13 은 서버가 계정의 라이선스를 안다 — D8). */
  acctStateMod.LICENSE_KEY_STORAGE, LICENSE_REQ_ID_KEY(), acctStateMod.LICENSE_OPTOUT_KEY,   // 🎫 «이 기기만 해제» 표시도 계정 것이다
  /* 누적 시간 · 오늘치 · 서버 맞춤 마크는 계정별 칸(shared/account-store.js)이라 여기서 지우지 않는다 — 계정을 바꾸면 다른 칸이 열린다. */
  focusLevelMod().DANCE_NOTIFIED_KEY, focusLevelMod().DANCE_REPAIR_KEY,   // 해금 안내 기록 — 수령함이 진짜다(_danceUnlockPending 이 수령함을 보고 중복을 거른다)
  /* 가챠 — 연동 pull(syncGachaToServer 'transfer','pull') + 부팅 tick 이 서버 것을 받아온다. 보너스는 loadChalBonus. */
  GACHA_OWNED_KEY(), GACHA_TS_KEY(), GACHA_BONUS_KEY(),
  /* 달성표 — syncChalToServer 가 서버 ts 가 크면 통째로 받아온다. */
  CHAL_KEY(),
  /* 캐릭터 슬롯 — 연동 pull(syncSlotsToServer 'transfer','pull'). 업로드 캐시 둘은 users/{uid}/ 경로의 URL 이라
     **다른 uid 가 물려받으면 남의 Storage 를 가리킨다** — 반드시 같이 지운다. */
  LS_KEY(), slotSyncMod().SLOTS_TS_KEY, slotSyncMod().SLOTS_SEEN_KEY, slotSyncMod().SLOTS_LOSS_KEY, slotSyncMod().SLOTS_LASTSYNC_KEY, slotSyncMod().SLOTS_PUSHFAIL_KEY, CUR_SLOT_KEY, slotSyncMod().SLOT_GLB_CACHE_KEY, 'tw.roomFaceUrls',
  /* 🧬 보관함 · 책상 표 · 못 올린 휴지통 줄(설계 §9-5 · 개정 36) — 서버 chars 가 원본이라 다음 로그인의 첫 채택이 다시 만든다.
     문자열로 적는다: 상수는 이 목록보다 뒤에 선언된다(검사가 이 함수만 떼어 돌린다). flush 가 먼저 올린다. */
  'deskFriends.chars.v1', 'deskFriends.chars.desk', 'deskFriends.chars.trashPend',
  'tw.charsLinked',            // F 안내 표시(개정 57) — 옮긴 cid 목록 · 다음 사람에게 띄울 것이 아니다
  'tw.starColor',              // 🌟 회차 별 색(개정 71) — 프로필 starC 가 돌아올 길이다(_adoptStarColorFromProfile). 남으면 다음 계정 프로필에 앞 사람 색이 실린다
  /* ⚠️ SLOTS_BAK_KEY(덮어쓰기 직전 백업)는 **일부러 빼 두었다.** 위 ⚠️ 의 「돌아오는 길이 없는
     항목을 여기 넣으면 로그아웃이 곧 삭제」가 그 이유다 — 백업은 정의상 서버에 없는 것이라
     지우면 그것으로 끝이다. 남의 캐릭터를 주워 가는 길은 restoreSlotsBackup 의 uid 대조로 막는다.
     (빠뜨린 것으로 보고 넣지 말 것 — 제보 3-7) */
  EXTRA_SEAT_KEY,              // 슬롯 번호 목록 — 슬롯이 사라지면 가리키는 곳이 없다
  /* 플레이리스트 — 다시 로그인하면 서버 사본에서 받아온다.
     볼륨·반복·미니미·창 위치는 기기 설정이라 남긴다. */
  'tw.playlist', 'tw.playlistSets', 'tw.playlistCur', 'tw.playlistTitle', 'tw.playlistBio',
  'tw.playlistHomePublic', 'tw.playlistPrivate',
  'tw.secretRoomMusic',        // 🎧 내 시크릿룸을 같이 듣기로 열기 — 그 계정의 시크릿룸 설정이라 다음 사람에게 남기지 않는다
  /* 고친 시각이 남으면 다음 계정의 서버 목록을 «이 기기가 나중» 으로 이겨 비운다 · 백업은 앞 계정 목록이다 */
  'tw.playlistEditTs', 'tw.playlistBackup',
  /* 프로필·읽음 표시 — 이름은 스냅샷(r.name), 나머지는 새로 쌓이면 된다. */
  USER_NAME_KEY, CUSTOM_STATUS_KEY, 'tw.userStatus', 'tw.awayKind', MY_AD_BANNER_KEY,
  BELL_SEEN_KEY, INBOX_BC_READ_KEY, tricksMod.BONK_DAY_KEY,
];
/* 접두어로 쌓이는 키(방마다 하나) — 목록에 못 적으므로 여기서 훑는다. */
const ACCOUNT_LOCAL_KEY_PREFIXES = ['tw_chat_read:', 'tw_chat_join:'];

/* 📤 지우기 전에 올린다 — 이 기기가 마지막으로 쌓은 것(≤10분치 시간·마지막 뽑기·저장한 캐릭터)을
   서버에 실어 보낸다. 실패는 여기서 판단하지 않는다 — 아래 검문(_acctPreflight)이 결과로 본다.
   ⚠️ 무한정 기다리지 않는다. 슬롯 push 는 얼굴 업로드가 딸려 있어 느릴 수 있다. */
const ACCT_FLUSH_TIMEOUT_MS = 8000;
async function _acctFlushToServer(){
  const jobs = [];
  const call = (fn, ...a) => { try{ if(typeof fn === 'function') jobs.push(Promise.resolve(fn(...a))); }catch(_){} };
  call(typeof focusLevelMod().syncFocusTotalToServer === 'function' ? focusLevelMod().syncFocusTotalToServer : null, 'logout');
  call(gachaMod().syncGachaToServer, 'logout');
  call(weeklyChal().syncChalToServer, 'logout');
  call(plMod.flushPending, getMyUserId());   // 🎵 못 올린 목록 고침 한 번 — 계정을 놓으면 버려지므로
  /* 슬롯은 대기 중인 debounce push 가 있으면 그것부터 흘려보낸다(3초를 기다릴 이유가 없다). */
  try{ if(typeof slotSyncMod()._slotsPushTimer !== 'undefined' && slotSyncMod()._slotsPushTimer()){ clearTimeout(slotSyncMod()._slotsPushTimer()); slotSyncMod().setSlotsPushTimer(null); } }catch(_){}
  call(typeof slotSyncMod().syncSlotsToServer === 'function' ? slotSyncMod().syncSlotsToServer : null, 'logout');
  call(typeof charsMod()._charsSync === 'function' ? charsMod()._charsSync : null, 'logout');   // 🧬 켜져 있지 않으면 즉시 돌아온다
  if(!jobs.length) return { timedOut:false };
  /* [2026-09-20 · §2] 상한에 걸렸는지 돌려준다 — 검문이 «아직 올리는 중» 과 «서버가 거부» 를 다른 말로 하기 위해.
     둘은 사용자에게 다른 뜻이다: 전자는 기다리면 되고, 후자는 기다려도 안 된다. */
  const timedOut = await Promise.race([
    Promise.allSettled(jobs).then(() => false),
    new Promise(res => setTimeout(() => res(true), ACCT_FLUSH_TIMEOUT_MS)),
  ]);
  return { timedOut: timedOut === true };
}

/* 🛂 검문 — «로컬에만 있는 소지품» 이 남아 있으면 지우지 않는다.
   [왜 막는가] 규칙이 거부한 기기(비밀번호 연동만 한 기기 · 세션이 풀린 기기)는 push 가 조용히 실패한다.
     그 상태로 지우면 로그아웃이 곧 삭제다. 막고 이유를 말하는 쪽이 낫다 — 로그인 한 번이 복구다.
   ⚠️ 읽기 실패(null)도 «모른다» 이므로 막는다. 네트워크가 없는 한 순간에 지우는 것이 더 큰 사고다.
   [2026-09-20 · §2 제보 1] 세 가지가 바뀌었다.
     ① **첫 실패에서 끝내지 않고 전 항목을 센다** — 사용자에게 «이 컴퓨터에만 있는 것» 을 이름과 개수로
        전부 말해야 강제 로그아웃을 눈 뜨고 고를 수 있다(예전엔 첫 항목 하나만 말했다).
     ② **null 과 0 을 가른다.** firebase-init 의 읽기 함수는 실패를 null 로, «없다» 를 0/빈 값으로 돌려준다
        (syncSlotsToServer 가 이미 그 규약으로 `if(sTs === null) return` 을 쓴다). 예전엔 `!(ts > 0)` 하나로
        묶어서 둘 다 «올리지 못했어요» 가 됐다 — 규약을 바꾸지 않고 **읽는 쪽에서** 가른다.
     ③ **kind** — 'offline'(API 없음) · 'unknown'(확인 못 함) · 'timeout'(8초 상한에 걸린 뒤의 «없다»)
        · 'denied'(올렸는데 없다). 부르는 쪽이 문구를 이걸로 고른다.
   @return { ok:true } | { ok:false, reason, kind, items:[{label, reason, kind}], timedOut } — reason 은 첫 항목의 것(호환) */
async function _acctPreflight(uid, opt){
  const timedOut = !!(opt && opt.timedOut);
  const items = [];
  const push = (label, reason, kind) => items.push({ label, reason, kind });
  /* 로컬 개수부터 — 오프라인이어도 «무엇이 사라지는지» 는 말할 수 있어야 한다. */
  let nSlots = 0, nGacha = 0, gapMin = 0, hasSlots = false;
  try{ hasSlots = (typeof slotSyncMod()._slotsHasLocal === 'function') && slotSyncMod()._slotsHasLocal(); }catch(_){}
  try{ nSlots = (hasSlots && typeof slotSyncMod()._slotsFilledCount === 'function') ? slotSyncMod()._slotsFilledCount(localStorage.getItem(LS_KEY())) : 0; }catch(_){}
  try{ nGacha = (typeof gachaMod().owned() === 'object' && gachaMod().owned()) ? Object.keys(gachaMod().owned()).length : 0; }catch(_){}
  const lblSlots = '캐릭터' + (nSlots ? ' ' + nSlots + '개' : '');
  const lblGacha = '뽑은 파츠' + (nGacha ? ' ' + nGacha + '개' : '');
  const api = window.firebaseAPI;
  if(!api){
    if(hasSlots) push(lblSlots, '네트워크 연결이 필요해요', 'offline');
    if(nGacha) push(lblGacha, '네트워크 연결이 필요해요', 'offline');
    return { ok:false, reason:'네트워크 연결이 필요해요', kind:'offline', items, timedOut };
  }
  /* 🧍 캐릭터 — 로컬에 있으면 서버 ts 가 있어야 한다. */
  try{
    if(hasSlots && api.loadSlotsTs){
      const ts = await api.loadSlotsTs(uid);
      if(ts === null || ts === undefined) push(lblSlots, '캐릭터 저장 상태를 확인하지 못했어요', 'unknown');
      else if(!(typeof ts === 'number' && ts > 0)) push(lblSlots, '캐릭터를 서버에 올리지 못했어요', timedOut ? 'timeout' : 'denied');
    }
  }catch(_){ push(lblSlots, '캐릭터 저장 상태를 확인하지 못했어요', 'unknown'); }
  /* 🎰 가챠 — 이 PC 의 뽑기가 서버에 다 있어야 한다(파츠마다 개수까지). ⚠️ «서버에 하나라도 있나» 로 줄이지 말 것 —
     서버에 못 올라간 뽑기가 있어도 통과해 로그아웃이 지운다. */
  try{
    if(nGacha && api.loadGachaOwned){
      const srv = await api.loadGachaOwned(uid);
      if(srv === null || srv === undefined) push(lblGacha, '파츠 저장 상태를 확인하지 못했어요', 'unknown');
      else if(gachaMod().unsynced(srv.owned) > 0) push(lblGacha, '뽑은 파츠를 서버에 올리지 못했어요', timedOut ? 'timeout' : 'denied');
    }
  }catch(_){ push(lblGacha, '파츠 저장 상태를 확인하지 못했어요', 'unknown'); }
  /* 🕒 누적 시간 — 마크가 로컬 누적을 따라잡았어야 한다(2분은 왕복 사이에 쌓이는 폭). */
  try{
    const total = Math.floor(Number(_focusTotalSec()) || 0);
    if(total > 0){
      const gap = focusLevelMod()._hasFocusSyncedMark() ? (total - focusLevelMod()._getFocusSyncedMark()) : total;
      if(!focusLevelMod()._hasFocusSyncedMark() || gap > 120){
        gapMin = Math.max(1, Math.round(gap / 60));
        push('누적 시간 ' + gapMin + '분', '누적 시간을 서버에 올리지 못했어요', timedOut ? 'timeout' : 'denied');
      }
    }
  }catch(_){}
  if(!items.length) return { ok:true, items:[] };
  const kind = items.some(i => i.kind === 'unknown') ? 'unknown'
             : items.some(i => i.kind === 'timeout') ? 'timeout' : 'denied';
  return { ok:false, reason: items[0].reason, kind, items, timedOut };
}

/* 🧹 실제로 지운다 — localStorage 와 **메모리** 둘 다.
   [왜 메모리까지] 이 뒤 700ms 안에 재시작하지만, 그 사이 beforeunload 가 돈다
     (syncFocusTotalToServer('quit') · _chalSave). 메모리에 옛 값이 있으면 그 한 번이 지운 키를 도로 쓴다.
   ⚠️ getMyUserId() 를 부르는 코드가 이 뒤에 돌면 임시 uid 가 하나 생긴다. 그건 이미 설계된 상태다
     (게이트 주석 «로그아웃 직후 만들어진 임시 유저 코드»). 여기서 막지 않는다. */
function _wipeAccountLocal(){
  setAcctDetached(true);
  for(const k of ACCOUNT_LOCAL_KEYS()){ try{ localStorage.removeItem(k); }catch(_){} }
  try{
    const drop = [];
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if(k && ACCOUNT_LOCAL_KEY_PREFIXES.some(p => k.startsWith(p))) drop.push(k);
    }
    drop.forEach(k => { try{ localStorage.removeItem(k); }catch(_){} });
  }catch(_){}
  /* 메모리 — 위 주석 참고. 각 값은 그 모듈의 «빈 기기» 초기값과 같다. */
  try{ setFocusTotalSec(0); setFocusTodaySec(0); }catch(_){}
  try{ if(window.firebaseAPI && firebaseAPI.chatHistory) firebaseAPI.chatHistory.wipeAll(); }catch(_){}   // 💬 이 PC 대화 저장(chat-history.js)
  try{ gachaMod().resetMemory(); }catch(_){}   // 🎰 가챠 — gachaOwned = {} · _gachaTs = 0 · _gachaBonus = 0 (gacha.js)
  try{ weeklyChal().resetMemory(); }catch(_){}   // 👑 달성표 — chalRec = 빈 기록 · dirty=false (weekly-challenge.js)
  try{ slotSyncMod().setSlotsTs(0); slotSyncMod().setSlotsSeen(0); slotSyncMod().setSlotsConflict(null); setExtraSeatSlots([]); }catch(_){}
  try{ plMod.st.cur = 0; plMod.reset(); }catch(_){}   // 🎵 playlist.js — 목록 · 한마디 · 공개를 비우고 새 계정 것을 받기 전까지 안 올림
  try{ mhScheduler.reset(); }catch(_){}   // 📅 scheduler.js — 일정 · 디데이 · 알림을 비우고 받기 전으로
  /* isPremium(메모리)은 안 건드린다 — 700ms 뒤 재시작이고, 그 사이 책상을 다시 그릴 이유가 없다.
     다음 부팅의 initLicense 가 빈 키를 보고 기본으로 시작한다. */
}

/* 로그인이 남아 있을 때 presence 를 «꺼짐» 으로 — signOut 뒤에는 onDisconnect(꺼짐)가 돌지 않아(그 칸은 이 계정 로그인만 쓴다)
   친구에게 접속중으로 남는다. 밀려난 기기는 쓰지 않는다 — 그 칸은 이긴 쪽 것이다.
   firebaseAPI 가 없을 수 있다 — 강제 로그아웃은 검문(«네트워크 없음»)에 걸려도 여기까지 온다. */
const PRESENCE_OFF_WAIT_MS = 3000;   // 오프라인이면 쓰기가 안 끝난다 — 로그아웃을 이만큼만 붙잡는다
function _presenceOff(uid){
  const api = window.firebaseAPI;
  if(!api || sessionLost()) return Promise.resolve();
  let p = null;
  try{ p = api.setMyPresenceState(uid, false); }catch(_){}
  return Promise.race([Promise.resolve(p).catch(() => {}), new Promise(r => setTimeout(r, PRESENCE_OFF_WAIT_MS))]);
}
/* 신원 놓기 한 벌 — 올리고 → 검문 → 지운다. 로그아웃·연동 해제가 같이 쓴다.
   @return { ok:true } | { ok:false, reason } — false 면 **아무것도 안 지웠다.** 부르는 쪽이 이유를 보여준다. */
async function _detachAccountLocal(opt){
  /* 🚪 [2026-09-20 · §2] force — 검문에 걸려도 지운다. **두 번째 누름에서만** 열리는 갈래다(부르는 쪽 참고).
     출구가 없으면 막히는 원인이 계속되는 한 영원히 못 나가는데, 하필 로그아웃이 «로그인 문구가 계속 뜬다» 의
     복구 수단이다. 강제로 지워도 올리기는 한 번 더 해 본다(공짜다). 기기 세션도 놓는다(아래). */
  const force = !!(opt && opt.force);
  let uid = null; try{ uid = localStorage.getItem(MY_USER_ID_KEY); }catch(_){}
  if(uid){
    const fl = await _acctFlushToServer();
    const pf = await _acctPreflight(uid, { timedOut: !!(fl && fl.timedOut) });
    if(!pf.ok && !force) return pf;
    if(!pf.ok) console.warn('[계정] 검문에 걸렸지만 강제 로그아웃 — 이 기기에만 있던 것: ' + (pf.items || []).map(i => i.label).join(' · '));
  }
  if(uid) await _presenceOff(uid);
  _wipeAccountLocal();
  /* 🖥️ 지금 기기 자리는 realtime 서버가 쥔다 — 로그아웃(loginFlowMod.logout)이 연결을 끊으면 놓인다. */
  return { ok:true };
}

/* 로그아웃 — Auth 세션만 끊는 게 아니라 **이 기기의 신원까지 놓는다.**
   [왜 그렇게까지 하는가] 세션만 끊으면 로컬 유저 코드가 그대로 남아, 로그아웃한 뒤에도
     그 계정의 마이홈·친구가 계속 보인다. 한 컴퓨터를 나눠 쓸 때 다음 사람이 앞사람 계정을
     그대로 보게 된다는 뜻이다. 그래서 계정 연동 해제(acctUnlinkYes)와 **같은 자리를 지운다.**
   ★ 예전에 해제가 무서웠던 이유(돌아오려면 유저 코드 22자리와 비밀번호가 필요했다)는
     이제 없다 — 게이트에 구글 버튼이 있어서 클릭 한 번으로 돌아온다. 계정은 서버에 그대로다.
   ★ [2026-09-16 제보 4] 지우는 목록은 ACCOUNT_LOCAL_KEYS 한 벌이다(위). 소지품까지 전부 지운다.
   ⚠️ 순서: 올리고·검문 **먼저**, signOut 은 **그 뒤**. 거꾸로 하면 세션이 끊긴 상태에서 push 가
     거부되고, 검문이 그걸 «못 올렸다» 로 읽어 로그아웃이 항상 막힌다.
   @return { ok, reason } — ok=false 면 세션도 로컬도 그대로다. */
async function _loginDoLogout(opt){
  const r = await _detachAccountLocal(opt);
  if(!r.ok) return r;
  try{ await loginFlowMod.logout(); }catch(_){}   // realtime 끄기 · 로그인 놓기 · 내 계정 사본 지우기
  return { ok:true };
}

/* 🗑️ 회원 탈퇴 — 서버(POST /v1/me/withdrawal · 202)가 계정을 지운 뒤 이 PC 의 신원 · 소지품도 로그아웃과 같은 한 벌로 지운다.
   ★ 로그아웃과 달리 올리기 · 검문을 하지 않는다 — 지울 계정에 올릴 까닭이 없다.
   ★ 서버는 5분 안 로그인을 요구한다 — 오래됐으면 구글로 다시 확인(_withRecentLogin).
   @return { ok, reason } — ok=false 면 이 PC 는 그대로다. */
const WITHDRAW_WORD = '탈퇴';   // 서버 확인 글자와 같다(user-api.js WITHDRAW_CONFIRM)
async function _loginDoDeleteAccount(word){
  if(String(word == null ? '' : word).trim() !== WITHDRAW_WORD) return { ok:false, reason:'확인 글자 «' + WITHDRAW_WORD + '» 를 그대로 입력해 주세요' };
  const r = await _withRecentLogin(() => userApiMod.withdraw());
  if(!r.ok) return r;
  try{ await loginFlowMod.logout(); }catch(_){}   // realtime 끄기 · 로그인 놓기(로그인 계정은 서버가 뒤에서 지운다)
  _wipeAccountLocal();
  return { ok:true };
}
/* 탈퇴 안내의 «지울 항목 n 개 · 파일 m 개» — 못 읽으면 { ok:false }(안내 줄만 숨긴다) */
async function _withdrawPreview(){
  try{ const p = await userApiMod.withdrawalPreview(); return p ? Object.assign({ ok:true }, p) : { ok:false }; }catch(_){ return { ok:false }; }
}

/* 🔐 [회원가입 설계 §7-C2·C3 · 개정 14 · 시안 확정] 계정 탭 — 로그인 수단 · 비밀번호 만들기(C3) · 바꾸기(C2).
   ★ 모드는 Auth 세션의 제공자(providerData)가 정한다 — 로컬 키가 아니라. 로그인 표시(LOGIN_EMAIL_KEY)는 «탭을 로그인 얼굴로» 만 정한다.
       비밀번호 있음 → C2(바꾸기 · 구글 없으면 경고 + [연결하기]) · 구글만 → C3(만들기) · 세션 없음 → 한 줄(«다시 시작하면 로그인 화면» — 그게 K) · 익명 → 숨김.
   ★ C3 아이디 = 이 계정의 친구 코드(서버 계정) — 비밀번호 로그인은 서버가 붙인다(POST /v1/me/password-login).
   ★ C2 는 지금 비밀번호를 묻지 않는다((가)) — 서버가 토큰으로 본인을 확인한다(5분 안 로그인 — 오래됐으면 구글로 다시 확인). 바꾸면 이 PC 는 새 비밀번호로 곧바로 다시 로그인.
   ⚠️ 옛 계정 탭 안에 넣은 첫 조각이다 — 탭 전체를 C 로 바꾸는 건 화면 단계. */
function _acctMethodsMode(pv){
  if(!pv) return { mode:'off' };
  if(pv.anonymous) return { mode:'none' };
  if(pv.password){
    const code = pv.passwordEmail ? String(pv.passwordEmail).split('@')[0].toUpperCase() : null;
    return { mode:'c2', google:!!pv.google, warn:!pv.google, code };
  }
  if(pv.google) return { mode:'c3', google:true, warn:false, code:null };
  return { mode:'none' };
}
function _acctPwCheck(a, b){
  a = String(a || ''); b = String(b || '');
  if(a.length < 6) return { ok:false, focus:1, reason:'비밀번호는 6자 이상으로 정해 주세요' };
  if(a !== b) return { ok:false, focus:2, reason:'비밀번호가 서로 달라요.' };
  return { ok:true };
}
/* C3 아이디 = 이 계정의 친구 코드 — 서버가 돌려준 내 계정(사본) · 없으면 이 기기 코드(로그인 때 서버 값으로 적었다) */
function _acctPwCode(){
  const c = loginFlowMod.meCache();
  let code = c && c.me ? c.me.friendCode : null;
  if(!code){ try{ code = localStorage.getItem(MY_FRIEND_CODE_KEY); }catch(_){} }
  return (code && FRIEND_CODE_LOGIN_RE.test(code)) ? { ok:true, code } : { ok:false, reason:'내 친구 코드를 확인하지 못했어요 — 앱을 다시 시작한 뒤 다시 해 주세요' };
}
/* 서버가 «5분 안 로그인» 을 요구하는 일(비밀번호 붙이기 · 바꾸기 · 탈퇴) — USER_REAUTH_REQUIRED 면 구글로 다시 확인하고 한 번 더.
   구글이 없는 계정(친구 코드 + 비밀번호만)은 앱에 지금 비밀번호를 받을 화면이 없다 — 다시 로그인한 뒤 하라고 알린다.
   돌려주는 것: { ok, value } · { ok:false, canceled } · { ok:false, reason } */
const REAUTH_PASSWORD_ONLY = '보안을 위해 다시 로그인한 뒤 해 주세요 — 로그아웃하고 친구 코드 + 비밀번호로 다시 로그인하면 5분 안에 할 수 있어요';
async function _withRecentLogin(fn){
  try{ return { ok:true, value: await fn() }; }
  catch(e){
    if(!(e && e.code === 'USER_REAUTH_REQUIRED')) return { ok:false, reason:userApiMod.reasonOf(e), code:(e && e.code) || '' };
  }
  let pv = null; try{ pv = firebaseAPI.authProviders(); }catch(_){}
  if(!(pv && pv.google)) return { ok:false, reason:REAUTH_PASSWORD_ONLY };
  let g = null; try{ g = await companion.signInWithGoogle(); }catch(_){}
  if(!g || !g.ok) return { ok:false, canceled:!!(g && (g.canceled || !g.reason || g.reason === '로그인이 취소됐어요')), reason:(g && g.reason) || '' };
  let a = null; try{ a = await firebaseAPI.authReauthGoogle(g.idToken); }catch(_){}
  if(!a || !a.ok) return { ok:false, reason:(a && a.reason) || '구글 확인에 실패했어요' };
  try{ return { ok:true, value: await fn() }; }
  catch(e){ return { ok:false, reason:userApiMod.reasonOf(e), code:(e && e.code) || '' }; }
}
/* C3 — 구글만 있는 계정에 `{내 친구코드}@tw.local` + 비밀번호 로그인을 붙인다(서버가 붙인다 — 앱이 붙이면 남의 코드 이메일을 차지할 수 있어서).
   붙인 뒤 이 PC 의 Auth 사본을 다시 읽어 계정 탭이 C2 로 바뀐다. */
async function _acctCreatePassword(pw){
  const c = _acctPwCode();
  if(!c.ok) return c;
  const r = await _withRecentLogin(() => userApiMod.attachPasswordLogin(pw));
  if(!r.ok) return r;
  try{ await firebaseAPI.authReload(); }catch(_){}
  return { ok:true, code:c.code };
}
/* C2 — 서버가 바꾸고 이 계정의 모든 로그인을 끊는다 → 이 PC 는 새 비밀번호로 곧바로 다시 로그인(같은 계정). 다시 로그인이 실패해도 바꾸기는 성공(relogged:false). */
async function _acctChangePassword(pw){
  let pv = null; try{ pv = firebaseAPI.authProviders(); }catch(_){}
  if(!pv || !pv.passwordEmail) return { ok:false, reason:'비밀번호가 없는 계정이에요 — 먼저 비밀번호를 만들어 주세요' };
  const r = await _withRecentLogin(() => userApiMod.changePassword(pw));
  if(!r.ok) return r;
  let l = null; try{ l = await firebaseAPI.authSignInWithFriendCode(String(pv.passwordEmail).split('@')[0], pw); }catch(_){}
  return { ok:true, relogged: !!(l && l.ok && l.uid === pv.authUid) };
}
let _acctMethodsLast = null;
/* keepMsg — 방금 한 일의 안내 줄을 남긴 채 모양만 다시 그린다(C3 → C2 로 바뀌는 순간). 탭을 열 때는 입력·안내를 비운다. */
async function _acctMethodsRender(keepMsg){
  const $e = id => document.getElementById(id);
  const box = $e('acctMethods'), off = $e('acctMOff');
  if(!box) return null;
  if(!keepMsg){
    ['acctPw1','acctPw2'].forEach(i => { const el = $e(i); if(el){ el.value = ''; el.disabled = false; } });
    const pm = $e('acctPwMsg'); if(pm){ pm.textContent = ''; pm.style.display = 'none'; }
  }
  if(!getMyLoginEmail() || !(window.firebaseAPI && firebaseAPI.authProviders)){
    box.style.display = 'none'; if(off) off.style.display = 'none'; _acctMethodsLast = null; return null;
  }
  try{ if(firebaseAPI.authReady) await firebaseAPI.authReady(); }catch(_){}
  let pv = null; try{ pv = firebaseAPI.authProviders(); }catch(_){ pv = null; }
  const m = _acctMethodsMode(pv);
  _acctMethodsLast = m;
  if(off) off.style.display = m.mode === 'off' ? 'block' : 'none';
  if(m.mode !== 'c2' && m.mode !== 'c3'){ box.style.display = 'none'; return m; }
  const c3 = m.mode === 'c3';
  box.style.display = 'block';
  const show = (id, on, how) => { const el = $e(id); if(el) el.style.display = on ? (how || 'block') : 'none'; };
  const text = (id, t) => { const el = $e(id); if(el) el.textContent = t; };
  show('acctMGoogleOk', m.google, 'inline');
  show('acctMGoogleLink', !m.google, 'inline-block');
  const gl = $e('acctMGoogleLink'); if(gl) gl.disabled = false;
  let code = m.code;
  if(!code){ try{ code = localStorage.getItem(MY_FRIEND_CODE_KEY); }catch(_){} }
  text('acctMCode', code || '—');
  text('acctMPwState', c3 ? '비밀번호 없음' : '연결됨');
  const ps = $e('acctMPwState'); if(ps) ps.style.color = c3 ? 'var(--ink-soft)' : 'var(--win-ok,#2a7a3f)';
  show('acctMNote', c3);
  show('acctMWarn', !!m.warn);
  text('acctPwTitle', c3 ? '비밀번호 만들기' : '비밀번호 바꾸기');
  text('acctPwL1', c3 ? '비밀번호' : '새 비밀번호');
  text('acctPwL2', c3 ? '비밀번호 확인' : '새 비밀번호 확인');
  text('acctPwBtn', c3 ? '비밀번호 만들기' : '비밀번호 바꾸기');
  show('acctPwHint', !c3);
  return m;
}

/* 계정 탭 다시 그리기 — [개정 16] [내 정보 › 계정](C4) 한 곳. 로그인했으면 C4, 아니면 한 줄(로그인은 게이트 H · I · K 가 한다).
   ★ 옛 두 얼굴 중 «로그인 전 [구글 계정으로 로그인]» · «연결됨 · 이메일» 상자 · 유저 코드/친추 코드 줄 · 되찾기 상자는 걷었다. */
function refreshAccountTab(){
  const email = getMyLoginEmail();
  const inBox = document.getElementById('acctLoggedIn');
  const noBox = document.getElementById('acctNoLogin');
  if(inBox) inBox.style.display = email ? 'block' : 'none';
  if(noBox) noBox.style.display = email ? 'none'  : 'block';
  // 확인/완료 단계는 탭을 다시 열 때마다 접어 둔다 — 열어둔 채로 남으면 다음에 헷갈린다.
  const cf = document.getElementById('acctLogoutConfirm'); if(cf) cf.style.display = 'none';
  const dn = document.getElementById('acctLogoutDone');    if(dn) dn.style.display = 'none';
  const lb = document.getElementById('acctLogoutBtn');     if(lb) lb.style.display = 'block';
  const fb = document.getElementById('acctLogoutForce');   if(fb) fb.style.display = 'none';   // §2 강제 갈래도 접는다
  const msg = document.getElementById('acctLoginMsg');     if(msg) msg.style.display = 'none';
  try{ slotSyncMod()._slotsRenderAcctSync(); }catch(_){}                 // ☁️ 기기 연동 구획(3-7-2 B안)
  try{ const p = _acctMethodsRender(); if(p && p.catch) p.catch(()=>{}); }catch(_){}   // 🔐 로그인 수단 · C2 · C3
}

/* 🔐 C2 · C3 배선 — [비밀번호 만들기/바꾸기] · (C2) 구글 [연결하기]. 모드는 마지막으로 그린 _acctMethodsLast 를 따른다. */
(function initAccountMethodsUI(){
  const bind = ()=>{
    const $e = id => document.getElementById(id);
    const btn = $e('acctPwBtn'), p1 = $e('acctPw1'), p2 = $e('acctPw2'), gl = $e('acctMGoogleLink');
    const say = (t, kind)=>{
      const el = $e('acctPwMsg'); if(!el) return;
      el.textContent = t || ''; el.style.display = t ? 'block' : 'none';
      el.style.color = kind === 'ok' ? 'var(--win-ok,#2a7a3f)' : (kind === 'err' ? 'var(--win-error)' : 'var(--ink-soft)');
    };
    const go = async ()=>{
      const m = _acctMethodsLast;
      if(!btn || btn.disabled || !m || (m.mode !== 'c2' && m.mode !== 'c3')) return;
      const a = String((p1 && p1.value) || ''), b = String((p2 && p2.value) || '');
      const v = _acctPwCheck(a, b);
      if(!v.ok){ say(v.reason, 'err'); const f = v.focus === 2 ? p2 : p1; if(f) f.focus(); return; }
      const c3 = m.mode === 'c3';
      const label = btn.textContent;
      btn.disabled = true; if(p1) p1.disabled = true; if(p2) p2.disabled = true;
      btn.textContent = c3 ? '만드는 중…' : '바꾸는 중…';
      say(c3 ? '' : '서버에서 바꾸는 중이에요…', 'info');
      let r = null;
      try{ r = c3 ? await _acctCreatePassword(a) : await _acctChangePassword(a); }
      catch(_){ r = { ok:false, reason:'오류가 났어요 — 다시 시도해 주세요' }; }
      btn.disabled = false; if(p1) p1.disabled = false; if(p2) p2.disabled = false; btn.textContent = label;
      if(!r || !r.ok){ say(r && r.canceled ? '' : ((r && r.reason) || '실패했어요 — 다시 시도해 주세요'), 'err'); return; }
      if(p1) p1.value = ''; if(p2) p2.value = '';
      if(c3){
        try{ await _acctMethodsRender(true); }catch(_){}
        say('✅ 비밀번호를 만들었어요. 이제 친구 코드 ' + (r.code || '') + ' + 비밀번호로도 로그인할 수 있어요.', 'ok');
      } else if(r.relogged){
        say('✅ 비밀번호를 바꿨어요. 다른 PC는 새 비밀번호로 다시 로그인해야 해요.', 'ok');
      } else {
        say('✅ 비밀번호를 바꿨어요. 이 PC도 다시 로그인이 필요할 수 있어요 — 앱을 다시 시작하면 로그인 화면이 나와요.', 'ok');
      }
    };
    if(btn) btn.onclick = go;
    if(p1) p1.onkeydown = e=>{ if(e.key === 'Enter'){ if(p2) p2.focus(); } };
    if(p2) p2.onkeydown = e=>{ if(e.key === 'Enter') go(); };
    /* C2 의 구글 [연결하기] — J 의 [구글도 연결하기]와 같은 일(지금 세션에 붙이기 · authLinkGoogle). 로그인을 바꾸지 않는다. */
    /* 🩹 [2026-10-02 제보 #5] «구글 연결하기를 누르면 창이 뜬 뒤 아무 일도 안 일어난다»
       결과 문구가 비밀번호 칸 **맨 아래** 작은 글씨(acctPwMsg)에만 나와서 화면 밖에 있으면 안 보였다.
       게다가 실패 사유가 비면(signInWithGoogle 예외 · reason 없음) say('') 가 칸을 아예 숨겼다.
       ⇒ ① 사유가 비면 기본 문구 ② 토스트로도 같이 띄운다 ③ 문구 칸을 화면 안으로 끌어온다. */
    const sayG = (t, kind)=>{
      say(t, kind);
      if(t && kind !== 'info'){ try{ toast(t); }catch(_){} }
      try{ const el = $e('acctPwMsg'); if(el && t) el.scrollIntoView({ block:'nearest' }); }catch(_){}
    };
    if(gl) gl.onclick = async ()=>{
      if(!(window.companion && companion.signInWithGoogle) || !(window.firebaseAPI && firebaseAPI.authLinkGoogle)){ sayG('이 버전에서는 구글을 연결할 수 없어요', 'err'); return; }
      gl.disabled = true; say('구글 창을 여는 중…', 'info');
      let g = null; try{ g = await companion.signInWithGoogle(); }catch(_){}
      if(!g || !g.ok){ sayG((g && g.reason) || '구글 로그인 창에서 결과를 받지 못했어요 — 다시 시도해 주세요', 'err'); gl.disabled = false; return; }
      let r = null; try{ r = await firebaseAPI.authLinkGoogle(g.idToken); }catch(_){ r = { ok:false, reason:'네트워크 오류 — 인터넷 연결을 확인해 주세요' }; }
      if(!r || !r.ok){ sayG((r && r.reason) || '구글을 연결하지 못했어요', 'err'); gl.disabled = false; return; }
      try{ await _acctMethodsRender(true); }catch(_){}
      sayG('✅ 구글이 연결됐어요. 이제 구글로도 로그인할 수 있어요.', 'ok');
    };
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once:true });
  else bind();
})();

return {
  CHARS_LINKED_KEY,
  _enterAccount,
  _loginDoFriendCode,
  _loginDoGoogle,
  _loginDoLogout,
  _loginDoDeleteAccount,
  _withdrawPreview,
  _wipeAccountLocal,
  refreshAccountTab,
};
}

const api = { createAccount };
if(typeof window !== 'undefined') window.TwAccount = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

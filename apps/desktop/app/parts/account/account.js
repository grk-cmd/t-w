/* account.js — 🔑 계정 — 구글 로그인 · 친구코드 로그인 · 로그아웃 · 신원 지우기 · 계정 이전 흔적
   app.js «🔑 구글 로그인 (계정)» · «🧹 신원을 놓을 때 이 기기에서 지우는 것» · «📤 계정 이전 / 연동 / 연동 해제(걷은 흔적)» 세 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 23번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 3개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 49줄 —
     CHAL_KEY · FOCUS_TODAY_DATE_KEY · FOCUS_TODAY_SEC_KEY · FOCUS_TOTAL_KEY · GACHA_BONUS_KEY · GACHA_OWNED_KEY · GACHA_TS_KEY · LICENSE_REQ_ID_KEY · LS_KEY · _focusTodaySec · _focusTotalSec · charsMod · extraSeatSlots · focusLevelMod · gachaMod · slotSyncMod · weeklyChal 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setFocusTodaySec · setFocusTotalSec · setExtraSeatSlots(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 4개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 신원 핵심(로그인 이메일 · 저장 키 · 친구코드 모양 · 신원 놓음)과 라이선스 저장 키는 account-state.js 에서 받는다(모듈 순환 끊기 5).
   ★ «연동됨» 안내 창(_charsLinkedMaybeShow)은 보관함 화면이 있는 my-info.js 로 옮겼다 — 표시 키 CHARS_LINKED_KEY 는 쓰는 쪽(여기)에 두고 내놓는다.
   ★ 밖에서 부르는 이름: CHARS_LINKED_KEY · _applyTransferSnapshot · _loginDoFriendCode · _loginDoGoogle · _loginDoLogout · _loginDoDeleteAccount · _loginLocalSnapshot · refreshAccountTab — app.js 는 accountMod.이름 으로 부른다.
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
const FOCUS_TODAY_DATE_KEY = deps.FOCUS_TODAY_DATE_KEY;   // 읽는 함수
const FOCUS_TODAY_SEC_KEY = deps.FOCUS_TODAY_SEC_KEY;   // 읽는 함수
const FOCUS_TOTAL_KEY = deps.FOCUS_TOTAL_KEY;   // 읽는 함수
const GACHA_BONUS_KEY = deps.GACHA_BONUS_KEY;   // 읽는 함수
const GACHA_OWNED_KEY = deps.GACHA_OWNED_KEY;   // 읽는 함수
const GACHA_TS_KEY = deps.GACHA_TS_KEY;   // 읽는 함수
const HAD_USER_ID_AT_BOOT = deps.HAD_USER_ID_AT_BOOT;
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
const slotSyncMod = deps.slotSyncMod;   // 읽는 함수
const toast = deps.toast;
const tricksMod = deps.tricksMod;
const weeklyChal = deps.weeklyChal;   // 읽는 함수
const setFocusTodaySec = deps.setFocusTodaySec;   // 쓰는 함수
const setFocusTotalSec = deps.setFocusTotalSec;   // 쓰는 함수
const setExtraSeatSlots = deps.setExtraSeatSlots;   // 쓰는 함수

/* 이 기기의 현재 값들 — 로그인/부팅 때 서버 스냅샷에 실어 보내는 한 벌.
   ★ 여기 없는 것(플레이리스트·가챠·마이홈)은 각자 실시간 사본이 따로 있어서 안 담는다. */
function _loginLocalSnapshot(){
  const g = k => { try{ return localStorage.getItem(k) || null; }catch(_){ return null; } };
  return {
    license: g(acctStateMod.LICENSE_KEY_STORAGE),
    focusTotalSec: Number.isFinite(Number(_focusTotalSec())) ? Number(_focusTotalSec()) : null,
    name: g(USER_NAME_KEY),
    friendCode: g(MY_FRIEND_CODE_KEY)
  };
}

/* 🔒 이 기기의 유저 코드를 구글 계정에 **묶어도 되는가**.
   [무엇을 막는가] 결속은 한 번 생기면 그 계정의 정답이 되어 다음 로그인마다 그 코드로 끌고 간다.
     그래서 "계정이라고 부를 수 있는 코드"에만 걸어야 한다. 그런데 getMyUserId() 는 코드가 없으면
     **그 자리에서 만들어낸다.** 초대 게이트에서 [구글 로그인]을 누른 새 기기가 방금 태어난 임시
     코드를 계정에 묶어버린 것이 제보의 시작이었다(그리고 화면은 입장을 거부했다 — 묶임만 남았다).
   [판정 기준이 왜 둘인가] 신호 하나로는 못 가른다.
     · HAD_USER_ID_AT_BOOT — 이번 부팅 **전부터** 코드가 있던 기기. 어떤 쓰기보다 먼저 캡처되므로
       "게이트 앞에서 방금 태어난 코드"와 확실히 구별된다. 오프라인으로만 쓰던 기존 유저도 여기 걸린다
       (그 사람들은 checkInviteGate 의 오프라인 분기로 도장 없이 통과한다 — INVITE_PASS_KEY 만
        보면 진짜 유저가 로그인을 거절당한다).
     · INVITE_PASS_KEY — 이번 부팅에 초대 코드로 막 입장한 사람. 코드는 방금 생겼지만 정식 계정이다.
   ⚠️ '조회'까지 막는 것이 아니다. 결속만 막는다 — 이미 묶인 계정으로 돌아오는 길(게이트 안의
     구글 버튼)은 그대로 열려 있어야 한다. 그 판정은 서버가 authUsers 를 보고 한다. */
function _loginMayBind(){
  let passed = false;
  try{ passed = !!localStorage.getItem(acctStateMod.INVITE_PASS_KEY); }catch(_){}
  if(!HAD_USER_ID_AT_BOOT && !passed) return false;
  try{ return !!localStorage.getItem(MY_USER_ID_KEY); }catch(_){ return false; }
}

/* 🧬 [회원가입 설계 §3 «다름» · §7-F · CHECKS 개정 57] 다른 계정으로 갈아타기 **직전** 정리 — 이 기기에 남은 옛 계정(before) 몫.
   [왜] 예전엔 갈아탄 뒤에도 옛 계정의 보관함 · 책상 표(deskFriends.chars.*)가 그대로 남아, 첫 채택이 «이미 채택함» 으로 건너뛰고
     평상시 동기화가 옛 계정 캐릭터를 **새 계정 서버에 조용히 올렸다**. 책상 표는 옛 cid 를 가리킨 채 새 계정 칸 그림을 받아,
     그 칸을 고치면 옛 cid 에 새 계정 캐릭터가 덮였다. 로그아웃 → 로그인은 _detachAccountLocal 이 지워서 멀쩡했다 — 로그아웃 없이
     갈아타는 길(I 의 구글 · K 의 다른 계정 로그인)에만 있던 틈이다.
   갈래 — 옛 uid 가 어느 계정에 묶였나(userAuth/{before}):
     · 못 읽음      → 실패(갈아타지 않는다). 어느 쪽인지 모르고 섞거나 버리지 않는다.
     · 안 묶임(I)   → 같은 사람의 이 PC 몫이다. ① 옛 uid 로 캐릭터를 끝까지 올리고(안 묶인 uid 라 규칙상 쓸 수 있다 · 못 올리면 실패)
                      ② 옛 uid 서버의 산 캐릭터를 **같은 cid 로** 새 계정 보관함에 복사(_charsLinkPlan · 더 새것이 이긴다 · 묘비는 안 옮김 ·
                      20 을 넘어도 버리지 않는다 — D2 가 경고) ③ 캐릭터 로컬 키만 내려놓고 ④ F 안내 표시를 남긴다(재시작 뒤 첫 채택이 끝나면 한 번).
                      집중 시간 · 플레이리스트 등 나머지는 예전처럼 따라간다(같은 사람).
     · 다른 계정(K) → 남의 계정일 수 있다(한 PC 를 둘이 씀). 아무것도 가져오지 않고 **로그아웃처럼 전부 내려놓는다**(_wipeAccountLocal).
                      그 계정 몫은 지금 세션으로 올릴 수 없으므로(규칙) 책상 칸은 슬롯 백업에만 남긴다(백업은 uid 대조로 남이 못 줍는다).
   ⚠️ uid 기록(_setMyUserId) **전에** 부른다 — ① 은 옛 uid 로 돈다. 돌려주는 것: { ok, mode:'none'|'import'|'detach'|'plain', n, reason }. */
const CHARS_LINKED_KEY = 'tw.charsLinked';
function _charsLinkPlan(fromChars, toChars){
  fromChars = (fromChars && typeof fromChars === 'object') ? fromChars : {};
  toChars = (toChars && typeof toChars === 'object') ? toChars : {};
  const entries = {}, cids = [];
  for(const cid in fromChars){
    const e = fromChars[cid];
    if(!/^c[a-z0-9]{6,24}$/.test(cid) || !e || typeof e.def !== 'string' || charsMod()._charsIsTomb(e)) continue;
    const mt = Number(e.mtime) || 0, cur = toChars[cid];
    if(cur && charsMod()._charsEntryTime(cur) >= mt) continue;             // 새 계정 쪽이 같거나 더 새것(지운 것 포함) — 되살리지 않는다
    entries[cid] = { def: e.def, mtime: mt };
    cids.push(cid);
  }
  return { entries, cids };
}
async function _switchPrepare(before, to){
  if(!before || before === to) return { ok:true, mode:'none', n:0 };
  if(!(window.firebaseAPI && firebaseAPI.authOwnerOf)) return { ok:false, reason:'네트워크 연결이 필요해요' };
  let owner; try{ owner = await firebaseAPI.authOwnerOf(before); }catch(_){ owner = undefined; }
  if(owner === undefined) return { ok:false, reason:'이 PC 의 옛 계정 정보를 읽지 못했어요 — 인터넷 연결을 확인하고 다시 시도해 주세요' };
  const dropChars = () => { for(const k of ['deskFriends.chars.v1', 'deskFriends.chars.desk', 'deskFriends.chars.trashPend']){ try{ localStorage.removeItem(k); }catch(_){} } };
  if(owner !== null){
    let raw = null; try{ raw = localStorage.getItem(LS_KEY()); }catch(_){}
    try{ if(raw) slotSyncMod()._slotsBackupSave(raw, '[]', 0); }catch(_){}
    _wipeAccountLocal();
    return { ok:true, mode:'detach', n:0 };
  }
  if(!(typeof charsMod().CHARS_SYNC_ENABLED !== 'undefined' && charsMod().CHARS_SYNC_ENABLED && typeof charsMod()._charsBoot === 'function')){ dropChars(); return { ok:true, mode:'plain', n:0 }; }
  const prepFail = { ok:false, reason:'이 PC 의 캐릭터를 올리지 못했어요 — 아무것도 바꾸지 않았어요. 잠시 뒤 다시 시도해 주세요' };
  let b = null; try{ b = await charsMod()._charsBoot('switch'); }catch(_){ b = null; }
  if(!b || !b.ok) return prepFail;
  const box = charsMod()._charsBoxGet();
  for(const c in box) if(box[c] && box[c].dirty) return prepFail;   // 아직 못 올린 칸이 남았다(도는 중이었던 판 포함)
  if(!(firebaseAPI.loadCharsRemote && firebaseAPI.saveCharsEntries)) return prepFail;
  let ca = null, cb = null;
  try{ [ca, cb] = await Promise.all([ firebaseAPI.loadCharsRemote(before), firebaseAPI.loadCharsRemote(to) ]); }catch(_){}
  if(!ca || !cb) return prepFail;
  const plan = _charsLinkPlan(ca.chars, cb.chars);
  if(plan.cids.length){
    let ok = false; try{ ok = !!(await firebaseAPI.saveCharsEntries(to, plan.entries)); }catch(_){ ok = false; }
    if(!ok) return { ok:false, reason:'캐릭터를 계정으로 옮기지 못했어요 — 아무것도 바꾸지 않았어요. 잠시 뒤 다시 시도해 주세요' };
  }
  dropChars();
  if(plan.cids.length){ try{ localStorage.setItem(CHARS_LINKED_KEY, JSON.stringify({ to, cids: plan.cids, at: Date.now() })); }catch(_){} }
  return { ok:true, mode:'import', n: plan.cids.length };
}

/* 구글 로그인 — 창 열기(main) → 토큰 검증·결속(firebase) → 필요하면 갈아타기(여기).
   @return { ok, switched, email, reason }
           switched=true → 유저 코드가 바뀌었다 = **재시작이 필요하다** */
async function _loginDoGoogle(){
  if(!(window.companion && companion.signInWithGoogle))
    return { ok:false, reason:'이 버전에서는 구글 로그인을 쓸 수 없어요 (앱 업데이트가 필요해요)' };
  if(!(window.firebaseAPI && firebaseAPI.authSignInWithGoogle))
    return { ok:false, reason:'네트워크 연결이 필요해요' };

  /* ⚠️ 취소도 정상 경로다. 유저가 창을 그냥 닫으면 여기로 온다 — 반드시 조용히 끝내야 한다
     (여기서 실패로 시끄럽게 굴면 "닫았을 뿐인데 오류가 뜬다"가 된다). */
  let g;
  try{ g = await companion.signInWithGoogle(); }
  catch(e){ return { ok:false, reason:'로그인 창을 열지 못했어요' }; }
  /* 🩹 [2026-10-02 제보 #5] canceled 는 «그냥 닫음» 일 때만 — 예전엔 실패를 전부 취소로 쳐서 구글이 막은 사유까지 숨겼다.
     옛 main 은 canceled 표시 없이 '로그인이 취소됐어요' 만 보내므로 그것도 닫음으로 본다. (세 곳 같은 식 — 검사가 함수를 떼어 돌려 공용 함수를 못 쓴다) */
  if(!g || !g.ok) return { ok:false, reason:(g && g.reason) || '로그인이 취소됐어요', canceled:!!(g && (g.canceled || !g.reason || g.reason === '로그인이 취소됐어요')) };

  /* ⚠️ getMyUserId() 를 쓰지 않는다 — 없으면 만들어내는 함수라, 없다는 사실 자체가 지워진다.
     여기서는 "이 기기에 코드가 있었는가"가 판단의 근거이므로 날것으로 읽어야 한다. */
  let before = null; try{ before = localStorage.getItem(MY_USER_ID_KEY); }catch(_){}
  // 묶어도 되는 코드일 때만 서버에 건넨다. null 을 주면 서버는 조회만 하고 결속은 거절한다.
  const offer = _loginMayBind() ? before : null;
  const r = await firebaseAPI.authSignInWithGoogle(g.idToken, offer);
  if(!r || !r.ok) return { ok:false, reason:(r && r.reason) || '로그인에 실패했어요', needCode:!!(r && r.needCode) };

  try{
    localStorage.setItem(LOGIN_EMAIL_KEY, r.email || '');
    localStorage.setItem(LOGIN_UID_KEY, r.uid || '');
  }catch(_){}

  if(r.userCode === before){
    /* 이 기기가 이미 그 계정이다 — 갈아탈 것이 없다. 첫 결속이면 스냅샷을 한 벌 올려둔다
       (이걸 빼먹으면 새 기기에서 로그인했을 때 라이선스·이름·친추코드가 비어 온다). */
    if(r.bound){ try{ await firebaseAPI.setAccountSnapshot(before, _loginLocalSnapshot()); }catch(_){} }
    /* 🎟️ **bound=false 는 "이 구글 계정에 이 uid 가 이미 묶여 있었다"는 뜻이다** — 서버가 인정한
       주인이라는 증거다. 그러니 게이트 통과 자격으로 친다(switched 경로와 같은 근거).
       [경위] 예전에는 여기서 아무 표시도 안 남겼고, 게이트는 이 결과를 "연결된 기록이 없어요"로
         읽어 막았다. 본인 확인이 끝났는데 실패로 뒤집힌 셈이라, 로그인해 둔 사람도 못 들어왔다.
       ⚠️ bound=true(이 계정의 첫 결속)는 자격의 근거가 못 된다 — 방금 깐 사람도 로그인만 하면
         묶이기 때문이다. 그쪽은 여전히 초대 코드가 필요하다. 그래서 둘을 갈라 돌려준다. */
    const alreadyOwner = !r.bound;
    if(alreadyOwner){ try{ acctStateMod._markInvitePassed(); }catch(_){} }
    return { ok:true, switched:false, alreadyOwner, email:r.email };
  }

  /* ── 그 구글 계정의 uid 로 갈아탄다 (게이트 H · K 의 [구글로 로그인]이 새 PC 에서 계정으로 들어가는 길) ──
     ★ uid 기록은 `_setMyUserId` 하나로(설계 §6-⑦ · 개정 56). 못 쓰면 Auth 세션도 놓는다 — 친구 코드 로그인과 같은 모양.
     ★ (개정 56 · 설계 §6-②) 이 기기의 이전 uid 는 적지 않는다 — 다른 계정이다. */
  /* 🧬 [설계 §3 «다름» · F · CHECKS 개정 57] 갈아타기 전에 이 기기의 옛 계정(before) 몫을 정리한다 — _switchPrepare 주석.
     못 하면 **갈아타지 않는다**(세션을 놓고 실패) — 옛 계정의 캐릭터를 잃거나 새 계정에 섞지 않게. */
  const prep = await _switchPrepare(before, r.userCode);
  if(!prep.ok){
    try{ await firebaseAPI.authSignOut(); }catch(_){}
    try{ localStorage.removeItem(LOGIN_EMAIL_KEY); localStorage.removeItem(LOGIN_UID_KEY); }catch(_){}
    return { ok:false, reason: prep.reason || '이 PC 의 옛 계정을 정리하지 못했어요 — 다시 시도해 주세요' };
  }
  if(!_setMyUserId(r.userCode)){
    try{ await firebaseAPI.authSignOut(); }catch(_){}
    try{ localStorage.removeItem(LOGIN_EMAIL_KEY); localStorage.removeItem(LOGIN_UID_KEY); }catch(_){}
    return { ok:false, reason:'이 기기에 계정을 저장하지 못했어요 — 다시 시도해 주세요' };
  }
  try{ localStorage.setItem(LOGIN_EMAIL_KEY, r.email || ''); localStorage.setItem(LOGIN_UID_KEY, r.uid || ''); }catch(_){}   // 내려놓기(detach)가 지웠을 수 있다
  try{
    const snap = await firebaseAPI.fetchAccountSnapshot(r.userCode);
    await _applyTransferSnapshot(snap);   // 계정 연동과 **같은 함수** — 복원 규칙은 한 벌뿐이다
  }catch(e){ console.warn('[로그인] 복원 중 오류 — uid 교체는 이미 끝났다', e); }
  try{ acctStateMod._markInvitePassed(); }catch(_){}   // 계정이 있는 사람 = 이미 정식 유저
  return { ok:true, switched:true, email:r.email };
}

/* 🔑 [회원가입 설계 §3 H · 개정 8] 친구 코드 + 비밀번호 로그인 — 처음 쓰는 PC 의 기존 사용자.
   서버가 돌려준 uid(`authUsers/{authUid}.userCode`)를 **그대로** 채택한다. 결속은 하지 않는다(가입 A·I 가 한다).
   돌려주는 것: { ok, switched } — switched 면 부르는 쪽이 재시작한다.
   ★ uid 기록은 `_setMyUserId` 하나로(설계 §6-⑦). 못 쓰면 Auth 세션도 놓는다 — «로그인은 됐는데 이 기기는 딴 사람» 을 남기지 않는다.
   ⚠️ LOGIN_EMAIL_KEY 에는 `{코드}@tw.local` 이 들어간다 — 계정 탭(C) 표시는 화면 단계에서 친구 코드로 바꾼다. */
async function _loginDoFriendCode(code, password){
  if(!(window.firebaseAPI && firebaseAPI.authSignInWithFriendCode))
    return { ok:false, reason:'네트워크 연결이 필요해요' };
  const r = await firebaseAPI.authSignInWithFriendCode(code, password);
  if(!r || !r.ok) return { ok:false, reason:(r && r.reason) || '로그인에 실패했어요' };
  const before = getMyUserId();
  if(r.userCode !== before){
    /* 🧬 갈아타기 전 정리(구글 로그인과 같은 함수 · CHECKS 개정 57). 못 하면 갈아타지 않는다. */
    const prep = await _switchPrepare(before, r.userCode);
    if(!prep.ok){
      try{ await firebaseAPI.authSignOut(); }catch(_){}
      return { ok:false, reason: prep.reason || '이 PC 의 옛 계정을 정리하지 못했어요 — 다시 시도해 주세요' };
    }
    if(!_setMyUserId(r.userCode)){
      try{ await firebaseAPI.authSignOut(); }catch(_){}
      return { ok:false, reason:'이 기기에 계정을 저장하지 못했어요 — 다시 시도해 주세요' };
    }
  }
  try{
    localStorage.setItem(LOGIN_EMAIL_KEY, r.email || '');
    localStorage.setItem(LOGIN_UID_KEY, r.uid || '');
  }catch(_){}
  if(r.userCode === before){ try{ acctStateMod._markInvitePassed(); }catch(_){} return { ok:true, switched:false }; }
  try{
    const snap = await firebaseAPI.fetchAccountSnapshot(r.userCode);
    /* 구글 로그인·가입과 **같은 함수** — 복원 규칙은 한 벌뿐이다. 입력한 코드는 비밀번호로 확인된 이 계정의 아이디라,
       계정에 코드 기록이 없을 때 그것을 쓴다(개정 56). */
    await _applyTransferSnapshot(snap, { typedCode: code });
  }catch(e){ console.warn('[로그인] 복원 중 오류 — uid 교체는 이미 끝났다', e); }
  try{ acctStateMod._markInvitePassed(); }catch(_){}
  return { ok:true, switched:true };
}

/* 로그아웃 — Auth 세션만 끊는 게 아니라 **이 기기의 신원까지 놓는다.**
   [왜 그렇게까지 하는가] 세션만 끊으면 로컬 유저 코드가 그대로 남아, 로그아웃한 뒤에도
     그 계정의 마이홈·친구가 계속 보인다. 한 컴퓨터를 나눠 쓸 때 다음 사람이 앞사람 계정을
     그대로 보게 된다는 뜻이다. 그래서 계정 연동 해제(acctUnlinkYes)와 **같은 자리를 지운다.**
   ★ 예전에 해제가 무서웠던 이유(돌아오려면 유저 코드 22자리와 비밀번호가 필요했다)는
     이제 없다 — 게이트에 구글 버튼이 있어서 클릭 한 번으로 돌아온다. 계정은 서버에 그대로다. */

const ACCOUNT_LOCAL_KEYS = ()=>[
  /* 신원 */
  MY_USER_ID_KEY, acctStateMod.INVITE_PASS_KEY, MY_FRIEND_CODE_KEY, LOGIN_EMAIL_KEY, LOGIN_UID_KEY,
  MY_FRIEND_CODE_PREV_KEY,     // 이 기기가 버린 코드 기록(진단용) — 다음 사람에게는 남의 코드다
  /* 라이선스 — 다시 로그인하면 계정 스냅샷(_applyTransferSnapshot r.license)으로 돌아온다. 없으면 키 재입력. */
  acctStateMod.LICENSE_KEY_STORAGE, LICENSE_REQ_ID_KEY(), acctStateMod.LICENSE_OPTOUT_KEY,   // 🎫 «이 기기만 해제» 표시도 계정 것이다
  /* 누적 시간(레벨 원본) — 스냅샷 focusTotalSec + syncFocusTotalToServer 의 «서버가 크면 받아온다» 가지.
     ⚠️ FOCUS_SYNCED_KEY 는 **removeItem** 이다. 값을 두면 «마크» 가 되고, 없으면 «한 번도 안 맞춰봄 = 증분 0 · max 바닥만».
        빈 기기에 마크가 남아 있으면 다음 계정의 첫 동기화가 (0 − 옛마크) 로 꼬인다. */
  FOCUS_TOTAL_KEY(), FOCUS_TODAY_SEC_KEY(), FOCUS_TODAY_DATE_KEY(), focusLevelMod().FOCUS_SYNCED_KEY,
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
  /* 플레이리스트 — _restoreOwnedDataAfterTransfer 가 세 벌 전부(fetchMyPlaylistSets) 받아온다.
     볼륨·반복·미니미·창 위치는 기기 설정이라 남긴다. */
  'tw.playlist', 'tw.playlistSets', 'tw.playlistCur', 'tw.playlistTitle', 'tw.playlistBio',
  'tw.playlistHomePublic', 'tw.playlistPrivate',
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
  /* 🎰 가챠 — 로컬 보유분이 있으면 서버에도 보유분이 있어야 한다. */
  try{
    if(nGacha && api.loadGachaOwned){
      const srv = await api.loadGachaOwned(uid);
      if(srv === null || srv === undefined) push(lblGacha, '파츠 저장 상태를 확인하지 못했어요', 'unknown');
      else if(!Object.keys(srv.owned || {}).length) push(lblGacha, '뽑은 파츠를 서버에 올리지 못했어요', timedOut ? 'timeout' : 'denied');
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
  try{ const pl = plMod.st; pl.sets = plMod.blankSets(); pl.cur = 0; pl.bio = ''; pl.homePublic = false; pl.private = false; pl.pubSig = null; }catch(_){}   // 🎵 playlist.js — 상태 묶음
  /* isPremium(메모리)은 안 건드린다 — 700ms 뒤 재시작이고, 그 사이 책상을 다시 그릴 이유가 없다.
     다음 부팅의 initLicense 가 빈 키를 보고 기본으로 시작한다. */
}

/* 로그인이 남아 있을 때 presence 를 «꺼짐» 으로 — signOut 뒤에는 onDisconnect(꺼짐)가 돌지 않아(그 칸은 이 계정 로그인만 쓴다)
   친구에게 접속중으로 남는다. 밀려난 기기는 쓰지 않는다 — 그 칸은 이긴 쪽 것이다.
   firebaseAPI 가 없을 수 있다 — 강제 로그아웃은 검문(«네트워크 없음»)에 걸려도 여기까지 온다. */
const PRESENCE_OFF_WAIT_MS = 3000;   // 오프라인이면 쓰기가 안 끝난다 — 로그아웃을 이만큼만 붙잡는다
function _presenceOff(uid){
  const api = window.firebaseAPI;
  if(!api || api.deviceSessionLost()) return Promise.resolve();
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
  /* 🖥️ 기기 세션을 놓는다 — 내 것일 때만 지운다. authSignOut 은 이 뒤(_loginDoLogout)라 아직 쓸 수 있다. */
  try{ if(window.firebaseAPI && firebaseAPI.releaseDeviceSession) await firebaseAPI.releaseDeviceSession(); }catch(_){}
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
  try{ if(window.firebaseAPI && firebaseAPI.authSignOut) await firebaseAPI.authSignOut(); }catch(_){}
  return { ok:true };
}

/* 🗑️ 회원 탈퇴 — 서버에서 계정을 지운 뒤(account-delete-net.js) 이 PC 의 신원 · 소지품도 로그아웃과 같은 한 벌로 지운다.
   ★ 로그아웃과 달리 올리기 · 검문을 하지 않는다 — 지울 계정에 올릴 까닭이 없고, DB 연결도 이미 끊었다.
   ★ 기기 세션(releaseDeviceSession)도 놓지 않는다 — users/{코드} 째로 서버가 지웠다.
   @return { ok, reason } — ok=false 면 이 PC 는 그대로다(서버는 지우다 멈췄을 수 있다 — 다시 누르면 이어서 지운다). */
async function _loginDoDeleteAccount(word){
  const api = window.firebaseAPI && firebaseAPI.accountDelete;
  if(!api) return { ok:false, reason:'탈퇴 기능을 불러오지 못했어요 — 앱을 다시 시작해 주세요' };
  const r = await api.run(word);
  if(!r || !r.ok) return r || { ok:false, reason:'탈퇴하지 못했어요' };
  _wipeAccountLocal();
  return r;
}

/* 🔐 [회원가입 설계 §7-C2·C3 · 개정 14 · 시안 확정] 계정 탭 — 로그인 수단 · 비밀번호 만들기(C3) · 바꾸기(C2).
   ★ 모드는 Auth 세션의 제공자(providerData)가 정한다 — 로컬 키가 아니라. 로그인 표시(LOGIN_EMAIL_KEY)는 «탭을 로그인 얼굴로» 만 정한다.
       비밀번호 있음 → C2(바꾸기 · 구글 없으면 경고 + [연결하기]) · 구글만 → C3(만들기) · 세션 없음 → 한 줄(«다시 시작하면 로그인 화면» — 그게 K) · 익명 → 숨김.
   ★ C3 아이디 = 이 계정의 친구 코드 — 계정 거울 → 이 기기 코드 순으로, **지금 friendCodes 가 내 uid 를 가리킬 때만.** 남의 코드로 `@tw.local` 을 만들지 않는다.
   ★ C2 는 지금 비밀번호를 묻지 않는다((가)) — 함수 `changePassword` 가 ID 토큰으로 본인을 확인한다. 바꾸면 이 PC 는 새 비밀번호로 곧바로 다시 로그인(firebase-init).
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
async function _acctPwCode(){
  const uid = getMyUserId();
  if(!uid) return { ok:false, reason:'이 PC의 계정을 확인하지 못했어요 — 앱을 다시 시작해 주세요' };
  if(!(window.firebaseAPI && firebaseAPI.lookupFriendCode)) return { ok:false, reason:'네트워크 연결이 필요해요' };
  const cands = [];
  try{ const m = firebaseAPI.getUserFriendCode ? await firebaseAPI.getUserFriendCode(uid) : null; if(m) cands.push(String(m)); }catch(_){}
  try{ const l = localStorage.getItem(MY_FRIEND_CODE_KEY); if(l && !cands.includes(l)) cands.push(String(l)); }catch(_){}
  let unread = false;
  for(const c of cands){
    if(!FRIEND_CODE_LOGIN_RE.test(c)) continue;
    let owner;
    try{ owner = await firebaseAPI.lookupFriendCode(c); }catch(_){ unread = true; continue; }
    if(owner === uid) return { ok:true, code:c };
  }
  return { ok:false, reason: unread ? '네트워크 오류 — 인터넷 연결을 확인해 주세요' : '내 친구 코드를 확인하지 못했어요 — 앱을 다시 시작한 뒤 다시 해 주세요' };
}
/* C3 — 링크 → (오래된 로그인이면) 구글 재인증 → 링크 한 번 더. 재인증은 세션을 바꾸지 않는다(authReauthGoogle). */
async function _acctCreatePassword(pw){
  if(!(window.firebaseAPI && firebaseAPI.authLinkPassword)) return { ok:false, reason:'이 버전에서는 비밀번호를 만들 수 없어요' };
  const c = await _acctPwCode();
  if(!c.ok) return c;
  const link = async ()=>{ try{ return await firebaseAPI.authLinkPassword(c.code, pw); }catch(_){ return { ok:false, reason:'네트워크 오류 — 인터넷 연결을 확인해 주세요' }; } };
  let r = await link();
  if(r && r.needReauth){
    if(!(window.companion && companion.signInWithGoogle) || !firebaseAPI.authReauthGoogle) return { ok:false, reason:'구글로 다시 확인할 수 없는 버전이에요 — 앱을 다시 시작한 뒤 해 주세요' };
    let g = null; try{ g = await companion.signInWithGoogle(); }catch(_){}
    if(!g || !g.ok) return { ok:false, canceled:!!(g && (g.canceled || !g.reason || g.reason === '로그인이 취소됐어요')), reason:(g && g.reason) || '' };
    let a = null; try{ a = await firebaseAPI.authReauthGoogle(g.idToken); }catch(_){}
    if(!a || !a.ok) return a || { ok:false, reason:'구글 확인에 실패했어요' };
    r = await link();
  }
  if(!r || !r.ok) return r || { ok:false, reason:'비밀번호를 만들지 못했어요' };
  return { ok:true, code:c.code };
}
/* C2 — 함수 한 번. 성공 뒤 다시 로그인은 firebase-init 이 한다(relogged). */
async function _acctChangePassword(pw){
  if(!(window.firebaseAPI && firebaseAPI.authChangePassword)) return { ok:false, reason:'이 버전에서는 비밀번호를 바꿀 수 없어요' };
  let r = null;
  try{ r = await firebaseAPI.authChangePassword(pw); }catch(_){ r = { ok:false, reason:'네트워크 오류 — 인터넷 연결을 확인해 주세요' }; }
  return r || { ok:false, reason:'비밀번호를 바꾸지 못했어요' };
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

/* 🔗 로그인한 계정에 코드 기록이 없을 때 이 기기 코드 — _applyTransferSnapshot 안 주석(개정 56) 참고. 돌려주는 것: 무엇을 했는지. */
function _adoptAccountFriendCode(r, opts){
  if(r && r.friendCode) return 'snapshot';
  let old = null; try{ old = localStorage.getItem(MY_FRIEND_CODE_KEY); }catch(_){}
  const typed = String((opts && opts.typedCode) || '').toUpperCase().trim();
  if(FRIEND_CODE_LOGIN_RE.test(typed)){
    if(old === typed) return 'typed';
    if(old) _rememberOldFriendCode(old);
    try{ localStorage.setItem(MY_FRIEND_CODE_KEY, typed); }catch(_){}
    return 'typed';
  }
  if(!old) return 'none';
  _rememberOldFriendCode(old);
  try{ localStorage.removeItem(MY_FRIEND_CODE_KEY); }catch(_){}
  console.info('[친추코드] 로그인한 계정에 코드 기록이 없어 이 기기 코드(' + old + ')를 내려놓았어요 — 다음 부팅에 계정 코드를 정해요');
  return 'cleared';
}
/* 📥 계정 스냅샷을 로컬 키에 복원 — fetchAccountSnapshot 결과(r · 옛 verifyTransfer 와 같은 모양)를 받아 레벨원본·이름·친추코드·라이선스 반영.
   userId는 위에서 이미 교체됨. 값이 없는 항목(구버전 등록분)은 건드리지 않아 기존 로컬 값 보존.
   ⚠️ [2026-09-20 · 제보 3-1] 예전엔 첫 줄이 `if(!r) return` 이었다 — 스냅샷이 null 이면 **소지품 복원까지
     통째로 건너뛰었다.** 스냅샷은 «이름·라이선스·친추코드·집중초» 고, 소지품(플레이리스트·가챠·슬롯)은
     `users/{uid}` 의 실시간 사본을 **직접 읽는** 별개의 것인데(아래 주석이 스스로 그렇게 적어 놓았다),
     호출만 스냅샷 존재에 묶여 있었다. 스냅샷은 첫 결속·비밀번호 등록 때만 쓰이므로, 그 이전 판에서
     묶인 계정이나 그때 쓰기가 실패한 계정은 스냅샷이 없다 → uid 는 갈아타는데 캐릭터·파츠·곡이 하나도
     안 따라왔다(회사↔집 제보). 부르는 쪽이 넷(로그인·연동·되찾기·부팅 게이트)이라 **여기서** 가른다:
     스냅샷 부분만 `if(r)` 안으로, 그 뒤 셋은 있든 없든 돈다. */
async function _applyTransferSnapshot(r, opts){
  if(!r) console.warn('[연동] 계정 스냅샷이 없습니다 — 이름·라이선스·친추코드는 못 받지만 소지품(캐릭터·파츠·곡)은 서버 사본에서 그대로 복원합니다');
  if(r){
  /* 🔑 [2026-09-15 제보 3] 키만 저장하고 isPremium 을 안 올리던 자리 — 재시작 전까지 내 전용 책상이 기본으로 보였다.
     loadLicenseFromStorage 와 같은 태도(로컬 키 = 일단 프리미엄, 재검증은 다음 부팅의 initLicense). */
  try{ if(r.license){ localStorage.setItem(acctStateMod.LICENSE_KEY_STORAGE, r.license); acctStateMod._setPremium(true); } }catch(_){}
  try{
    if(Number.isFinite(r.focusTotalSec) && r.focusTotalSec >= 0){
      /* 🕒 ★ 포커스 누적만은 **덮어쓰지 않는다 — max 다.**
         플레이리스트·가챠는 "저쪽 계정으로 갈아탄다"가 맞아서 덮어쓰지만(아래
         _restoreOwnedDataAfterTransfer), 이 값은 레벨의 원본이라 덮어쓰면 유저 눈에는
         그냥 레벨이 깎인 것으로 보인다. 그리고 max 는 멱등이라 두 번 세어질 걱정도 없다
         (예전 증분 방식에서 마크를 손으로 맞춰야 했던 이유가 통째로 사라진다).
         ⚠️ 대가: 연동 전 이 기기에 쌓여 있던 시간이 연동해 온 계정으로 합쳐진다.
            "기록은 항상 큰 쪽을 따라간다"는 요청의 직접적인 귀결이다. */
      const _merged = Math.max(Number(_focusTotalSec())||0, r.focusTotalSec);
      localStorage.setItem(FOCUS_TOTAL_KEY(), String(_merged));
      /* 🕒 마크도 합친 값으로 맞춘다 — 안 맞추면 "이 기기의 옛 누적치 − 옛 마크"가 증분으로
         잡혀서, 연동해 온 계정에 이 기기 시간이 통째로 한 번 더 더해진다.
         마크 = 로컬이면 증분 0 이고, 아래 즉시 동기화는 max 바닥만 태운다(= 서버가 더 크면
         그 값을 받아오고, 이 기기가 더 크면 서버를 끌어올린다). */
      localStorage.setItem(focusLevelMod().FOCUS_SYNCED_KEY, String(_merged));
      /* 메모리 값도 같이 맞춘다 — 즉시 동기화가 localStorage 가 아니라 이 값을 본다. */
      setFocusTotalSec(_merged);
    }
  }catch(_){}
  try{ if(r.name) localStorage.setItem(USER_NAME_KEY, r.name); }catch(_){}
  try{
    if(r.friendCode){
      // 🔗 스냅샷 코드로 덮기 전에, 이 기기가 쓰던 코드를 적어둔다(진단용 기록 — getOldFriendCodes).
      let old = null; try{ old = localStorage.getItem(MY_FRIEND_CODE_KEY); }catch(_){}
      if(old && old !== r.friendCode) _rememberOldFriendCode(old);
      localStorage.setItem(MY_FRIEND_CODE_KEY, r.friendCode);
    }
  }catch(_){}
  }   // ← 여기까지가 스냅샷이 있어야만 할 수 있는 일. 아래 셋은 스냅샷과 무관하다(제보 3-1).
  /* 🔗 계정에 코드 기록이 없을 때(스냅샷에도 거울 users/{uid}/friendCode 에도 없음 — fetchAccountSnapshot 이 둘 다 본다).
     [개정 56 · 사용자 확정 (가)] 그대로 두면 이 기기가 쓰던 코드(= 이전 uid, 곧 **다른 계정**의 코드)가 이 계정의 아이디처럼 보인다.
       예전엔 _claimFriendCodeAfterTransfer 가 그 코드의 주인을 새 uid 로 **강제로** 바꿔 가렸다 — 남의 아이디를 빼앗는 길이라 걷었다.
     · 친구 코드로 로그인 → **입력한 코드**(비밀번호로 확인된 이 계정의 아이디).
     · 그 밖(구글) → 로컬 코드를 **지운다.** 다음 부팅에 ensureMyFriendCode 가 거울을 먼저 보고(_friendCodeMirrorFix),
       거울도 없으면 이 계정의 **첫** 코드를 뽑는다 — 계정엔 코드가 없었으니 재발급 금지(§1-8)에 걸리지 않는다.
     ★ 소유권(friendCodes)은 어느 갈래에서도 쓰지 않는다. 지운 코드는 진단 기록에 남는다. */
  _adoptAccountFriendCode(r, opts);
  /* 🎵🎰 플레이리스트·가챠 보유분을 연동한 계정 것으로 맞춘다.
     [경위] 스냅샷(setTransferHash)에는 집중초·이름·친추코드·라이선스만 담겨 있어서,
       연동해도 플레이리스트와 뽑은 파츠는 이 기기의 옛 로컬 값 그대로였다(제보).
     ★ 스냅샷에 더 담지 않고 **서버 사본을 직접 읽는다** — 둘 다 users/{uid} 아래에 이미
       실시간 사본이 있고(.read:true), 스냅샷은 '비밀번호 등록 시점'에 굳은 값이라
       그 뒤에 추가한 곡·뽑은 파츠를 놓친다. */
  await _restoreOwnedDataAfterTransfer();
  /* 🕒 연동 직후 즉시 서버와 맞춘다 — 다른 기기에서 쌓인 기록을 이 자리에서 내려받는다.
     예전엔 동기화가 도는 시점이 부팅 4초 후와 런처 복귀뿐이라, 연동을 마쳐도 레벨이 곧바로
     고쳐지지 않았다("집에서 30이었는데 회사에서 26" 제보의 체감 부분).
     ★ 이 시점엔 마크 == 로컬 누적이라 증분이 0이다 — 올리는 건 없고 서버 값을 받아오기만 한다.
       (위에서 _focusTotalSec을 스냅샷 값으로 맞춰뒀기 때문. 그 줄과 짝이다) */
  try{ if(typeof focusLevelMod().syncFocusTotalToServer==='function') await focusLevelMod().syncFocusTotalToServer('transfer'); }catch(_){}
  /* 🌟 회차 별 색 — 로그아웃이 지웠으니 이 계정 프로필의 starC 를 받아 온다(개정 71). */
  try{ await focusLevelMod()._adoptStarColorFromProfile(); }catch(_){}
}
/* 🎵🎰 연동 직후 — 플레이리스트와 가챠 보유분을 새 uid 기준으로 되맞춘다.
   호출 시점에 localStorage 의 유저 ID 는 이미 새 계정으로 갈려 있다(getMyUserId()가 새 값).

   [정책이 서로 다른 이유]
     · 플레이리스트 = **덮어쓰기**. 순서가 있는 목록이라 합치면 남의 순서와 뒤섞이고 상한(PL_MAX)도
       금방 넘는다. 연동은 "저쪽 계정으로 갈아탄다"는 뜻이므로 저쪽 목록이 정답이다.
       ★ 단, 저쪽이 비어 있으면 이 기기 목록을 그대로 두고 **올려준다** — 서버 사본이 아직 없는
         계정(파도타기용 공개를 한 번도 안 한 계정)에서 목록이 증발하는 사고를 막는다.
     · 가챠 = **저쪽 계정 것을 그대로 받는다**(pull). 평소 동기화는 ts 로 최신 기기가 이기지만,
       연동은 "저쪽 계정으로 갈아탄다"는 뜻이라 이 기기가 더 최신이어도 그 계정 것이 정답이다.
       ★ 단, 저쪽 서버가 비어 있으면(한 번도 동기화 안 된 계정) 로컬을 지우지 않고 그대로 올린다 —
         규칙 파일에 gacha 블록이 없던 시절 로컬에만 쌓인 사람의 파츠가 증발하는 사고를 막는다.

   ⚠️ 실패해도 조용히 넘어간다 — 여기서 예외가 새면 연동 자체가 실패한 것처럼 보인다.
      (연동의 본체인 uid 교체는 이미 끝났고, 서버 사본은 다음 부팅 동기화에서도 다시 만난다) */
async function _restoreOwnedDataAfterTransfer(){
  const uid = getMyUserId();
  // ── 🎵 플레이리스트 — 상태는 playlist.js 안에 있다. pl(상태 묶음)로 읽고 쓴다(앱 FSD 16번).
  try{
    const pl = plMod.st;
    /* ★ [2026-09-16 제보 4] **세 벌 전부** 받는다(fetchMyPlaylistSets). 예전엔 fetchPlaylistOf 로 한 벌만
       받아 «지금 고른 프리셋» 에 앉혔는데, 그 함수는 파도타기용이라 벌을 **무작위로** 골랐고
       나머지 두 벌은 이 기기의 옛 값이 그대로 남았다. 로그아웃이 로컬 목록을 지우게 된 지금은
       세 벌을 다 받아야 «돌아오면 그대로» 가 성립한다.
       ⚠️ 구버전 firebaseAPI(fetchMyPlaylistSets 없음)에서는 예전 길(fetchPlaylistOf)로 물러난다. */
    if(window.firebaseAPI && firebaseAPI.fetchMyPlaylistSets){
      const r = await firebaseAPI.fetchMyPlaylistSets(uid);   // {sets,bio,homePublic} | null
      const total = r && Array.isArray(r.sets) ? r.sets.reduce((n, s) => n + ((s && s.items) ? s.items.length : 0), 0) : 0;
      if(total){
        /* 서버 항목은 {id, title} 뿐이다 — url 은 _plNormalizeSets 가 id 로 복원한다(부팅 로드와 같은 관문). */
        pl.sets = plMod.normalizeSets(r.sets);
        pl.cur = plMod.setIdx(pl.cur);
        pl.bio = String(r.bio || '').slice(0, plMod.PL_BIO_MAX);
        pl.homePublic = !!r.homePublic;
        pl.sel = -1; pl.now = -1; pl.nowSet = pl.cur; pl.view = null; pl.nowView = null;
        try{ plMod.save(); }catch(_){}
        /* 방금 받아온 것 = 서버와 같은 내용. 지문을 미리 맞춰 _plPublish 의 헛쓰기를 막는다(모양은 _plPublish 와 같다). */
        pl.pubSig = plMod.pubSigOf(pl.sets.map(ps => ({
          name: String((ps && ps.name) || '').slice(0, plMod.PL_TITLE_MAX),
          items: (((ps && ps.items) || [])).map(x => ({ id:x.id, title:x.title || '' })),
        })), { bio: pl.bio, homePublic: pl.homePublic, private: pl.private });
        if(typeof plMod.render === 'function') plMod.render();
      } else if(pl.sets.some(ps => ps && ps.items && ps.items.length)){
        // 저쪽 계정에 사본이 없다 — 이 기기 목록을 새 uid 로 올려서 다음 기기에서도 보이게 한다.
        pl.pubSig = null;
        if(typeof plMod.publish === 'function') plMod.publish();
      }
    } else if(window.firebaseAPI && firebaseAPI.fetchPlaylistOf){
      const r = await firebaseAPI.fetchPlaylistOf(uid);   // 비어 있으면 null
      if(r && r.items && r.items.length){
        const items = r.items.filter(x => x && x.id).slice(0, plMod.PL_MAX).map(x => ({
          id: x.id,
          url: 'https://www.youtube.com/watch?v=' + x.id,
          title: String(x.title || '').slice(0, 60)
        }));
        pl.sets[pl.cur].items = items;
        pl.sel = -1; pl.now = -1; pl.nowSet = pl.cur; pl.view = null; pl.nowView = null;
        try{ plMod.save(); }catch(_){}
        pl.pubSig = plMod.pubSigOf(pl.sets.map(ps => ({
          name: String((ps && ps.name) || '').slice(0, plMod.PL_TITLE_MAX),
          items: (((ps && ps.items) || [])).map(x => ({ id:x.id, title:x.title || '' })),
        })), { bio: pl.bio, homePublic: pl.homePublic, private: pl.private });
        if(typeof plMod.render === 'function') plMod.render();
      } else if(plMod.mine().length){
        pl.pubSig = null;
        if(typeof plMod.publish === 'function') plMod.publish();
      }
    }
  }catch(e){ console.warn('[연동] 플레이리스트 복원 실패', e); }
  // ── 🎰 가챠 보유분 — 연동은 '저쪽 계정 것을 받아온다'가 맞으므로 ts 를 보지 않고 무조건 내려받는다.
  //    (평소 동기화는 최신 기기가 이기는 ts 비교지만, 연동만은 이 기기가 더 최신이어도 저쪽이 정답이다)
  try{
    await gachaMod().syncGachaToServer('transfer', 'pull');
    if(gachaMod().isInvOpen()) gachaMod().renderGachaInv();
  }catch(e){ console.warn('[연동] 가챠 복원 실패', e); }
  // ── 🧍 캐릭터 슬롯 [2026-09-16 제보 6-b] — 가챠와 같은 규칙: 저쪽 계정 것을 ts 안 보고 pull,
  //    저쪽이 비어 있으면 이 기기 것을 push(로컬에만 캐릭터가 있던 사람의 첫 업로드).
  //    ★ 파츠(가챠) 다음에 온다 — 받은 캐릭터가 입은 파츠의 보유분이 먼저 맞춰져 있어야 한다.
  try{
    if(typeof slotSyncMod().syncSlotsToServer === 'function') await slotSyncMod().syncSlotsToServer('transfer', 'pull');
    /* 🧬 켜져 있으면 캐릭터 단위도 — 로그아웃이 보관함 키를 지웠으므로 이 계정으로 첫 채택부터 다시 한다(개정 36). */
    if(typeof charsMod()._charsBoot === 'function' && typeof charsMod().CHARS_SYNC_ENABLED !== 'undefined' && charsMod().CHARS_SYNC_ENABLED) await charsMod()._charsBoot('transfer');
  }catch(e){ console.warn('[연동] 캐릭터 복원 실패', e); }
}
/* (걷음 · 개정 56) _claimFriendCodeAfterTransfer — 로그인 직후 로컬 코드의 주인을 새 uid 로 강제로 바꾸던 것. 남의 계정 코드를 가져가는 길이라
   걷었다(설계 §6 «남는 것» · 소유권 쪽). 대신 _adoptAccountFriendCode 가 **로컬 표시만** 계정 것으로 맞춘다. */

return {
  CHARS_LINKED_KEY,
  _applyTransferSnapshot,
  _loginDoFriendCode,
  _loginDoGoogle,
  _loginDoLogout,
  _loginDoDeleteAccount,
  _loginLocalSnapshot,
  refreshAccountTab,
};
}

const api = { createAccount };
if(typeof window !== 'undefined') window.TwAccount = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

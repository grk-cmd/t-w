/* license-gate.js — 🎟️ 초대장 — 앱 접근 제한(초대 게이트 · 라이선스 키 · 기존 가입 확인)
   app.js «🎟️ 초대장 (앱 접근 제한)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 31번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다. 같은 구역 초대 창 묶기 안에 있던 관리자 📊 통계 · 🎟️ 초대권 지급 모듈 만드는 줄은 app.js(이 모듈 만드는 줄 바로 뒤)로 뺐다. 여러 모듈이 읽는 isPremium(프리미엄 여부)은 app.js 에 남겼다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 20줄 —
     FRIEND_CODE_LOGIN_RE · LOGIN_EMAIL_KEY · LOGIN_UID_KEY · awayPicMod · creatorOpen · isAdmin · userStatus 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 19개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 저장 키 셋 · 초대 통과 표시 · 프리미엄 깃발 바꾸기(_setPremium)는 계정 핵심 상태(account-state.js)로 옮겼다(모듈 순환 끊기 5) — 이 모듈은 deps 로 받고, 프리미엄이 바뀌면 다시 그리기를 onPremiumChanged 로 건다.
   ★ 밖에서 부르는 이름: INVITE_GRANT_MAX · INVITE_PASS_KEY · LICENSE_KEY_STORAGE · LICENSE_OPTOUT_KEY · _existingSignupCheck · _genLicenseKey · _licenseSnapForPush · _markInvitePassed · _needLoginCheck · _setPremium · activateLicense · checkInviteGate · deactivateLicense · loadLicenseFromStorage · refreshInviteBtn · verifyLicense — app.js 는 licenseGateMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwLicenseGate — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-license-gate.js */
(function(){

function createLicenseGate(deps){
const DEFAULT_DESK_OVERRIDE_ID = deps.DEFAULT_DESK_OVERRIDE_ID;
const FRIEND_CODE_LOGIN_RE = deps.FRIEND_CODE_LOGIN_RE;   // 읽는 함수
const HAD_USER_ID_AT_BOOT = deps.HAD_USER_ID_AT_BOOT;
const LOGIN_EMAIL_KEY = deps.LOGIN_EMAIL_KEY;   // 읽는 함수
const LOGIN_UID_KEY = deps.LOGIN_UID_KEY;   // 읽는 함수
const MY_FRIEND_CODE_KEY = deps.MY_FRIEND_CODE_KEY;
const _applyTransferSnapshot = deps._applyTransferSnapshot;
const _inventMyUserId = deps._inventMyUserId;
const _loginDoFriendCode = deps._loginDoFriendCode;
const _loginDoGoogle = deps._loginDoGoogle;
const _loginLocalSnapshot = deps._loginLocalSnapshot;
const _setMyUserId = deps._setMyUserId;
const applyDeskCatalogRefToSeat = deps.applyDeskCatalogRefToSeat;
const applyDeskItemsTo = deps.applyDeskItemsTo;
const awayPicMod = deps.awayPicMod;   // 읽는 함수
const creatorOpen = deps.creatorOpen;   // 읽는 함수
const genFriendCodeCandidate = deps.genFriendCodeCandidate;
const getMyLoginEmail = deps.getMyLoginEmail;
const getMyUserId = deps.getMyUserId;
const isAdmin = deps.isAdmin;   // 읽는 함수
const pruneUnownedLicenseAssets = deps.pruneUnownedLicenseAssets;
const refreshAccountTab = deps.refreshAccountTab;
const refreshCustomStatusMenuItem = deps.refreshCustomStatusMenuItem;
const refreshLicenseUI = deps.refreshLicenseUI;
const renderCrItems = deps.renderCrItems;
const restoreLicenseHeldAssets = deps.restoreLicenseHeldAssets;
const seats = deps.seats;
const setUserStatus = deps.setUserStatus;
const toast = deps.toast;
const userStatus = deps.userStatus;   // 읽는 함수
const INVITE_PASS_KEY = deps.INVITE_PASS_KEY;   // 🪪 계정 핵심 상태(account-state.js) — 저장 키 · 초대 통과 · 프리미엄
const LICENSE_KEY_STORAGE = deps.LICENSE_KEY_STORAGE;
const LICENSE_OPTOUT_KEY = deps.LICENSE_OPTOUT_KEY;
const _markInvitePassed = deps._markInvitePassed;
const _setPremium = deps._setPremium;
const onPremiumChanged = deps.onPremiumChanged;
const _acctRelaunchAfterDetach = deps._acctRelaunchAfterDetach;
const _rcStore = deps._rcStore;   // 원격 설정 한 벌(account-state.js)
function inviteGateOn(){ const s = _rcStore(); return s ? s.inviteGate() : true; }
/* 🎟️ [회원가입 설계 §3 · 개정 8] 초대 코드를 소진한 **기기 토큰** — uid 대신 invites/{code}.usedBy 에 들어간다.
   값 {code, token}. uid 가 정해지면 finishInviteSignup 이 usedBy 를 uid 로 바꾸고 이 키를 지운다.
   ★ 못 바꿨으면 남겨 둔다 — 다음 부팅의 checkInviteGate 가 다시 부른다(_inviteFinishPending). */
const INVITE_TOKEN_KEY = 'tw.inviteToken';
function _inviteTokenLoad(){
  try{ const v = JSON.parse(localStorage.getItem(INVITE_TOKEN_KEY) || 'null'); return (v && v.code && v.token) ? v : null; }catch(_){ return null; }
}
function _inviteTokenFor(code){
  const cur = _inviteTokenLoad();
  if(cur && cur.code === code) return cur.token;   // 같은 코드의 재시도 — 같은 토큰(usedBy===token 이면 통과)
  const a = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let t = 't'; for(let i=0;i<16;i++) t += a[Math.floor(Math.random()*a.length)];
  try{ localStorage.setItem(INVITE_TOKEN_KEY, JSON.stringify({ code, token:t })); }catch(_){}
  return t;
}
/* 토큰을 uid 로 바꾸는 마무리. uid 가 없으면 아무것도 안 한다. 성공하면 토큰 키를 지운다. */
async function _inviteFinishPending(){
  const tk = _inviteTokenLoad(); const uid = getMyUserId();
  if(!tk || !uid) return false;
  if(!(window.firebaseAPI && firebaseAPI.finishInviteSignup)) return false;
  try{
    const r = await firebaseAPI.finishInviteSignup(tk.code, tk.token, uid);
    if(r && r.ok){ try{ localStorage.removeItem(INVITE_TOKEN_KEY); }catch(_){} return true; }
  }catch(_){}
  return false;
}
const INVITE_GRANDFATHER_COUNT = 2;         // 🎟️ 일괄 2장 정책 — 기존유저 grandfather도 신규 초대 유저도 2장.
                                            //   0장이 돼도 재지급 없음: 지급 경로(grandfather/self-heal)는 전부
                                            //   "invite 노드가 아예 없을 때"만 발동하고, 0장은 노드가 있는 상태라 안 걸림.
const INVITE_GRANT_MAX = 3;                 // 관리자가 한 번에 지급할 수 있는 최대 초대권 수

function _genInviteCode(){
  const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // 헷갈리는 0/O, 1/I 제외
  const seg = n => Array.from({length:n}, ()=>a[Math.floor(Math.random()*a.length)]).join('');
  return `INVT-${seg(4)}-${seg(4)}`;
}

/* ✍️ [회원가입 설계 §3 A · 개정 10] 가입 도중 상태 — {uid, code}. 이 키가 있는 동안 게이트는 A 로 곧장 연다.
   ★ 새로 뽑지 않고 **같은 uid·코드로** 이어 간다 — 새로 뽑으면 선점된 코드가 주인 없이 남는다(§3 갈래 메모).
   ★ 익명 Auth 세션도 남아 있으므로(browserLocalPersistence) 다음 시도가 같은 authUid 로 온다.
   가입이 끝나면(_signupFinishLocal) 지운다. */
const SIGNUP_PENDING_KEY = 'tw.signupPending';
function _signupPendingLoad(){
  try{
    const v = JSON.parse(localStorage.getItem(SIGNUP_PENDING_KEY) || 'null');
    return (v && typeof v.uid === 'string' && /^u[0-9a-z]{8,40}$/i.test(v.uid) && typeof v.code === 'string' && v.code) ? v : null;
  }catch(_){ return null; }
}
function _signupPendingSave(p){ try{ localStorage.setItem(SIGNUP_PENDING_KEY, JSON.stringify({ uid:p.uid, code:p.code })); }catch(_){} }
/* uid 발명(② · _inventMyUserId 를 부르는 **유일한** 자리)과 친구 코드 후보를 한 번에 — 이미 있으면 그대로. */
function _signupPendingEnsure(){
  const had = _signupPendingLoad();
  if(had) return had;
  const p = { uid:_inventMyUserId(), code:genFriendCodeCandidate() };
  _signupPendingSave(p);
  return p;
}
/* ③ 친구 코드 선점 — 보여 준 코드를 먼저 시도하고, 그 사이 누가 가져갔으면 새 후보로(최대 8번). 바뀌면 상태에도 적는다. */
async function _signupClaimCode(p, persist){
  const keep = persist !== false;   // I(기존 사용자)는 가입 상태 키를 쓰지 않는다
  if(!(window.firebaseAPI && firebaseAPI.registerFriendCode)) return { ok:false, reason:'네트워크 연결이 필요해요' };
  const first = p.code;
  for(let i=0;i<8;i++){
    let ok = false;
    try{ ok = await firebaseAPI.registerFriendCode(p.code, p.uid); }
    catch(_){ return { ok:false, reason:'네트워크 오류 — 인터넷 연결을 확인해 주세요' }; }
    if(ok) return { ok:true, code:p.code, changed:p.code !== first };
    p.code = genFriendCodeCandidate();
    if(keep) _signupPendingSave(p);
  }
  return { ok:false, reason:'친구 코드를 정하지 못했어요 — 다시 시도해 주세요' };
}
/* 가입 끝 — 이 기기에 적는다. uid 기록은 _setMyUserId 하나로. 거울(users/{uid}/friendCode)은 ⑥ 거울 정정의 근거라 여기서 남긴다. */
async function _signupFinishLocal(p, email, authUid){
  if(!_setMyUserId(p.uid)) return { ok:false, reason:'이 기기에 저장하지 못했어요 — 다시 시도해 주세요' };
  try{
    localStorage.setItem(MY_FRIEND_CODE_KEY, p.code);
    localStorage.setItem(LOGIN_EMAIL_KEY(), email || '');
    localStorage.setItem(LOGIN_UID_KEY(), authUid || '');
  }catch(_){}
  try{ if(firebaseAPI.setUserFriendCode) await firebaseAPI.setUserFriendCode(p.uid, p.code); }catch(_){}
  await _inviteFinishPending();   // 초대 토큰 → uid (못 하면 토큰이 남아 다음 부팅에 다시)
  _markInvitePassed();
  try{ localStorage.removeItem(SIGNUP_PENDING_KEY); }catch(_){}
  return { ok:true, code:p.code };
}
/* 친구 코드 + 비밀번호 가입 — 익명 → ② → ③ → ④ → ⑤ (설계 §3 · §9-6 (a)). 어느 단계에서 끊겨도 다시 누르면 이어 간다. */
async function _signupDoPassword(password){
  if(!(window.firebaseAPI && firebaseAPI.authSignupEnsure)) return { ok:false, reason:'네트워크 연결이 필요해요' };
  const p = _signupPendingEnsure();
  const a = await firebaseAPI.authSignupEnsure(p.code.toLowerCase() + '@tw.local');
  if(!a || !a.ok) return a || { ok:false, reason:'가입을 시작하지 못했어요' };
  const c = await _signupClaimCode(p);
  if(!c.ok) return c;
  const l = await firebaseAPI.authSignupLinkPassword(p.code, password);
  if(!l || !l.ok){
    /* Auth 에 같은 코드의 계정이 이미 있다 — friendCodes 와 어긋난 판. 새 후보로 바꿔 두고 다시 누르게 한다. */
    if(l && l.taken){ p.code = genFriendCodeCandidate(); _signupPendingSave(p); return { ok:false, codeChanged:true, reason:'이 코드는 쓸 수 없어서 새 코드로 바꿨어요 — [가입하기]를 한 번 더 눌러 주세요' }; }
    return l || { ok:false, reason:'계정을 만들지 못했어요' };
  }
  const b = await firebaseAPI.authSignupBind(p.uid);
  if(!b || !b.ok) return b || { ok:false, reason:'계정 연결에 실패했어요' };
  const f = await _signupFinishLocal(p, l.email, b.authUid);
  return f.ok ? { ok:true, code:p.code, changed:c.changed } : f;
}
/* 구글로 가입 — 구글 → ⑤(authSignInWithGoogle 이 이 uid 를 결속) → ③ (④ 없음 · 비밀번호는 나중에 계정 탭에서).
   ★ 그 구글 계정이 **이미 가입돼 있으면** 새로 만들지 않고 그 계정으로 들어간다(existing) — 발명한 uid 는 버린다. */
async function _signupDoGoogle(){
  if(!(window.companion && companion.signInWithGoogle)) return { ok:false, reason:'이 버전에서는 구글 로그인을 쓸 수 없어요 (앱 업데이트가 필요해요)' };
  if(!(window.firebaseAPI && firebaseAPI.authSignInWithGoogle)) return { ok:false, reason:'네트워크 연결이 필요해요' };
  let g;
  try{ g = await companion.signInWithGoogle(); }catch(_){ return { ok:false, reason:'로그인 창을 열지 못했어요' }; }
  if(!g || !g.ok) return { ok:false, canceled:!!(g && (g.canceled || !g.reason || g.reason === '로그인이 취소됐어요')), reason:(g && g.reason) || '' };
  const p = _signupPendingEnsure();
  const r = await firebaseAPI.authSignInWithGoogle(g.idToken, p.uid);
  if(!r || !r.ok) return { ok:false, reason:(r && r.reason) || '구글 가입에 실패했어요' };
  if(r.userCode !== p.uid){
    if(!_setMyUserId(r.userCode)) return { ok:false, reason:'이 기기에 저장하지 못했어요 — 다시 시도해 주세요' };
    try{ localStorage.setItem(LOGIN_EMAIL_KEY(), r.email || ''); localStorage.setItem(LOGIN_UID_KEY(), r.uid || ''); }catch(_){}
    try{ await _applyTransferSnapshot(await firebaseAPI.fetchAccountSnapshot(r.userCode)); }catch(e){ console.warn('[가입] 기존 계정 복원 중 오류', e); }
    await _inviteFinishPending();
    _markInvitePassed();
    try{ localStorage.removeItem(SIGNUP_PENDING_KEY); }catch(_){}
    return { ok:true, existing:true };
  }
  const c = await _signupClaimCode(p);
  if(!c.ok) return c;
  const f = await _signupFinishLocal(p, r.email, r.uid);
  return f.ok ? { ok:true, code:p.code, changed:c.changed } : f;
}

/* 🪪 [회원가입 설계 §3 I · §7-I · 개정 11] 기존 사용자 가입 — 로그인 안 하고 쓰던 사람(이 PC 에 uid 가 있고 그 uid 가 **아무 계정에도 안 묶임**).
   부팅 때 초대 게이트를 지난 뒤 한 번 본다. 닫기 없음. **uid 는 그대로** — 지금 친구 코드가 아이디, 비밀번호만 정한다.
   ★ 켜고 끄는 스위치 — 끄면 옛날처럼 로그인 없이 쓴다(로그인 필수는 설계 결정 7 · N+2 규칙 잠금의 전제).
   ★ 오프라인이면(userAuth 를 못 읽으면) 이번 부팅엔 안 띄운다 — 다음 온라인 부팅에 다시(§3).
   ★ 그 uid 가 **다른 계정에 묶여 있으면** I 가 아니다 — 가입하면 결속에서 거절된다. 그 판(다른 PC 에서 구글로 묶고 여기선 로그인 안 함)은
     «이 PC 는 로그인이 필요해요» 쪽 일이라 여기서 다루지 않는다. */
/* 스위치는 원격 설정 flags.existingSignup(API · 없으면 true) — 초대 게이트와 같이 부팅 때 첫 답을 기다려 한 번 정한다. */
function existingSignupOn(){ const s = _rcStore(); return s ? s.existingSignup() : true; }
/* 이 uid 의 아이디가 될 친구 코드 — 이 기기 코드가 내 것이면 그것, 아니면 계정 거울(users/{uid}/friendCode)이 내 것이면 그것.
   돌려주는 것: { code, mine:true } · { code:후보, mine:false }(내 코드가 없다 — [가입하기] 때 선점) · undefined(못 읽음 · 이번엔 쉰다). */
async function _existingSignupCode(uid){
  const owned = async c => {
    if(!c) return false;
    try{ return (await firebaseAPI.lookupFriendCode(c)) === uid; }catch(_){ return undefined; }
  };
  let local = null; try{ local = localStorage.getItem(MY_FRIEND_CODE_KEY); }catch(_){}
  const a = await owned(local);
  if(a === undefined) return undefined;
  if(a) return { code:local, mine:true };
  let mirror = null;
  try{ mirror = firebaseAPI.getUserFriendCode ? await firebaseAPI.getUserFriendCode(uid) : null; }catch(_){ mirror = null; }
  if(mirror && mirror !== local){
    const b = await owned(mirror);
    if(b === undefined) return undefined;
    if(b) return { code:mirror, mine:true };
  }
  return { code:genFriendCodeCandidate(), mine:false };
}
/* 띄울지 판정 — { uid, code, mine } 이면 띄운다 · null 이면 안 띄운다. */
async function _existingSignupNeed(){
  if(!existingSignupOn()) return null;
  const uid = getMyUserId();
  if(!uid) return null;
  if(!(window.firebaseAPI && firebaseAPI.authOwnerOf && firebaseAPI.lookupFriendCode)) return null;
  try{ if(firebaseAPI.authReady) await firebaseAPI.authReady(); }catch(_){}
  const owner = await firebaseAPI.authOwnerOf(uid);
  if(owner === undefined) return null;   // 못 읽음 — 오프라인 · 다음 부팅에
  if(owner) return null;                 // 이미 어떤 계정에 묶였다 — I 가 아니다
  const c = await _existingSignupCode(uid);
  if(!c) return null;
  return { uid, code:c.code, mine:c.mine };
}
/* 비밀번호 가입 — 익명 → (코드가 내 것이 아니면 ③) → ④ → ⑤(이 uid). uid 를 바꾸지 않으므로 재시작도 없다. */
async function _existingSignupDoPassword(st, password){
  if(!(window.firebaseAPI && firebaseAPI.authSignupEnsure)) return { ok:false, reason:'네트워크 연결이 필요해요' };
  const a = await firebaseAPI.authSignupEnsure(st.code.toLowerCase() + '@tw.local');
  if(!a || !a.ok) return a || { ok:false, reason:'가입을 시작하지 못했어요' };
  let changed = false;
  if(!st.mine){
    const c = await _signupClaimCode(st, false);   // 이 사람의 가입 상태는 없다 — tw.signupPending 에 적지 않는다
    if(!c.ok) return c;
    changed = c.changed; st.mine = true;
  }
  const l = await firebaseAPI.authSignupLinkPassword(st.code, password);
  if(!l || !l.ok) return l || { ok:false, reason:'계정을 만들지 못했어요' };
  const b = await firebaseAPI.authSignupBind(st.uid);
  if(!b || !b.ok) return b || { ok:false, reason:'계정 연결에 실패했어요' };
  try{
    localStorage.setItem(MY_FRIEND_CODE_KEY, st.code);
    localStorage.setItem(LOGIN_EMAIL_KEY(), l.email || '');
    localStorage.setItem(LOGIN_UID_KEY(), b.authUid || '');
  }catch(_){}
  try{ if(firebaseAPI.setUserFriendCode) await firebaseAPI.setUserFriendCode(st.uid, st.code); }catch(_){}
  /* 구글 첫 결속과 같은 일 — 다른 PC 가 이 계정으로 들어올 때 받을 스냅샷(레벨원본·이름·코드·라이선스)을 남긴다. */
  try{ if(firebaseAPI.setAccountSnapshot) await firebaseAPI.setAccountSnapshot(st.uid, _loginLocalSnapshot()); }catch(_){}
  return { ok:true, code:st.code, changed };
}
/* 부팅 때 한 번 — 초대 게이트를 지난 뒤(initInviteGate). 띄우면 끝날 때까지 기다린다. */
async function _existingSignupCheck(){
  let st = null;
  try{ st = await _existingSignupNeed(); }catch(e){ console.warn('[가입 안내] 판정 실패 — 이번엔 넘어간다', e); return false; }
  if(!st) return false;
  return await _showExistingSignup(st);
}
function _showExistingSignup(st){
  return new Promise(resolve=>{
    const ov = document.getElementById('existingSignupOverlay');
    if(!ov){ resolve(false); return; }
    const codeEl = document.getElementById('exSignupCode');
    const pw1 = document.getElementById('exSignupPw'), pw2 = document.getElementById('exSignupPw2');
    const okB = document.getElementById('exSignupOk'), gB = document.getElementById('exSignupGoogleBtn');
    const sm = document.getElementById('exSignupMsg');
    const say = (t, isErr)=>{ if(!sm) return; sm.textContent = t || ''; sm.style.color = isErr ? 'var(--win-error)' : 'var(--ink-soft)'; sm.style.display = t ? 'block' : 'none'; };
    const busy = on => { if(okB) okB.disabled = on; if(gB) gB.disabled = on; };
    if(codeEl) codeEl.textContent = st.code;
    ov.style.display = 'flex';
    setTimeout(()=>{ if(pw1) pw1.focus(); }, 50);
    const close = ()=>{
      ov.style.display = 'none';
      try{ refreshAccountTab(); }catch(_){}
      resolve(true);
    };
    const goPw = async ()=>{
      const a = String((pw1 && pw1.value) || ''), b = String((pw2 && pw2.value) || '');
      if(a.length < 6){ say('비밀번호는 6자 이상으로 정해 주세요', true); if(pw1) pw1.focus(); return; }
      if(a !== b){ say('비밀번호가 서로 달라요.', true); if(pw2) pw2.focus(); return; }
      busy(true); say('가입하는 중…', false);
      let r = null;
      try{ r = await _existingSignupDoPassword(st, a); }catch(_){ r = { ok:false, reason:'네트워크 오류 — 인터넷 연결을 확인해 주세요' }; }
      if(codeEl) codeEl.textContent = st.code;
      if(!r || !r.ok){ say((r && r.reason) || '가입하지 못했어요 — 다시 시도해 주세요', true); busy(false); return; }
      /* 🎉 J — uid 가 그대로라 [시작하기] 는 닫기만 한다(재시작 없음). 뒤의 앱이 보이게 반투명. */
      say('', false);
      if(pw1) pw1.disabled = true; if(pw2) pw2.disabled = true;
      ov.style.display = 'none';
      await _showSignupDone({ code:r.code, google:false, changed:!!r.changed, dim:true });
      _hideSignupDone();
      close();
    };
    const goG = async ()=>{
      busy(true); say('구글 창을 여는 중…', false);
      let r = null;
      try{ r = await _loginDoGoogle(); }catch(_){ r = { ok:false, reason:'네트워크 오류 — 인터넷 연결을 확인해 주세요' }; }
      if(!r || !r.ok){ say((r && !r.canceled && r.reason) || '', true); busy(false); return; }
      if(!r.switched){ say('✅ 구글 계정에 연결됐어요.', false); setTimeout(close, 1200); return; }
      /* 그 구글이 이미 다른 uid 의 계정이었다 — _loginDoGoogle 이 그쪽으로 갈아탔다(옛 결론 그대로 · «다름» 조각에서 다시 본다). */
      say('✅ 이미 가입된 구글 계정이에요 — 그 계정으로 다시 시작하는 중이에요…', false);
      _acctRelaunchAfterDetach(()=> say('✅ 이미 가입된 구글 계정이에요. 앱을 완전히 종료했다가 다시 실행해 주세요.', false));
    };
    if(okB) okB.onclick = goPw;
    if(gB) gB.onclick = goG;
    if(pw1) pw1.onkeydown = e=>{ if(e.key==='Enter'){ if(pw2) pw2.focus(); } };
    if(pw2) pw2.onkeydown = e=>{ if(e.key==='Enter') goPw(); };
  });
}

/* 🎉 [회원가입 설계 §7-J · §4 (가) · 개정 13] 가입 완료 — J(비밀번호) · J2(구글). A 와 I 가 같이 쓴다.
   opts: { code, google, changed, dim, startLabel } · 돌려주는 약속은 [시작하기]를 누를 때 풀린다(부르는 쪽이 재시작 또는 닫기).
   ★ 되찾기 코드는 없다((가)) — 비밀번호를 잊으면 로그인돼 있는 PC 의 계정 탭에서 바꾼다.
   ★ [구글도 연결하기]는 **지금 세션에 구글을 붙인다**(authLinkGoogle · 같은 authUid) — 로그인을 바꾸는 _loginDoGoogle 과 다르다. */
function _showSignupDone(opts){
  const o = opts || {};
  return new Promise(resolve=>{
    const ov = document.getElementById('signupDoneOverlay');
    if(!ov){ resolve(); return; }
    const $e = id => document.getElementById(id);
    const intro = $e('sdIntro'), codeEl = $e('sdCode'), pwNote = $e('sdPwNote'), warn = $e('sdWarn');
    const gNote = $e('sdGoogleNote'), msg = $e('sdMsg'), start = $e('sdStart'), gBtn = $e('sdGoogle');
    const say = (t, isErr)=>{ if(!msg) return; msg.textContent = t || ''; msg.style.color = isErr ? 'var(--win-error)' : 'var(--ink-soft)'; msg.style.display = t ? 'block' : 'none'; };
    if(codeEl) codeEl.textContent = o.code || '—';
    if(intro) intro.innerHTML = o.google ? '가입됐어요! 다음부터는 <b>구글로 로그인</b>하면 돼요.' : '가입됐어요! 이제 이 아이디로 어느 컴퓨터에서든 로그인할 수 있어요.';
    if(pwNote) pwNote.style.display = o.google ? 'none' : 'block';
    if(warn) warn.style.display = o.google ? 'none' : 'block';
    if(gBtn) gBtn.style.display = o.google ? 'none' : 'block';
    if(gNote) gNote.style.display = o.google ? 'block' : 'none';
    say(o.changed ? '보여 드린 코드를 그 사이 다른 분이 먼저 써서 새 코드로 정했어요.' : '', false);
    ov.style.background = o.dim ? 'rgba(0,0,0,.45)' : '#3a6ea5';
    ov.style.display = 'flex';
    if(start){
      start.disabled = false;
      start.textContent = o.startLabel || '시작하기';
      start.onclick = ()=>{ start.disabled = true; if(gBtn) gBtn.disabled = true; resolve({ say }); };
    }
    if(gBtn){
      gBtn.disabled = false;
      gBtn.onclick = async ()=>{
        if(!(window.companion && companion.signInWithGoogle) || !(window.firebaseAPI && firebaseAPI.authLinkGoogle)){ say('이 버전에서는 구글을 연결할 수 없어요 — 나중에 계정 탭에서 연결해 주세요', true); return; }
        gBtn.disabled = true; say('구글 창을 여는 중…', false);
        let g = null; try{ g = await companion.signInWithGoogle(); }catch(_){}
        if(!g || !g.ok){ say((g && g.reason) || '', true); gBtn.disabled = false; return; }
        let r = null; try{ r = await firebaseAPI.authLinkGoogle(g.idToken); }catch(_){ r = { ok:false, reason:'네트워크 오류 — 인터넷 연결을 확인해 주세요' }; }
        if(!r || !r.ok){ say((r && r.reason) || '구글을 연결하지 못했어요', true); gBtn.disabled = false; return; }
        if(warn) warn.style.display = 'none';
        gBtn.textContent = '✅ 구글 연결됨';
        say('구글이 연결됐어요. 이제 구글로도 로그인할 수 있어요.', false);
      };
    }
    setTimeout(()=>{ if(start) start.focus(); }, 50);
  });
}
function _hideSignupDone(){ const ov = document.getElementById('signupDoneOverlay'); if(ov) ov.style.display = 'none'; }

/* 🔐 [회원가입 설계 §9-11 · §7-K · 개정 13] K · 이 PC는 로그인이 필요해요 — 이 PC 의 uid 가 **이미 계정에 묶였는데**
   지금 세션이 그 계정이 아니다(로그인 안 함 · 다른 PC 에서 비밀번호를 바꿔 끊김). I 의 짝: I 는 «안 묶임 → 가입», K 는 «묶임 → 로그인».
   ★ 못 읽으면(오프라인 · userAuth undefined) 안 띄운다 — 다음 부팅에. 닫기 없음.
   ★ 아이디 = 계정 거울(users/{uid}/friendCode) · 없으면 이 기기 코드. 로그인이 맞는지는 서버가 가린다. */
async function _needLoginNeed(){
  const uid = getMyUserId();
  if(!uid) return null;
  if(!(window.firebaseAPI && firebaseAPI.authOwnerOf && firebaseAPI.authCurrentUid)) return null;
  try{ if(firebaseAPI.authReady) await firebaseAPI.authReady(); }catch(_){}
  const owner = await firebaseAPI.authOwnerOf(uid);
  if(owner === undefined || owner === null) return null;   // 못 읽음 · 안 묶임(그건 I)
  if(firebaseAPI.authCurrentUid() === owner) return null;  // 이미 그 계정으로 로그인돼 있다
  let code = null;
  try{ code = firebaseAPI.getUserFriendCode ? await firebaseAPI.getUserFriendCode(uid) : null; }catch(_){ code = null; }
  if(!code){ try{ code = localStorage.getItem(MY_FRIEND_CODE_KEY); }catch(_){} }
  return { uid, code: code || null };
}
async function _needLoginCheck(){
  let st = null;
  try{ st = await _needLoginNeed(); }catch(e){ console.warn('[로그인 필요] 판정 실패 — 이번엔 넘어간다', e); return false; }
  if(!st) return false;
  return await _showNeedLogin(st);
}
function _showNeedLogin(st){
  return new Promise(resolve=>{
    const ov = document.getElementById('needLoginOverlay');
    if(!ov){ resolve(false); return; }
    const $e = id => document.getElementById(id);
    const codeEl = $e('nlCode'), pw = $e('nlPw'), gB = $e('nlGoogleBtn'), fB = $e('nlFcBtn'), msg = $e('nlMsg');
    const forgot = $e('nlForgot'), box = $e('nlForgotBox');
    const say = (t, isErr)=>{ if(!msg) return; msg.textContent = t || ''; msg.style.color = isErr ? 'var(--win-error)' : 'var(--ink-soft)'; msg.style.display = t ? 'block' : 'none'; };
    const busy = on => { if(gB) gB.disabled = on; if(fB) fB.disabled = on; };
    if(codeEl) codeEl.textContent = st.code || '—';
    ov.style.display = 'flex';
    setTimeout(()=>{ if(pw) pw.focus(); }, 50);
    const close = ()=>{ ov.style.display = 'none'; try{ refreshAccountTab(); }catch(_){} resolve(true); };
    const after = r => {
      if(!r.switched){ say('✅ 로그인됐어요.', false); setTimeout(close, 900); return; }
      /* 로그인한 계정의 uid 가 이 PC 와 달랐다 — 그 계정으로 갈아탔으니 다시 띄운다(구글 갈아타기와 같은 결론). */
      say('✅ 로그인됐어요. 앱을 다시 시작하는 중이에요…', false);
      _acctRelaunchAfterDetach(()=> say('✅ 로그인됐어요. 앱을 완전히 종료했다가 다시 실행해 주세요.', false));
    };
    if(gB) gB.onclick = async ()=>{
      busy(true); say('구글 창을 여는 중…', false);
      let r = null; try{ r = await _loginDoGoogle(); }catch(_){ r = { ok:false, reason:'네트워크 오류 — 인터넷 연결을 확인해 주세요' }; }
      if(!r || !r.ok){ say((r && !r.canceled && r.reason) || '', true); busy(false); return; }
      after(r);
    };
    const goPw = async ()=>{
      const p = String((pw && pw.value) || '');
      if(!st.code){ say('이 PC에서 친구 코드를 찾지 못했어요 — [구글로 로그인]을 써 주세요', true); return; }
      if(!p){ say('비밀번호를 입력해 주세요', true); if(pw) pw.focus(); return; }
      busy(true); say('확인 중…', false);
      let r = null; try{ r = await _loginDoFriendCode(st.code, p); }catch(_){ r = { ok:false, reason:'네트워크 오류 — 인터넷 연결을 확인해 주세요' }; }
      if(!r || !r.ok){ say((r && r.reason) || '로그인에 실패했어요', true); busy(false); return; }
      after(r);
    };
    if(fB) fB.onclick = goPw;
    if(pw) pw.onkeydown = e=>{ if(e.key==='Enter') goPw(); };
    if(forgot) forgot.onclick = e=>{ e.preventDefault(); if(box) box.style.display = box.style.display === 'none' ? 'block' : 'none'; };
  });
}

/* 앱 시작 시 접근 권한 확인. 통과하면 resolve, 아니면 게이트를 띄우고 코드 입력을 기다림. */
async function checkInviteGate(){
  if(!inviteGateOn()){
    /* 🩹 게이트가 꺼져 있어도 **통과 도장은 찍는다.**
       [경위] 예전에는 그냥 return true 였다. 그래서 게이트가 꺼져 있던 기간의 유저는 전원
         INVITE_PASS_KEY 가 비어 있었고, 나중에 게이트를 켠 순간 **그 사람들이 한꺼번에**
         진짜 검사로 떨어졌다. 서버 흔적(hasLegacy)이 없는 사람 — 혼자 책상만 쓰던 분들 —
         은 그대로 문 앞에 갇혔다(2026-08 제보).
       ★ HAD_USER_ID_AT_BOOT 를 조건에 두는 이유: 이번 부팅에 처음 만들어진 uid 는 '방금 깐 사람'
         이라 도장 대상이 아니다. 이미 쓰고 있던 기기만 찍는다.
       ⚠️ 게이트를 껐다 켤 일이 또 있어도 이 한 줄이 있으면 같은 사고가 안 난다. */
    if(HAD_USER_ID_AT_BOOT){ try{ _markInvitePassed(); }catch(_){} }
    return true;
  }
  /* 🎟️ 지난번에 초대 토큰을 uid 로 못 바꾼 채 끝났으면 여기서 마무리한다(도장이 있어도 — 도장은 가입 끝에 찍힌다). */
  if(_inviteTokenLoad() && getMyUserId()){ _inviteFinishPending().catch(()=>{}); }
  try{ if(localStorage.getItem(INVITE_PASS_KEY)) return true; }catch(e){}   // 이미 통과한 기기
  /* 🪪 uid 가 없다 = 처음 쓰는 PC(설계 §3 «없음» 갈래) — 서버에 물어볼 uid 도 없으니 곧장 게이트. */
  if(!getMyUserId()) return await _showInviteGate();
  if(!window.firebaseAPI || !firebaseAPI.getInviteAccount){
    // Firebase를 못 쓰는 상황(오프라인 등): 기존 유저(부팅 시 userId 보유)는 막지 않고,
    // 신규 설치는 게이트로 보냄 (네트워크 없인 코드 검증도 불가하니 어차피 입장 불가).
    if(HAD_USER_ID_AT_BOOT) return true;
    return await _showInviteGate();
  }
  const myId = getMyUserId();
  try{
    const acct = await firebaseAPI.getInviteAccount(myId);
    // ── 1) 서버에 이미 분류된 유저: invite 노드가 있으면 그대로 통과 ──
    //    (grandfather를 받았거나, 초대 코드로 정식 입장한 유저 — invitesLeft가 몇이든 상관없음)
    if(acct && acct.invite){
      _markInvitePassed();
      return true;
    }
    // ── 2) 진짜 옛 유저 grandfather: "실사용 흔적(hasLegacy)"이 있어야 함 ──
    //    ★ users/{uid} 존재만으로 판정하면 안 됨: 신규 유저도 첫 실행에 presence·profile이
    //      자동 생성되기 때문. 게이트 화면에서 코드 안 넣고 종료 후 재실행하면 그 흔적 때문에
    //      "기존 유저"로 오인돼 통과 + 지급되는 구멍이 있었음 (재실행 우회).
    //    ★ hasLegacy = 친구/마이홈/스케줄/방명록 등 — 게이트 통과 없이는 절대 못 만드는 데이터.
    if(HAD_USER_ID_AT_BOOT && acct && acct.exists && acct.hasLegacy){
      if(firebaseAPI.grandfatherInvite){
        try{
          const g = await firebaseAPI.grandfatherInvite(myId, INVITE_GRANDFATHER_COUNT);
          if(!g || typeof g.invitesLeft !== 'number'){
            console.warn('[invite] grandfather 지급 결과가 비어 있음 — Firebase 규칙 배포 여부 확인');
          }
        }catch(err){
          console.warn('[invite] grandfather 지급 실패(permission_denied면 규칙 미배포)', err);
        }
      }
      _markInvitePassed();
      return true;
    }
  }catch(e){
    // 조회 실패(네트워크 등) — 옛 유저(부팅 시 userId 보유)를 오프라인 때문에 막지는 않음.
    if(HAD_USER_ID_AT_BOOT) return true;
  }
  // ── 신규 유저: 초대 코드 입력 대기 ──
  return await _showInviteGate();
}

/* 초대 코드 입력 화면 — 유효한 코드를 넣을 때까지 앱을 막음. Promise<boolean> */
function _showInviteGate(){
  return new Promise(resolve=>{
    const ov  = document.getElementById('inviteGateOverlay');
    const inp = document.getElementById('inviteGateInput');
    const ok  = document.getElementById('inviteGateOk');
    const msg = document.getElementById('inviteGateMsg');
    if(!ov || !inp || !ok){ resolve(true); return; }   // 마크업이 없으면 막지 않음
    ov.style.display = 'flex';
    let wantGoogle = false;   // 초대 코드 전에 구글을 눌렀다 — 코드가 통과하면 구글 가입으로 바로 간다
    setTimeout(()=>inp.focus(), 50);
    /* ✍️ A · 계정 만들기 — 같은 오버레이의 두 번째 카드. H 에서 초대 코드를 통과한 새 사람만 온다(설계 §3 · §7-A).
       가입이 끝나면 J · J2(_showSignupDone) → [시작하기] 에서 재시작. */
    const openSignup = ()=>{
      const hCard = document.getElementById('inviteGateCard');
      const aCard = document.getElementById('signupCard');
      if(!aCard){ showMsg('가입 화면을 열지 못했어요 — 앱을 다시 실행해 주세요', true); return; }
      if(hCard) hCard.style.display = 'none';
      aCard.style.display = 'block';
      const p = _signupPendingEnsure();
      const codeEl = document.getElementById('signupCode');
      const pw1 = document.getElementById('signupPw'), pw2 = document.getElementById('signupPw2');
      const okB = document.getElementById('signupOk'), gB = document.getElementById('signupGoogleBtn');
      const sm = document.getElementById('signupMsg');
      const say = (t, isErr)=>{ if(!sm) return; sm.textContent = t || ''; sm.style.color = isErr ? 'var(--win-error)' : 'var(--ink-soft)'; sm.style.display = t ? 'block' : 'none'; };
      const showCode = ()=>{ const q = _signupPendingLoad(); if(codeEl && q) codeEl.textContent = q.code; };
      if(codeEl) codeEl.textContent = p.code;
      const busy = on => { if(okB) okB.disabled = on; if(gB) gB.disabled = on; };
      const done = async (r, how) => {
        showCode();
        if(pw1) pw1.disabled = true; if(pw2) pw2.disabled = true;
        if(r.existing){
          /* 이미 가입된 구글이었다 — 새로 만든 게 없으니 완료 화면 없이 그 계정으로 다시 시작. */
          say('✅ 이미 가입된 구글 계정이에요 — 그 계정으로 들어갈게요. 앱을 다시 시작하는 중이에요…', false);
          _acctRelaunchAfterDetach(()=> say('✅ 앱을 완전히 종료했다가 다시 실행해 주세요.', false));
          return;
        }
        say('', false);
        /* 🎉 J · J2 — [시작하기] 에서 재시작한다(uid 가 이 세션에서 처음 정해져 부팅부터 다시 돌아야 한다). */
        const d = await _showSignupDone({ code:r.code, google: how === 'google', changed:!!r.changed, dim:false });
        d.say('앱을 다시 시작하는 중이에요…', false);
        _acctRelaunchAfterDetach(()=> d.say('앱을 완전히 종료했다가 다시 실행해 주세요.', false));
      };
      const goPw = async ()=>{
        const a = String((pw1 && pw1.value) || ''), b = String((pw2 && pw2.value) || '');
        if(a.length < 6){ say('비밀번호는 6자 이상으로 정해 주세요', true); if(pw1) pw1.focus(); return; }
        if(a !== b){ say('비밀번호가 서로 달라요.', true); if(pw2) pw2.focus(); return; }
        busy(true); say('가입하는 중…', false);
        let r = null;
        try{ r = await _signupDoPassword(a); }catch(_){ r = { ok:false, reason:'네트워크 오류 — 인터넷 연결을 확인해 주세요' }; }
        if(r && r.ok){ done(r, 'password'); return; }
        showCode();
        say((r && r.reason) || '가입하지 못했어요 — 다시 시도해 주세요', true);
        busy(false);
      };
      const goG = async ()=>{
        busy(true); say('구글 창을 여는 중…', false);
        let r = null;
        try{ r = await _signupDoGoogle(); }catch(_){ r = { ok:false, reason:'네트워크 오류 — 인터넷 연결을 확인해 주세요' }; }
        if(r && r.ok){ done(r, 'google'); return; }
        say((r && !r.canceled && r.reason) || '', true);
        busy(false);
      };
      if(okB) okB.onclick = goPw;
      if(gB) gB.onclick = goG;
      if(wantGoogle){ wantGoogle = false; goG(); return; }
      if(pw1) pw1.onkeydown = e=>{ if(e.key==='Enter'){ if(pw2) pw2.focus(); } };
      if(pw2) pw2.onkeydown = e=>{ if(e.key==='Enter') goPw(); };
      setTimeout(()=>{ if(pw1) pw1.focus(); }, 50);
    };
    const showMsg = (text, isErr)=>{
      if(!msg) return;
      msg.textContent = text;
      msg.style.color = isErr ? 'var(--win-error)' : 'var(--ink-soft)';
      msg.style.display = text ? 'block' : 'none';
    };
    /* 🔑 [설계 §3 H · 개정 8] 옛 «유저 코드(u…) + 이전 비밀번호 = 계정 이전» 갈래는 걷었다.
       처음 쓰는 PC 의 기존 사용자는 아래 [친구 코드로 로그인] · [구글로 로그인] 으로 들어온다(초대 코드 불필요). */
    const submit = async ()=>{
      const raw = (inp.value||'').trim();
      if(!raw){ showMsg('초대 코드를 입력해 주세요', true); return; }
      // ── 초대 코드(기존) 경로 ──
      const code = raw.toUpperCase();
      ok.disabled = true; showMsg('확인 중…', false);
      try{
        /* 🎟️ [설계 §3 · 개정 8] uid 대신 기기 토큰으로 소진한다 — 이 호출이 새 사람의 uid 를 발명하던 자리다. */
        const r = await firebaseAPI.redeemInvite(code, _inviteTokenFor(code));
        if(r && r.ok){
          if(getMyUserId()){
            /* 이 기기엔 이미 uid 가 있다(도장 없이 게이트에 온 옛 설치) — uid 가 안 바뀌니 재시작 없이 들어간다. */
            await _inviteFinishPending();
            _markInvitePassed();
            ov.style.display = 'none';
            resolve(true);
            return;
          }
          /* ✍️ 이 기기엔 uid 가 없다 = 새 사람 → A(계정 만들기). uid 후보는 A 를 열 때 가입 상태(tw.signupPending)에만 적고,
             서버와 tw.myUserId 에는 [가입하기]가 끝날 때 처음 쓴다(설계 §3 ②~⑤). */
          openSignup();
          return;   // ok.disabled 유지
        }
        showMsg((r && r.reason) || '초대 코드를 사용할 수 없어요', true);
      }catch(e){
        showMsg('네트워크 오류 — 인터넷 연결을 확인해 주세요', true);
      }
      ok.disabled = false;
    };
    ok.onclick = submit;
    inp.onkeydown = e=>{ if(e.key==='Enter') submit(); };

    /* 🔑 [친구 코드로 로그인] — H 의 둘째 문(설계 §3 · §7-H). 계정 = 친구 코드 + 비밀번호(가입 A · I 가 만든 것).
       uid 가 바뀌면 재시작(구글 갈아타기와 같은 결론) · 이미 이 기기의 계정이면 게이트만 닫는다. */
    const fcInp = document.getElementById('inviteGateFc');
    const pwInp = document.getElementById('inviteGatePw');
    const fcBtn = document.getElementById('inviteGateFcBtn');
    const lmsg  = document.getElementById('inviteGateLoginMsg');
    const showLogin = (text, isErr)=>{
      if(!lmsg) return;
      lmsg.textContent = text || '';
      lmsg.style.color = isErr ? 'var(--win-error)' : 'var(--ink-soft)';
      lmsg.style.display = text ? 'block' : 'none';
    };
    const loginFc = async ()=>{
      const code = String((fcInp && fcInp.value) || '').trim().toUpperCase();
      const pw = String((pwInp && pwInp.value) || '');
      if(!code){ showLogin('친구 코드를 입력해 주세요', true); if(fcInp) fcInp.focus(); return; }
      if(!FRIEND_CODE_LOGIN_RE().test(code)){ showLogin('친구 코드는 MATE-XXXX 모양이에요', true); if(fcInp) fcInp.focus(); return; }
      if(pw.length < 6){ showLogin('비밀번호를 입력해 주세요 (6자 이상)', true); if(pwInp) pwInp.focus(); return; }
      fcBtn.disabled = true; showLogin('확인 중…', false);
      let r = null;
      try{ r = await _loginDoFriendCode(code, pw); }catch(_){ r = { ok:false, reason:'네트워크 오류 — 인터넷 연결을 확인해 주세요' }; }
      if(!r || !r.ok){ showLogin((r && r.reason) || '로그인에 실패했어요', true); fcBtn.disabled = false; return; }
      if(!r.switched){
        /* uid 가 안 바뀌었다 — 지금 세션의 구독이 그대로 맞으니 게이트만 닫는다(구글 alreadyOwner 와 같다). */
        showLogin('✅ ' + code + ' 계정으로 확인됐어요. 들어갈게요…', false);
        try{ ov.style.display = 'none'; }catch(_){}
        resolve(true);
        return;
      }
      if(fcInp) fcInp.disabled = true;
      if(pwInp) pwInp.disabled = true;
      showLogin('✅ 로그인됐어요. 앱을 다시 시작하는 중이에요…', false);
      _acctRelaunchAfterDetach(()=> showLogin('✅ 로그인됐어요. 앱을 완전히 종료했다가 다시 실행해 주세요.', false));
      // fcBtn.disabled 유지 — 재시작 전 상태 고정
    };
    if(fcBtn) fcBtn.onclick = loginFc;
    /* ✍️ 가입 도중에 끊긴 기기(초대 토큰 + 가입 상태가 남음) — 초대 코드를 다시 묻지 않고 A 로 곧장(설계 §3 갈래 메모). */
    if(_signupPendingLoad() && _inviteTokenLoad() && !getMyUserId()) openSignup();
    if(fcInp) fcInp.onkeydown = e=>{ if(e.key==='Enter'){ if(pwInp && !pwInp.value) pwInp.focus(); else loginFc(); } };
    if(pwInp) pwInp.onkeydown = e=>{ if(e.key==='Enter') loginFc(); };

    /* 🚪 밖에서 게이트를 닫는 문 — 게이트 안의 구글 버튼이 쓴다.
       그 버튼은 다른 IIFE(initAccountLoginUI)에서 묶여 있어 이 resolve 에 손이 닿지 않는다.
       ⚠️ 통과 도장을 찍는 것은 **부르는 쪽 책임**이다. 여기서 또 찍으면 근거 없는 통과가
         생길 수 있다(이 함수는 자격을 판단하지 않는다). */
    window._inviteGatePass = ()=>{
      try{ ov.style.display = 'none'; }catch(_){}
      resolve(true);
    };
    /* 게이트의 구글 버튼이 «연결된 기록 없음» 을 받았을 때 — 초대 코드 칸으로 보내고, 통과하면 [구글로 가입]을 이어 누른다. */
    window._inviteGateWantGoogle = ()=>{
      wantGoogle = true;
      try{ inp.focus(); }catch(_){}
    };
  });
}

/* 런처의 🎟️ 초대장 버튼 — 남은 장수 표시, 클릭 시 발급 */
async function refreshInviteBtn(){
  const btn = document.getElementById('lcInviteIssueBtn');
  if(!btn) return;
  if(isAdmin()){ btn.textContent = '🎟️ 초대장 (무제한)'; btn.disabled = false; btn.style.opacity=''; return; }
  if(!window.firebaseAPI || !firebaseAPI.getInvitesLeft || !getMyUserId()){ btn.textContent = '🎟️ 초대장'; return; }   // 내 코드가 없으면 읽지 않는다(읽어도 거부 → 같은 글)
  try{
    // 🩹 self-heal: "정식으로 게이트를 통과한 적 있는 기기(INVITE_PASS_KEY)"의 기존 유저가
    //   invite 노드를 잃었을 때만 재지급. 게이트 통과 전 신규 유저에겐 절대 발동 안 함 —
    //   조건 없이 돌리면 게이트 입력 화면 뒤에서 런처가 열리며 신규 유저에게 지급되는 구멍이 됨.
    const _passedBefore = (()=>{ try{ return !!localStorage.getItem(INVITE_PASS_KEY); }catch(e){ return false; } })();
    if(_passedBefore && HAD_USER_ID_AT_BOOT && firebaseAPI.getInviteAccount && firebaseAPI.grandfatherInvite){
      const acct = await firebaseAPI.getInviteAccount(getMyUserId());
      if(acct && acct.exists && !acct.invite && acct.hasLegacy){
        const g = await firebaseAPI.grandfatherInvite(getMyUserId(), INVITE_GRANDFATHER_COUNT);
        if(g && typeof g.invitesLeft === 'number'){
          toast(`기존 유저 확인 — 초대권 ${g.invitesLeft}장이 지급됐어요`);
        } else {
          console.warn('[invite] grandfather 지급 결과가 비어 있음 — Firebase 규칙/네트워크 확인');
        }
      }
    }
    const left = await firebaseAPI.getInvitesLeft(getMyUserId());
    // 잔액이 음수(회수 처리 등)여도 사용자에겐 0으로 보여줌 — 화면에 -1 같은 값이 뜨면 오류로 오해받음.
    btn.textContent = `🎟️ 초대장 (${Math.max(0, left)})`;
    btn.disabled = left <= 0;
    btn.style.opacity = left > 0 ? '' : '.5';
    btn.title = left > 0 ? '초대장을 발급해 친구를 초대할 수 있어요' : '남은 초대장이 없어요';
  }catch(e){
    console.warn('[invite] 초대장 버튼 갱신 실패', e);
    btn.textContent = '🎟️ 초대장';
  }
}

/* 초대장 발급 — 2단계 모달.
   1단계(확인): 아직 아무것도 차감 안 됨. [취소]나 창 닫기 → 그대로 종료.
   2단계(완료): [발급]을 누른 그 순간에 차감 + 코드 생성이 함께 일어나고 코드가 표시됨. */
async function issueInviteAndShow(){
  if(!window.firebaseAPI || !firebaseAPI.issueInvite){ toast('네트워크 연결이 필요해요'); return; }
  const ov      = document.getElementById('inviteIssuedOverlay');
  const title   = document.getElementById('inviteIssuedTitle');
  const stepC   = document.getElementById('inviteConfirmStep');
  const stepI   = document.getElementById('inviteIssuedStep');
  const cLeft   = document.getElementById('inviteConfirmLeft');
  if(!ov || !stepC || !stepI){ return; }

  // 1단계로 초기화
  if(title) title.textContent = '🎟️ 초대장 발급';
  stepC.style.display = '';
  stepI.style.display = 'none';
  if(cLeft){
    if(isAdmin()) cLeft.textContent = '관리자는 초대장이 차감되지 않아요';
    else {
      try{ const left = await firebaseAPI.getInvitesLeft(getMyUserId()); cLeft.textContent = `남은 초대장: ${left}장`; }
      catch(e){ cLeft.textContent = ''; }
    }
  }
  ov.style.display = 'flex';
}

/* [발급] 확정 — 여기서 처음으로 차감이 일어남 */
async function _inviteConfirmIssue(){
  const title  = document.getElementById('inviteIssuedTitle');
  const stepC  = document.getElementById('inviteConfirmStep');
  const stepI  = document.getElementById('inviteIssuedStep');
  const codeEl = document.getElementById('inviteIssuedCode');
  const leftEl = document.getElementById('inviteIssuedLeft');
  const okBtn  = document.getElementById('inviteConfirmOk');
  if(okBtn) okBtn.disabled = true;
  try{
    const code = _genInviteCode();
    const r = await firebaseAPI.issueInvite(getMyUserId(), code, isAdmin());
    if(!r || !r.ok){
      toast((r && r.reason) || '초대장 발급에 실패했어요');
      const ov = document.getElementById('inviteIssuedOverlay');
      if(ov) ov.style.display = 'none';
      refreshInviteBtn();
      return;
    }
    if(title) title.textContent = '🎟️ 초대장 발급 완료';
    if(codeEl) codeEl.textContent = r.code;
    if(leftEl){
      if(isAdmin()) leftEl.textContent = '관리자는 초대장이 차감되지 않아요';
      else {
        try{ const left = await firebaseAPI.getInvitesLeft(getMyUserId()); leftEl.textContent = `남은 초대장: ${left}장`; }
        catch(e){ leftEl.textContent = ''; }
      }
    }
    if(stepC) stepC.style.display = 'none';
    if(stepI) stepI.style.display = '';
    refreshInviteBtn();
  } finally {
    if(okBtn) okBtn.disabled = false;
  }
}

(function bindInviteUI(){
  const btn = document.getElementById('lcInviteIssueBtn');
  if(btn) btn.addEventListener('click', issueInviteAndShow);

  const ov = document.getElementById('inviteIssuedOverlay');
  const closeBtn = document.getElementById('inviteIssuedClose');
  const copyBtn  = document.getElementById('inviteIssuedCopy');
  if(closeBtn && ov) closeBtn.addEventListener('click', ()=>{ ov.style.display='none'; });
  // 1단계(확인) 버튼 — [발급]을 눌러야 그때 차감+코드 생성. [취소]는 아무 일도 안 함.
  const confirmOk     = document.getElementById('inviteConfirmOk');
  const confirmCancel = document.getElementById('inviteConfirmCancel');
  if(confirmOk) confirmOk.addEventListener('click', _inviteConfirmIssue);
  if(confirmCancel && ov) confirmCancel.addEventListener('click', ()=>{ ov.style.display='none'; });
  if(copyBtn){
    copyBtn.addEventListener('click', ()=>{
      const code = (document.getElementById('inviteIssuedCode')||{}).textContent || '';
      if(!code || code==='-') return;
      try{ navigator.clipboard.writeText(code); toast('초대 코드를 복사했어요'); }
      catch(e){ toast('복사에 실패했어요 — 직접 선택해서 복사해 주세요'); }
    });
  }

})();

function _genLicenseKey(){
  // XXXX-XXXX-XXXX-XXXX 형식, 헷갈리기 쉬운 0/O, 1/I 제외
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () => Array.from({length:4}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
  return `${seg()}-${seg()}-${seg()}-${seg()}`;
}

async function verifyLicense(key){
  if(!window.firebaseAPI || !window.firebaseAPI.redeemLicense){
    return { ok:false, reason:'네트워크 오류 — 인터넷 연결을 확인해 주세요', offline:true };
  }
  return await window.firebaseAPI.redeemLicense(key.trim().toUpperCase());
}

function loadLicenseFromStorage(){
  try{
    const key = localStorage.getItem(LICENSE_KEY_STORAGE);
    if(key){ _setPremium(true); return key; }   // 온라인 재검증 전까지는 로컬 저장값 신뢰(오프라인 사용 허용)
  }catch(e){}
  return null;
}
/* 🎫 라이선스는 **계정을 따라간다** (2026-09-23 제보 «노트북에서 받고 본컴에서 받으려니 우편이 사라졌다 — 한 PC 만 되나요?»)
   [답] 키는 여러 PC 에서 된다(redeemLicense 가 재설치 허용). 문제는 두 번째 PC 로 **옮겨 가는 길**이었다.
   [구멍 셋]
     ① 등록한 순간에는 계정 스냅샷(accountSnap)이 안 올라갔다 — 그 PC 를 로그인한 채 **다시 켜야** 올라갔다.
     ② 스냅샷에서 라이선스를 받는 것은 로그인·계정 연동 순간뿐이었다 — 이미 로그인된 PC 는 영영 안 받았다.
     ③ ★ 가장 나빴던 것: 로그인된 PC 는 부팅 6초 뒤 **자기** 스냅샷으로 accountSnap 을 통째로 덮어쓴다
        (setAccountSnapshot 은 update 로 노드 하나를 교체). 라이선스 없는 PC 가 켜지면 계정의 라이선스가 null 로 지워졌다.
   [고침] ① activateLicense 가 곧바로 올린다(_licenseSnapPushNow).
          ② ③ 부팅 push 앞에서 _licenseSnapForPush — 이 PC 에 키가 없으면 계정 것을 읽어 검증하고,
             유효하면 이 PC 에서도 켜고(해제해 둔 키가 아니면), **올리는 스냅샷에도 계정의 키를 그대로 싣는다.**
             계정에서 라이선스가 빠지는 것은 키가 회수됐을 때(검증 실패 · 오프라인 아님)뿐이다.
   ★ «이 기기에서 해제» 는 이 기기만의 일이다 — LICENSE_OPTOUT_KEY 에 그 키를 적어 두고, 그 키는 다시 켜지 않는다.
     다른 키(새로 산 것)는 켠다. 로그아웃하면 이 표시도 지운다(ACCOUNT_LOCAL_KEYS). */
function _licenseSnapPushNow(){
  try{
    if(!getMyLoginEmail()) return;   // 로그인 안 한 기기 — 계정이 없다
    if(!(window.firebaseAPI && firebaseAPI.setAccountSnapshot)) return;
    firebaseAPI.setAccountSnapshot(getMyUserId(), _loginLocalSnapshot());
  }catch(_){}
}
async function _licenseSnapForPush(){
  const snap = _loginLocalSnapshot();
  if(snap.license) return snap;                        // 이 PC 에 있으면 그게 계정 것이다(예전과 같음)
  let acct = null;
  try{ acct = (window.firebaseAPI && firebaseAPI.fetchAccountSnapshot) ? await firebaseAPI.fetchAccountSnapshot(getMyUserId()) : null; }catch(_){ acct = null; }
  const k = (acct && typeof acct.license === 'string') ? acct.license.trim().toUpperCase() : '';
  if(!k) return snap;
  const v = await verifyLicense(k);
  if(!v.ok && !v.offline) return snap;                 // 회수된 키 — 계정에서도 빠진다
  snap.license = k;                                    // ★ 이 PC 에 없다고 계정의 라이선스를 지우지 않는다(구멍 ③)
  let opt = null; try{ opt = localStorage.getItem(LICENSE_OPTOUT_KEY); }catch(_){}
  if(v.ok && opt !== k){
    try{ localStorage.setItem(LICENSE_KEY_STORAGE, k); }catch(_){}
    _setPremium(true);
    try{ refreshLicenseUI(); }catch(_){}
    try{ toast('🎫 계정에 등록된 라이선스를 이 PC에서도 켰어요'); }catch(_){}
  }
  return snap;
}
async function activateLicense(key){
  const r = await verifyLicense(key);
  if(r.ok){
    try{ localStorage.setItem(LICENSE_KEY_STORAGE, key.trim().toUpperCase()); localStorage.removeItem(LICENSE_OPTOUT_KEY); }catch(e){}
    _setPremium(true);
    _licenseSnapPushNow();   // 🎫 다른 PC 가 곧바로 받을 수 있게(구멍 ①)
  }
  return r;
}
function deactivateLicense(){
  let _k = null; try{ _k = localStorage.getItem(LICENSE_KEY_STORAGE); }catch(_){}
  try{ localStorage.removeItem(LICENSE_KEY_STORAGE); if(_k) localStorage.setItem(LICENSE_OPTOUT_KEY, _k); }catch(e){}   // 🎫 이 기기만 해제 — 부팅 때 다시 켜지 않는다
  // 프리미엄이 풀렸는데 커스텀 상태를 쓰고 있었으면 기본 상태로 되돌림
  if(typeof userStatus()!=='undefined' && userStatus()==='custom') setUserStatus(null);
  _setPremium(false);
}
/* 프리미엄 여부가 바뀔 때 그에 따라 잠금/해제되는 UI를 다시 그림 (라이선스 검증이 비동기라 나중에 확정됨) */
onPremiumChanged(_refreshPremiumGatedUI);   // 프리미엄이 바뀌면(account-state.js _setPremium) 내 좌석 책상 · 아이템 · 전용 칸을 다시 그린다
function _refreshPremiumGatedUI(){
  refreshCustomStatusMenuItem();   // ✨ 커스텀 상태 메뉴 항목
  try{ if(typeof awayPicMod()._awayRenderUI === 'function') awayPicMod()._awayRenderUI(null); }catch(_){}        // 👑 자리비움 그림 등록 칸(프리미엄 전용)
  /* 🪑 [2026-09-18 제보 2] 라이선스가 바뀌었으니 **저장값부터** 맞춘다 — 다시 그리는 것은 그 다음이다.
     ★ 예전에는 여기 「charDef 는 손대지 않는다」고 적혀 있었다. 근거는 «나중에 라이선스가 오면 같은
       참조로 원래 책상이 돌아온다» 였고 그 판단 자체는 옳았다. 다만 그 남은 값이
       serializeDefForNetwork 를 타고 방으로 나가고, 받는 쪽은 seat.remote 라 게이트 없이 그린다 —
       «친구 화면엔 없는데 내 화면엔 보인다» 가 정확히 그것이다(제보 2).
     ★ 그래서 지금은 **접어 둔다** — 지우는 것이 아니라 deskLicenseHold 로 옮겨 적는다.
       옛 주석이 지키려던 것(라이선스가 돌아오면 책상도 돌아온다)은 그대로 지키면서 전파만 끊는다.
       근거와 경계는 pruneUnownedLicenseAssets 위 주석에 적었다.
     ⚠️ 남의 좌석은 안 건드린다 — 남의 것은 애초에 게이트를 안 탄다(seat.remote). */
  try{ restoreLicenseHeldAssets(); }
  catch(e){ console.warn('[라이선스] 접어 둔 자산 복원 실패', e); }
  try{ pruneUnownedLicenseAssets(); }
  catch(e){ console.warn('[라이선스] 전용 자산 정리 실패', e); }
  try{
    if(typeof seats!=='undefined' && Array.isArray(seats)){
      seats.forEach(s=>{
        if(!s || !s.isMe || s.remote || !s.charDef) return;
        if(s.charDef.deskCatalogId){ applyDeskCatalogRefToSeat(s, s.charDef); }
        else if(!s.charDef.deskGlb){ applyDeskCatalogRefToSeat(s, {deskCatalogId:DEFAULT_DESK_OVERRIDE_ID, deskScale:s.charDef.deskScale, deskLenX:s.charDef.deskLenX, deskColor:s.charDef.deskColor}); }
        if(s.charDef.deskItems) applyDeskItemsTo(s, s.charDef.deskItems);
      });
    }
  }catch(_){}
  // 생성기가 열려 있으면 책상 카드의 🔒 도 지금 값으로 다시 그린다
  try{ if(typeof creatorOpen()!=='undefined' && creatorOpen()) renderCrItems(); }catch(_){}
}

return {
  INVITE_GRANT_MAX,
  _existingSignupCheck,
  _genLicenseKey,
  _licenseSnapForPush,
  _needLoginCheck,
  activateLicense,
  checkInviteGate,
  deactivateLicense,
  loadLicenseFromStorage,
  refreshInviteBtn,
  verifyLicense,
};
}

const api = { createLicenseGate };
if(typeof window !== 'undefined') window.TwLicenseGate = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

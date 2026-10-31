/* license-gate.js — 🎟️ 게이트 — 켤 때 로그인 · 서버 가입 확인 · 초대 코드 · 계정 만들기 · 초대장 버튼 · 라이선스 키
   app.js «🎟️ 초대장 (앱 접근 제한)» 구역 본문을 옮긴 모듈이다(앱 FSD 31번 — docs/APP_FSD_MAP.md). 관리자 📊 통계 · 🎟️ 초대권 지급은 app.js 가 이 모듈 바로 뒤에서 만든다.
   ★ awayPicMod · creatorOpen · userStatus · FRIEND_CODE_LOGIN_RE 는 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값).
   ★ 저장 키 · 프리미엄 깃발 바꾸기(_setPremium)는 계정 핵심 상태(account-state.js)에 있다(모듈 순환 끊기 5) — 이 모듈은 deps 로 받고, 프리미엄이 바뀌면 다시 그리기를 onPremiumChanged 로 건다.
   ★ 0.13 — 켤 때 로그인 · 서버 가입 확인은 login-flow.js(GET /v1/me), 초대 코드 확인 · 가입 · 내 초대는 서버(user-api.js)가 한다.
     옛 갈래(기기 토큰으로 초대 소진 · 앱이 uid · 친구 코드를 만들어 묶기 · 기존 사용자 가입 I · 로그인 필요 K · grandfather 초대권 · 계정 사본)는 걷었다.
   ★ 밖에서 부르는 이름: INVITE_GRANT_MAX · _genLicenseKey · activateLicense · checkInviteGate · deactivateLicense · loadLicenseFromStorage · refreshInviteBtn · verifyLicense — app.js 는 licenseGateMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwLicenseGate — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-license-gate.js */
(function(){

function createLicenseGate(deps){
const DEFAULT_DESK_OVERRIDE_ID = deps.DEFAULT_DESK_OVERRIDE_ID;
const FRIEND_CODE_LOGIN_RE = deps.FRIEND_CODE_LOGIN_RE;   // 읽는 함수
const _loginDoFriendCode = deps._loginDoFriendCode;
const _loginDoGoogle = deps._loginDoGoogle;
const _enterAccount = deps._enterAccount;   // 서버 계정으로 이 PC 맞추기(account.js) → { ok, switched }
const twNav = deps.twNav;   // 🧭 창 열기 통로(nav.js) — «계정에 들어감» 을 켜는 순서 모듈(app-boot.js)에 알린다
const notifyError = deps.notifyError;   // 번호 토스트(error-codes.js)
const _wipeAccountLocal = deps._wipeAccountLocal;   // 이 PC 계정 몫 지우기(account.js)
const loginFlowMod = deps.loginFlowMod;   // 🔑 로그인 흐름(login-flow.js) — 켤 때 판정 · 가입 · realtime · 로컬 모드
const userApiMod = deps.userApiMod;   // 🪪 계정 provider(user-api.js) — 초대 확인 · 내 초대 · 화면 문구
const SIGNUP_CODE_PLACEHOLDER = 'MATE-····';   // 친구 코드는 서버가 가입 때 정한다 — 가입 전엔 자리 표시만
const applyDeskCatalogRefToSeat = deps.applyDeskCatalogRefToSeat;
const applyDeskItemsTo = deps.applyDeskItemsTo;
const awayPicMod = deps.awayPicMod;   // 읽는 함수
const creatorOpen = deps.creatorOpen;   // 읽는 함수
const getMyUserId = deps.getMyUserId;
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
const LICENSE_KEY_STORAGE = deps.LICENSE_KEY_STORAGE;   // 🪪 계정 핵심 상태(account-state.js) — 저장 키 · 프리미엄
const LICENSE_OPTOUT_KEY = deps.LICENSE_OPTOUT_KEY;
const _setPremium = deps._setPremium;
const onPremiumChanged = deps.onPremiumChanged;
const _acctRelaunchAfterDetach = deps._acctRelaunchAfterDetach;
const _rcStore = deps._rcStore;   // 원격 설정 한 벌(account-state.js)
function inviteGateOn(){ const s = _rcStore(); return s ? s.inviteGate() : true; }
const INVITE_GRANT_MAX = 3;                 // 관리자가 한 번에 지급할 수 있는 최대 초대권 수

/* ═══ 🔑 켤 때 — 로그인 · 서버 가입 확인 (0.13 — login-flow.js 판정 · 설계 03-auth 3-3-1) ═══
   in     → 이 PC 를 서버 계정에 맞춘다(_enterAccount). uid 가 바뀌었으면 다시 켠다 · 아니면 «계정에 들어감» 을 알린다 — 옛 값 옮기기 → realtime → 계정 기능 시작 · 0.13 첫 실행은 app-boot.js 차례 표가 한다.
   local  → 서버에 닿지 못함 · 점검 — «서버에 연결할 수 없어요» 화면(로컬 모드 없음 · 서버가 원본). [다시 시도] · realtime ready 가 계정을 다시 묻고, 닿으면 위와 같이.
   signup → 로그인은 됐는데 서버에 계정이 없다(가입 전 · 탈퇴 · 관리자가 지움) — 이 PC 계정 몫을 지우고 게이트.
   login  → 게이트(초대 코드 · 구글 · 친구 코드 로그인). 로그인 없이 쓰는 길은 없다(ADR-0006). */
async function checkInviteGate(){
  return await _afterConfirm(await loginFlowMod.confirm());
}
async function _afterConfirm(c){
  if(c.state === 'in'){
    const r = _enterAccount(c.me, loginFlowMod.identity());
    if(r.ok && r.switched){ _relaunchSoon('🔑 계정을 맞췄어요 — 앱을 다시 시작하는 중이에요…'); return true; }
    if(r.ok){ _entered(c.me); return true; }
    return await _showInviteGate();
  }
  if(c.state === 'local') return await _showOfflineGate();   // 서버에 닿지 못하면 로컬 모드 없이 막는다(서버가 원본)
  if(c.state === 'signup' && getMyUserId()) _wipeAccountLocal();   // 서버에 이 계정이 없다 — 이 PC 계정 몫을 지운다(로그인은 게이트에서 다시)
  return await _showInviteGate();
}
/* 이 PC 를 서버 계정에 맞췄고 앱을 다시 켤 일이 없다 — 계정 기능 시작을 부탁한다(차례는 app-boot.js) */
function _entered(me){ twNav.go(twNav.NAV.ACCOUNT_ENTERED, me); }
/* 🔌 서버에 연결할 수 없어요 — 같은 오버레이의 카드. [다시 시도] 를 누르거나 realtime 이 다시 붙으면(ready) 계정을 한 번 다시 묻는다(타이머 없음).
   누른 [다시 시도] 가 또 닿지 못하면 오류 번호 E-ACC-03 한 번 · 화면은 그대로. 닿으면 평소 켜기 차례로 간다. */
function _showOfflineGate(){
  return new Promise(resolve=>{
    const ov = document.getElementById('inviteGateOverlay');
    const card = document.getElementById('offlineCard');
    const btn = document.getElementById('offlineRetry');
    const msg = document.getElementById('offlineMsg');
    const hCard = document.getElementById('inviteGateCard'), aCard = document.getElementById('signupCard');
    if(!ov || !card || !btn){ resolve(false); return; }   // 마크업이 없으면 못 들어간다
    if(hCard) hCard.style.display = 'none';
    if(aCard) aCard.style.display = 'none';
    card.style.display = 'block';
    ov.style.display = 'flex';
    const say = (t)=>{ if(!msg) return; msg.textContent = t || ''; msg.style.display = t ? 'block' : 'none'; };
    loginFlowMod.waitForServer((c)=>{
      card.style.display = 'none'; ov.style.display = 'none'; if(hCard) hCard.style.display = '';
      _afterConfirm(c).then(resolve, ()=>resolve(false));
    });
    btn.onclick = async ()=>{
      btn.disabled = true; say('');
      let r = null;
      try{ r = await loginFlowMod.retryNow(); }catch(_){ r = null; }
      btn.disabled = false;
      if(r && r.state === 'local'){
        say(r.limited ? '요청이 많아요 — 잠시 뒤 다시 눌러 주세요' : '아직 연결되지 않았어요');
        notifyError('E-ACC-03', r.reason);
      }
    };
  });
}
function _relaunchSoon(text){
  try{ toast(text); }catch(_){}
  _acctRelaunchAfterDetach(()=>{ try{ toast('앱을 완전히 종료했다가 다시 실행해 주세요'); }catch(_){} });
}

/* 🎉 [회원가입 설계 §7-J · §4 (가) · 개정 13] 가입 완료 — J(비밀번호) · J2(구글).
   opts: { code, google, dim, startLabel } · 돌려주는 약속은 [시작하기]를 누를 때 풀린다(부르는 쪽이 재시작 또는 닫기).
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
    say('', false);
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

/* 게이트 — 로그인할 때까지 앱을 막는다. 세 문: 초대 코드(→ 계정 만들기) · 구글 로그인 · 친구 코드 로그인. Promise<boolean>
   로그인 · 가입이 끝나면 이 PC 를 서버 계정에 맞추고, uid 가 바뀌었으면(처음 쓰는 PC 포함) 다시 켠다 · 같으면 게이트만 닫는다. */
function _showInviteGate(){
  return new Promise(resolve=>{
    const ov  = document.getElementById('inviteGateOverlay');
    const inp = document.getElementById('inviteGateInput');
    const ok  = document.getElementById('inviteGateOk');
    const msg = document.getElementById('inviteGateMsg');
    if(!ov || !inp || !ok){ resolve(false); return; }   // 마크업이 없으면 못 들어간다(로그인 없이 쓰는 길 없음)
    ov.style.display = 'flex';
    let wantGoogle = false;   // 초대 코드 전에 구글을 눌렀는데 가입 기록이 없었다 — 코드가 통과하면 구글 가입으로 바로 간다
    setTimeout(()=>inp.focus(), 50);
    const close = ()=>{ try{ ov.style.display = 'none'; }catch(_){} try{ refreshAccountTab(); }catch(_){} };
    /* 로그인 · 가입 성공 뒤 한 벌 — r: { switched } */
    const finish = (r, say)=>{
      if(r.switched){
        say('✅ 로그인됐어요. 앱을 다시 시작하는 중이에요…');
        _acctRelaunchAfterDetach(()=> say('✅ 로그인됐어요. 앱을 완전히 종료했다가 다시 실행해 주세요.'));
        return;
      }
      close(); _entered(r.me); resolve(true);
    };
    /* ✍️ A · 계정 만들기 — 같은 오버레이의 두 번째 카드. 초대 코드를 통과한 새 사람(초대 게이트가 꺼져 있으면 코드 없이)만 온다.
       친구 코드는 서버가 가입 때 정한다 — 가입이 끝나면 J · J2(_showSignupDone) → [시작하기] 에서 재시작. */
    const openSignup = (inviteCode)=>{
      const hCard = document.getElementById('inviteGateCard');
      const aCard = document.getElementById('signupCard');
      if(!aCard){ showMsg('가입 화면을 열지 못했어요 — 앱을 다시 실행해 주세요', true); return; }
      if(hCard) hCard.style.display = 'none';
      aCard.style.display = 'block';
      const codeEl = document.getElementById('signupCode');
      const pw1 = document.getElementById('signupPw'), pw2 = document.getElementById('signupPw2');
      const okB = document.getElementById('signupOk'), gB = document.getElementById('signupGoogleBtn');
      const sm = document.getElementById('signupMsg');
      const say = (t, isErr)=>{ if(!sm) return; sm.textContent = t || ''; sm.style.color = isErr ? 'var(--win-error)' : 'var(--ink-soft)'; sm.style.display = t ? 'block' : 'none'; };
      if(codeEl) codeEl.textContent = SIGNUP_CODE_PLACEHOLDER;   // 서버가 가입 때 정한다
      const busy = on => { if(okB) okB.disabled = on; if(gB) gB.disabled = on; };
      const done = async (r, how) => {
        if(pw1) pw1.disabled = true; if(pw2) pw2.disabled = true;
        const e = _enterAccount(r.me, loginFlowMod.identity());
        if(!e.ok){ say(e.reason, true); busy(false); return; }
        if(r.existing){
          /* 이미 가입된 구글이었다 — 새로 만든 게 없으니 완료 화면 없이 그 계정으로 */
          if(!e.switched){ say('', false); close(); _entered(r.me); resolve(true); return; }
          say('✅ 이미 가입된 구글 계정이에요 — 그 계정으로 들어갈게요. 앱을 다시 시작하는 중이에요…', false);
          _acctRelaunchAfterDetach(()=> say('✅ 앱을 완전히 종료했다가 다시 실행해 주세요.', false));
          return;
        }
        if(codeEl) codeEl.textContent = r.me.friendCode;
        say('', false);
        /* 🎉 J · J2 — [시작하기] 에서 재시작한다(uid 가 이 실행에서 처음 정해져 부팅부터 다시 돌아야 한다). */
        const d = await _showSignupDone({ code:r.me.friendCode, google: how === 'google', dim:false });
        d.say('앱을 다시 시작하는 중이에요…', false);
        _acctRelaunchAfterDetach(()=> d.say('앱을 완전히 종료했다가 다시 실행해 주세요.', false));
      };
      const goPw = async ()=>{
        const a = String((pw1 && pw1.value) || ''), b = String((pw2 && pw2.value) || '');
        if(a.length < 6){ say('비밀번호는 6자 이상으로 정해 주세요', true); if(pw1) pw1.focus(); return; }
        if(a !== b){ say('비밀번호가 서로 달라요.', true); if(pw2) pw2.focus(); return; }
        busy(true); say('가입하는 중…', false);
        let r = null;
        try{ r = await loginFlowMod.joinPassword({ inviteCode, password:a }); }catch(_){ r = { ok:false, reason:'네트워크 오류 — 인터넷 연결을 확인해 주세요' }; }
        if(r && r.ok){ done(r, 'password'); return; }
        say((r && r.reason) || '가입하지 못했어요 — 다시 시도해 주세요', true);
        busy(false);
      };
      const goG = async ()=>{
        busy(true); say('구글 창을 여는 중…', false);
        let r = null;
        try{ r = await loginFlowMod.joinGoogle({ inviteCode }); }catch(_){ r = { ok:false, reason:'네트워크 오류 — 인터넷 연결을 확인해 주세요' }; }
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
    /* 초대 코드 — 서버에 «쓸 수 있나» 만 묻는다(쓴 횟수는 가입이 끝날 때 서버가 센다). 게이트가 꺼져 있으면 빈 칸으로도 계정 만들기로. */
    const submit = async ()=>{
      const raw = (inp.value||'').trim();
      if(!raw){
        if(!inviteGateOn()){ openSignup(null); return; }
        showMsg('초대 코드를 입력해 주세요', true); return;
      }
      ok.disabled = true; showMsg('확인 중…', false);
      try{
        const r = await userApiMod.checkInvite(raw);
        if(r.usable){ openSignup(r.code); return; }   // ok.disabled 유지
        showMsg(userApiMod.inviteReasonOf(r.reason), true);
      }catch(e){
        showMsg(userApiMod.reasonOf(e), true);
      }
      ok.disabled = false;
    };
    ok.onclick = submit;
    inp.onkeydown = e=>{ if(e.key==='Enter') submit(); };

    /* 🔑 [친구 코드로 로그인] — 계정 = 친구 코드 + 비밀번호(가입 때 서버가 만든 것). */
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
      if(r.switched){ if(fcInp) fcInp.disabled = true; if(pwInp) pwInp.disabled = true; }
      finish(r, (t)=>showLogin(t, false));
    };
    if(fcBtn) fcBtn.onclick = loginFc;
    if(fcInp) fcInp.onkeydown = e=>{ if(e.key==='Enter'){ if(pwInp && !pwInp.value) pwInp.focus(); else loginFc(); } };
    if(pwInp) pwInp.onkeydown = e=>{ if(e.key==='Enter') loginFc(); };

    /* [구글로 로그인] — 새 PC 의 기존 사용자가 초대 코드 없이 들어오는 문. 이 구글로 가입한 계정이 없으면 초대 코드 칸으로 보내고,
       코드가 통과하면 [구글로 가입]을 이어 누른다. */
    const gate = document.getElementById('inviteGateGoogleBtn');
    if(gate) gate.onclick = async ()=>{
      gate.disabled = true;
      let r = null;
      try{ r = await _loginDoGoogle(); }catch(_){ r = { ok:false, reason:'로그인 중 오류가 났어요' }; }
      gate.disabled = false;
      if(!r || !r.ok){
        if(r && r.needCode){ showLogin('초대 코드를 넣어 주세요 — 이 구글 계정으로 가입한 기록이 없어요', true); wantGoogle = true; try{ inp.focus(); }catch(_){} return; }
        showLogin(r && r.canceled ? '' : ((r && r.reason) || '로그인에 실패했어요'), true);
        return;
      }
      finish(r, (t)=>showLogin(t, false));
    };
  });
}

/* 런처의 🎟️ 초대장 버튼 — 남은 장수 표시, 클릭 시 발급(서버 /v1/me/invites — 남은 장수 · 관리자 무제한은 서버가 정한다) */
/* 초대장 버튼 한 벌 — 남은 장수를 읽어 1장 이상일 때만 켠다. 못 읽었으면(서버 준비 전 · 내 코드 없음 · 읽기 실패) 끈다 */
function _setInviteBtn(btn, text, on, title){
  btn.textContent = text;
  btn.disabled = !on;
  btn.style.opacity = on ? '' : '.5';
  btn.title = title;
}
const _leftText = (left) => (left === null ? '무제한' : Math.max(0, left) + '장');   // null = 관리자(서버가 무제한으로 답함) · 음수(회수)는 0 으로 보인다
async function refreshInviteBtn(){
  const btn = document.getElementById('lcInviteIssueBtn');
  if(!btn) return;
  if(!getMyUserId()){ _setInviteBtn(btn, '🎟️ 초대장', false, '초대장 수를 불러오지 못했어요'); return; }   // 로그인 전 — 읽어도 거부
  try{
    const m = await userApiMod.myInvites();
    if(!m) throw new Error('모양이 다름');
    const on = m.invitesLeft === null || m.invitesLeft > 0;
    _setInviteBtn(btn, '🎟️ 초대장 (' + (m.invitesLeft === null ? '무제한' : Math.max(0, m.invitesLeft)) + ')', on, on ? '초대장을 발급해 친구를 초대할 수 있어요' : '남은 초대장이 없어요');
  }catch(e){
    console.warn('[invite] 초대장 버튼 갱신 실패', e);
    _setInviteBtn(btn, '🎟️ 초대장', false, '초대장 수를 불러오지 못했어요');
  }
}

/* 초대장 발급 — 2단계 모달.
   1단계(확인): 아직 아무것도 차감 안 됨. [취소]나 창 닫기 → 그대로 종료.
   2단계(완료): [발급]을 누른 그 순간에 서버가 차감 + 코드 생성을 함께 하고 코드가 표시됨. */
async function issueInviteAndShow(){
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
    try{ const m = await userApiMod.myInvites(); cLeft.textContent = m ? '남은 초대장: ' + _leftText(m.invitesLeft) : ''; }
    catch(e){ cLeft.textContent = ''; }
  }
  ov.style.display = 'flex';
}

/* [발급] 확정 — 여기서 처음으로 차감이 일어남. 답을 못 받아 다시 누르면 같은 요청 번호(두 장이 나가지 않게) */
const _inviteIds = deps.inviteIds;   // 요청 번호 기억(request-id.js createPending) — 초대장 발급 다시 보내기
const INVITE_ISSUE_KEY = 'invite';
async function _inviteConfirmIssue(){
  const title  = document.getElementById('inviteIssuedTitle');
  const stepC  = document.getElementById('inviteConfirmStep');
  const stepI  = document.getElementById('inviteIssuedStep');
  const codeEl = document.getElementById('inviteIssuedCode');
  const leftEl = document.getElementById('inviteIssuedLeft');
  const okBtn  = document.getElementById('inviteConfirmOk');
  if(okBtn) okBtn.disabled = true;
  try{
    let r = null;
    try{ r = await userApiMod.createInvite(_inviteIds.idFor(INVITE_ISSUE_KEY)); _inviteIds.settle(INVITE_ISSUE_KEY); }
    catch(e){
      if(!(e && e.kind === 'unavailable')) _inviteIds.settle(INVITE_ISSUE_KEY);
      toast(userApiMod.reasonOf(e));
      const ov = document.getElementById('inviteIssuedOverlay');
      if(ov) ov.style.display = 'none';
      refreshInviteBtn();
      return;
    }
    if(title) title.textContent = '🎟️ 초대장 발급 완료';
    if(codeEl) codeEl.textContent = r.code;
    if(leftEl){
      try{ const m = await userApiMod.myInvites(); leftEl.textContent = m ? '남은 초대장: ' + _leftText(m.invitesLeft) : ''; }
      catch(e){ leftEl.textContent = ''; }
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
/* 🎫 «이 기기에서 해제» 는 이 기기만의 일이다 — LICENSE_OPTOUT_KEY 에 그 키를 적어 두고, 그 키는 다시 켜지 않는다.
   다른 PC 로 라이선스를 옮기던 계정 사본(accountSnap)은 0.13 에서 걷었다 — 서버가 계정의 라이선스를 안다(D8 묶음이 판정 · 기기 관리를 옮긴다). */
async function activateLicense(key){
  const r = await verifyLicense(key);
  if(r.ok){
    try{ localStorage.setItem(LICENSE_KEY_STORAGE, key.trim().toUpperCase()); localStorage.removeItem(LICENSE_OPTOUT_KEY); }catch(e){}
    _setPremium(true);
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
  _genLicenseKey,
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

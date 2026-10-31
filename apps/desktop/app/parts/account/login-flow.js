/* login-flow.js — 🔑 로그인 흐름 — 로그인 → 서버 가입 확인 → realtime 켜기 · 로컬 모드 · 내 계정 사본 (검사 sim-login-flow.js)
   [왜] 로그인(토큰 받기)만 Firebase Auth 가 하고, «이 로그인이 누구인가» 는 서버(GET /v1/me)가 정한다(설계 03-auth 3-1).
     게이트 · 계정 탭 · 밀려난 기기 화면이 같은 판정을 따로 하지 않게 한 곳에 둔다. 화면(DOM)은 모른다.
   [판정] confirm() → { state, me }
     'in'     — 서버가 계정을 돌려줌. me 사본을 이 PC 에 적는다(tw.me — 로그인 계정과 묶음).
     'signup' — 로그인은 됐는데 계정이 없음(401 USER_CODE_NOT_BOUND — 가입 전 · 탈퇴 · 관리자가 지움). 가입 화면 · 이 PC 계정 몫 지움은 부르는 쪽.
     'login'  — 로그인이 없음(익명 세션 포함) · 토큰이 끝남. 로그인 화면.
     'local'  — 서버에 닿지 못함 · 점검. 로컬 모드 — 이 PC 기능만 쓰고 me 는 마지막 사본(없으면 null). 다시 묻기는 서버가 살아 있다는 신호(realtime ready · 아무 API 요청이 서버 답을 받음)가 올 때 한 번 — 타이머로 되풀이하지 않는다(enterLocal).
   [가입] 비밀번호: POST /v1/users(토큰 없음) → 받은 친구코드 + 비밀번호로 Auth 로그인 → confirm. 답을 못 받아 다시 누르면 **같은 요청 번호**
     (서버가 처음 계정을 돌려준다 — 두 계정이 생기지 않게). 구글: 구글 로그인 → confirm 이 'signup' 이면 POST /v1/users { inviteCode }.
   [realtime] goOnline() — 서버가 계정을 돌려준 뒤에만 켠다(hello claim:true · 이 기기가 지금 기기). 밀려나면(4004) onSessionLost 로 밀려난 기기 화면을 띄운다.
   classic script — user-api.js · api-errors.js · rt-hub.js 다음 · app.js 보다 먼저 싣는다(window.TwLoginFlow). Firebase 를 모른다 — Auth 원시는 deps.auth. */
(function(){
'use strict';

const ME_CACHE_KEY = 'tw.me';   // { authUid, me, at } — 로컬 모드 · 프리미엄 유예의 «마지막 답»
const STATE = Object.freeze({ IN: 'in', SIGNUP: 'signup', LOGIN: 'login', LOCAL: 'local' });
const CANCELED_TEXT = '로그인이 취소됐어요';   // 옛 main 은 canceled 표시 없이 이 글만 보낸다 — 그냥 닫음으로 본다
const RT_READY = 'ready', RT_SESSION_LOST = 'sessionLost';   // rt-hub.js 상태 이름

/* 비밀번호 가입의 요청 번호 열쇠 — 비밀번호를 바꿔 다시 누르면 새 요청(같은 번호면 서버가 처음 비밀번호의 계정을 돌려준다).
   비밀번호 글을 그대로 들고 있지 않게 짧은 지문(FNV-1a)만. */
function joinKey(inviteCode, password){
  let h = 0x811c9dc5;
  const s = String(password || '');
  for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return 'join:' + String(inviteCode || '') + ':' + h.toString(36);
}
/* 마지막 답의 프리미엄이 아직 유효한가 — 서버가 준 유예(premiumGraceSec) 안일 때만(D8 라이선스 묶음이 판정에 쓴다) */
function premiumNow(cache, now){
  if(!cache || !cache.me || cache.me.premium !== true) return false;
  return (now - cache.at) <= cache.me.premiumGraceSec * 1000;
}

/** @param {{
 *   userApi: { me: Function, joinWithPassword: Function, joinWithGoogle: Function, updateMe: Function },
 *   translate: (err: any) => { action: string, code: string },
 *   reasonOf: (err: any) => string,
 *   auth: { ready: () => Promise<void>, user: () => ({ uid: string, anonymous: boolean } | null),
 *           signInGoogle: (idToken: string) => Promise<{ ok: boolean, email?: string, reason?: string }>,
 *           signInPassword: (code: string, pw: string) => Promise<{ ok: boolean, email?: string, reason?: string }>,
 *           signOut: () => Promise<void>, identity: () => ({ email: string | null, uid: string | null }) },
 *   googleWindow: () => Promise<{ ok: boolean, idToken?: string, canceled?: boolean, reason?: string }>,
 *   rt: { start: (o: { claim: boolean }) => void, stop: () => void, onState: (fn: (s: string) => void) => Function },
 *   pending: { idFor: (k: string) => string, settle: (k: string) => void },
 *   storage: { getItem: Function, setItem: Function, removeItem: Function },
 *   onSessionLost: () => void,
 *   forgetSession: () => void,   // 계정을 놓을 때 API 통로의 로그인 읽기 · 기억을 뗀다(TwApi.authed.forgetSession)
 *   now: () => number, onReachable: (fn: () => void) => Function,
 * }} deps */
function createLoginFlow(deps){
  const userApi = deps.userApi;
  const auth = deps.auth;
  const storage = deps.storage;
  const now = deps.now;
  let mode = 'off';           // 'off' · 'in' · 'local'
  let online = false;         // realtime 를 켰나
  let stateHooked = false;
  let rtLocal = false;        // 로컬 모드에서 realtime 을 켜 둔 상태(다시 붙는 신호를 받으려고 — 계정이 정해지면 그대로 쓴다)
  let localBack = null, localChecking = false;

  function readCache(){
    let o = null;
    try{ o = JSON.parse(storage.getItem(ME_CACHE_KEY) || 'null'); }catch(_){ o = null; }
    const u = auth.user();
    if(!o || !o.me || typeof o.at !== 'number' || !u || o.authUid !== u.uid) return null;   // 다른 로그인의 사본은 읽지 않는다
    return o;
  }
  function writeCache(me){
    const u = auth.user();
    if(!u || !me) return;
    try{ storage.setItem(ME_CACHE_KEY, JSON.stringify({ authUid: u.uid, me, at: now() })); }catch(_){}
  }
  function clearCache(){ try{ storage.removeItem(ME_CACHE_KEY); }catch(_){} }

  /* 이 로그인은 누구인가 — 위 [판정]. 던지지 않는다. */
  async function confirm(){
    try{ await auth.ready(); }catch(_){}
    const u = auth.user();
    if(!u || u.anonymous) return { state: STATE.LOGIN, me: null };
    let me = null;
    try{ me = await userApi.me(); }
    catch(e){
      const t = deps.translate(e);
      if(t.action === 'signup'){ clearCache(); return { state: STATE.SIGNUP, me: null }; }
      if(t.action === 'login') return { state: STATE.LOGIN, me: null, reason: deps.reasonOf(e) };
      const c = readCache();
      return { state: STATE.LOCAL, me: c ? c.me : null, reason: deps.reasonOf(e) };
    }
    if(!me){ const c = readCache(); return { state: STATE.LOCAL, me: c ? c.me : null, reason: '서버 답의 모양이 달라요' }; }
    writeCache(me);
    return { state: STATE.IN, me };
  }

  /* realtime 상태 신호 — 밀려남(4004)은 계정이 정해진 뒤에만 화면에 알리고, 로컬 모드에서 ready(서버가 다시 답함)면 계정을 한 번 다시 묻는다 */
  function hookState(){
    if(stateHooked) return;
    stateHooked = true;
    deps.rt.onState((s) => {
      if(s === RT_SESSION_LOST){ if(mode !== 'off') deps.onSessionLost(); }   // 로컬 모드에서도 진짜 밀려남이다(다른 PC 가 나중에 claim) — 알리지 않으면 되돌아와도 연결이 죽은 채 조용하다
      else if(s === RT_READY) onServerSign();
    });
    deps.onReachable(onServerSign);
  }
  /* 서버가 살아 있다는 신호 두 가지(realtime 이 다시 붙음 · 아무 API 요청이 서버 답을 받음) — 같은 한 함수. 로컬 모드일 때만 계정을 묻는다 */
  function onServerSign(){ if(mode === 'local') recheckLocal(); }
  /* 서버가 계정을 돌려준 뒤 — realtime 켜기(이 기기가 지금 기기 · claim). 이미 켰으면 아무 일 없음. */
  function goOnline(){
    mode = 'in'; localBack = null;
    hookState();
    rtLocal = false;   // 로컬 모드에서 이미 claim 으로 켠 연결은 그대로 쓴다
    if(online) return;
    online = true;
    deps.rt.start({ claim: true });
  }

  /* 로컬 모드 — 서버에 닿지 못했다. realtime(핵심 연결 — 혼자 다시 붙는다)을 켜 두고(claim — 앱을 켠 것이라 첫 hello 는 claim · 안 그러면 다른 기기 세션 때문에 4004 로 끊긴다),
     다시 붙었다는 신호(ready) 또는 서버가 답한 요청이 오면 계정을 한 번 묻는다. 닿으면 onBack(confirm 결과) 한 번 · 'in' 이면 같은 연결을 그대로 쓴다. 타이머로 되풀이하지 않는다. */
  function enterLocal(onBack){
    mode = 'local'; localBack = onBack;
    hookState();
    if(!online){ online = true; rtLocal = true; deps.rt.start({ claim: true }); }
  }
  async function recheckLocal(){
    if(localChecking) return;   // 신호가 겹쳐도 한 번
    localChecking = true;
    let r;
    try{ r = await confirm(); }finally{ localChecking = false; }
    if(mode !== 'local' || r.state === STATE.LOCAL) return;
    const back = localBack; localBack = null;
    if(r.state === STATE.IN) goOnline();
    else if(rtLocal){ rtLocal = false; online = false; try{ deps.rt.stop(); }catch(_){} }   // 계정이 없거나 로그인이 풀렸다 — 켜 둔 연결을 끈다
    try{ if(back) back(r); }catch(_){}
  }

  /* 구글 로그인 → confirm. 창을 그냥 닫으면 canceled(조용히 끝낼 일). 서버에 계정이 없으면(signup) 로그인을 놓는다 —
     «로그인은 됐는데 계정은 없는» 채로 껐다 켜면 켤 때 signup 으로 이 PC 계정 몫이 지워져 0.12 캐릭터가 올리기 전에 사라진다.
     가입으로 이어 가는 joinGoogle 만 keepOnSignup 으로 로그인을 둔다(바로 POST /v1/users 에 그 로그인이 필요하다). */
  async function loginGoogle(){ return googleSignInConfirm(false); }
  async function googleSignInConfirm(keepOnSignup){
    let g = null;
    try{ g = await deps.googleWindow(); }catch(_){ return { ok: false, reason: '로그인 창을 열지 못했어요' }; }
    if(!g || !g.ok) return { ok: false, canceled: !!(g && (g.canceled || !g.reason || g.reason === CANCELED_TEXT)), reason: (g && g.reason) || '' };
    const a = await auth.signInGoogle(g.idToken);
    if(!a || !a.ok) return { ok: false, reason: (a && a.reason) || '구글 계정 확인에 실패했어요' };
    const c = await confirm();
    if(c.state === STATE.SIGNUP && !keepOnSignup){ try{ await auth.signOut(); }catch(_){} }
    return { ok: c.state === STATE.IN, state: c.state, me: c.me, email: a.email || null, reason: c.reason || '' };
  }
  /* 친구코드 + 비밀번호 로그인 → confirm. 계정이 없으면(탈퇴 등) 로그인을 놓는다 — «로그인은 됐는데 계정은 없는» 상태를 남기지 않는다. */
  async function loginPassword(code, password){
    const a = await auth.signInPassword(code, password);
    if(!a || !a.ok) return { ok: false, reason: (a && a.reason) || '로그인에 실패했어요' };
    const c = await confirm();
    if(c.state === STATE.SIGNUP){ try{ await auth.signOut(); }catch(_){} return { ok: false, state: c.state, reason: '이 친구 코드의 계정을 찾지 못했어요' }; }
    return { ok: c.state === STATE.IN, state: c.state, me: c.me, reason: c.reason || '' };
  }

  /* 비밀번호 가입 — 위 [가입]. 돌려주는 것: { ok, me } · { ok:false, reason, joined }(joined = 계정은 만들어졌고 로그인만 못 함 — 다시 누르면 같은 계정) */
  async function joinPassword(o){
    const key = joinKey(o.inviteCode, o.password);
    let me = null;
    try{ me = await userApi.joinWithPassword({ inviteCode: o.inviteCode || null, password: o.password, requestId: deps.pending.idFor(key) }); }
    catch(e){
      if(e && e.kind !== 'unavailable') deps.pending.settle(key);   // 서버가 거절했다 — 다음 시도는 새 요청
      return { ok: false, reason: deps.reasonOf(e), code: (e && e.code) || '' };
    }
    if(!me) return { ok: false, reason: '서버 답의 모양이 달라요' };
    const a = await auth.signInPassword(me.friendCode, o.password);
    if(!a || !a.ok) return { ok: false, joined: true, reason: (a && a.reason) || '가입은 됐는데 로그인하지 못했어요 — 다시 눌러 주세요' };
    const c = await confirm();
    if(c.state !== STATE.IN) return { ok: false, joined: true, reason: c.reason || '가입은 됐는데 계정을 확인하지 못했어요 — 다시 눌러 주세요' };
    deps.pending.settle(key);
    return { ok: true, me: c.me };
  }
  /* 구글 가입 — 구글 로그인 → 이미 계정이면 그 계정(existing) · 없으면 POST /v1/users { inviteCode }. */
  async function joinGoogle(o){
    const l = await googleSignInConfirm(true);
    if(l.ok) return { ok: true, existing: true, me: l.me };
    if(l.state !== STATE.SIGNUP) return l;
    const dropLogin = async () => { try{ await auth.signOut(); }catch(_){} };   // 가입이 안 됐으면 계정 없는 로그인을 남기지 않는다
    let me = null;
    try{ me = await userApi.joinWithGoogle({ inviteCode: (o && o.inviteCode) || null }); }
    catch(e){
      if(e && e.code === 'USER_ALREADY_JOINED'){ const c = await confirm(); if(c.state === STATE.IN) return { ok: true, existing: true, me: c.me }; }
      await dropLogin();
      return { ok: false, reason: deps.reasonOf(e), code: (e && e.code) || '' };
    }
    if(!me){ await dropLogin(); return { ok: false, reason: '서버 답의 모양이 달라요' }; }
    writeCache(me);
    return { ok: true, me };
  }

  /* 내 계정 고치기 — 사본의 version 으로 보내고, 다른 곳에서 먼저 바뀌었으면(CONCURRENT_UPDATE) 다시 받아 한 번 더.
     fields: { displayName? , presencePref? }. 돌려주는 것: { ok, me } · { ok:false, err } */
  async function patchMe(fields){
    const send = async (version) => userApi.updateMe(Object.assign({ version }, fields));
    let c = readCache();
    try{
      if(!c){ const r = await confirm(); if(r.state !== STATE.IN) return { ok: false, err: { kind: 'unavailable', code: 'NO_ME' } }; c = readCache(); }
      let me;
      try{ me = await send(c.me.version); }
      catch(e){
        if(!(e && e.code === 'CONCURRENT_UPDATE')) throw e;
        const r = await confirm();
        if(r.state !== STATE.IN) throw e;
        me = await send(r.me.version);
      }
      if(!me) return { ok: false, err: { kind: 'unavailable', code: 'BAD_SHAPE' } };
      writeCache(me);
      return { ok: true, me };
    }catch(e){ return { ok: false, err: e }; }
  }

  /* 로그아웃 · 계정을 놓을 때 — realtime 을 끄고 · API 통로의 로그인 읽기를 떼고 · 로그인을 놓고 사본을 지운다. */
  async function logout(){
    online = false; rtLocal = false; localBack = null; mode = 'off';
    try{ deps.rt.stop(); }catch(_){}   // 안 끄면 토큰 없이 끝없이 다시 붙는다
    try{ deps.forgetSession(); }catch(_){}   // 진행 중인 로그인 읽기에 다음 계정이 묻어가지 않게(api-client forgetSession)
    clearCache();
    try{ await auth.signOut(); }catch(_){}
  }

  return {
    confirm, goOnline, enterLocal, loginGoogle, loginPassword, joinPassword, joinGoogle, patchMe, logout,
    meCache: () => readCache(),
    identity: () => auth.identity(),   // 지금 Auth 로그인 { email, uid } — 이 PC 로그인 표시(계정 탭 얼굴 · 진단)
    premiumNow: () => premiumNow(readCache(), now()),
    mode: () => mode,
  };
}

const api = { ME_CACHE_KEY, STATE, joinKey, premiumNow, createLoginFlow };
if(typeof window !== 'undefined') window.TwLoginFlow = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

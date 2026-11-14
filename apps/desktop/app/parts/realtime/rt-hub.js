/* rt-hub.js — 🛰 realtime 연결 하나(pv 3) — 로그인 뒤 늘 붙어 있는 웹소켓 · 닫힘 번호 표 · 작별(bye) · 살아 있음 확인 · 알림 → «다시 받기» 표 (검사 sim-rt-hub.js)
   [왜] 방 · 친구 접속 상태 · 알림 · 방 초대 · 대화 · 스티커사진이 **한 연결** 로 온다(서버 통신 규약 pv 3). 기능마다 연결을 따로 열지 않고,
     알림(notify — «바뀌었다» 만 · 데이터 없음)을 받으면 그 기능이 자기 자원을 다시 GET(ETag)한다.
   [연결] start({ claim }) — hello { pv:3, token, ver, deviceId, session, claim? } → ready{ userCode, graceMs }. 사고로 끊기면 다시 붙는다
     (realtime-link.js 백오프 1 · 2 · 4 · 8 · 15초 ±50%). 토큰은 만료 5분 전 같은 연결로 hello(link 가 한다).
     claim 은 앱을 켤 때 · «여기서 계속» 의 첫 hello 에만 — 다시 붙기 · 토큰 갱신에는 싣지 않는다(밀려난 앱이 되살아나 남을 밀지 않게).
     session 은 이번 실행의 값(저장 안 함) · deviceId 는 device-id.js(API 머리 X-Device-Id 와 같은 값).
   [닫힘 번호] CLOSE_CODES(서버 protocol/closeCodes.ts 와 같은 이름 · 값) → closeAction 한 곳(설계 04-realtime-disconnect 4-D-2).
     다시 붙는 것은 사고(1006 · 1009 · 4005 · 4008 · 모르는 1000번대 · 1001 은 첫 시도를 흩고 오래 기다림)뿐. 멈추는 번호 뒤엔
     사용자 누름 · 서버 신호(점검 해제)로만 start 를 다시 부른다(자동 재시도 없음). 4001 은 새 토큰으로 한 번 더 — ready 전 error auth 도 같게 센다.
   [작별] bye(why) — 로그아웃 · 탈퇴 · 계정 바꾸기: bye 를 보내고 서버의 닫힘(1000)을 BYE_WAIT_MS 기다린다(못 받으면 앱이 닫음). 방 leave 는 부르는 쪽이 먼저.
     quit() — 앱 끄기(beforeunload): bye{quit} 를 보내고 바로 닫는다. 작별 뒤 서버는 유예 없이 오프라인 · 자리 비움.
   [살아 있음] checkAlive() — 깨어남(main powerMonitor) · 네트워크 돌아옴(online) 때. ready 면 ping → PONG_WAIT_MS 안에 pong 이 없으면 끊고 다시 붙기,
     다시 붙는 중이면 기다림을 건너뛰고 바로 한 번. 주기 ping 은 없다(서버 웹소켓 ping 몫).
   [알림] on(종류, fn) — 묶음마다 자기 종류를 건다(KINDS 밖 이름은 던짐 — 오타가 조용히 안 오지 않게). 모르는 종류가 오면 버린다.
     fn({ kind, subject, section, resync:false }). **서버 유예(ready.graceMs)보다 오래 끊겼다 붙으면** 건 함수마다 한 번씩
     fn({ kind, resync:true }) — 끊긴 동안 놓친 알림을 메운다(서버가 ready 를 흩어 보내니 앱이 더 몰아 부르지 않는다).
   [그 밖의 메시지] onMessage(t, fn) — presence · announce · roomInvited · mobileFocus 와 방(ROOM_TYPES — C 묶음 방 포트 자리)의 메시지.
     send(msg) · request(msg)(rid 답 짝짓기 — presenceGet · random · peek). 방 포트는 이 둘 위에 만든다(방 규칙은 여기 없음).
   classic script — device-id.js 다음 · 쓰는 모듈 · app.js 보다 먼저 싣는다(window.TwRtHub). 연결 공통부(realtime-link.js · ES 모듈)와
     토큰 · 버전은 firebase-init.js 가 store.bind 로 잇는다 — bind 전 start 는 던진다. 켜는 것(start · stop · bye)은 로그인 흐름 몫. */
(function(){
'use strict';

const PV = 3;
/* 알림 종류 — 서버 규약 6장. 더할 땐 여기에 한 줄(서버는 종류를 더해도 pv 를 올리지 않는다) */
const KINDS = Object.freeze(['friends', 'friendRequests', 'card', 'notification', 'guestbook', 'gifts', 'collection', 'avatars', 'schedule',
  'license', 'photoQuota', 'notices', 'catalog', 'config', 'licenseRequests', 'friendSchedule']);
/* 방 안 · 방 목록 · 대화 · 스티커사진 메시지 — 방 포트(C 묶음)가 onMessage 로 받는다 */
const ROOM_TYPES = Object.freeze(['welcome', 'joined', 'left', 'patch', 'def', 'chat', 'poked', 'meta', 'music', 'disband', 'random', 'peek',
  'chatSaid', 'chatLine', 'photoWelcome', 'photoSlots', 'photoMeta', 'photoFrames', 'photoStarted', 'photoPos', 'photoEvent', 'photoShot']);
/* 그 밖에 받는 메시지 — ready · notify 는 허브가 먼저 쓴다 */
const MESSAGE_TYPES = Object.freeze(ROOM_TYPES.concat(['presence', 'roomInvited', 'mobileFocus', 'announce', 'sessionLost', 'error']));
const REQUEST_KINDS = Object.freeze(['presenceGet', 'random', 'peek']);
const ANSWERS = Object.freeze({ presence: 'presenceGet', random: 'random', peek: 'peek' });
/* 서버 close 코드 표 — 정본 t-w-server realtime/src/protocol/closeCodes.ts(PROTOCOL.md 7-1). 이름 · 값을 그대로 옮긴다. 4002 는 걷은 번호(다시 쓰지 않음). */
const CLOSE_CODES = Object.freeze({ bye: 1000, restart: 1001, tooLarge: 1009, auth: 4001, protocol: 4003, sessionLost: 4004,
  unavailable: 4005, maintenance: 4006, accountGone: 4007, helloTimeout: 4008 });
/* 닫힘마다 할 일 — 한 코드 한 처리. 표에 없는 번호는 closeAction 이 가른다(1000번대 · 번호 없음 = 사고 · 4000번대 = 멈춤) */
const ACTION = Object.freeze({ END: 'end', RECONNECT: 'reconnect', RESTART: 'restart', AUTH: 'auth', UPDATE: 'update',
  SESSION_LOST: 'sessionLost', MAINTENANCE: 'maintenance', ACCOUNT_GONE: 'accountGone', UNKNOWN: 'unknown' });
const CLOSE_ACTIONS = Object.freeze({
  [CLOSE_CODES.bye]: ACTION.END, [CLOSE_CODES.restart]: ACTION.RESTART, [CLOSE_CODES.tooLarge]: ACTION.RECONNECT,
  [CLOSE_CODES.auth]: ACTION.AUTH, [CLOSE_CODES.protocol]: ACTION.UPDATE, [CLOSE_CODES.sessionLost]: ACTION.SESSION_LOST,
  [CLOSE_CODES.unavailable]: ACTION.RECONNECT, [CLOSE_CODES.maintenance]: ACTION.MAINTENANCE, [CLOSE_CODES.accountGone]: ACTION.ACCOUNT_GONE,
  [CLOSE_CODES.helloTimeout]: ACTION.RECONNECT,
});
/** 닫힘 번호 → 할 일. 번호 없음(1006 · 앱이 끊음) · 모르는 1000번대는 사고로 다시 붙고, 모르는 4000번대는 새 서버의 «멈춰야 하는» 번호일 수 있어 멈춘다. */
function closeAction(code){
  if(typeof code !== 'number') return ACTION.RECONNECT;
  if(Object.prototype.hasOwnProperty.call(CLOSE_ACTIONS, code)) return CLOSE_ACTIONS[code];
  return (code >= 4000 && code <= 4999) ? ACTION.UNKNOWN : ACTION.RECONNECT;
}
const STATE = Object.freeze({ OFF: 'off', CONNECTING: 'connecting', READY: 'ready', RETRYING: 'retrying',
  SESSION_LOST: 'sessionLost', UPDATE: 'update', AUTH_FAILED: 'authFailed', MAINTENANCE: 'maintenance', ACCOUNT_GONE: 'accountGone', CLOSED: 'closed' });
/* 멈춤 할 일 → 상태 */
const STOP_STATES = Object.freeze({ [ACTION.UPDATE]: STATE.UPDATE, [ACTION.SESSION_LOST]: STATE.SESSION_LOST, [ACTION.MAINTENANCE]: STATE.MAINTENANCE,
  [ACTION.ACCOUNT_GONE]: STATE.ACCOUNT_GONE, [ACTION.UNKNOWN]: STATE.CLOSED, [ACTION.END]: STATE.OFF });
const BYE_WHY = Object.freeze({ LOGOUT: 'logout', QUIT: 'quit', WITHDRAW: 'withdraw', SWITCH: 'switch' });   // 서버 BYE_WHYS 와 같다
const START_WAIT_MS = 10000;     // start 가 첫 ready 를 기다리는 시간 — 넘으면 백오프로 계속 붙는다
const RESTART_SPREAD_MS = 30000;   // 1001(서버 재시작) 뒤 첫 시도를 0~이만큼 흩는다 — 모든 앱이 한꺼번에 몰리지 않게
const RESTART_READY_WAIT_MS = 35000;   // 그 연결의 ready 기다림 — 서버가 재시작 뒤 ready 를 0~30초 흩어 보낸다(흩기 상한 + 여유)
const BYE_WAIT_MS = 1000;        // bye 뒤 서버의 닫힘(1000)을 기다리는 시간 — 못 받으면 앱이 닫는다
const PONG_WAIT_MS = 5000;       // 깨어남 · online 때 보낸 ping 의 답 기다림

/* 붙을 주소 — 운영 · dev 앱. dev 서버는 이 PC 로컬(dev 용 공개 이름은 없다)이라 dev 기본은 로컬 8787 —
   dev 앱만 tw.realtimeUrl(같은 묶음의 wss · 로컬 8787)로 바꿀 수 있다. CSP connect-src 안이어야 한다(ws://127.0.0.1:8787 은 이미 열려 있다). */
const REALTIME_URLS = Object.freeze({ prod: 'wss://realtime.together-working.com', dev: 'ws://127.0.0.1:8787' });
const DEV_URL_KEY = 'tw.realtimeUrl';
const DEV_URL_RE = /^(?:wss:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:together-working\.com|togetherworking\.duckdns\.org)|ws:\/\/(?:127\.0\.0\.1|localhost):8787)$/;
function realtimeUrlFor(env, storage){
  if(env !== 'dev') return REALTIME_URLS.prod;
  try{
    const v = String((storage && storage.getItem(DEV_URL_KEY)) || '').trim().replace(/\/+$/, '');
    if(DEV_URL_RE.test(v) && v !== REALTIME_URLS.prod) return v;
  }catch(_){}
  return REALTIME_URLS.dev;
}
/* 세션 id — 서버 규칙 영숫자 _ - 1~32 · 이번 실행에만 */
const sessionIdOf = (uuid) => String(uuid).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);

/** @param {{ createLink: Function, WebSocket: Function | null, url: () => string | null, getToken: (force: boolean) => Promise<string | null>,
 *   getVersion: () => (string | Promise<string>), deviceId: () => string, session: string,
 *   now?: () => number, setTimeout?: Function, clearTimeout?: Function, random?: () => number, log?: { warn: Function } }} deps */
function createRtHub(deps){
  const now = deps.now || (() => Date.now());
  const log = deps.log || console;
  const kindFns = new Map(KINDS.map((k) => [k, []]));
  const msgFns = new Map(MESSAGE_TYPES.map((t) => [t, []]));
  const stateFns = [];
  let link = null;
  let started = false, claimNext = false, authFails = 0, lostAt = null, sawSessionLost = false;
  let state = STATE.OFF, userCode = null, lastClose = null;
  let pongTimer = null;
  let byeDone = null;   // bye 뒤 서버 닫힘을 기다리는 쪽 — { timer, res }
  const tSet = deps.setTimeout || ((f, ms) => setTimeout(f, ms));
  const tClear = deps.clearTimeout || ((h) => clearTimeout(h));
  const random = deps.random || Math.random;

  const warn = (...a) => { try{ log.warn('[realtime]', ...a); }catch(_){} };
  function setState(s){
    if(s === state) return;
    state = s;
    for(const fn of stateFns.slice()){ try{ fn(s); }catch(e){ warn('상태 알림 실패', e); } }
  }
  function emitKind(kind, payload){
    for(const fn of kindFns.get(kind).slice()){ try{ fn(payload); }catch(e){ warn('알림 처리 실패', kind, e); } }
  }
  /* 끊긴 동안 놓친 알림 메우기 — 건 함수마다 한 번(여러 종류에 같은 함수를 걸었어도 한 번) */
  function resync(){
    const done = new Set();
    for(const kind of KINDS){
      for(const fn of kindFns.get(kind).slice()){
        if(done.has(fn)) continue;
        done.add(fn);
        try{ fn({ kind, subject: null, section: null, resync: true }); }catch(e){ warn('다시 받기 실패', kind, e); }
      }
    }
  }
  function onServerMessage(m){
    if(m.t === 'notify'){
      if(!kindFns.has(m.kind)) return;   // 모르는 종류는 버린다(서버가 종류를 더해도 옛 앱이 깨지지 않게)
      emitKind(m.kind, { kind: m.kind, subject: (typeof m.subject === 'string') ? m.subject : null, section: (typeof m.section === 'string') ? m.section : null, resync: false });
      return;
    }
    if(m.t === 'pong'){ clearPong(); return; }
    if(m.t === 'sessionLost') sawSessionLost = true;
    const fns = msgFns.get(m.t);
    if(!fns) return;
    for(const fn of fns.slice()){ try{ fn(m); }catch(e){ warn('메시지 처리 실패', m.t, e); } }
  }
  /* 서버 유예 — 이보다 짧게 끊긴 동안의 알림은 서버가 들고 있다 보낸다. 칸이 없으면 0(늘 다시 받기 — 놓치는 쪽보다 낫다) */
  const graceOf = (m) => ((m && typeof m.graceMs === 'number' && m.graceMs >= 0) ? m.graceMs : 0);
  function onReady(m){
    authFails = 0; claimNext = false;
    userCode = (m && typeof m.userCode === 'string') ? m.userCode : null;
    const gap = (lostAt == null) ? null : now() - lostAt;
    lostAt = null;
    setState(STATE.READY);
    if(gap != null && gap > graceOf(m)) resync();
  }
  function clearPong(){ if(pongTimer){ tClear(pongTimer); pongTimer = null; } }
  function finishBye(){
    if(!byeDone) return;
    const b = byeDone; byeDone = null;
    tClear(b.timer); b.res();
  }
  function stopWith(s){ started = false; setState(s); }
  function onClosed(wasReady, fatal, closeCode){
    clearPong();
    lastClose = (typeof closeCode === 'number') ? closeCode : null;
    if(wasReady && lostAt == null) lostAt = now();
    if(!started){ finishBye(); setState(STATE.OFF); return; }
    if(sawSessionLost){ sawSessionLost = false; stopWith(STATE.SESSION_LOST); return; }
    const act = closeAction(closeCode);
    if(STOP_STATES[act]){ stopWith(STOP_STATES[act]); return; }
    if(act === ACTION.AUTH){
      // 멈추는 것은 서버가 4001(ready 전 error auth 포함 — link 가 같은 번호로 넘김)을 두 번 보냈을 때만.
      // 이 PC 에서 토큰을 못 받은 것(오프라인 등 · 번호 없음)은 서버에 닿지 못한 것이라 계속 다시 붙는다
      authFails++;
      if(authFails > 1){ stopWith(STATE.AUTH_FAILED); return; }
    }
    if(act === ACTION.AUTH || fatal === 'auth') link.markAuthRetry();   // 다음 열기는 새 토큰
    setState(STATE.RETRYING);
    if(act === ACTION.RESTART) link.scheduleReconnect({ delayMs: random() * RESTART_SPREAD_MS, readyWaitMs: RESTART_READY_WAIT_MS });
    else link.scheduleReconnect();
  }
  function makeLink(){
    return deps.createLink({
      WebSocket: deps.WebSocket, enabled: () => started, target: () => deps.url(), switchOk: () => true,
      getToken: (force) => deps.getToken(force), getUserId: () => null, getVersion: () => deps.getVersion(),
      pv: PV,
      helloFields: (phase) => {
        const o = { deviceId: deps.deviceId(), session: deps.session };
        if(phase === 'open' && claimNext) o.claim = true;
        return o;
      },
      requestKinds: REQUEST_KINDS.slice(), answers: Object.assign({}, ANSWERS), reflessKind: null, ridless: false,
      idleCloseMs: 0, busy: () => true, reconnectWanted: () => started,
      hooks: { onReady, onMessage: onServerMessage, onClosed },
      now: deps.now, setTimeout: deps.setTimeout, clearTimeout: deps.clearTimeout, random: deps.random, log: deps.log,
    });
  }

  /* 켜기 — 로그인(가입 확인) 뒤. claim 은 앱을 켤 때 · «여기서 계속» 에 true(기본 true). 이미 켜져 있으면 아무 일 없음. */
  function start(o){
    if(started) return;
    if(!link) link = makeLink();
    started = true; authFails = 0; sawSessionLost = false;
    claimNext = !(o && o.claim === false);
    setState(STATE.CONNECTING);
    link.ensureReady(START_WAIT_MS, { retry: true });
  }
  /* 끄기 — 로그아웃 · 계정을 놓을 때. 다시 켜면 처음부터(놓친 알림 메우기 없음 — 그때는 화면을 새로 받는다). */
  function stop(){
    started = false; lostAt = null; userCode = null;
    clearPong();
    if(link) link.close();
    setState(STATE.OFF);
  }
  /* 작별 — 로그아웃 · 탈퇴 · 계정 바꾸기. bye 를 보내고 서버의 닫힘(1000)을 BYE_WAIT_MS 까지 기다린다 · 못 받으면 앱이 close(1000).
     ready 가 아니면(인증 전 · 끊긴 중) 보낼 곳이 없으니 바로 끈다. 돌려주는 것: 끝나면 풀리는 Promise(던지지 않는다). */
  function bye(why){
    if(!started || !link){ stop(); return Promise.resolve(); }
    started = false; lostAt = null; userCode = null;
    clearPong();
    if(!link.send({ t: 'bye', why })){ link.close(); setState(STATE.OFF); return Promise.resolve(); }
    return new Promise((res) => {
      byeDone = { res, timer: tSet(() => { byeDone = null; link.close(); setState(STATE.OFF); res(); }, BYE_WAIT_MS) };
    });
  }
  /* 앱 끄기(beforeunload) — bye{quit} 를 보내고 기다리지 않고 닫는다(못 가면 서버는 1006 → 유예). */
  function quit(){
    if(!started || !link) return;
    started = false;
    clearPong();
    link.send({ t: 'bye', why: BYE_WHY.QUIT });
    link.close();
    setState(STATE.OFF);
  }
  /* 살아 있음 확인 — 깨어남 · 네트워크 돌아옴. ready 면 ping(이미 기다리는 중이면 그대로) · 다시 붙는 중이면 기다림을 건너뛰고 지금. */
  function checkAlive(){
    if(!started || !link) return;
    if(state === STATE.READY){
      if(pongTimer) return;
      if(!link.send({ t: 'ping' })) return;
      pongTimer = tSet(() => { pongTimer = null; if(started) link.drop(); }, PONG_WAIT_MS);
      return;
    }
    link.reconnectNow();
  }

  function on(kind, fn){
    if(!kindFns.has(kind)) throw new Error('[realtime] 모르는 알림 종류 — ' + kind);
    kindFns.get(kind).push(fn);
    return () => { const a = kindFns.get(kind), i = a.indexOf(fn); if(i >= 0) a.splice(i, 1); };
  }
  function onMessage(t, fn){
    if(!msgFns.has(t)) throw new Error('[realtime] 모르는 메시지 종류 — ' + t);
    msgFns.get(t).push(fn);
    return () => { const a = msgFns.get(t), i = a.indexOf(fn); if(i >= 0) a.splice(i, 1); };
  }
  function onState(fn){
    stateFns.push(fn);
    return () => { const i = stateFns.indexOf(fn); if(i >= 0) stateFns.splice(i, 1); };
  }

  return {
    start, stop, bye, quit, checkAlive, on, onMessage, onState,
    send: (msg) => (link ? link.send(msg) : false),
    request: (msg) => (link ? link.request(msg, (m) => m) : Promise.resolve(null)),
    state: () => state,
    userCode: () => userCode,
    isReady: () => state === STATE.READY,
    lastCloseCode: () => lastClose,
  };
}

/* 앱 창 신호 → 연결 — 앱 끄기는 작별(quit), 깨어남(main powerMonitor resume · unlock-screen) · 네트워크 돌아옴은 살아 있음 확인.
   win: addEventListener · companion.onWake(preload) */
function bindWindowEvents(win, hub){
  win.addEventListener('beforeunload', () => hub.quit());
  win.addEventListener('online', () => hub.checkAlive());
  if(win.companion) win.companion.onWake(() => hub.checkAlive());   // 웹 미리보기 · 검사 창엔 preload 가 없다(깨어남 신호 없이 online 만)
}

const api = { PV, KINDS, ROOM_TYPES, MESSAGE_TYPES, REQUEST_KINDS, ANSWERS, CLOSE_CODES, ACTION, CLOSE_ACTIONS, closeAction, STATE, BYE_WHY,
  START_WAIT_MS, RESTART_SPREAD_MS, RESTART_READY_WAIT_MS, BYE_WAIT_MS, PONG_WAIT_MS,
  REALTIME_URLS, DEV_URL_KEY, DEV_URL_RE, realtimeUrlFor, sessionIdOf, createRtHub, bindWindowEvents };
if(typeof window !== 'undefined'){
  /* 앱 한 벌 — 연결 공통부 · 토큰 · 버전은 firebase-init.js 가 bind 로 잇는다(ES 모듈이라 이 파일보다 늦게 돈다). */
  let bound = null;
  const need = () => { if(!bound) throw new Error('[realtime] 연결 재료가 아직 없다 — firebase-init 이 bind 한 뒤 start'); return bound; };
  let st = null; try{ st = window.localStorage; }catch(_){ st = null; }
  const env = window.TwApi.envOf(window);   // API 와 같은 판정 한 곳 — api-client.js 가 먼저 실린다
  const hub = createRtHub({
    createLink: (d) => need().createLink(d),
    WebSocket: window.WebSocket || null,
    url: () => realtimeUrlFor(env, st),
    getToken: (force) => need().getToken(force),
    getVersion: () => need().getVersion(),
    deviceId: () => window.TwDeviceId.store.get(),
    session: sessionIdOf(window.TwRequestId.newId()),
  });
  /* firebase-init.js 가 한 번 — { createLink(realtime-link.js), getToken(force), getVersion() } */
  hub.bind = (o) => { bound = o; };
  bindWindowEvents(window, hub);
  api.store = hub;
  window.TwRtHub = api;
}
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

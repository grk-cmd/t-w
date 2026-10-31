/* rt-hub.js — 🛰 realtime 연결 하나(pv 2) — 로그인 뒤 늘 붙어 있는 웹소켓 · 알림 → «다시 받기» 표 (검사 sim-rt-hub.js)
   [왜] 방 · 친구 접속 상태 · 알림 · 방 초대 · 대화 · 스티커사진이 **한 연결** 로 온다(서버 통신 규약 pv 2). 기능마다 연결을 따로 열지 않고,
     알림(notify — «바뀌었다» 만 · 데이터 없음)을 받으면 그 기능이 자기 자원을 다시 GET(ETag)한다.
   [연결] start({ claim }) — hello { pv:2, token, ver, deviceId, session, claim? } → ready{ userCode }. 끊기면 늘 다시 붙는다
     (realtime-link.js 백오프 1 · 2 · 4 · 8 · 15초 ±50%). 토큰은 만료 5분 전 같은 연결로 hello(link 가 한다).
     claim 은 앱을 켤 때 · «여기서 계속» 의 첫 hello 에만 — 다시 붙기 · 토큰 갱신에는 싣지 않는다(밀려난 앱이 되살아나 남을 밀지 않게).
     session 은 이번 실행의 값(저장 안 함) · deviceId 는 device-id.js(API 머리 X-Device-Id 와 같은 값).
   [닫힘 번호] 4001 토큰 — 새 토큰으로 한 번 더, 또 4001 이면 멈춤(state 'authFailed') · 4003 판이 다름 — 멈춤('update' · 업데이트 안내) ·
     4004 다른 기기가 차지(sessionLost) — 멈춤('sessionLost' · «여기서 계속» 은 start({ claim:true })) · 4005 · 그 밖 — 다시 붙기('retrying').
   [알림] on(종류, fn) — 묶음마다 자기 종류를 건다(KINDS 밖 이름은 던짐 — 오타가 조용히 안 오지 않게). 모르는 종류가 오면 버린다.
     fn({ kind, subject, section, resync:false }). **유예(RESYNC_AFTER_MS)보다 오래 끊겼다 붙으면** 건 함수마다 한 번씩
     fn({ kind, resync:true }) — 끊긴 동안 놓친 알림을 메운다(서버가 ready 를 흩어 보내니 앱이 더 몰아 부르지 않는다).
   [그 밖의 메시지] onMessage(t, fn) — presence · announce · roomInvited · mobileFocus 와 방(ROOM_TYPES — C 묶음 방 포트 자리)의 메시지.
     send(msg) · request(msg)(rid 답 짝짓기 — presenceGet · random · peek). 방 포트는 이 둘 위에 만든다(방 규칙은 여기 없음).
   classic script — device-id.js 다음 · 쓰는 모듈 · app.js 보다 먼저 싣는다(window.TwRtHub). 연결 공통부(realtime-link.js · ES 모듈)와
     토큰 · 버전은 firebase-init.js 가 store.bind 로 잇는다 — bind 전 start 는 던진다. 켜는 것(start · stop)은 로그인 흐름 몫. */
(function(){
'use strict';

const PV = 2;
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
const CLOSE = Object.freeze({ AUTH: 4001, PROTOCOL: 4003, SESSION_LOST: 4004, UNAVAILABLE: 4005 });
const STATE = Object.freeze({ OFF: 'off', CONNECTING: 'connecting', READY: 'ready', RETRYING: 'retrying',
  SESSION_LOST: 'sessionLost', UPDATE: 'update', AUTH_FAILED: 'authFailed' });
const RESYNC_AFTER_MS = 20000;   // 서버가 자리를 붙잡는 유예(room.timing.graceMs) — 이보다 짧게 끊긴 동안의 알림은 서버가 들고 있다가 보낸다
const START_WAIT_MS = 10000;     // start 가 첫 ready 를 기다리는 시간 — 넘으면 백오프로 계속 붙는다

/* 붙을 주소 — 운영 · dev 앱. dev 앱만 tw.realtimeUrl(같은 묶음의 wss · 로컬 8787)로 바꿀 수 있다. CSP connect-src 안이어야 한다. */
const REALTIME_URLS = Object.freeze({ prod: 'wss://realtime.together-working.com', dev: 'wss://realtime-dev.together-working.com' });
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
  let state = STATE.OFF, userCode = null;

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
    if(m.t === 'sessionLost') sawSessionLost = true;
    const fns = msgFns.get(m.t);
    if(!fns) return;
    for(const fn of fns.slice()){ try{ fn(m); }catch(e){ warn('메시지 처리 실패', m.t, e); } }
  }
  function onReady(m){
    authFails = 0; claimNext = false;
    userCode = (m && typeof m.userCode === 'string') ? m.userCode : null;
    const gap = (lostAt == null) ? 0 : now() - lostAt;
    lostAt = null;
    setState(STATE.READY);
    if(gap > RESYNC_AFTER_MS) resync();
  }
  function onClosed(wasReady, fatal, closeCode){
    if(wasReady && lostAt == null) lostAt = now();
    if(!started){ setState(STATE.OFF); return; }
    if(closeCode === CLOSE.SESSION_LOST || sawSessionLost){ sawSessionLost = false; started = false; setState(STATE.SESSION_LOST); return; }
    if(closeCode === CLOSE.PROTOCOL || fatal === 'protocol'){ started = false; setState(STATE.UPDATE); return; }
    // 멈추는 것은 서버가 보낸 4001 이 두 번일 때만 — 이 PC 에서 토큰을 못 받은 것(오프라인 등)은 서버에 닿지 못한 것이라 계속 다시 붙는다
    if(closeCode === CLOSE.AUTH){
      authFails++;
      if(authFails > 1){ started = false; setState(STATE.AUTH_FAILED); return; }
    }
    if(closeCode === CLOSE.AUTH || fatal === 'auth') link.markAuthRetry();   // 다음 열기는 새 토큰
    setState(STATE.RETRYING);
    link.scheduleReconnect();
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
    if(link) link.close();
    setState(STATE.OFF);
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
    start, stop, on, onMessage, onState,
    send: (msg) => (link ? link.send(msg) : false),
    request: (msg) => (link ? link.request(msg, (m) => m) : Promise.resolve(null)),
    state: () => state,
    userCode: () => userCode,
    isReady: () => state === STATE.READY,
  };
}

const api = { PV, KINDS, ROOM_TYPES, MESSAGE_TYPES, REQUEST_KINDS, ANSWERS, CLOSE, STATE, RESYNC_AFTER_MS, START_WAIT_MS,
  REALTIME_URLS, DEV_URL_KEY, DEV_URL_RE, realtimeUrlFor, sessionIdOf, createRtHub };
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
  api.store = hub;
  window.TwRtHub = api;
}
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

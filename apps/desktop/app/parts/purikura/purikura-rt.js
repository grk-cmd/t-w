/* purikura-rt.js — 📷 스티커사진 세션 포트(realtime 연결 하나 · photo* 메시지) (검사 sim-purikura-rt.js)
   세션(자리 넷 · 방장 · 설정 · 프레임 · 좌표 · 사건 · 셔터)과 하루 정원은 서버가 가진다 — 이 파일은 보내고 받은 것을 화면 모양으로 옮긴다.
     · 보내기: photoOpen{ fx } · photoLeave · photoConfig · photoFilter · photoCam · photoStart · photoCut · photoDone · photoFrame · photoPos · photoEvent · photoShutter
     · 받기: photoWelcome{ slot, slots, meta, frames } · photoSlots · photoMeta · photoFrames · photoStarted{ nth, left } · photoPos{ slot, p } · photoEvent{ slot, k, v, ts } · photoShot{ n, at }
     · 정원: GET /v1/rooms/photo-quota → { day, used, cap, left, reopenAt } · 바뀌면 알림 photoQuota(세션에 든 연결만) → 다시 GET.
   화면(purikura-ui.js)이 부르는 모양: open · close · release · isHost · mySlot · hostSlot · setConfig … · freezeMs · serverNow · slotsNow · framesNow.
   자리 칸은 { uid: userCode, name, fx } — 내 자리 · 좌석 찾기는 userCode 로 견준다(방 포트의 friendUserId 와 같은 값).
   classic script(window.TwPurikuraRt) — purikura-net.js(순수 계산) · rt-hub.js 다음 · app.js 보다 먼저. 만드는 곳은 app.js _purikura() 한 곳. */
(function(){
'use strict';

const QUOTA_PATH = '/v1/rooms/photo-quota';
const OPEN_WAIT_MS = 8000;       // photoWelcome · 거절을 기다리는 시간 — 넘으면 «지금은 들어갈 수 없어요»
const START_WAIT_MS = 8000;      // photoStarted · 정원 거절을 기다리는 시간(서버가 정원 길을 한 번 묻는다)
const START_FAIL_MSG = '지금은 시작할 수 없어요 — 잠시 뒤에 다시 눌러 주세요';
const START_NOT_READY_MSG = '서버에 연결된 뒤 시작할 수 있어요';
/* 서버 거절 → 화면 까닭. open 은 reason, start 는 message 로 쓴다. */
const OPEN_REFUSED = Object.freeze({ ROOM_PHOTO_BUSY: 'busy', ROOM_PHOTO_FULL: 'full', notInRoom: 'notInRoom' });
const START_REFUSED = Object.freeze({ ROOM_PHOTO_QUOTA_EXHAUSTED: 'closed', ROOM_PHOTO_QUOTA_UNAVAILABLE: 'unavailable', ROOM_PHOTO_NOT_HOST: 'not-host' });

/* 서버 자리 배열 ({ userCode, name, fx } | null)[4] → 화면 모양 { 번호: { uid, name, fx } } */
function slotsFromWire(arr){
  const o = {};
  (Array.isArray(arr) ? arr : []).forEach((v, i) => {
    if(v && typeof v.userCode === 'string') o[i] = { uid: v.userCode, name: v.name || '', fx: v.fx | 0 };
  });
  return o;
}
/* 서버 프레임 배열 (url | null)[4] → { 번호: url } — 빈 칸은 싣지 않는다 */
function framesFromWire(arr){
  const o = {};
  (Array.isArray(arr) ? arr : []).forEach((u, i) => { if(typeof u === 'string' && u) o[i] = u; });
  return o;
}

/** @param {{ hub: { onMessage: Function, on: Function, send: Function }, api: { get: Function }, P: object,
 *    serverNow: () => number, clock?: () => number, setTimeout?: Function, clearTimeout?: Function,
 *    onPeers?: Function, onMeta?: Function, onEvent?: Function, onShot?: Function, onSlots?: Function, onFrames?: Function }} deps */
function createPhotoSession(deps){
  const hub = deps.hub, api = deps.api, P = deps.P;
  const serverNow = deps.serverNow;
  const clock = deps.clock || Date.now;
  const tSet = deps.setTimeout || ((f, ms) => setTimeout(f, ms));
  const tClear = deps.clearTimeout || ((h) => clearTimeout(h));
  const noop = () => {};
  const onPeers = deps.onPeers || noop, onMeta = deps.onMeta || noop, onEvent = deps.onEvent || noop,
    onShot = deps.onShot || noop, onSlots = deps.onSlots || noop, onFrames = deps.onFrames || noop;

  let inSession = false, slot = -1, hostSlot = -1, slots = {}, meta = null, peers = {}, frames = {};
  let myCode = null;
  let lastSent = { wx: null, d: null, t: 0 };
  let opening = null, starting = null;   // 답을 기다리는 open · start 하나씩
  const quotaFns = [];

  /* 방장 = 살아 있는 자리 중 가장 작은 번호 · 내 자리는 userCode 로 찾는다 */
  function adoptSlots(o){
    slots = o || {};
    let host = -1, mine = -1;
    for(let i = 0; i < P.MAX_SLOTS; i++){
      const v = slots[i];
      if(!v || !v.uid) continue;
      if(host < 0) host = i;
      if(v.uid === myCode) mine = i;
    }
    hostSlot = host;
    slot = mine;
    for(const k of Object.keys(peers)) if(!slots[k]) delete peers[k];
  }
  function isHost(){ return inSession && slot >= 0 && hostSlot >= 0 && slot === hostSlot; }
  function reset(){ inSession = false; slot = -1; hostSlot = -1; slots = {}; meta = null; peers = {}; frames = {}; lastSent = { wx: null, d: null, t: 0 }; }

  function finishOpen(r){ const o = opening; if(!o) return; opening = null; tClear(o.timer); o.res(r); }
  function finishStart(r){ const s = starting; if(!s) return; starting = null; tClear(s.timer); s.res(r); }

  hub.onMessage('photoWelcome', (m) => {
    if(!opening || !m) return;
    inSession = true; peers = {}; meta = m.meta || null;
    adoptSlots(slotsFromWire(m.slots));
    if(typeof m.slot === 'number') slot = m.slot;
    frames = framesFromWire(m.frames);
    onSlots(slots); onMeta(meta); onFrames(frames);
    finishOpen({ ok: true, slot, host: isHost() });
  });
  hub.onMessage('photoSlots', (m) => { if(!inSession || !m) return; adoptSlots(slotsFromWire(m.slots)); onSlots(slots); onPeers(peers); });
  hub.onMessage('photoMeta', (m) => { if(!inSession || !m) return; meta = m.meta || null; onMeta(meta); });
  hub.onMessage('photoFrames', (m) => { if(!inSession || !m) return; frames = framesFromWire(m.frames); onFrames(frames); });
  hub.onMessage('photoPos', (m) => {
    if(!inSession || !m || m.slot === slot) return;
    const v = P.decPos(m.p);
    if(!v) return;
    peers[m.slot] = v; onPeers(peers);
  });
  hub.onMessage('photoEvent', (m) => { if(inSession && m && m.slot !== slot) onEvent(m.slot, { k: m.k, v: (m.v === undefined ? null : m.v), ts: m.ts }); });
  hub.onMessage('photoShot', (m) => { if(inSession && m) onShot({ n: m.n, at: m.at }); });
  hub.onMessage('photoStarted', (m) => {
    if(!m) return;
    const left = Math.max(0, m.left | 0), cap = P.CAP_PER_DAY, used = Math.max(0, cap - left);
    if(inSession) quotaFns.slice().forEach((f) => f(quotaOf({ left, used, cap })));
    finishStart({ ok: true, n: used, left, nth: (m.nth | 0) + '번째 · ' + left + '회 남음' });
  });
  hub.onMessage('error', (m) => {
    if(!m) return;
    if(opening && m.ref === 'photoOpen') finishOpen({ ok: false, reason: OPEN_REFUSED[m.code] || 'error' });
    else if(starting && m.ref === 'photoStart'){
      const reason = START_REFUSED[m.code] || 'error';
      const now = serverNow();
      finishStart({ ok: false, left: 0, reason, reopenAt: P.reopenAt(now),
        message: reason === 'closed' ? P.closedMessage(now) : START_FAIL_MSG });
    }
  });
  hub.on('photoQuota', () => { if(inSession && quotaFns.length) checkQuota().then((q) => quotaFns.slice().forEach((f) => f(q)), noop); });

  /* 정원 화면 모양 — 문 앞 안내 · 남은 횟수 칸 */
  function quotaOf(d){
    const cap = (d && d.cap > 0) ? (d.cap | 0) : P.CAP_PER_DAY;
    const left = Math.max(0, (d && d.left) | 0);
    const now = serverNow();
    return { ok: left > 0, left, used: (d && typeof d.used === 'number') ? d.used : cap - left, cap,
      label: left + ' / ' + cap, reopenAt: P.reopenAt(now), message: left > 0 ? '' : P.closedMessage(now) };
  }
  /* 문 앞에서 한 번 읽는다 — 못 읽으면 던진다(화면이 «지금은 확인할 수 없어요») */
  function checkQuota(){ return Promise.resolve(api.get(QUOTA_PATH, { auth: true })).then(quotaOf); }
  /* 창이 열려 있는 동안만 — 알림(photoQuota)이 오면 다시 GET · 시작하면 photoStarted 의 left */
  function watchQuota(cb){
    quotaFns.push(cb);
    return () => { const i = quotaFns.indexOf(cb); if(i >= 0) quotaFns.splice(i, 1); };
  }

  /* 자리 잡기 — 촬영 중이면 busy · 넷이 차면 full(서버가 정한다) */
  function open(roomCode, me){
    if(opening) return Promise.resolve({ ok: false, reason: 'error' });
    myCode = (me && me.userCode) || null;
    if(!roomCode || !myCode) return Promise.resolve({ ok: false, reason: 'notInRoom' });
    return new Promise((res) => {
      opening = { res, timer: tSet(() => finishOpen({ ok: false, reason: 'timeout' }), OPEN_WAIT_MS) };
      if(!hub.send({ t: 'photoOpen', fx: P.FILTER_REV })) finishOpen({ ok: false, reason: 'notReady' });
    });
  }
  /* 창을 닫을 때 · 꾸미기로 넘어갈 때(자리를 놓아야 다음 사람이 방장이 된다) — 마지막 사람이 나가면 서버가 세션을 지운다 */
  function close(){
    const was = inSession;
    reset();
    if(was) hub.send({ t: 'photoLeave' });
    return Promise.resolve();
  }

  /* 방장 일 — 보내기만 한다(서버가 photoMeta · photoFrames 로 모두에게 돌려준다). 안 보냈으면 false */
  const hostSend = (msg) => Promise.resolve(isHost() ? !!hub.send(msg) : false);
  function setConfig(cfg){
    /* 서버도 거르지만 화면 안내(«이 방향에는 그 컷 수를…»)를 위해 먼저 거른다 */
    if(!P.cutAllowed(cfg.orient, cfg.cuts)) return Promise.resolve(false);
    if(cfg.bg && P.bgJoin(String(cfg.bg).split(',')) !== String(cfg.bg)) return Promise.resolve(false);
    if(cfg.filter && !P.filterAllowed(cfg.filter)) return Promise.resolve(false);
    return hostSend({ t: 'photoConfig', orient: cfg.orient, cuts: cfg.cuts, basic: cfg.basic,
      bg: cfg.bg || 'white', filter: cfg.filter || 'none',
      camH: P.camClampH(cfg.camH === undefined ? P.CAM_HEIGHT : cfg.camH),
      camP: P.camClampP(cfg.camP === undefined ? P.CAM_PITCH : cfg.camP) });
  }
  function setFilter(id){ return P.filterAllowed(id) ? hostSend({ t: 'photoFilter', filter: id }) : Promise.resolve(false); }
  function setCam(h, p){ return hostSend({ t: 'photoCam', h: P.camClampH(h), p: P.camClampP(p) }); }
  /* at 0 = «i 번 컷을 기다리는 중» · 그 밖은 서버가 지금 시각을 찍는다 */
  function setCut(i, atMs){ return hostSend({ t: 'photoCut', i: i | 0, at: atMs === 0 ? 0 : 1 }); }
  function setDone(){ return hostSend({ t: 'photoDone' }); }
  function setFrameUrl(i, url){ return hostSend({ t: 'photoFrame', i: i | 0, url: url || null }); }
  function fireShutter(n){ return hostSend({ t: 'photoShutter', n: n | 0 }); }
  /* 촬영 시작 — 정원 한 칸은 서버가 이 순간에 쓴다 */
  function start(){
    if(!isHost()) return Promise.resolve({ ok: false, reason: 'not-host' });
    if(starting) return Promise.resolve({ ok: false, reason: 'busy' });
    return new Promise((res) => {
      starting = { res, timer: tSet(() => finishStart({ ok: false, reason: 'timeout', message: START_FAIL_MSG }), START_WAIT_MS) };
      if(!hub.send({ t: 'photoStart' })) finishStart({ ok: false, reason: 'notReady', message: START_NOT_READY_MSG });
    });
  }

  /* 좌표 — 실제로 달라졌을 때만 · 10Hz 이하(force 는 셔터 직전 · 회전을 마친 순간) */
  function sendPos(wx, d, force, gz, gp, yaw){
    if(!inSession || slot < 0) return false;
    const t = clock();
    if(!force){
      if(t - lastSent.t < P.SEND_MIN_MS) return false;
      if(lastSent.wx !== null && Math.abs(wx - lastSent.wx) < P.DEAD_X && Math.abs(d - lastSent.d) < P.DEAD_D) return false;
    }
    lastSent = { wx, d, t };
    hub.send({ t: 'photoPos', p: P.encPos(wx, d, gz, gp, yaw) });
    return true;
  }
  /* 사건(점프 · 포즈 · 눈 감기) — «눌렀다» 한 번 */
  function sendEvent(kind, value){
    if(!inSession || slot < 0) return false;
    hub.send({ t: 'photoEvent', k: kind, v: (value === undefined ? null : value) });
    return true;
  }

  return {
    checkQuota, watchQuota, open, close, release: close,
    isHost, mySlot: () => slot, hostSlot: () => hostSlot,
    setConfig, setFilter, setCam, setFrameUrl, start, setCut, setDone,
    sendPos, sendEvent, fireShutter, freezeMs: () => P.FREEZE_MS,
    serverNow: () => serverNow(),
    peersNow: () => peers, metaNow: () => meta, slotsNow: () => slots, framesNow: () => frames,
  };
}

const api = { QUOTA_PATH, OPEN_WAIT_MS, START_WAIT_MS, START_FAIL_MSG, START_NOT_READY_MSG, OPEN_REFUSED, START_REFUSED, slotsFromWire, framesFromWire, createPhotoSession };
if(typeof window !== 'undefined') window.TwPurikuraRt = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

/* purikura-rt.js — 📷 스티커사진 세션 포트(realtime 연결 하나 · 서버 통신 규약 4-6) (검사 sim-purikura-rt.js)
   [책임] 세션(자리 넷 · 방장 · 설정 · 프레임 · 좌표 · 사건 · 셔터)과 하루 정원은 서버가 가진다 — 이 파일은 보내고 받은 것을 화면 모양으로 옮긴다.
     · 보내기: photoOpen{ fx } · photoLeave · photoConfig · photoFilter · photoCam · photoStart · photoCut{ i, at } · photoDone · photoFrame{ i, url } · photoPos · photoEvent · photoShutter
     · 받기: photoWelcome{ slot, slots, meta, frames } · photoSlots · photoMeta · photoFrames · photoStarted{ nth, left } · photoPos{ slot, p } · photoEvent{ slot, k, v, ts } · photoShot{ n, at }
     · 정원: GET /v1/rooms/photo-quota → { day, used, cap, left, reopenAt } · 바뀌면 알림 photoQuota(사진 세션에 든 연결만) → 다시 GET.
   [방장] 서버가 정한다 — 판(meta)의 host(방장 userCode)가 원본이고, 방장이 바뀌면 서버가 photoMeta 를 다시 보낸다. 앱은 번호를 다시 계산하지 않는다. 방장 일은 방장이 아니면 보내지 않고, 보냈는데 서버가 거절하면(ROOM_PHOTO_NOT_HOST 등) onRefused 로 알린다.
   [자리를 잃는 때] 연결이 끊기거나 · 서버가 «방 밖» 이라고 답하면 세션을 버리고 onSlots({}) 로 알린다 — 화면이 «자리를 잃었어요» 를 한 번 띄운다.
     혼자 다시 들어가지 않는다(창을 닫았다 다시 열면 서버가 같은 자리를 돌려준다).
   [늦은 답] 요청마다 답은 순서대로 하나 — 시간 초과된 요청은 줄에 stale 로 남겨 그 늦은 답이 다음 요청의 답으로 읽히지 않게 한다.
     촬영 시작이 시간 초과 뒤에 서버에서 됐으면(photoMeta 의 shooting · photoStarted) 방장 화면이 onLateStart 로 이어 간다(서버가 원본).
   [서버 답] photoOpen 은 photoWelcome(성공) 또는 오류(ref photoOpen) · photoStart 는 photoStarted 또는 오류(ref photoStart) — 두 요청은 한 번에 하나씩 기다린다.
     그 밖의 요청은 성공 답이 없다(바뀐 값이 photoMeta · photoFrames 로 돌아온다).
   classic script(window.TwPurikuraRt) — rt-hub.js · purikura-net.js(순수 계산) 다음 · app.js 보다 먼저. 만드는 곳은 app.js _purikura() 한 곳. */
(function(){
'use strict';

const QUOTA_PATH = '/v1/rooms/photo-quota';
const OPEN_WAIT_MS = 8000;       // photoWelcome · 거절을 기다리는 시간 — 넘으면 «지금은 들어갈 수 없어요»
const START_WAIT_MS = 8000;      // photoStarted · 정원 거절을 기다리는 시간(서버가 정원 길을 한 번 묻는다)
/* 이 포트가 보내는 요청 이름 — 서버 오류의 ref 가 이 중 하나일 때만 이 포트 몫이다(방 · 대화 포트의 오류와 안 섞이게) */
const PHOTO_REFS = Object.freeze(['photoOpen', 'photoLeave', 'photoConfig', 'photoFilter', 'photoCam', 'photoStart', 'photoCut',
  'photoDone', 'photoFrame', 'photoPos', 'photoEvent', 'photoShutter']);
/* 방장만 보내는 요청 — 서버가 거절하면 onRefused 로 알린다 */
const HOST_REFS = Object.freeze(['photoConfig', 'photoFilter', 'photoCam', 'photoCut', 'photoDone', 'photoFrame', 'photoShutter']);
/* 서버 거절 → 화면 까닭. open 은 reason, start 는 reason + message 로 쓴다. 표에 없는 code 는 'error'. */
const OPEN_REFUSED = Object.freeze({ ROOM_PHOTO_BUSY: 'busy', ROOM_PHOTO_FULL: 'full', notInRoom: 'notInRoom' });
const START_REFUSED = Object.freeze({ ROOM_PHOTO_QUOTA_EXHAUSTED: 'closed', ROOM_PHOTO_QUOTA_UNAVAILABLE: 'unavailable',
  ROOM_PHOTO_NOT_HOST: 'not-host', notInRoom: 'notInRoom' });
/* 촬영 시작이 안 됐을 때 사용자에게 보이는 까닭 — 'closed' 는 날짜가 들어가서 closedMessage 로 만든다 */
const START_MESSAGES = Object.freeze({
  unavailable: '지금은 정원을 확인할 수 없어요 — 잠시 뒤에 다시 눌러 주세요',
  'not-host': '지금은 시작 권한이 없어요 — 방장이 바뀌었을 수 있어요',
  notInRoom: '방 밖에서는 시작할 수 없어요 — 창을 닫았다 다시 열어 주세요',
  notReady: '서버에 연결된 뒤 시작할 수 있어요',
  timeout: '지금은 시작할 수 없어요 — 잠시 뒤에 다시 눌러 주세요',
  error: '지금은 시작할 수 없어요 — 잠시 뒤에 다시 눌러 주세요',
});

/* 서버 자리 배열 (userCode, name, fx | null)[4] → 화면 모양 { 번호: { uid, name, fx } } — uid 는 userCode */
function slotsFromWire(arr){
  const o = {};
  (Array.isArray(arr) ? arr : []).forEach((v, i) => {
    if(v && typeof v.userCode === 'string') o[i] = { uid: v.userCode, name: (typeof v.name === 'string') ? v.name : '', fx: (+v.fx) || 0 };
  });
  return o;
}
/* 서버 프레임 배열 (url | null)[4] → { 번호: url } — 빈 칸은 싣지 않는다 */
function framesFromWire(arr){
  const o = {};
  (Array.isArray(arr) ? arr : []).forEach((u, i) => { if(typeof u === 'string' && u) o[i] = u; });
  return o;
}
/* 서버 판(meta) → 화면이 읽던 모양. 모양이 틀리면 null */
function metaFromWire(m){
  return (m && typeof m === 'object') ? Object.assign({}, m) : null;
}
const msOf = (v) => {
  if(typeof v === 'number' && isFinite(v)) return v;
  const t = (typeof v === 'string') ? Date.parse(v) : NaN;
  return isFinite(t) ? t : null;
};

/** 정원 화면 모양 — 문 앞 안내 · 남은 횟수 칸. d = { used, cap, left, reopenAt } (서버 답) · 모양이 틀리면 던진다(못 읽음 ≠ 0회 남음)
 * @param {{ used?: number, cap: number, left: number, reopenAt?: string|number }} d
 * @param {object} P purikura-net.js (closedMessage · reopenAt)
 * @param {number} nowMs 서버 시각 */
function quotaView(d, P, nowMs){
  if(!d || typeof d !== 'object' || !(d.cap > 0) || typeof d.left !== 'number' || !isFinite(d.left)) throw new Error('정원 답의 모양이 틀려요');
  const cap = d.cap | 0, left = Math.max(0, Math.min(cap, d.left | 0));
  return { ok: left > 0, left, used: (typeof d.used === 'number') ? d.used : cap - left, cap,
    label: P.quotaText(left, cap), reopenAt: msOf(d.reopenAt) || P.reopenAt(nowMs), message: left > 0 ? '' : P.closedMessage(nowMs) };
}

/** @param {{ hub: { onMessage: Function, on: Function, onState: Function, send: Function, isReady: () => boolean },
 *    api: { get: Function }, P: object, serverNow: () => number, clock?: () => number, setTimeout?: Function, clearTimeout?: Function,
 *    onPeers?: Function, onMeta?: Function, onEvent?: Function, onShot?: Function, onSlots?: Function, onFrames?: Function, onRefused?: Function, onLateStart?: Function,
 *    warn?: Function }} deps */
function createPhotoSession(deps){
  const hub = deps.hub, api = deps.api, P = deps.P;
  const serverNow = deps.serverNow;
  const clock = deps.clock || (() => Date.now());
  const tSet = deps.setTimeout || ((f, ms) => setTimeout(f, ms)), tClear = deps.clearTimeout || ((h) => clearTimeout(h));
  const warn = deps.warn || ((...a) => console.warn(...a));
  const noop = () => {};
  const onPeers = deps.onPeers || noop, onMeta = deps.onMeta || noop, onEvent = deps.onEvent || noop,
    onShot = deps.onShot || noop, onSlots = deps.onSlots || noop, onFrames = deps.onFrames || noop, onRefused = deps.onRefused || noop, onLateStart = deps.onLateStart || noop;

  let inSession = false, slot = -1, hostSlot = -1, slots = {}, meta = null, peers = {}, frames = {};
  let lastSent = { wx: null, d: null, t: 0 };
  let myCode = null;
  /* 보낸 순서대로 줄 세운 open · start 요청 — 서버는 요청 하나에 답 하나(photoWelcome · photoStarted 아니면 오류)를 순서대로 준다.
     시간 초과된 요청은 stale 로 줄에 남겨 둔다: 그 요청의 늦은 답이 다음 요청의 답으로 읽히지 않게(답이 오면 줄 맨 앞과 짝지어 stale 이면 버린다) */
  const openQ = [], startQ = [];
  const liveOf = (q) => q.find((e) => !e.stale) || null;
  const quotaFns = [];

  /* 내 자리 · 방장 자리 — 방장은 서버가 보낸 meta.host(userCode)가 앉은 자리다(없거나 자리에 없으면 -1) */
  function resolve(){
    slot = -1; hostSlot = -1;
    const host = meta && meta.host;
    for(let i = 0; i < P.MAX_SLOTS; i++){
      const v = slots[i];
      if(!v || !v.uid) continue;
      if(v.uid === myCode) slot = i;
      if(host && v.uid === host) hostSlot = i;
    }
    for(const k of Object.keys(peers)) if(!slots[k]) delete peers[k];
  }
  function isHost(){ return inSession && slot >= 0 && hostSlot >= 0 && slot === hostSlot; }
  function reset(){ inSession = false; slot = -1; hostSlot = -1; slots = {}; meta = null; peers = {}; frames = {}; lastSent = { wx: null, d: null, t: 0 }; }

  /* 답을 받았거나 보내지 못한 요청을 줄에서 빼고 약속을 푼다 */
  function settle(q, e, r){ const i = q.indexOf(e); if(i >= 0) q.splice(i, 1); tClear(e.timer); e.res(r); }
  /* 보낸 순서의 답 하나 — 줄 맨 앞(없으면 null). stale 이면 답만 버린다 */
  const nextAnswer = (q) => q.shift() || null;
  function startFail(reason){
    const now = serverNow();
    return { ok: false, left: 0, reason, reopenAt: P.reopenAt(now), message: reason === 'closed' ? P.closedMessage(now) : (START_MESSAGES[reason] || START_MESSAGES.error) };
  }
  /* 자리를 잃었다 — 세션을 버리고 화면에 «자리 없음» 을 알린다(혼자 다시 들어가지 않는다) */
  /* 세션을 놓거나 잃을 때 — 기다리던 요청을 접는다. 서버는 세션이 지워졌거나 방을 나가면 start 에 아무 답도 안 주니
     start 줄은 통째로 비운다(stale 이 남아 다음 열기의 photoMeta · photoStarted · 거절을 가로채지 않게).
     open 은 서버가 답을 주므로 기다리던 것만 stale 로 돌려 그 늦은 welcome 이 세션을 다시 켜지 못하게 한다. */
  function dropWaiting(){
    for(const e of openQ) if(!e.stale){ e.stale = true; tClear(e.timer); e.res({ ok: false, reason: 'error' }); }
    for(const e of startQ.slice()) if(!e.stale) settle(startQ, e, startFail('error'));
    startQ.length = 0;
  }
  function lose(){
    dropWaiting();
    if(!inSession) return;
    reset();
    onPeers(peers); onSlots(slots);
  }

  hub.onMessage('photoWelcome', (m) => {
    const o = nextAnswer(openQ);
    if(!o || o.stale) return;   // 시간 초과된 요청의 늦은 답 — 그때 이미 자리를 놓았다
    inSession = true; peers = {}; meta = metaFromWire(m.meta);
    slots = slotsFromWire(m.slots); resolve();
    if(slot < 0 && typeof m.slot === 'number') slot = m.slot;
    frames = framesFromWire(m.frames);
    onSlots(slots); onMeta(meta); onFrames(frames);
    tClear(o.timer); o.res({ ok: true, slot, host: isHost() });
  });
  hub.onMessage('photoSlots', (m) => { if(!inSession) return; slots = slotsFromWire(m.slots); resolve(); onSlots(slots); onPeers(peers); });
  hub.onMessage('photoMeta', (m) => {
    if(!inSession) return;
    const before = hostSlot;
    meta = metaFromWire(m.meta); resolve();
    onMeta(meta);
    if(hostSlot !== before) onSlots(slots);   // 방장이 바뀌었다 — 화면이 방장 표시 · 단추를 다시 그린다
    /* 시간 초과로 접은 촬영 시작이 서버에서는 됐다(shooting) — 서버가 원본이니 방장 화면이 이어 간다 */
    if(meta && meta.state === 'shooting' && isHost()) lateStart();
  });
  hub.onMessage('photoFrames', (m) => { if(!inSession) return; frames = framesFromWire(m.frames); onFrames(frames); });
  hub.onMessage('photoPos', (m) => {
    if(!inSession || m.slot === slot || !slots[m.slot]) return;
    const v = P.decPos(m.p);
    if(!v) return;
    peers[m.slot] = v; onPeers(peers);
  });
  hub.onMessage('photoEvent', (m) => { if(inSession && m.slot !== slot) onEvent(m.slot, { k: m.k, v: (m.v === undefined ? null : m.v), ts: m.ts }); });
  hub.onMessage('photoShot', (m) => { if(inSession) onShot({ n: m.n, at: m.at }); });
  hub.onMessage('photoStarted', (m) => {
    const nth = Math.max(0, m.nth | 0), left = Math.max(0, m.left | 0);
    if(inSession && nth + left > 0) quotaFns.slice().forEach((f) => f(quotaFromStart(nth, left)));
    const h = nextAnswer(startQ);
    if(!h) return;
    if(h.stale){ if(inSession && isHost()) lateStart(h); return; }
    tClear(h.timer); h.res({ ok: true, n: nth, left, nth: P.startedText(nth, left) });
  });
  /* 시간 초과로 접은 촬영 시작을 이어 간다 — 한 요청에 한 번만 */
  function lateStart(h){
    const e = h || startQ.find((x) => x.stale && !x.fired);
    if(!e || e.fired) return;
    e.fired = true;
    onLateStart();
  }
  hub.onMessage('error', (m) => {
    if(!m || PHOTO_REFS.indexOf(m.ref) < 0) return;
    if(m.ref === 'photoOpen'){
      const o = nextAnswer(openQ);
      if(o && !o.stale){ tClear(o.timer); o.res({ ok: false, reason: OPEN_REFUSED[m.code] || 'error' }); }
      return;
    }
    if(m.ref === 'photoStart'){
      const reason = START_REFUSED[m.code] || 'error';
      const h = nextAnswer(startQ);
      if(h && !h.stale){ tClear(h.timer); h.res(startFail(reason)); }
      if(reason === 'notInRoom') lose();
      return;
    }
    if(m.code === 'notInRoom'){ lose(); return; }
    if(inSession && HOST_REFS.indexOf(m.ref) >= 0) onRefused({ ref: m.ref, code: m.code });
  });
  /* 연결이 끊기면 서버는 이 연결의 자리를 비운다(유예 뒤) — 기다리던 요청도 접는다 */
  hub.onState(() => {
    if(hub.isReady()) return;
    for(const e of openQ.slice()) if(!e.stale) settle(openQ, e, { ok: false, reason: 'notReady' });
    for(const e of startQ.slice()) if(!e.stale) settle(startQ, e, startFail('notReady'));
    openQ.length = 0; startQ.length = 0;   // 끊긴 연결에는 답이 오지 않는다
    lose();
  });

  /* 정원 — 시작하면 photoStarted 의 nth · left 로 바로(cap = nth + left) */
  function quotaFromStart(nth, left){
    return quotaView({ used: nth, cap: nth + left, left }, P, serverNow());
  }
  /* 문 앞에서 한 번 읽는다 — 못 읽으면 던진다(화면이 «지금은 확인할 수 없어요» · 0회 남음과 다르다) */
  async function checkQuota(){
    return quotaView(await api.get(QUOTA_PATH, { auth: true }), P, serverNow());
  }
  /* 창이 열려 있는 동안만 — 알림(photoQuota)이 오면 다시 GET · 시작하면 photoStarted. 다시 받기에 실패하면 지금 숫자를 둔다(혼자 되풀이하지 않는다) */
  function watchQuota(cb){
    quotaFns.push(cb);
    return () => { const i = quotaFns.indexOf(cb); if(i >= 0) quotaFns.splice(i, 1); };
  }
  hub.on('photoQuota', () => {
    if(!inSession || !quotaFns.length) return;
    checkQuota().then((q) => quotaFns.slice().forEach((f) => f(q)), (e) => warn('[스티커사진] 정원을 다시 못 읽었어요', e));
  });

  /* 자리 잡기 — 촬영 중이면 busy · 넷이 차면 full · 방 밖이면 notInRoom(서버가 정한다) */
  function open(roomCode, me){
    if(liveOf(openQ)) return Promise.resolve({ ok: false, reason: 'error' });
    const code = (me && typeof me.userCode === 'string' && me.userCode) || null;
    if(!roomCode || !code) return Promise.resolve({ ok: false, reason: 'notInRoom' });
    myCode = code;
    return new Promise((res) => {
      const e = { res, stale: false, timer: null };
      openQ.push(e);
      e.timer = tSet(() => {
        /* 늦게 도착할 welcome 은 버려지니 서버에 자리가 남지 않게 놓는다 */
        e.stale = true; e.res({ ok: false, reason: 'timeout' });
        hub.send({ t: 'photoLeave' });
      }, OPEN_WAIT_MS);
      if(!hub.send({ t: 'photoOpen', fx: P.FILTER_REV })) settle(openQ, e, { ok: false, reason: 'notReady' });
    });
  }
  /* 창을 닫을 때 · 꾸미기로 넘어갈 때(자리를 놓아야 다음 사람이 방장이 된다) — 마지막 사람이 나가면 서버가 세션을 지운다 */
  function close(){
    const was = inSession;
    dropWaiting();
    reset();
    if(was) hub.send({ t: 'photoLeave' });
    return Promise.resolve();
  }

  /* 방장 일 — 보내기만 한다(서버가 photoMeta · photoFrames 로 모두에게 돌려준다). 보냈으면 true */
  const hostSend = (msg) => Promise.resolve(isHost() ? !!hub.send(msg) : false);
  function setConfig(cfg){
    /* 서버도 거르지만 화면 안내(«이 방향에는 그 컷 수를…»)를 위해 먼저 거른다 — 서버는 잘못된 값이면 통째로 거부한다 */
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
  /* atMs 0 = «i 번 컷을 기다리는 중» · 그 밖은 서버가 지금 시각을 찍어 모두에게 돌려준다(카운트다운은 그 값에서 센다) */
  function setCut(i, atMs){ return hostSend({ t: 'photoCut', i: i | 0, at: atMs === 0 ? 0 : 1 }); }
  function setDone(){ return hostSend({ t: 'photoDone' }); }
  function setFrameUrl(i, url){ return hostSend({ t: 'photoFrame', i: i | 0, url: url || null }); }
  function fireShutter(n){ return hostSend({ t: 'photoShutter', n: n | 0 }); }
  /* 촬영 시작 — 정원 한 칸은 서버가 이 순간에 쓴다 */
  function start(){
    if(!isHost()) return Promise.resolve(startFail('not-host'));
    if(liveOf(startQ)) return Promise.resolve(startFail('error'));
    return new Promise((res) => {
      const e = { res, stale: false, fired: false, timer: null };
      startQ.push(e);
      e.timer = tSet(() => { e.stale = true; e.res(startFail('timeout')); }, START_WAIT_MS);
      if(!hub.send({ t: 'photoStart' })) settle(startQ, e, startFail('notReady'));
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
    if(!hub.send({ t: 'photoPos', p: P.encPos(wx, d, gz, gp, yaw) })) return false;
    lastSent = { wx, d, t };
    return true;
  }
  /* 사건(점프 · 포즈 · 눈 감기) — «눌렀다» 한 번 */
  function sendEvent(kind, value){
    if(!inSession || slot < 0) return false;
    return !!hub.send({ t: 'photoEvent', k: kind, v: (value === undefined ? null : value) });
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

const api = { QUOTA_PATH, OPEN_WAIT_MS, START_WAIT_MS, PHOTO_REFS, HOST_REFS, OPEN_REFUSED, START_REFUSED, START_MESSAGES,
  slotsFromWire, framesFromWire, metaFromWire, quotaView, createPhotoSession };
if(typeof window !== 'undefined') window.TwPurikuraRt = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

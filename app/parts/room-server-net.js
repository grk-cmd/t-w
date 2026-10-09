/*
 * 방 서버(웹소켓) provider — makeFirebaseProvider 와 같은 모양(join · update · poke · pokeSelf · leave).
 * 통신 규약의 정본은 방 서버 저장소의 PROTOCOL.md (PROTOCOL_VERSION = 1) 다. 칸 이름 · 한도는 거기를 따른다.
 * peek · rid 는 v1 안에서 선택으로 더해진 것이다. 그 전 서버에서는 peek 이 null 로 끝나고, rid 없는 답은 보낸 순서로 짝짓는다.
 * 채팅 탭(멤버 칸 tab · chat 의 tab · meta 의 tabs)도 v1 안에서 더해졌다 — 그 전 서버는 tab 이 실린 메시지를 거절하므로 서버를 먼저 배포한다.
 *
 * 켤지 · 어느 서버로 갈지는 room-server-gate.js(관리자 스위치 config/roomServer · 방 주소록 roomDir)가 정하고,
 * firebase-init.js 가 그 결과 주소를 url() 로 넘긴다. url() 이 null 이면 서버 쪽은 아예 쓰지 않는다.
 * 주소가 바뀌면(다른 서버의 방) 방 밖에 있을 때 옛 연결을 닫고 새로 붙는다. 못 붙은 주소는 1분 동안 다시 시도하지 않는다.
 *
 * 서버가 맡는 규칙(정원 · 중복 접속 · 호스트 승계 · 해산 · 살아 있음)은 여기서 다시 판단하지 않는다.
 * Firebase 를 직접 부르지 않는다 — firebase-init.js 가 토큰 · 버전 · userId 를 넘겨 연결만 한다.
 *
 * deps: WebSocket, enabled() → bool, url() → 문자열 | null, getToken(force) → Promise<문자열 | null>,
 *       getUserId() → 문자열 | null, getVersion() → 문자열 | Promise,
 *       now · setTimeout · clearTimeout · setInterval · clearInterval · log 는 검사용(기본 전역).
 */
export const ROOM_SERVER_PV = 1;

const CONNECT_TIMEOUT_MS = 5000;     // 이 안에 ready 가 안 오면 Firebase 로 돌아간다
const JOIN_TIMEOUT_MS = 8000;
const REQ_TIMEOUT_MS = 4000;         // stats · random · peek · meta 답
const LEAVE_WAIT_MS = 1500;          // 나가기 확인(left)을 기다리는 최대 시간
const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000];
const STATE_MIN_GAP_MS = 1000;       // 집중 상태(focus/idle/sleep)는 1초에 한 번까지
const EXP_CHECK_MS = 30000;          // 경험치 칸은 하트비트가 없어서 바뀌었는지만 가끔 본다
const TOKEN_LEAD_MS = 5 * 60 * 1000; // 만료 5분 전에 새 토큰으로 hello
const TOKEN_FALLBACK_MS = 50 * 60 * 1000;
const TOKEN_MIN_MS = 60 * 1000;
const IDLE_CLOSE_MS = 60 * 1000;     // 방 밖에서 개수 · 랜덤만 물은 연결은 이만큼 쉬면 닫는다
const FAIL_COOLDOWN_MS = 60 * 1000;
// 끊긴 동안의 말 · 찌르기는 종류마다 마지막 몇 개만 들고 있다가 다시 붙으면 보낸다 — 오래된 건 뒤늦게 터지면 어색해서 버린다
const HELD_MAX = 5;
const HELD_TTL_MS = 15 * 1000;
/* 방 안에서 끊긴 뒤 이만큼 못 돌아오면 그 방은 포기한다(onLost 'unreachable' → app.js 가 같은 코드로 Firebase 에 다시 들어간다).
   재시작 한 번(몇 초)은 재연결로 이어 붙는다 — 재연결 간격 1·2·4·8·15초를 다 써 볼 만큼(30초)은 기다린다. */
export const ROOM_LOST_AFTER_MS = 30 * 1000;  // 못 붙었으면 이만큼은 다시 시도하지 않는다 — 서버가 죽었을 때 입장마다 5초씩 기다리지 않게

// 서버가 받는 멤버 칸(PROTOCOL.md «멤버 칸»). 모르는 칸이 하나라도 있으면 patch 통째로 거절되므로 여기서 거른다.
export const MEMBER_FIELDS = ['name', 'state', 'userStatus', 'customStatus', 'level', 'exp', 'cyc', 'clv', 'starC',
  'awaySz', 'lic', 'awayImg', 'ridingOn', 'seatedOn', 'bench', 'mobile', 'danceStyle', 'flyCool', 'noise', 'tab'];
const CHAT_FIELDS = ['text', 'fly', 'flyColor', 'flySize'];
// 💬 채팅 탭 자리 — chat-tabs.js SLOTS · 서버 PROTOCOL.md «채팅 탭». #일반은 id 가 없다.
export const CHAT_TAB_IDS = ['s1', 's2'];
// rid(요청 id)를 붙여 묻는 요청 — 답의 t 가 요청의 t 와 같다. 서버는 rid 를 1~16자(영숫자 _ . : -)만 받는다.
export const RID_REQUESTS = ['stats', 'random', 'peek'];

/* 방 전원이 봐야 하는 찌르기. 지금(Firebase)은 대상 노드에 쓰면 방 전체가 그 노드를 구독하고 있어서
   모두의 화면에서 그 사람 좌석이 반응한다(syncFriendSeats 의 pet · dizzy · fly: · bonk:). 같은 그림을 내려면 all.
   dance: 는 받은 본인만 춤추고 상태로 퍼뜨리므로 대상에게만 간다. */
export function isRoomWidePoke(type){
  const t = String(type || '');
  return t === 'pet' || t === 'dizzy' || t.indexOf('fly:') === 0 || t.indexOf('bonk:') === 0;
}

// Firebase ID 토큰의 만료 시각(ms). 못 읽으면 null.
export function jwtExpMs(token){
  try{
    const p = String(token).split('.')[1];
    const b = p.replace(/-/g, '+').replace(/_/g, '/');
    const s = b + '==='.slice((b.length + 3) % 4);
    const json = (typeof atob === 'function') ? atob(s) : Buffer.from(s, 'base64').toString('binary');
    const o = JSON.parse(json);
    return (typeof o.exp === 'number') ? o.exp * 1000 : null;
  }catch(_){ return null; }
}

// _sameRoomVal(app.js) 과 같은 비교 — null 과 undefined 는 같은 «값 없음».
function same(a, b){
  if(a === b) return true;
  if(a == null && b == null) return true;
  if(a == null || b == null) return false;
  if(typeof a === 'object' || typeof b === 'object'){
    try{ return JSON.stringify(a) === JSON.stringify(b); }catch(_){ return false; }
  }
  return false;
}

function pickFields(o){
  const out = {};
  for(const k of MEMBER_FIELDS){ if(o && o[k] !== undefined) out[k] = o[k]; }
  return out;
}

/* Presence 가 provider.update 로 넘기는 것(_basePayload + def · chat · chatTab · name)을 서버 메시지 셋으로 가른다.
   def → def, chat → chat(서버가 ts 를 찍으므로 ts 는 뺀다), 나머지 → patch. 바뀐 칸 고르기는 부르는 쪽 몫이다.
   💬 chatTab(#일반이 아닌 탭의 말) → chat + tab. 서버에는 칸이 하나(chat)뿐이고 tab 으로 가른다 — 받는 쪽은 chatTabFromWire. */
export function splitRoomPayload(payload){
  const out = { patch: null, def: undefined, chat: null };
  if(!payload) return out;
  const patch = pickFields(payload);
  if(Object.keys(patch).length) out.patch = patch;
  if(payload.def) out.def = payload.def;
  const ct = payload.chatTab;
  const src = (ct && typeof ct.text === 'string' && CHAT_TAB_IDS.indexOf(ct.tab) >= 0) ? ct
            : (payload.chat && typeof payload.chat.text === 'string') ? payload.chat : null;
  if(src){
    const c = {};
    for(const k of CHAT_FIELDS){ if(src[k] !== undefined) c[k] = src[k]; }
    if(src === ct) c.tab = ct.tab;
    out.chat = c;
  }
  return out;
}

/* 서버의 말풍선 { text, ts, fly?, …, tab? } → 친구 객체 칸. tab 이 있으면 chatTab(Firebase 방에서 멤버 노드에 쓰는 것과 같은 모양
   { tab, text, ts, … }), 없으면 chat. app.js 의 말풍선 · 탭 거르기(syncFriendSeats)가 고치지 않고 그대로 돈다. */
export function chatFromWire(m){
  const c = { text: m.text, ts: m.ts };
  if(m.fly !== undefined) c.fly = m.fly;
  if(m.flyColor !== undefined) c.flyColor = m.flyColor;
  if(m.flySize !== undefined) c.flySize = m.flySize;
  if(typeof m.tab === 'string' && m.tab) return { key: 'chatTab', val: Object.assign({ tab: m.tab }, c) };
  return { key: 'chat', val: c };
}

/* meta 요청이 반영됐는지 — tabs 는 { s1: { name } | null } 을 서버 meta.tabs 와 견준다. */
export function metaMatches(meta, want){
  return Object.keys(want).every((k) => {
    if(k !== 'tabs') return meta[k] === want[k];
    const cur = (meta && meta.tabs && typeof meta.tabs === 'object') ? meta.tabs : {};
    return Object.keys(want.tabs).every((id) => want.tabs[id] === null ? !cur[id] : !!(cur[id] && cur[id].name === want.tabs[id].name));
  });
}

export function createRoomServerNet(deps){
  const tSet = deps.setTimeout || ((f, ms) => setTimeout(f, ms));
  const tClear = deps.clearTimeout || ((h) => clearTimeout(h));
  const iSet = deps.setInterval || ((f, ms) => setInterval(f, ms));
  const iClear = deps.clearInterval || ((h) => clearInterval(h));
  const now = deps.now || (() => Date.now());
  const log = deps.log || console;

  let ws = null, gen = 0, opening = false, ready = false, fatal = null;
  let token = null, helloUid = null, helloVer = null, forceToken = false, authRetried = false;
  let tokenTimer = null, idleTimer = null, reconnectTimer = null, connectTimer = null, attempt = 0, downSince = null;
  let readyWaiters = [];
  let failAt = -Infinity, failCode = null, failUrl = null, curUrl = null;
  const reqWaiters = new Map();   // rid → { kind, done } — 답은 rid 로 짝짓는다(보낸 순서에 기대지 않는다)
  let ridSeq = 0;
  let active = null;   // 방에 들어가 있거나 들어가는 중인 provider 의 속(P)
  let lingering = null;  // 나가기 확인(left)을 기다리는 provider — active 를 비운 뒤라 따로 잡아 둔다

  // 방 안이면 그 방을 연 서버로(재연결도), 방 밖이면 지금 고른 주소로.
  function targetUrl(){
    if(active && active.inRoom && active.url) return active.url;
    try{ return deps.url() || null; }catch(_){ return null; }
  }

  function enabled(){
    try{ return !!(deps.WebSocket && deps.enabled && deps.enabled() && deps.url && deps.url()); }catch(_){ return false; }
  }

  function sendRaw(sock, o){
    try{ sock.send(JSON.stringify(o)); return true; }catch(_){ return false; }
  }
  function send(o){
    if(!ws || !ready) return false;
    return sendRaw(ws, o);
  }

  function settleReady(result){
    const ws_ = readyWaiters; readyWaiters = [];
    for(const w of ws_){ tClear(w.timer); w.res(result); }
  }

  // ── 연결 ────────────────────────────────────────────────────────────
  async function open(){
    if(opening || ws) return;
    opening = true;
    const my = ++gen;
    fatal = null;
    const force = forceToken; forceToken = false;
    let tk = null, ver = null, uid = null;
    try{ tk = await deps.getToken(force); }catch(_){ tk = null; }
    try{ ver = await deps.getVersion(); }catch(_){ ver = null; }
    try{ uid = deps.getUserId(); }catch(_){ uid = null; }
    opening = false;
    if(my !== gen) return;
    // 로그인 토큰이나 userId 가 없으면 서버가 받아 주지 않는다(서버는 userAuth 로 묶인 계정만 받는다).
    if(!tk || !uid){ fatal = 'auth'; closed(); return; }
    token = tk; helloUid = uid; helloVer = (typeof ver === 'string' && ver) ? ver : '0.0.0';
    let sock;
    try{ curUrl = targetUrl(); sock = new deps.WebSocket(curUrl); }catch(_){ fatal = 'connect'; closed(); return; }
    ws = sock;
    connectTimer = tSet(() => { connectTimer = null; if(my === gen && !ready){ fatal = fatal || 'timeout'; drop(); } }, CONNECT_TIMEOUT_MS);
    sock.onopen = () => { if(my === gen) sendRaw(sock, { t: 'hello', pv: ROOM_SERVER_PV, token: tk, userId: uid, ver: helloVer }); };
    sock.onmessage = (ev) => {
      if(my !== gen) return;
      let m = null;
      try{ m = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); }catch(_){ return; }
      if(m && typeof m.t === 'string') onMsg(m);
    };
    sock.onclose = () => { if(my === gen) closed(); };
    sock.onerror = () => {};
  }

  // 지금 연결을 버린다. 옛 소켓에서 늦게 오는 것은 gen 으로 걸러진다.
  function drop(){
    const s = ws;
    gen++;
    if(s){ try{ s.close(); }catch(_){} }
    closed();
  }

  function closed(){
    ws = null; opening = false;
    const wasReady = ready;
    ready = false;
    if(connectTimer){ tClear(connectTimer); connectTimer = null; }
    if(tokenTimer){ tClear(tokenTimer); tokenTimer = null; }
    if(idleTimer){ tClear(idleTimer); idleTimer = null; }
    if(!wasReady){ failAt = now(); failCode = fatal || 'closed'; failUrl = curUrl; }
    settleReady({ ok: false, code: fatal || 'closed' });
    const pending = [...reqWaiters.values()]; reqWaiters.clear();
    for(const w of pending) w.done(null);
    const P = active;
    if(!P || !P.inRoom || P.leaving) return;
    if(P.joinWaiter && !P.joined){
      // 첫 입장도 못 했다 — 부르는 쪽이 Firebase 로 돌아가게 실패로 끝낸다.
      finishJoin(P, { ok: false, code: fatal || 'closed' });
      return;
    }
    if(fatal === 'version' || fatal === 'protocol' || (fatal === 'auth' && authRetried)){
      lost(P, fatal);
      return;
    }
    if(fatal === 'auth'){ authRetried = true; forceToken = true; }
    if(wasReady) attempt = 0;
    if(downSince === null) downSince = now();
    if(now() - downSince >= ROOM_LOST_AFTER_MS){ downSince = null; failAt = now(); failUrl = curUrl; lost(P, 'unreachable'); return; }
    scheduleReconnect();
  }

  function scheduleReconnect(){
    if(reconnectTimer) return;
    const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
    attempt++;
    reconnectTimer = tSet(() => {
      reconnectTimer = null;
      if(active && active.inRoom && !ws) open();
    }, delay);
  }

  function scheduleToken(){
    if(tokenTimer){ tClear(tokenTimer); tokenTimer = null; }
    const exp = jwtExpMs(token);
    const delay = exp ? Math.max(TOKEN_MIN_MS, exp - now() - TOKEN_LEAD_MS) : TOKEN_FALLBACK_MS;
    tokenTimer = tSet(async () => {
      tokenTimer = null;
      let tk = null;
      try{ tk = await deps.getToken(true); }catch(_){ tk = null; }
      if(!ready || !tk){ if(ready) scheduleToken(); return; }
      token = tk;
      send({ t: 'hello', pv: ROOM_SERVER_PV, token: tk, userId: helloUid, ver: helloVer });
      scheduleToken();
    }, delay);
  }

  function scheduleIdle(){
    if(idleTimer){ tClear(idleTimer); idleTimer = null; }
    if(active) return;
    idleTimer = tSet(() => {
      idleTimer = null;
      if(!active && !reqWaiters.size) close();
    }, IDLE_CLOSE_MS);
  }

  function close(){
    if(reconnectTimer){ tClear(reconnectTimer); reconnectTimer = null; }
    const s = ws;
    gen++;
    ws = null; opening = false; ready = false;
    if(s){ try{ s.close(1000); }catch(_){} }
    if(connectTimer){ tClear(connectTimer); connectTimer = null; }
    if(tokenTimer){ tClear(tokenTimer); tokenTimer = null; }
    if(idleTimer){ tClear(idleTimer); idleTimer = null; }
  }

  function ensureReady(ms){
    if(!enabled()) return Promise.resolve({ ok: false, code: 'off' });
    const want = targetUrl();
    // 다른 서버의 방으로 간다 — 방 밖일 때만 옛 연결을 닫는다(방 안이면 그 방이 끝날 때까지 그대로).
    if((ws || opening) && curUrl !== want && !(active && active.inRoom)) close();
    if(ready) return Promise.resolve({ ok: true });
    if(!ws && !opening && failUrl === want && now() - failAt < FAIL_COOLDOWN_MS) return Promise.resolve({ ok: false, code: failCode || 'closed' });
    return new Promise((res) => {
      const w = { res, timer: null };
      w.timer = tSet(() => {
        const i = readyWaiters.indexOf(w);
        if(i >= 0) readyWaiters.splice(i, 1);
        res({ ok: false, code: 'timeout' });
      }, ms || CONNECT_TIMEOUT_MS);
      readyWaiters.push(w);
      if(!ws && !opening) open();
    });
  }

  function request(msg, map){
    return ensureReady().then((r) => {
      if(!r.ok) return null;
      return new Promise((res) => {
        const rid = 'q' + (++ridSeq).toString(36);
        const w = { kind: msg.t, done: null, timer: null };
        w.done = (m) => { tClear(w.timer); reqWaiters.delete(rid); res(m ? map(m) : null); scheduleIdle(); };
        w.timer = tSet(() => { reqWaiters.delete(rid); res(null); }, REQ_TIMEOUT_MS);
        reqWaiters.set(rid, w);
        if(!send(Object.assign({}, msg, { rid }))) w.done(null);
      });
    });
  }
  // 답 하나 → 기다리던 요청. rid 가 없는 답(rid 를 모르는 옛 서버)만 같은 종류 중 가장 먼저 보낸 것에 준다.
  function takeWaiter(kind, rid){
    if(typeof rid === 'string') return reqWaiters.get(rid) || null;
    for(const w of reqWaiters.values()){ if(w.kind === kind) return w; }
    return null;
  }
  function stats(){
    return request({ t: 'stats' }, (m) => ({ workingroom: m.workingroom | 0, togetherroom: m.togetherroom | 0, total: m.total | 0 }));
  }
  function random(limit){
    const msg = { t: 'random' };
    if(limit > 0) msg.limit = Math.min(50, limit | 0);
    return request(msg, (m) => (Array.isArray(m.rooms) ? m.rooms.filter((c) => typeof c === 'string') : []));
  }
  /* 들어가지 않고 방 보기 — { exists, count, channel, secret } · 못 물으면 null(꺼짐 · 못 붙음 · 시간 초과 · peek 을 모르는 서버).
     방 밖 · 방 안 어디서나 묻는다(지금 자리는 그대로). */
  function peek(room){
    return request({ t: 'peek', room: String(room || '') }, (m) => ({
      exists: m.exists === true, count: m.count | 0,
      channel: (m.channel === 'workingroom' || m.channel === 'togetherroom') ? m.channel : null,
      secret: m.secret === true,
    }));
  }

  // ── 받은 메시지 ─────────────────────────────────────────────────────
  function onMsg(m){
    const P = active;
    switch(m.t){
      case 'ready':
        if(!ready){
          ready = true; attempt = 0; authRetried = false; failAt = -Infinity; downSince = null;
          if(connectTimer){ tClear(connectTimer); connectTimer = null; }
          scheduleToken();
          if(P && P.inRoom) onReady(P);
          settleReady({ ok: true });
          scheduleIdle();
        }else{
          scheduleToken();   // 토큰 갱신 hello 의 답
        }
        return;
      case 'error':
        if(!ready && (m.code === 'auth' || m.code === 'version' || m.code === 'protocol')){
          fatal = m.code;     // 서버가 곧 끊는다(4001 · 4002 · 4003). 기다리는 쪽은 closed() 에서 이 코드를 받는다.
          drop();
          return;
        }
        if(m.code === 'auth' && m.ref === 'hello') return;   // 갱신 실패 — 만료 뒤 서버가 끊으면 재연결이 새 토큰을 받는다
        /* 묻기 요청이 거절됐다 — 오류에는 rid 가 없어서 그 종류 중 가장 먼저 보낸 것을 실패로 끝낸다.
           peek 을 모르는 옛 서버는 ref 없이 badRequest 를 준다(모르는 t) — 이 모듈은 깨진 JSON 을 보내지 않으니 그건 peek 뿐이다. */
        if(m.code === 'badRequest' && (RID_REQUESTS.indexOf(m.ref) >= 0 || !m.ref)){
          const w = takeWaiter(m.ref || 'peek', undefined);
          if(w){ w.done(null); return; }
        }
        if(P) onError(P, m);
        return;
      case 'stats':
      case 'random':
      case 'peek': {
        const w = takeWaiter(m.t, m.rid);
        if(w && w.kind === m.t) w.done(m);
        return;
      }
      default: {
        const L = lingering;
        if(m.t === 'left' && L && m.memberId === L.memberId && m.reason === 'leave'){
          lingering = null;
          if(L.leaveWaiter) L.leaveWaiter.done();
          return;
        }
        if(P) onEvent(P, m);
      }
    }
  }

  // ── provider ────────────────────────────────────────────────────────
  function stopTimers(P){
    if(P.stateTimer){ tClear(P.stateTimer); P.stateTimer = null; }
    if(P.expTimer){ iClear(P.expTimer); P.expTimer = null; }
  }

  function canSend(P){ return ready && P.inRoom && !!P.memberId && !P.awaitingWelcome && active === P; }

  function sendJoin(P, full){
    const msg = { t: 'join', room: P.room };
    if(!full && P.resume){
      msg.resume = P.resume;
    }else{
      msg.me = Object.assign({}, P.current, { def: P.def });
      // #일반(null)이면 tab 을 싣지 않는다 — 채팅 탭을 모르는 옛 서버에도 들어갈 수는 있게(null = 칸 없음이라 뜻은 같다)
      if(msg.me.tab == null) delete msg.me.tab;
      if(P.userId) msg.me.userId = P.userId;
      if(P.create) msg.create = P.create;
      P.sent = Object.assign({}, P.current);
      P.defDirty = false;
    }
    P.awaitingWelcome = true;
    send(msg);
  }

  function onReady(P){
    if(P.joined) sendJoin(P, !P.resume);    // 다시 붙음 — resume 먼저
    else if(P.joinWaiter) sendJoin(P, true);
  }

  function notifyLeft(P){
    if(P.joined && !P.leftNotified){
      P.leftNotified = true;
      try{ if(P.hooks.onLeft) P.hooks.onLeft(P.room); }catch(_){}
    }
  }

  function detach(P){
    P.inRoom = false;
    P.held = { chat: [], poke: [] };
    if(active === P) downSince = null;
    stopTimers(P);
    notifyLeft(P);
    if(active === P) active = null;
    scheduleIdle();
  }

  function finishJoin(P, result){
    const w = P.joinWaiter;
    if(!w) return;
    P.joinWaiter = null;
    tClear(w.timer);
    if(!result.ok){
      if(ready && P.sentAnyJoin) send({ t: 'leave' });   // 늦게 welcome 이 와도 자리가 남지 않게
      detach(P);
    }
    w.res(result);
  }

  function lost(P, code){
    detach(P);
    try{ if(P.hooks.onLost) P.hooks.onLost(code); }catch(_){}
  }

  function onError(P, m){
    if(m.ref === 'join'){
      if(m.code === 'resumeFailed'){ sendJoin(P, true); return; }   // 자리가 없다 — 전체 상태로 다시
      P.awaitingWelcome = false;
      if(P.joinWaiter && !P.joined){ finishJoin(P, { ok: false, code: m.code }); return; }
      if(P.inRoom) lost(P, m.code);   // 다시 붙는 중에 정원 · 기간 등으로 막혔다
      return;
    }
    if(m.ref === 'meta'){
      const list = P.metaWaiters; P.metaWaiters = [];
      for(const w of list) w.done({ ok: false, code: m.code });
      return;
    }
    if(m.ref === 'leave' || m.code === 'notInRoom') return;
    try{ log.warn('[방 서버] 거절 —', m.code, m.ref || ''); }catch(_){}
  }

  // 멤버 모습 → 친구 객체. 마지막 말풍선에 tab 이 있으면 chatTab 자리로(chatFromWire).
  const memberFrom = (view) => {
    const v = Object.assign({}, view || {});
    if(v.chat && typeof v.chat === 'object'){
      const c = chatFromWire(v.chat);
      delete v.chat;
      v[c.key] = c.val;
    }
    return v;
  };

  function setMeta(P, meta){
    if(!meta) return;
    const prev = P.meta;
    P.meta = meta;
    const list = P.metaWaiters; P.metaWaiters = [];
    for(const w of list){
      if(metaMatches(meta, w.want)) w.done({ ok: true });
      else P.metaWaiters.push(w);
    }
    try{ if(P.hooks.onMeta) P.hooks.onMeta(meta, prev); }catch(_){}
  }

  /* 친구 객체를 makeFirebaseProvider 가 changeCb 로 넘기는 모양 그대로 만든다 — 멤버 칸 + userId + def(복원본) + chat + poke.
     ★ 순서 보장은 makeFirebaseProvider 의 _roomSnapSeq 와 같은 방식이다. 매번 «방 전체» 를 만들어 넘기므로,
       def 를 푸는 동안 더 새 것이 지나갔으면 이건 버린다(뒤의 것이 이것을 다 담고 있다).
       풀어 둔 def 는 원본이 같으면 다시 풀지 않는다 — 상태 칸만 바뀌는 대부분의 갱신이 기다림 없이 지나간다. */
  function restoreDef(P, id){
    const raw = P.members[id] && P.members[id].def;
    const c = P.defCache[id];
    if(c && c.raw === raw) return c.p;
    let p;
    try{ p = Promise.resolve(P.hooks.deserializeDef ? P.hooks.deserializeDef(raw) : raw).catch(() => raw); }
    catch(_){ p = Promise.resolve(raw); }
    P.defCache[id] = { raw, p };
    return p;
  }
  function emit(P){
    const seq = ++P.seq;
    const ids = Object.keys(P.members);
    for(const id of Object.keys(P.defCache)){ if(!P.members[id]) delete P.defCache[id]; }
    return Promise.all(ids.map((id) => restoreDef(P, id))).then((defs) => {
      if(seq !== P.seq || !P.inRoom || active !== P) return;
      const out = {};
      ids.forEach((id, i) => { out[id] = Object.assign({}, P.members[id], { def: defs[i] }); });
      try{ if(P.changeCb) P.changeCb(out); }catch(err){ try{ log.warn('[방 서버] 화면 갱신 실패', err); }catch(_){} }
    });
  }

  function onEvent(P, m){
    if(!P.inRoom) return;
    switch(m.t){
      case 'welcome': {
        if(m.room !== P.room) return;
        const first = !P.joined;
        P.memberId = m.memberId;
        P.resume = m.resume || null;
        P.awaitingWelcome = false;
        const old = P.members;
        P.members = {};
        const mem = m.members || {};
        for(const id of Object.keys(mem)){
          const v = memberFrom(mem[id]);
          // 다시 붙었을 때 def 가 그대로면 옛 객체를 그대로 써서 풀어 둔 것(얼굴 그림)을 다시 풀지 않는다
          if(old[id] && old[id].def !== v.def && same(old[id].def, v.def)) v.def = old[id].def;
          P.members[id] = v;
        }
        setMeta(P, m.meta);
        if(first){
          P.joined = true;
          if(!P.expTimer) P.expTimer = iSet(() => checkExp(P), EXP_CHECK_MS);
          try{ if(P.hooks.onJoined) P.hooks.onJoined(P.room); }catch(_){}
          finishJoin(P, { ok: true, memberId: m.memberId, others: Object.keys(mem).length, meta: m.meta || null });
        }else if(m.resumed){
          /* 죽어 가던 소켓에 보낸 칸은 «보냄» 으로 적혔어도 서버에 안 닿았을 수 있다 — 지금 상태 전체를 한 번 다시 보낸다
             (Firebase 가 다시 붙을 때 내 노드를 통째로 다시 쓰는 것과 같다). */
          P.sent = {};
          if(P.def) P.defDirty = true;
        }
        flush(P, null);   // welcome 을 기다리는 사이 바뀐 칸도 여기서 나간다
        sendHeld(P);
        emit(P);
        return;
      }
      case 'joined':
        if(!m.memberId || m.memberId === P.memberId) return;
        P.members[m.memberId] = memberFrom(m.member);
        emit(P);
        return;
      case 'left':
        if(m.memberId === P.memberId){
          if(m.reason === 'replaced'){
            // 같은 계정이 다른 곳에서 들어와 내 자리를 가져갔다 — 한 계정 한 기기에서 밀려난 것과 같다
            detach(P);
            try{ if(P.hooks.onReplaced) P.hooks.onReplaced(); }catch(_){}
          }
          return;
        }
        if(P.members[m.memberId]){ delete P.members[m.memberId]; emit(P); }
        return;
      case 'patch': {
        const cur = P.members[m.memberId];
        if(!cur) return;
        for(const k of Object.keys(m)){ if(k !== 't' && k !== 'memberId') cur[k] = m[k]; }
        emit(P);
        return;
      }
      case 'def': {
        const cur = P.members[m.memberId];
        if(!cur) return;
        cur.def = m.def;
        emit(P);
        return;
      }
      case 'chat': {
        const cur = P.members[m.memberId];
        if(!cur) return;
        const c = chatFromWire(m);
        cur[c.key] = c.val;
        emit(P);
        return;
      }
      case 'poked': {
        const p = { type: m.type, from: m.from, ts: m.ts };
        if(m.to === P.memberId){
          try{ if(P.onPoked) P.onPoked(p); }catch(_){}
          return;
        }
        const cur = P.members[m.to];
        if(!cur) return;
        cur.poke = p;   // Firebase 와 같은 자리(대상 멤버의 poke 칸) — syncFriendSeats 가 ts 로 한 번만 재생한다
        emit(P);
        return;
      }
      case 'meta':
        setMeta(P, m.meta);
        return;
      case 'disband':
        detach(P);
        try{ if(P.hooks.onDisband) P.hooks.onDisband(m.reason || null); }catch(_){}
        return;
    }
  }

  function scheduleState(P){
    if(P.stateTimer) return;
    const wait = Math.max(0, P.lastStateAt + STATE_MIN_GAP_MS - now());
    P.stateTimer = tSet(() => { P.stateTimer = null; flush(P, null); }, wait);
  }

  function hold(P, kind, msg){
    if(!P.inRoom) return;
    const q = P.held[kind];
    q.push({ msg, at: now() });
    if(q.length > HELD_MAX) q.shift();
  }
  function sendHeld(P){
    for(const kind of ['chat', 'poke']){
      const q = P.held[kind]; P.held[kind] = [];
      for(const h of q){
        if(now() - h.at > HELD_TTL_MS) continue;
        send(h.msg.to === null ? Object.assign({}, h.msg, { to: P.memberId }) : h.msg);   // to null = 나(pokeSelf) — 새 memberId 로
      }
    }
  }

  // 바뀐 칸만 보낸다. state 는 1초에 한 번 — 그 사이 값은 버리고 마지막 값을 보낸다.
  function flush(P, chat){
    if(!canSend(P)){ if(chat) hold(P, 'chat', Object.assign({ t: 'chat' }, chat)); return; }
    const patch = {};
    let n = 0;
    for(const k of MEMBER_FIELDS){
      if(!(k in P.current) || same(P.current[k], P.sent[k])) continue;
      if(k === 'state' && now() - P.lastStateAt < STATE_MIN_GAP_MS){ scheduleState(P); continue; }
      patch[k] = P.current[k]; n++;
    }
    if(n){
      if('state' in patch) P.lastStateAt = now();
      if(send(Object.assign({ t: 'patch' }, patch))) Object.assign(P.sent, patch);
    }
    if(P.defDirty && send({ t: 'def', def: P.def })) P.defDirty = false;
    if(chat) send(Object.assign({ t: 'chat' }, chat));
  }

  function checkExp(P){
    if(!P.inRoom || !P.hooks.getExp) return;
    let e;
    try{ e = P.hooks.getExp(); }catch(_){ return; }
    if(e === undefined) return;
    P.current.exp = e;
    flush(P, null);
  }

  function makeProvider(hooks, opts){
    const P = {
      hooks: hooks || {}, create: (opts && opts.create) || null,
      room: null, url: null, memberId: null, resume: null, userId: null,
      inRoom: false, joined: false, leaving: false, leftNotified: false, awaitingWelcome: false, sentAnyJoin: false,
      current: {}, sent: {}, def: null, defDirty: false, held: { chat: [], poke: [] },
      members: {}, meta: null, defCache: {}, seq: 0,
      changeCb: null, onPoked: null, joinWaiter: null, leaveWaiter: null, metaWaiters: [],
      stateTimer: null, expTimer: null, lastStateAt: -Infinity,
    };
    return {
      kind: 'server',
      join(room, me, changeCb, onPoked){
        P.room = room; P.changeCb = changeCb; P.onPoked = onPoked || null;
        P.inRoom = true; P.leaving = false;
        P.def = P.hooks.serializeDef ? P.hooks.serializeDef(me.def) : me.def;
        P.current = pickFields(me);
        // 경험치 칸도 입장 때 싣는다 — Firebase 는 첫 하트비트가 실어 보냈지만 여기는 하트비트가 없다
        if(P.hooks.getExp){ try{ const e = P.hooks.getExp(); if(e !== undefined) P.current.exp = e; }catch(_){} }
        P.userId = (me && me.userId) || null;
        try{ P.url = deps.url() || null; }catch(_){ P.url = null; }
        if(active && active !== P) detach(active);
        active = P;
        if(idleTimer){ tClear(idleTimer); idleTimer = null; }
        return new Promise((res) => {
          P.joinWaiter = { res, timer: tSet(() => finishJoin(P, { ok: false, code: 'timeout' }), JOIN_TIMEOUT_MS) };
          P.sentAnyJoin = true;
          if(ready) sendJoin(P, true);   // 아니면 ready 가 오는 순간 onReady 가 보낸다
          else ensureReady().then((r) => { if(!r.ok) finishJoin(P, { ok: false, code: r.code }); });
        });
      },
      update(payload){
        if(!payload || !P.inRoom) return;
        const s = splitRoomPayload(payload);
        if(s.def){ P.def = P.hooks.serializeDef ? P.hooks.serializeDef(s.def) : s.def; P.defDirty = true; }
        if(s.patch) Object.assign(P.current, s.patch);
        flush(P, s.chat);
      },
      poke(targetId, type){
        if(!targetId) return;
        const msg = { t: 'poke', to: targetId, type: String(type) };
        if(isRoomWidePoke(type)) msg.all = true;
        if(canSend(P)) send(msg); else hold(P, 'poke', msg);
      },
      pokeSelf(type){
        // to 가 나 자신이면 서버가 방 전원(나 포함)에게 보낸다
        if(canSend(P)) send({ t: 'poke', to: P.memberId, type: String(type) });
        else hold(P, 'poke', { t: 'poke', to: null, type: String(type) });
      },
      // 방장만 — chatOff · open · tabs({ s1: { name } | null }). 서버가 바뀐 meta 를 돌려주면 ok.
      setMeta(fields){
        const want = {};
        if(fields && typeof fields.chatOff === 'boolean') want.chatOff = fields.chatOff;
        if(fields && typeof fields.open === 'boolean') want.open = fields.open;
        if(fields && fields.tabs && typeof fields.tabs === 'object'){
          const tabs = {};
          for(const id of CHAT_TAB_IDS){
            const v = fields.tabs[id];
            if(v === null) tabs[id] = null;
            else if(v && typeof v.name === 'string' && v.name) tabs[id] = { name: v.name };
          }
          if(Object.keys(tabs).length) want.tabs = tabs;
        }
        if(!Object.keys(want).length || !canSend(P)) return Promise.resolve({ ok: false });
        return new Promise((res) => {
          const w = { want, done: null, timer: null };
          w.done = (r) => { tClear(w.timer); res(r); };
          w.timer = tSet(() => {
            const i = P.metaWaiters.indexOf(w);
            if(i >= 0) P.metaWaiters.splice(i, 1);
            res({ ok: false, code: 'timeout' });
          }, REQ_TIMEOUT_MS);
          P.metaWaiters.push(w);
          send(Object.assign({ t: 'meta' }, want));
        });
      },
      leave(){
        if(P.joinWaiter) finishJoin(P, { ok: false, code: 'left' });
        if(!P.inRoom) return Promise.resolve();
        P.leaving = true;
        const wasActive = active === P;
        detach(P);
        if(!wasActive || !ready) return Promise.resolve();
        if(!sendRaw(ws, { t: 'leave' })) return Promise.resolve();
        return new Promise((res) => {
          const w = { done: null, timer: null };
          w.done = () => { tClear(w.timer); P.leaveWaiter = null; if(lingering === P) lingering = null; res(); };
          w.timer = tSet(w.done, LEAVE_WAIT_MS);
          P.leaveWaiter = w;
          lingering = P;
        });
      },
      memberId(){ return P.memberId; },
      roomMeta(){ return P.meta; },
      _state: P,   // 검사용
    };
  }

  return {
    enabled, ensureReady, stats, random, peek, makeProvider, close,
    isReady: () => ready,
    inRoom: () => !!(active && active.inRoom),
    _debug: () => ({ ws, ready, gen, attempt, fatal, active, tokenTimer, reconnectTimer }),
  };
}

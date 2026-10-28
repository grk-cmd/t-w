/*
 * realtime-link.js — realtime 서버(웹소켓) 연결 공통부. 옛 방 연결(room/room-server-net.js · pv 1)과 늘 붙는 연결 하나(realtime/rt-hub.js · pv 2)가 같이 쓴다.
 * 책임: 열기 · hello(인증) · ready 기다리기 · 토큰 갱신 · 다시 붙기 백오프 · rid 요청과 답 짝짓기 · 쉬면 닫기 · 못 붙은 주소 잠깐 쉬기.
 *   방 · 친구처럼 «무엇을 주고받는지» 는 모른다 — 연결 위의 메시지는 hooks.onMessage 로 넘기고, 끊기면 hooks.onClosed 로 알린다.
 *   다시 붙을지 · 언제 포기할지도 부르는 쪽이 정한다(scheduleReconnect 를 부르면 그때 백오프로 붙는다).
 * Firebase 를 직접 부르지 않는다 — 토큰 · 버전 · userId 는 deps 로 받는다. 아무것도 import 하지 않는다.
 *
 * deps: WebSocket, enabled() → bool, target() → 붙을 주소 | null, switchOk() → 주소가 바뀌었을 때 지금 연결을 닫아도 되나,
 *       getToken(force) → Promise<문자열 | null>, getUserId() → 문자열 | null, getVersion() → 문자열 | Promise,
 *       pv(통신 규약 판 — 2 부터 hello 에 userId 를 싣지 않는다 · 신원은 토큰뿐) ·
 *       helloExtra(hello 선택 칸 객체 — 없으면 안 싣는다) · helloFields(phase: 'open' | 'refresh') → 객체(연결마다 · 갱신마다 달라지는 칸 — 있으면 helloExtra 대신),
 *       requestKinds(rid 로 묻는 요청 t 목록) · answers({ 답 t: 요청 t }) · reflessKind(ref 없는 badRequest 를 받을 요청 t | null) ·
 *       ridless(rid 없는 답을 같은 종류의 가장 먼저 보낸 요청에 줄까 — 옛 서버용),
 *       idleCloseMs(0 이면 쉬어도 안 닫음) · busy() → 쉬면 닫기를 미룰까 · reconnectWanted() → 다시 붙기 타이머가 울렸을 때 붙을까,
 *       hooks: { onReady(readyMsg), onMessage(m), onClosed(wasReady, fatal, closeCode) } — closeCode 는 웹소켓 닫힘 번호(4001 · 4004 …) | null,
 *       now · setTimeout · clearTimeout · random · log 는 검사용(기본 전역).
 * 내보냄: createRealtimeLink(deps) → { enabled, ensureReady(ms, o), request(msg, map), send(o), close(), drop(), scheduleReconnect(),
 *       scheduleIdle(), cancelIdle(), markAuthRetry(), markFailed(), isReady(), state() }
 *   순수: jwtExpMs(token) · LINK_TIMING
 */
export const LINK_TIMING = Object.freeze({
  CONNECT_TIMEOUT_MS: 5000,      // 재연결 한 번이 ready 를 기다리는 시간 — 입장 대기(ensureReady(ms))가 더 길면 그만큼
  REQ_TIMEOUT_MS: 4000,          // rid 요청의 답
  BACKOFF_MS: Object.freeze([1000, 2000, 4000, 8000, 15000]),
  // 백오프를 ±이 비율만큼 흩는다 — 서버가 재시작하면 모든 앱이 같은 순간 끊겨, 흩지 않으면 1 · 2 · 4초 뒤에 한꺼번에 다시 붙는다
  BACKOFF_JITTER: 0.5,
  TOKEN_LEAD_MS: 5 * 60 * 1000,  // 만료 5분 전에 새 토큰으로 hello
  TOKEN_FALLBACK_MS: 50 * 60 * 1000,
  TOKEN_MIN_MS: 60 * 1000,
  FAIL_COOLDOWN_MS: 60 * 1000,
});

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

export function createRealtimeLink(deps){
  const T = LINK_TIMING;
  const tSet = deps.setTimeout || ((f, ms) => setTimeout(f, ms));
  const tClear = deps.clearTimeout || ((h) => clearTimeout(h));
  const now = deps.now || (() => Date.now());
  const random = deps.random || Math.random;
  const hooks = deps.hooks || {};
  const requestKinds = deps.requestKinds || [];
  const answers = deps.answers || {};
  const reflessKind = deps.reflessKind || null;
  const ridless = deps.ridless !== false;
  const idleCloseMs = deps.idleCloseMs || 0;

  let ws = null, gen = 0, opening = false, ready = false, fatal = null, closeCode = null;
  let token = null, helloUid = null, helloVer = null, forceToken = false, authRetried = false;
  let tokenTimer = null, idleTimer = null, reconnectTimer = null, connectTimer = null, attempt = 0;
  let readyWaiters = [];
  let failAt = -Infinity, failCode = null, failUrl = null, curUrl = null;
  const reqWaiters = new Map();   // rid → { kind, done } — 답은 rid 로 짝짓는다(보낸 순서에 기대지 않는다)
  let ridSeq = 0;

  function target(){
    try{ return deps.target() || null; }catch(_){ return null; }
  }
  function enabled(){
    try{ return !!(deps.WebSocket && deps.enabled && deps.enabled() && target()); }catch(_){ return false; }
  }
  function hello(tk, phase){
    const extra = deps.helloFields ? deps.helloFields(phase) : deps.helloExtra;
    const base = (deps.pv >= 2) ? { t: 'hello', pv: deps.pv, token: tk, ver: helloVer } : { t: 'hello', pv: deps.pv, token: tk, userId: helloUid, ver: helloVer };
    return Object.assign(base, extra || {});
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
  async function open(waitMs){
    if(opening || ws) return;
    opening = true;
    const my = ++gen;
    fatal = null; closeCode = null;
    const force = forceToken; forceToken = false;
    let tk = null, ver = null, uid = null;
    try{ tk = await deps.getToken(force); }catch(_){ tk = null; }
    try{ ver = await deps.getVersion(); }catch(_){ ver = null; }
    try{ uid = deps.getUserId(); }catch(_){ uid = null; }
    opening = false;
    if(my !== gen) return;
    // 로그인 토큰이 없으면 서버가 받아 주지 않는다. 옛 판(pv 1)은 userId 도 싣는다.
    if(!tk || (deps.pv < 2 && !uid)){ fatal = 'auth'; closed(); return; }
    token = tk; helloUid = uid; helloVer = (typeof ver === 'string' && ver) ? ver : '0.0.0';
    let sock;
    try{ curUrl = target(); sock = new deps.WebSocket(curUrl); }catch(_){ fatal = 'connect'; closed(); return; }
    ws = sock;
    connectTimer = tSet(() => { connectTimer = null; if(my === gen && !ready){ fatal = fatal || 'timeout'; drop(); } }, Math.max(T.CONNECT_TIMEOUT_MS, waitMs || 0));
    sock.onopen = () => { if(my === gen) sendRaw(sock, hello(tk, 'open')); };
    sock.onmessage = (ev) => {
      if(my !== gen) return;
      let m = null;
      try{ m = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); }catch(_){ return; }
      if(m && typeof m.t === 'string') onMsg(m);
    };
    sock.onclose = (ev) => { if(my === gen){ closeCode = (ev && typeof ev.code === 'number') ? ev.code : null; closed(); } };
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
    if(wasReady) attempt = 0;
    try{ if(hooks.onClosed) hooks.onClosed(wasReady, fatal, closeCode); }catch(e){ try{ (deps.log || console).warn('[realtime] 끊김 처리 실패', e); }catch(_){} }
  }

  function scheduleReconnect(){
    if(reconnectTimer) return;
    const base = T.BACKOFF_MS[Math.min(attempt, T.BACKOFF_MS.length - 1)];
    const delay = Math.round(base * (1 + T.BACKOFF_JITTER * (2 * random() - 1)));
    attempt++;
    reconnectTimer = tSet(() => {
      reconnectTimer = null;
      let want = false;
      try{ want = !!deps.reconnectWanted(); }catch(_){ want = false; }
      if(want && !ws) open();
    }, delay);
  }

  function scheduleToken(){
    if(tokenTimer){ tClear(tokenTimer); tokenTimer = null; }
    const exp = jwtExpMs(token);
    const delay = exp ? Math.max(T.TOKEN_MIN_MS, exp - now() - T.TOKEN_LEAD_MS) : T.TOKEN_FALLBACK_MS;
    tokenTimer = tSet(async () => {
      tokenTimer = null;
      let tk = null;
      try{ tk = await deps.getToken(true); }catch(_){ tk = null; }
      if(!ready || !tk){ if(ready) scheduleToken(); return; }
      token = tk;
      send(hello(tk, 'refresh'));
      scheduleToken();
    }, delay);
  }

  function cancelIdle(){
    if(idleTimer){ tClear(idleTimer); idleTimer = null; }
  }
  function scheduleIdle(){
    cancelIdle();
    if(!idleCloseMs) return;
    const isBusy = () => { try{ return !!(deps.busy && deps.busy()); }catch(_){ return false; } };
    if(isBusy()) return;
    idleTimer = tSet(() => {
      idleTimer = null;
      if(!isBusy() && !reqWaiters.size) close();
    }, idleCloseMs);
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

  /* ms: ready 를 기다릴 시간(기본 CONNECT_TIMEOUT_MS). o.retry: 방금 못 붙은 주소라도(FAIL_COOLDOWN_MS 안) 다시 붙어 본다. */
  function ensureReady(ms, o){
    if(!enabled()) return Promise.resolve({ ok: false, code: 'off' });
    const want = target();
    // 다른 주소로 간다 — 부르는 쪽이 괜찮다고 할 때만 옛 연결을 닫는다(방 안이면 그 방이 끝날 때까지 그대로).
    let canSwitch = true;
    try{ canSwitch = deps.switchOk ? !!deps.switchOk() : true; }catch(_){ canSwitch = true; }
    if((ws || opening) && curUrl !== want && canSwitch) close();
    if(ready) return Promise.resolve({ ok: true });
    if(!ws && !opening && !(o && o.retry) && failUrl === want && now() - failAt < T.FAIL_COOLDOWN_MS) return Promise.resolve({ ok: false, code: failCode || 'closed' });
    return new Promise((res) => {
      const w = { res, timer: null };
      w.timer = tSet(() => {
        const i = readyWaiters.indexOf(w);
        if(i >= 0) readyWaiters.splice(i, 1);
        res({ ok: false, code: 'timeout' });
      }, ms || T.CONNECT_TIMEOUT_MS);
      readyWaiters.push(w);
      if(!ws && !opening) open(ms);
    });
  }

  function request(msg, map){
    return ensureReady().then((r) => {
      if(!r.ok) return null;
      return new Promise((res) => {
        const rid = 'q' + (++ridSeq).toString(36);
        const w = { kind: msg.t, done: null, timer: null };
        w.done = (m) => { tClear(w.timer); reqWaiters.delete(rid); res(m ? map(m) : null); scheduleIdle(); };
        w.timer = tSet(() => { reqWaiters.delete(rid); res(null); }, T.REQ_TIMEOUT_MS);
        reqWaiters.set(rid, w);
        if(!send(Object.assign({}, msg, { rid }))) w.done(null);
      });
    });
  }
  // 답 하나 → 기다리던 요청. rid 가 없는 답(rid 를 모르는 옛 서버)만 같은 종류 중 가장 먼저 보낸 것에 준다(ridless 일 때).
  function takeWaiter(kind, rid){
    if(typeof rid === 'string') return reqWaiters.get(rid) || null;
    if(!ridless) return null;
    for(const w of reqWaiters.values()){ if(w.kind === kind) return w; }
    return null;
  }

  // ── 받은 메시지 ─────────────────────────────────────────────────────
  function toHook(m){
    try{ if(hooks.onMessage) hooks.onMessage(m); }catch(e){ try{ (deps.log || console).warn('[realtime] 메시지 처리 실패', m.t, e); }catch(_){} }
  }
  function onMsg(m){
    if(m.t === 'ready'){
      if(!ready){
        ready = true; attempt = 0; authRetried = false; failAt = -Infinity;
        if(connectTimer){ tClear(connectTimer); connectTimer = null; }
        scheduleToken();
        try{ if(hooks.onReady) hooks.onReady(m); }catch(_){}
        settleReady({ ok: true });
        scheduleIdle();
      }else{
        scheduleToken();   // 토큰 갱신 hello 의 답
      }
      return;
    }
    if(m.t === 'error'){
      if(!ready && (m.code === 'auth' || m.code === 'version' || m.code === 'protocol')){
        fatal = m.code;     // 서버가 곧 끊는다(4001 · 4002 · 4003). 기다리는 쪽은 closed() 에서 이 코드를 받는다.
        drop();
        return;
      }
      if(m.code === 'auth' && m.ref === 'hello') return;   // 갱신 실패 — 만료 뒤 서버가 끊으면 재연결이 새 토큰을 받는다
      /* 묻기 요청이 거절됐다 — 오류에는 rid 가 없어서 그 종류 중 가장 먼저 보낸 것을 실패로 끝낸다.
         새 요청을 모르는 옛 서버는 ref 없이 badRequest 를 준다(모르는 t) — 그건 reflessKind 의 것으로 본다. */
      if(m.code === 'badRequest' && (requestKinds.indexOf(m.ref) >= 0 || !m.ref)){
        const kind = m.ref || reflessKind;
        let w = null;
        if(kind){ for(const x of reqWaiters.values()){ if(x.kind === kind){ w = x; break; } } }
        if(w){ w.done(null); return; }
      }
      toHook(m);
      return;
    }
    const kind = answers[m.t];
    if(kind){
      const w = takeWaiter(kind, m.rid);
      if(w && w.kind === kind){ w.done(m); return; }
    }
    toHook(m);
  }

  return {
    enabled, ensureReady, request, send, close, drop, scheduleReconnect, scheduleIdle, cancelIdle,
    // auth 로 끊긴 뒤 한 번만 새 토큰으로 다시 — 다음 open 이 getToken(true)
    markAuthRetry(){ authRetried = true; forceToken = true; },
    // 이 주소를 «방금 못 붙음» 으로 — FAIL_COOLDOWN_MS 동안 ensureReady 가 바로 실패
    markFailed(){ failAt = now(); failUrl = curUrl; },
    isReady: () => ready,
    state: () => ({ ws, ready, gen, attempt, fatal, authRetried, tokenTimer, reconnectTimer, curUrl }),
  };
}

/* room-rt.js — 🛰 방 포트(realtime 연결 하나 위의 방 provider · 서버 통신 규약 pv 2) (검사 sim-room-rt.js)
   [책임] 방 하나에 들어가 있는 동안의 통신 — join(resume) · patch · def · chat(말풍선) · poke · meta · music · leave 와
     방 밖의 random · peek. 받은 메시지는 친구 객체(presence.js 가 받던 모양)로 바꿔 changeCb 에 넘긴다.
     연결 · 토큰 · 다시 붙기는 rt-hub.js 가 한다 — 여기는 그 위에서 «방 안이면 다시 붙을 때 resume», «오래 못 돌아오면 포기» 만 본다.
   [서버가 정하는 것] 정원 · 같은 계정 중복 · 방장 승계 · 해산 · 채널 · 시크릿룸 입장 · 방 상한 · 버전 — 여기서 다시 판단하지 않는다.
   [앱과 서버의 모양 차이 — 이 파일 한 곳에서만 바꾼다]
     · 대화 탭: 앱 안은 's1' · 's2'(chat-tabs.js SLOTS) · 서버는 'S1' · 'S2'(멤버 칸 tab · 말풍선 tab · meta.tabs 키). tabToWire · tabFromWire.
     · 사람: 서버가 멤버마다 붙여 주는 userCode 를 친구 객체 userId 칸에도 둔다(올라타기 · 벤치 · 신고 숨김이 그 칸으로 사람을 찾는다).
     · 걷은 칸: me.userId · lic(실으면 서버가 badRequest) — 신원은 토큰, 프리미엄은 서버가 판정.
   [모양] classic script(window.TwRoomRt) — rt-hub.js 다음 · app.js 보다 먼저 싣는다. 앱 한 벌은 TwRoomRt.store(TwRtHub.store 위).
     provider 모양은 presence.js 가 부르는 join · update · poke · pokeSelf · leave + 방장 setMeta · 같이 듣기 onMusic · sendMusic · serverNow. */
(function(){
'use strict';

const JOIN_TIMEOUT_MS = 8000;        // 붙어 있을 때 welcome 을 기다리는 시간
const REQ_TIMEOUT_MS = 4000;         // meta · music 답
const LEAVE_WAIT_MS = 1500;          // 나가기 확인(left)을 기다리는 최대 시간
const STATE_MIN_GAP_MS = 1000;       // 집중 상태(focus/idle/sleep)는 1초에 한 번까지
const EXP_CHECK_MS = 30000;          // 경험치 칸은 바뀌었는지만 가끔 본다
// 끊긴 동안의 말 · 찌르기는 종류마다 마지막 몇 개만 들고 있다가 다시 붙으면 보낸다 — 오래된 건 뒤늦게 터지면 어색해서 버린다
const HELD_MAX = 5;
const HELD_TTL_MS = 15 * 1000;
/* 앱 쪽 두 시간 — 원격 설정 room.timing(remote-config.js roomServerTiming)이 없거나 틀리면 이 값.
   joinWaitMs     : 연결이 아직 안 붙었을 때 입장을 기다리는 시간.
   clientGiveUpMs : 방 안에서 끊긴 뒤 이만큼 못 돌아오면 그 방은 포기한다(onLost 'unreachable'). 서버 규약 1장 «방 안 90초». */
const TIMING_DEFAULTS = Object.freeze({ joinWaitMs: 10 * 1000, clientGiveUpMs: 90 * 1000 });
// 방 안에서 끊긴 채 이만큼 지나면 «다시 연결 중» 을 알린다 — 짧은 끊김은 조용히 이어 붙는다
const RECONNECT_NOTICE_MS = 15 * 1000;

// 서버가 받는 멤버 칸(서버 규약 3장). 모르는 칸이 하나라도 있으면 patch 통째로 거절되므로 여기서 거른다.
const MEMBER_FIELDS = Object.freeze(['name', 'state', 'userStatus', 'customStatus', 'level', 'exp', 'cyc', 'clv', 'starC',
  'awaySz', 'awayImg', 'ridingOn', 'seatedOn', 'bench', 'mobile', 'danceStyle', 'flyCool', 'noise', 'tab']);
const CHAT_FIELDS = Object.freeze(['text', 'fly', 'flyColor', 'flySize']);
const CHANNELS = Object.freeze(['workingroom', 'togetherroom']);
const RANDOM_MAX = 50;
/* 대화 탭 — 앱 id ↔ 서버 이름. #일반은 앱 'general'(또는 칸 없음) · 서버는 칸 없음(멤버 · 말풍선 · meta) / 'GENERAL'(대화 기록). */
const TAB_WIRE = Object.freeze({ s1: 'S1', s2: 'S2' });
const TAB_APP = Object.freeze({ S1: 's1', S2: 's2' });
const GENERAL_WIRE = 'GENERAL';
/** 앱 탭 id → 서버 탭('S1' · 'S2') · #일반 · 모르는 값은 null */
const tabToWire = (id) => (typeof id === 'string' && Object.prototype.hasOwnProperty.call(TAB_WIRE, id)) ? TAB_WIRE[id] : null;
/** 서버 탭 → 앱 탭 id('s1' · 's2') · 'GENERAL' · 모르는 값은 null(#일반) */
const tabFromWire = (w) => (typeof w === 'string' && Object.prototype.hasOwnProperty.call(TAB_APP, w)) ? TAB_APP[w] : null;
/** 대화 기록의 탭 — 앱 id → 'GENERAL' · 'S1' · 'S2' */
const historyTabOf = (id) => tabToWire(id) || GENERAL_WIRE;

const ROOM_MSGS = Object.freeze(['welcome', 'joined', 'left', 'patch', 'def', 'chat', 'poked', 'meta', 'music', 'disband']);
/* error.ref 가 이 방 포트의 요청인 것 — 대화(chatSay) · 사진(photo*) · 초대 오류는 그 포트가 받는다 */
const ROOM_REFS = Object.freeze(['join', 'patch', 'def', 'chat', 'poke', 'meta', 'music', 'leave']);

/* 방 전원이 봐야 하는 찌르기 — 그 사람 좌석이 모두의 화면에서 반응한다(pet · dizzy · fly: · bonk:).
   dance: 는 받은 본인만 춤추고 상태로 퍼뜨리므로 대상에게만 간다. */
function isRoomWidePoke(type){
  const t = String(type || '');
  return t === 'pet' || t === 'dizzy' || t.indexOf('fly:') === 0 || t.indexOf('bonk:') === 0;
}

// null 과 undefined 는 같은 «값 없음».
function same(a, b){
  if(a === b) return true;
  if(a == null && b == null) return true;
  if(a == null || b == null) return false;
  if(typeof a === 'object' || typeof b === 'object'){
    try{ return JSON.stringify(a) === JSON.stringify(b); }catch(_){ return false; }
  }
  return false;
}

/* 앱 멤버 칸 → 서버 칸. tab 은 'S1' · 'S2' · null(#일반). */
function pickFields(o){
  const out = {};
  for(const k of MEMBER_FIELDS){
    if(!o || o[k] === undefined) continue;
    out[k] = (k === 'tab') ? tabToWire(o[k]) : o[k];
  }
  return out;
}

/* presence.js 가 provider.update 로 넘기는 것(_basePayload + def · chat · chatTab · name)을 서버 메시지 셋으로 가른다.
   def → def, chat → chat(서버가 ts 를 찍으므로 ts 는 뺀다), 나머지 → patch. 바뀐 칸 고르기는 부르는 쪽 몫이다.
   💬 chatTab(#일반이 아닌 탭의 말) → chat + tab('S1' · 'S2'). */
function splitRoomPayload(payload){
  const out = { patch: null, def: undefined, chat: null };
  if(!payload) return out;
  const patch = pickFields(payload);
  if(Object.keys(patch).length) out.patch = patch;
  if(payload.def) out.def = payload.def;
  const ct = payload.chatTab;
  const ctTab = (ct && typeof ct.text === 'string') ? tabToWire(ct.tab) : null;
  const src = ctTab ? ct : (payload.chat && typeof payload.chat.text === 'string') ? payload.chat : null;
  if(src){
    const c = {};
    for(const k of CHAT_FIELDS){ if(src[k] !== undefined) c[k] = src[k]; }
    if(src === ct) c.tab = ctTab;
    out.chat = c;
  }
  return out;
}

/* 서버의 말풍선 { text, ts, fly?, …, tab? } → 친구 객체 칸. tab 이 있으면 chatTab({ tab:'s1', text, ts, … }), 없으면 chat. */
function chatFromWire(m){
  const c = { text: m.text, ts: m.ts };
  if(m.fly !== undefined) c.fly = m.fly;
  if(m.flyColor !== undefined) c.flyColor = m.flyColor;
  if(m.flySize !== undefined) c.flySize = m.flySize;
  const tab = tabFromWire(m.tab);
  if(tab) return { key: 'chatTab', val: Object.assign({ tab }, c) };
  return { key: 'chat', val: c };
}

/* 서버 meta → 앱 meta — tabs 키만 앱 id 로(값 { name, ts } 는 그대로). host 는 방장 userCode. */
function metaFromWire(meta){
  if(!meta || typeof meta !== 'object') return null;
  const out = Object.assign({}, meta);
  const tabs = {};
  const src = (meta.tabs && typeof meta.tabs === 'object') ? meta.tabs : {};
  for(const w of Object.keys(src)){
    const id = tabFromWire(w);
    if(id && src[w] && typeof src[w].name === 'string') tabs[id] = { name: src[w].name, ts: Number(src[w].ts) || 0 };
  }
  out.tabs = tabs;
  return out;
}

/* meta 요청이 반영됐는지 — want.tabs 는 앱 id({ s1: { name } | null }), meta 는 metaFromWire 를 거친 값. title '' 은 «칸 없음» 과 같다. */
function metaMatches(meta, want){
  return Object.keys(want).every((k) => {
    if(k === 'title') return (meta.title || '') === want.title;
    if(k !== 'tabs') return meta[k] === want[k];
    const cur = (meta && meta.tabs && typeof meta.tabs === 'object') ? meta.tabs : {};
    return Object.keys(want.tabs).every((id) => want.tabs[id] === null ? !cur[id] : !!(cur[id] && cur[id].name === want.tabs[id].name));
  });
}

/* 같이 듣기 곡 줄(listen-model 모양 { id, title, by, at, paused, pos, seq, dur? }) → music 메시지. by · at 은 서버가 정한다. */
function musicToWire(m, pos){
  const out = { t: 'music', id: m.id, title: m.title, paused: !!m.paused, pos: Math.max(0, Number(pos) || 0), seq: m.seq };
  if(Number(m.dur) > 0) out.dur = Number(m.dur);
  return out;
}

/* 멤버 모습(welcome.members 값 · joined.member) → 친구 객체 — 말풍선 자리 · 탭 · userId(=userCode) */
function memberFrom(view){
  const v = Object.assign({}, view || {});
  if(v.chat && typeof v.chat === 'object'){
    const c = chatFromWire(v.chat);
    delete v.chat;
    v[c.key] = c.val;
  }
  if('tab' in v) v.tab = tabFromWire(v.tab);
  if(typeof v.userCode === 'string') v.userId = v.userCode;
  return v;
}

/** @param {{ hub: { onMessage: Function, onState: Function, send: Function, request: Function, state: () => string, isReady: () => boolean, userCode: () => (string|null) },
 *   STATE: { READY: string, OFF: string, SESSION_LOST: string, UPDATE: string, AUTH_FAILED: string },
 *   timing?: () => ({ joinWaitMs?: number, clientGiveUpMs?: number } | null),
 *   now?: () => number, setTimeout?: Function, clearTimeout?: Function, setInterval?: Function, clearInterval?: Function, log?: { warn: Function } }} deps */
function createRoomRt(deps){
  const hub = deps.hub;
  const S = deps.STATE;
  const tSet = deps.setTimeout || ((f, ms) => setTimeout(f, ms));
  const tClear = deps.clearTimeout || ((h) => clearTimeout(h));
  const iSet = deps.setInterval || ((f, ms) => setInterval(f, ms));
  const iClear = deps.clearInterval || ((h) => clearInterval(h));
  const now = deps.now || (() => Date.now());
  const log = deps.log || console;
  function timing(){
    let t = null;
    try{ t = deps.timing ? deps.timing() : null; }catch(_){ t = null; }
    const pick = (k) => (t && typeof t[k] === 'number' && t[k] > 0) ? t[k] : TIMING_DEFAULTS[k];
    return { joinWaitMs: pick('joinWaitMs'), clientGiveUpMs: pick('clientGiveUpMs') };
  }
  /* 연결이 멈춘 상태(다시 붙지 않음) → 방을 놓는 까닭 */
  const STOPPED = { [S.OFF]: 'off', [S.UPDATE]: 'version', [S.AUTH_FAILED]: 'auth' };

  let active = null;     // 방에 들어가 있거나 들어가는 중인 provider 의 속(P)
  let lingering = null;  // 나가기 확인(left)을 기다리는 provider — active 를 비운 뒤라 따로 잡아 둔다
  let downSince = null, noticeTimer = null, giveUpTimer = null;

  const send = (o) => { try{ return !!hub.send(o); }catch(_){ return false; } };
  const ready_ = () => { try{ return !!hub.isReady(); }catch(_){ return false; } };
  const warn = (...a) => { try{ log.warn('[방]', ...a); }catch(_){} };

  // ── 연결 상태 ───────────────────────────────────────────────────────
  function onHubState(s){
    const P = active;
    if(s === S.READY){
      downSince = null;
      clearDown(P, true);
      if(P && P.inRoom && !P.leaving){
        if(P.joined) sendJoin(P, !P.resume);   // 다시 붙음 — resume 먼저
        else if(P.joinWaiter) sendJoin(P, true);
      }
      return;
    }
    if(!P || !P.inRoom || P.leaving) return;
    if(s === S.SESSION_LOST){   // 다른 기기가 이 계정을 차지 — 방 자리도 서버가 바로 뺐다
      if(P.joinWaiter && !P.joined){ finishJoin(P, { ok: false, code: 'sessionLost' }); return; }
      detach(P);
      try{ if(P.hooks.onReplaced) P.hooks.onReplaced(); }catch(_){}
      return;
    }
    if(STOPPED[s]){
      if(P.joinWaiter && !P.joined){ finishJoin(P, { ok: false, code: STOPPED[s] }); return; }
      lost(P, STOPPED[s]);
      return;
    }
    // connecting · retrying — hub 가 백오프로 다시 붙는다. 방 안이면 알림 · 포기 시계만 건다.
    if(!P.joined) return;   // 입장 전 끊김은 입장 대기 시계(joinWaiter)가 끝낸다
    if(downSince === null) downSince = now();
    scheduleDown(P);
  }
  function scheduleDown(P){
    if(!giveUpTimer){
      const left = Math.max(0, timing().clientGiveUpMs - (now() - downSince));
      giveUpTimer = tSet(() => {
        giveUpTimer = null;
        if(active !== P || !P.inRoom || ready_()) return;
        downSince = null;
        lost(P, 'unreachable');
      }, left);
    }
    if(!noticeTimer && !P.noticed && P.hooks.onReconnecting){
      const left = Math.max(0, RECONNECT_NOTICE_MS - (now() - downSince));
      noticeTimer = tSet(() => {
        noticeTimer = null;
        if(active !== P || !P.inRoom || ready_()) return;
        P.noticed = true;
        try{ P.hooks.onReconnecting(true); }catch(_){}
      }, left);
    }
  }
  function clearDown(P, back){
    if(noticeTimer){ tClear(noticeTimer); noticeTimer = null; }
    if(giveUpTimer){ tClear(giveUpTimer); giveUpTimer = null; }
    if(P && P.noticed){
      P.noticed = false;
      if(back){ try{ if(P.hooks.onReconnecting) P.hooks.onReconnecting(false); }catch(_){} }
    }
  }

  // ── 방 밖 요청 ──────────────────────────────────────────────────────
  /* 랜덤 후보 — 그 채널의 공개 방 중 사람이 있고 정원이 안 찬 방 코드 · 못 물으면 null(빈 목록 [] 과 다르게) */
  function random(limit, channel){
    const msg = { t: 'random' };
    if(limit > 0) msg.limit = Math.min(RANDOM_MAX, limit | 0);
    if(CHANNELS.indexOf(channel) >= 0) msg.channel = channel;
    return Promise.resolve(hub.request(msg)).then((m) => (m && Array.isArray(m.rooms)) ? m.rooms.filter((c) => typeof c === 'string') : null, () => null);
  }
  /* 들어가지 않고 방 보기 — { exists, count, channel, secret } · 못 물으면 null. count 는 유예 중 자리까지. */
  function peek(room){
    return Promise.resolve(hub.request({ t: 'peek', room: String(room || '') })).then((m) => (m ? {
      exists: m.exists === true, count: m.count | 0,
      channel: (CHANNELS.indexOf(m.channel) >= 0) ? m.channel : null,
      secret: m.secret === true,
    } : null), () => null);
  }

  // ── 받은 메시지 ─────────────────────────────────────────────────────
  function onRoomMsg(m){
    const L = lingering;
    if(m.t === 'left' && L && m.memberId === L.memberId && m.reason === 'leave'){
      lingering = null;
      if(L.leaveWaiter) L.leaveWaiter.done();
      return;
    }
    if(active) onEvent(active, m);
  }
  function onErrorMsg(m){
    if(!m || ROOM_REFS.indexOf(m.ref) < 0) return;
    const P = active;
    if(P) onError(P, m);
  }
  for(const t of ROOM_MSGS) hub.onMessage(t, onRoomMsg);
  hub.onMessage('error', onErrorMsg);
  hub.onState(onHubState);

  // ── provider ────────────────────────────────────────────────────────
  function stopTimers(P){
    if(P.stateTimer){ tClear(P.stateTimer); P.stateTimer = null; }
    if(P.expTimer){ iClear(P.expTimer); P.expTimer = null; }
  }
  function canSend(P){ return ready_() && P.inRoom && !!P.memberId && !P.awaitingWelcome && active === P; }

  function sendJoin(P, full){
    const msg = { t: 'join', room: P.room };
    if(!full && P.resume){
      msg.resume = P.resume;
    }else{
      msg.me = Object.assign(pickFields(P.current), { def: P.def });
      if(msg.me.tab == null) delete msg.me.tab;   // #일반은 칸 없음
      if(P.create) msg.create = P.create;
      P.sent = Object.assign({}, P.current);
      P.defDirty = false;
    }
    P.awaitingWelcome = true;
    P.sentAnyJoin = true;
    send(msg);
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
    if(active === P){ downSince = null; clearDown(P, false); }
    stopTimers(P);
    notifyLeft(P);
    if(active === P) active = null;
  }
  function finishJoin(P, result){
    const w = P.joinWaiter;
    if(!w) return;
    P.joinWaiter = null;
    tClear(w.timer);
    if(!result.ok){
      if(ready_() && P.sentAnyJoin) send({ t: 'leave' });   // 늦게 welcome 이 와도 자리가 남지 않게
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
    if(m.ref === 'music'){
      const list = P.musicWaiters; P.musicWaiters = [];
      for(const w of list) w.done({ ok: false, code: m.code });
      return;
    }
    if(m.ref === 'leave' || m.code === 'notInRoom') return;
    warn('서버가 거절 —', m.code, m.ref || '');
  }

  function setMeta(P, raw){
    const meta = metaFromWire(raw);
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

  /* 같이 듣기 곡 — welcome · music 으로 온다(null = 틀 곡 없음). now 칸으로 서버 시계를 맞춘다.
     srvSeq — 서버가 마지막으로 받아들인 차례(곡을 지워도 남는다 — 지운 뒤 새 곡을 0 부터 쓰면 stale). */
  function setClock(P, srvNow){ if(typeof srvNow === 'number' && isFinite(srvNow)) P.clockOff = srvNow - now(); }
  function setMusic(P, music, srvSeq){
    P.music = (music && typeof music === 'object') ? music : null;
    if(typeof srvSeq === 'number' && isFinite(srvSeq)) P.musicSeq = srvSeq;
    else if(P.music && Number(P.music.seq) > P.musicSeq) P.musicSeq = Number(P.music.seq);
    const seq = P.musicSeq;
    const list = P.musicWaiters; P.musicWaiters = [];
    for(const w of list){
      if(seq >= w.seq || (w.clear && !P.music)) w.done({ ok: true });
      else P.musicWaiters.push(w);
    }
    for(const fn of P.musicFns.slice()){ try{ fn(P.music); }catch(_){} }
  }

  /* 친구 객체(멤버 칸 + userCode/userId + def(복원본) + chat + poke)를 changeCb 로 넘긴다.
     매번 «방 전체» 를 만들어 넘기므로, def 를 푸는 동안 더 새 것이 지나갔으면 이건 버린다(뒤의 것이 이것을 다 담고 있다).
     풀어 둔 def 는 원본이 같으면 다시 풀지 않는다 — 상태 칸만 바뀌는 대부분의 갱신이 기다림 없이 지나간다.
     ⚠️ 얼굴 그림을 못 받은 채 풀린 def 는 hooks.retryDefAfter 가 기다릴 시간을 주면 그 뒤 다시 풀어 넘긴다. */
  function restoreDef(P, id){
    const raw = P.members[id] && P.members[id].def;
    const c = P.defCache[id];
    if(c && c.raw === raw) return c.p;
    return startRestore(P, id, raw, 0);
  }
  function startRestore(P, id, raw, tries){
    let p;
    try{ p = Promise.resolve(P.hooks.deserializeDef ? P.hooks.deserializeDef(raw) : raw).catch(() => raw); }
    catch(_){ p = Promise.resolve(raw); }
    const entry = { raw, p };
    P.defCache[id] = entry;
    if(P.hooks.retryDefAfter) p.then((d) => {
      let wait = null;
      try{ wait = P.hooks.retryDefAfter(d, tries); }catch(_){}
      if(wait === null || P.defCache[id] !== entry) return;
      tSet(() => {
        if(P.defCache[id] !== entry || !P.inRoom || active !== P) return;
        startRestore(P, id, raw, tries + 1);
        emit(P);
      }, wait);
    });
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
      try{ if(P.changeCb) P.changeCb(out); }catch(err){ warn('화면 갱신 실패', err); }
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
        setClock(P, m.now);
        setMusic(P, m.music, m.musicSeq);
        if(first){
          P.joined = true;
          if(!P.expTimer) P.expTimer = iSet(() => checkExp(P), EXP_CHECK_MS);
          try{ if(P.hooks.onJoined) P.hooks.onJoined(P.room); }catch(_){}
          finishJoin(P, { ok: true, memberId: m.memberId, others: Object.keys(mem).length, meta: P.meta });
        }else if(m.resumed){
          /* 죽어 가던 소켓에 보낸 칸은 «보냄» 으로 적혔어도 서버에 안 닿았을 수 있다 — 지금 상태 전체를 한 번 다시 보낸다. */
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
          }else if(m.reason === 'closed'){
            // 관리자가 방을 닫았다
            lost(P, 'closed');
          }
          return;
        }
        if(P.members[m.memberId]){ delete P.members[m.memberId]; emit(P); }
        return;
      case 'patch': {
        const cur = P.members[m.memberId];
        if(!cur) return;
        for(const k of Object.keys(m)){
          if(k === 't' || k === 'memberId') continue;
          cur[k] = (k === 'tab') ? tabFromWire(m[k]) : m[k];
        }
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
        cur.poke = p;   // 대상 멤버의 poke 칸 — 좌석 그리기가 ts 로 한 번만 재생한다
        emit(P);
        return;
      }
      case 'meta':
        setMeta(P, m.meta);
        return;
      case 'music':
        setClock(P, m.now);
        setMusic(P, m.music, m.seq);
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
      patch[k] = (k === 'tab') ? tabToWire(P.current[k]) : P.current[k]; n++;
    }
    if(n){
      if('state' in patch) P.lastStateAt = now();
      if(send(Object.assign({ t: 'patch' }, patch))){
        for(const k of Object.keys(patch)) P.sent[k] = P.current[k];
      }
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

  /* 앱 멤버 칸(탭은 앱 id) — P.current · P.sent 는 앱 모양으로 들고, 보낼 때만 서버 모양으로 바꾼다 */
  function appFields(o){
    const out = {};
    for(const k of MEMBER_FIELDS){ if(o && o[k] !== undefined) out[k] = o[k]; }
    return out;
  }

  /** hooks: serializeDef · deserializeDef · retryDefAfter · getExp · onMeta(meta, prev) · onDisband · onReplaced · onLost(code) ·
   *    onReconnecting(on) · onJoined(room) · onLeft(room) — 모두 선택. opts.create — 방 만들기 칸(join.create). */
  function makeProvider(hooks, opts){
    const P = {
      hooks: hooks || {}, create: (opts && opts.create) || null,
      room: null, memberId: null, resume: null,
      inRoom: false, joined: false, leaving: false, leftNotified: false, awaitingWelcome: false, sentAnyJoin: false,
      current: {}, sent: {}, def: null, defDirty: false, held: { chat: [], poke: [] },
      members: {}, meta: null, defCache: {}, seq: 0,
      changeCb: null, onPoked: null, joinWaiter: null, leaveWaiter: null, metaWaiters: [],
      stateTimer: null, expTimer: null, lastStateAt: -Infinity, noticed: false,
      music: undefined, musicSeq: -1, musicFns: [], musicWaiters: [], clockOff: 0,
    };
    return {
      kind: 'server',
      /* 입장 — { ok:true, memberId, others, meta } 또는 { ok:false, code }(full · channelFull · secretClosed · forbidden · title · version ·
         unavailable · timeout · off · auth · sessionLost · left). me 의 userId · lic 는 싣지 않는다. */
      join(room, me, changeCb, onPoked){
        P.room = room; P.changeCb = changeCb; P.onPoked = onPoked || null;
        P.inRoom = true; P.leaving = false;
        P.def = P.hooks.serializeDef ? P.hooks.serializeDef(me.def) : me.def;
        P.current = appFields(me);
        if(P.hooks.getExp){ try{ const e = P.hooks.getExp(); if(e !== undefined) P.current.exp = e; }catch(_){} }
        if(active && active !== P) detach(active);
        active = P;
        return new Promise((res) => {
          let st = null;
          try{ st = hub.state(); }catch(_){ st = S.OFF; }
          if(st === S.SESSION_LOST || STOPPED[st]){
            P.joinWaiter = { res, timer: null };
            finishJoin(P, { ok: false, code: STOPPED[st] || 'sessionLost' });
            return;
          }
          const wait = ready_() ? JOIN_TIMEOUT_MS : Math.max(JOIN_TIMEOUT_MS, timing().joinWaitMs);
          P.joinWaiter = { res, timer: tSet(() => finishJoin(P, { ok: false, code: 'timeout' }), wait) };
          if(ready_()) sendJoin(P, true);   // 아니면 READY 가 되는 순간 onHubState 가 보낸다
        });
      },
      update(payload){
        if(!payload || !P.inRoom) return;
        const s = splitRoomPayload(payload);
        if(s.def){ P.def = P.hooks.serializeDef ? P.hooks.serializeDef(s.def) : s.def; P.defDirty = true; }
        if(s.patch) Object.assign(P.current, appFields(payload));
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
      /* 방장만 — chatOff · open · title · tabs({ s1: { name } | null }). 서버가 바뀐 meta 를 돌려주면 ok · 거절은 { ok:false, code }(title · forbidden …). */
      setMeta(fields){
        const want = {};
        if(fields && typeof fields.chatOff === 'boolean') want.chatOff = fields.chatOff;
        if(fields && typeof fields.open === 'boolean') want.open = fields.open;
        if(fields && typeof fields.title === 'string') want.title = fields.title;   // '' = 지움
        if(fields && fields.tabs && typeof fields.tabs === 'object'){
          const tabs = {};
          for(const id of Object.keys(TAB_WIRE)){
            const v = fields.tabs[id];
            if(v === null) tabs[id] = null;
            else if(v && typeof v.name === 'string' && v.name) tabs[id] = { name: v.name };
          }
          if(Object.keys(tabs).length) want.tabs = tabs;
        }
        if(!Object.keys(want).length || !canSend(P)) return Promise.resolve({ ok: false, code: 'notReady' });
        if(P.meta && metaMatches(P.meta, want)) return Promise.resolve({ ok: true });   // 이미 그 값 — 서버가 meta 를 안 보낼 수 있어 기다리면 시간 초과로 끝난다
        const wire = Object.assign({ t: 'meta' }, want);
        if(want.tabs){
          wire.tabs = {};
          for(const id of Object.keys(want.tabs)) wire.tabs[TAB_WIRE[id]] = want.tabs[id];
        }
        return new Promise((res) => {
          const w = { want, done: null, timer: null };
          w.done = (r) => { tClear(w.timer); res(r); };
          w.timer = tSet(() => {
            const i = P.metaWaiters.indexOf(w);
            if(i >= 0) P.metaWaiters.splice(i, 1);
            res({ ok: false, code: 'timeout' });
          }, REQ_TIMEOUT_MS);
          P.metaWaiters.push(w);
          send(wire);
        });
      },
      leave(){
        if(P.joinWaiter) finishJoin(P, { ok: false, code: 'left' });
        if(!P.inRoom) return Promise.resolve();
        P.leaving = true;
        const wasActive = active === P;
        detach(P);
        if(!wasActive || !ready_()) return Promise.resolve();
        if(!send({ t: 'leave' })) return Promise.resolve();
        return new Promise((res) => {
          const w = { done: null, timer: null };
          w.done = () => { tClear(w.timer); P.leaveWaiter = null; if(lingering === P) lingering = null; res(); };
          w.timer = tSet(w.done, LEAVE_WAIT_MS);
          P.leaveWaiter = w;
          lingering = P;
        });
      },
      /* 🎧 같이 듣기 — 지금 곡을 듣는다(이미 받았으면 바로 한 번) · 끊는 함수. 받기 전에는 부르지 않는다(불러오는 중). */
      onMusic(fn){
        P.musicFns.push(fn);
        if(P.music !== undefined){ try{ fn(P.music); }catch(_){} }
        return () => { const i = P.musicFns.indexOf(fn); if(i >= 0) P.musicFns.splice(i, 1); };
      },
      /* 곡 쓰기(방장 · 같이 듣기 방만) — m 은 listen-model 의 곡 줄 · pos 는 지금 위치(초) · null 은 지움. 거절은 { ok:false, code }(forbidden · stale …). */
      sendMusic(m, pos){
        if(!canSend(P)) return Promise.resolve({ ok: false, code: 'notReady' });
        const seq = m ? Number(m.seq) : P.musicSeq + 1;
        const msg = m ? musicToWire(m, pos) : { t: 'music', clear: true, seq };
        return new Promise((res) => {
          const w = { seq, clear: !m, done: null, timer: null };
          w.done = (r) => { tClear(w.timer); res(r); };
          w.timer = tSet(() => {
            const i = P.musicWaiters.indexOf(w);
            if(i >= 0) P.musicWaiters.splice(i, 1);
            res({ ok: false, code: 'timeout' });
          }, REQ_TIMEOUT_MS);
          P.musicWaiters.push(w);
          send(msg);
        });
      },
      serverNow(){ return now() + P.clockOff; },   // welcome · music 의 now 로 맞춘 서버 시각(ms)
      lastMusicSeq(){ return P.musicSeq; },        // 서버가 마지막으로 받아들인 차례(곡이 비어도) · 모르면 -1
      memberId(){ return P.memberId; },
      roomMeta(){ return P.meta; },
      _state: P,   // 검사용
    };
  }

  return {
    makeProvider, random, peek, timing,
    isReady: () => ready_(),
    inRoom: () => !!(active && active.inRoom),
    /* 지금 방의 provider 속 — 같은 방의 다른 포트(대화)가 «지금 방 코드» 를 물을 때 */
    roomCode: () => (active && active.inRoom && active.joined) ? active.room : null,
    /* 연결의 나(ready.userCode) — 방장 · 대화 글쓴이 · 사진 자리 판정은 이 값 */
    myCode: () => { try{ return hub.userCode() || null; }catch(_){ return null; } },
    _debug: () => ({ active, downSince, noticeTimer, giveUpTimer }),
  };
}

const api = { JOIN_TIMEOUT_MS, REQ_TIMEOUT_MS, LEAVE_WAIT_MS, TIMING_DEFAULTS, RECONNECT_NOTICE_MS, MEMBER_FIELDS, CHAT_FIELDS, CHANNELS,
  TAB_WIRE, GENERAL_WIRE, ROOM_MSGS, ROOM_REFS,
  tabToWire, tabFromWire, historyTabOf, isRoomWidePoke, splitRoomPayload, chatFromWire, metaFromWire, metaMatches, musicToWire, memberFrom,
  createRoomRt };
if(typeof window !== 'undefined'){
  /* 앱 한 벌 — realtime 연결 하나(TwRtHub.store) 위. 시간 두 칸은 원격 설정(room.timing · remote-config.js 가 먼저 실린다). */
  api.store = createRoomRt({
    hub: window.TwRtHub.store, STATE: window.TwRtHub.STATE,
    timing: () => window.TwRemoteConfig.store.roomServerTiming(),
  });
  window.TwRoomRt = api;
}
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

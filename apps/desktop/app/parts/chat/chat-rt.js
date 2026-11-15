/* chat-rt.js — 💬 대화 포트(대화 기록 · 보내기 · 방장 지우기 · 내 이모티콘) — realtime 연결 하나 + API (검사 sim-chat-rt.js)
   [책임] 투게더룸 · 시크릿룸 대화창의 서버 길 한 곳.
     · 보내기 chatSay{ requestId, tab, text | game } → 보낸 연결에 chatSaid · 방 전원에 chatLine. 시간 안에 답이 없으면 실패로 끝낸다(자동으로 다시 보내지 않는다) — 사용자가 같은 글을 다시 누르면 같은 requestId 로 보낸다(서버가 처음 줄을 돌려줘 두 줄이 안 생긴다).
     · 지난 기록 GET /v2/rooms/{코드}/chats?tab=&since=&limit= → { lines, hasMore } — since 는 시각(이상) · hasMore 면 마지막 줄 시각으로 다시. 시크릿룸도 읽는다(서버가 3일 보관 — 사용자 결정 11-09). 못 받으면 onFail — 빈 대화로 그리지 않는다.
     · 방장 지우기 chatClear{ tab } → 서버가 지우기 표시 줄(CLEAR)을 방 전원에 보낸다(앱이 따로 표시 줄을 쓰지 않는다).
     · 내 이모티콘 8칸 GET · PUT · DELETE /v2/me/emojis — 그림은 Storage 에 올린 주소만(올리기는 부르는 쪽이 넘긴다).
   [모양 바꾸기 — 이 파일 한 곳] 서버 줄 { id, tab:'GENERAL'|'S1'|'S2', kind:TEXT|GAME|CLEAR, userCode?, name, text, ts } →
     앱 줄 { id, uid(=userCode), name, text, ts(ms), tab('general'|'s1'|'s2'), sys:'clr'(CLEAR) } — 대화창 · 대화 기록(chat-history.js)이 읽던 모양.
     탭 이름은 room-rt.js 의 tabToWire · tabFromWire 한 벌을 쓴다.
   [서버가 정하는 것] 워킹룸은 대화 없음(CHAT_NOT_AVAILABLE) · 잠금(CHAT_OFF) · 5초 8줄(CHAT_TOO_FAST) · 글 상한 · 방장 지우기 — 여기서 다시 판단하지 않는다.
   classic script(window.TwChatRt) — rt-hub.js · room-rt.js · api-client.js · request-id.js 다음 · app.js 보다 먼저. 앱 한 벌은 TwChatRt.store. */
(function(){
'use strict';

const SAY_WAIT_MS = 5000;        // chatSaid 를 기다리는 시간 — 넘으면 실패(timeout). 자동으로 다시 보내지 않는다
const RETRY_TTL_MS = 60000;      // 시간 초과로 끝난 글의 requestId 를 다시 쓰는 시간 — 서버의 같은 requestId 중복 방지 보관 안(지나면 새 글로 본다)
const RETRY_KEEP = 20;           // 시간 초과로 끝난 글의 requestId 를 들고 있는 개수 — 사용자가 같은 글을 다시 보낼 때 같은 번호를 쓴다
const CLEAR_WAIT_MS = 5000;      // 방장 지우기 — 지우기 표시 줄을 기다리는 시간
const PAGE_LIMIT = 100;          // 한 번에 받는 줄 수(서버 기본과 같다 · 상한 300)
const PAGE_MAX = 5;              // 이어 받기 쪽수 상한 — 3일 보관 · 채널마다 300줄이라 이 안에서 끝난다
const CHATS_TIMEOUT_MS = 8000;
const LIVE_MAX = 300;            // 방 · 탭마다 들고 있는 최근 줄(chat-history.js CHAT_KEEP_MAX 와 같은 뜻)
const CLEAR_SYS = 'clr';         // chat-history.js CLEAR_SYS 와 같다(지우기 표시 줄)
const EMOJI_PATH = '/v2/me/emojis';
const ERR_REFS = Object.freeze(['chatSay', 'chatClear']);
const msOf = (v) => {
  if(typeof v === 'number' && isFinite(v)) return v;
  const t = (typeof v === 'string') ? Date.parse(v) : NaN;
  return isFinite(t) ? t : null;
};

/** 서버 줄 → 앱 줄 · 모양이 틀리면 null. tabFromWire 는 room-rt.js 의 것('S1' → 's1' · 그 밖 null = #일반). */
function lineFromWire(line, tabFromWire){
  if(!line || typeof line !== 'object' || typeof line.id !== 'string' || !line.id) return null;
  const ts = msOf(line.ts);
  const m = { id: line.id, uid: (typeof line.userCode === 'string') ? line.userCode : null,
    name: (typeof line.name === 'string') ? line.name : '', text: (typeof line.text === 'string') ? line.text : '',
    ts: (ts === null) ? 0 : ts, tab: tabFromWire(line.tab) || 'general' };
  if(line.kind === 'CLEAR') m.sys = CLEAR_SYS;
  if(line.kind === 'GAME') m.game = true;
  return m;
}

/** @param {{ hub: { onMessage: Function, send: Function, isReady: () => boolean },
 *   api: { get: Function, put: Function, del: Function },   // 로그인 API 통로(TwApi.authed)
 *   roomCode: () => (string|null),   // 지금 들어가 있는 방(room-rt.js roomCode) — chatLine 에는 방 코드가 없다
 *   historyTabOf: (appTab: string) => string, tabFromWire: (w: string) => (string|null),   // room-rt.js 탭 바꾸기 한 벌
 *   newRequestId: () => string,
 *   setTimeout?: Function, clearTimeout?: Function, log?: { warn: Function } }} deps */
function createChatRt(deps){
  const hub = deps.hub, api = deps.api;
  const tSet = deps.setTimeout || ((f, ms) => setTimeout(f, ms));
  const tClear = deps.clearTimeout || ((h) => clearTimeout(h));
  const log = deps.log || console;
  const warn = (...a) => { try{ log.warn('[대화]', ...a); }catch(_){} };
  const fromWire = (line) => lineFromWire(line, deps.tabFromWire);

  /* 지금 방에서 받은 줄 — 방 · 탭마다(방이 바뀌면 비운다). 같은 id 는 하나. */
  let liveRoom = null;
  const live = new Map();     // tab → Map(id → 줄)
  const subs = new Set();     // { room, tab, fn }
  const pendingSay = new Map();   // requestId → waiter
  const pendingClear = [];        // { tab, done }
  const nowMs = deps.now || (() => Date.now());
  const timedOut = new Map();     // 방 · 글 모양 → { id, at } — requestId — 시간 초과로 끝난 것만(서버가 받았을 수 있어 같은 번호로 다시 보낸다)

  function liveOf(tab){
    if(!live.has(tab)) live.set(tab, new Map());
    return live.get(tab);
  }
  function keep(m){
    const room = deps.roomCode();
    if(!room) return null;
    if(room !== liveRoom){ live.clear(); liveRoom = room; }
    const box = liveOf(m.tab);
    box.set(m.id, m);
    if(box.size > LIVE_MAX){ const first = box.keys().next().value; box.delete(first); }
    return room;
  }
  function deliver(m){
    const room = keep(m);
    if(!room) return;
    for(const s of Array.from(subs)){
      if(s.room === room && s.tab === m.tab){ try{ s.fn(m); }catch(e){ warn('줄 알림 실패', e); } }
    }
    if(m.sys === CLEAR_SYS){
      for(let i = pendingClear.length - 1; i >= 0; i--){ if(pendingClear[i].tab === m.tab){ pendingClear[i].done({ ok: true }); pendingClear.splice(i, 1); } }
    }
  }

  hub.onMessage('chatLine', (msg) => { const m = fromWire(msg && msg.line); if(m) deliver(m); });
  hub.onMessage('chatSaid', (msg) => {
    const m = fromWire(msg && msg.line);
    if(m) deliver(m);
    const w = msg && pendingSay.get(msg.requestId);
    if(w) w.done(m ? { ok: true, id: m.id, ts: m.ts } : { ok: false, code: 'CHAT_STORE_UNAVAILABLE' });
  });
  hub.onMessage('error', (msg) => {
    if(!msg || ERR_REFS.indexOf(msg.ref) < 0) return;
    if(msg.ref === 'chatSay'){
      const w = pendingSay.get(msg.requestId);
      if(w) w.done({ ok: false, code: msg.code });
      return;
    }
    const c = pendingClear.shift();
    if(c) c.done({ ok: false, code: msg.code });
  });

  /* 보내기 — chatSaid 를 기다린다(자동으로 다시 보내지 않는다). { ok, id, ts } · 거절 { ok:false, code }(CHAT_OFF · CHAT_TOO_FAST · timeout · notReady …)
     시간 초과 뒤 사용자가 같은 글을 다시 보내면 같은 requestId — 서버가 이미 받았다면 처음 줄을 돌려준다. */
  function say(body){
    const key = String(deps.roomCode() || '') + '\n' + JSON.stringify(body);   // 방이 다르면 같은 글도 다른 글이다
    const prev = timedOut.get(key);
    const requestId = (prev && nowMs() - prev.at <= RETRY_TTL_MS) ? prev.id : deps.newRequestId();
    timedOut.delete(key);
    const msg = Object.assign({ t: 'chatSay', requestId }, body);
    return new Promise((res) => {
      let timer = null;
      const w = { done: null };
      w.done = (r) => {
        tClear(timer); pendingSay.delete(requestId);
        if(r && r.code === 'timeout'){ timedOut.set(key, { id: requestId, at: nowMs() }); if(timedOut.size > RETRY_KEEP) timedOut.delete(timedOut.keys().next().value); }
        res(r);
      };
      pendingSay.set(requestId, w);
      if(!hub.send(msg)){ w.done({ ok: false, code: 'notReady' }); return; }
      timer = tSet(() => w.done({ ok: false, code: 'timeout' }), SAY_WAIT_MS);
    });
  }
  /** 글 한 줄 — appTab 'general' · 's1' · 's2' */
  function sendText(room, text, appTab){
    if(!room || room !== deps.roomCode()) return Promise.resolve({ ok: false, code: 'notInRoom' });
    return say({ tab: deps.historyTabOf(appTab), text: String(text || '') });
  }
  /** 기록 줄(게임) — { dice: [a, b] } | { fly: userCode } · 문장은 서버가 만든다 */
  function sendGame(room, game, appTab){
    if(!room || room !== deps.roomCode()) return Promise.resolve({ ok: false, code: 'notInRoom' });
    const body = { game };
    if(game && game.dice) body.tab = deps.historyTabOf(appTab);   // 날리기는 늘 #일반(서버)
    return say(body);
  }
  /** 방장 지우기 — { ok } · 거절 { ok:false, code }(CHAT_NOT_HOST · CHAT_STORE_UNAVAILABLE) */
  function clear(room, appTab){
    if(!room || room !== deps.roomCode()) return Promise.resolve({ ok: false, code: 'notInRoom' });
    const tab = deps.tabFromWire(deps.historyTabOf(appTab)) || 'general';
    return new Promise((res) => {
      const c = { tab, done: null, timer: null };
      c.done = (r) => { tClear(c.timer); res(r); };
      c.timer = tSet(() => { const i = pendingClear.indexOf(c); if(i >= 0) pendingClear.splice(i, 1); res({ ok: false, code: 'timeout' }); }, CLEAR_WAIT_MS);
      pendingClear.push(c);
      if(!hub.send({ t: 'chatClear', tab: deps.historyTabOf(appTab) })){ pendingClear.splice(pendingClear.indexOf(c), 1); c.done({ ok: false, code: 'notReady' }); }
    });
  }

  /* 지난 기록 한 쪽 — 못 받으면 던진다(부르는 쪽이 «못 불러옴» 을 그린다) */
  async function page(room, appTab, sinceMs, limit){
    let path = '/v2/rooms/' + encodeURIComponent(room) + '/chats?tab=' + deps.historyTabOf(appTab) + '&limit=' + limit;
    if(typeof sinceMs === 'number') path += '&since=' + encodeURIComponent(new Date(sinceMs).toISOString());
    const d = await api.get(path, { auth: true, timeoutMs: CHATS_TIMEOUT_MS });
    const lines = (d && Array.isArray(d.lines)) ? d.lines.map(fromWire).filter(Boolean) : [];
    return { lines, hasMore: !!(d && d.hasMore) };
  }

  /** chat-history.js 의 subscribeSince — since 가 null 이면 마지막 PAGE_LIMIT 줄, 숫자면 그 시각 이후 전부(쪽 넘김).
   *  새 줄마다 onMsg(줄) · 처음 받기가 끝나면 onReady() 한 번 · 못 받으면 onReady 대신 onFail(오류) 한 번. 반환: 끊는 함수. 받는 동안 온 줄도 놓치지 않는다(같은 id 는 하나로). */
  function subscribeSince(room, appTab, since, onMsg, onReady, onFail){
    const tab = deps.tabFromWire(deps.historyTabOf(appTab)) || 'general';
    let closed = false;
    const sub = { room, tab, fn: (m) => { if(!closed) onMsg(m); } };
    subs.add(sub);
    (async () => {
      try{
        if(typeof since !== 'number'){
          const p = await page(room, appTab, null, PAGE_LIMIT);
          if(!closed) p.lines.forEach(sub.fn);
        }else{
          let at = since;
          for(let n = 0; n < PAGE_MAX && !closed; n++){
            const p = await page(room, appTab, at, PAGE_LIMIT);
            if(closed) break;
            p.lines.forEach(sub.fn);
            if(!p.hasMore || !p.lines.length) break;
            at = p.lines[p.lines.length - 1].ts;
          }
        }
      }catch(e){
        warn('지난 기록을 못 받음', (e && (e.code || e.message)) || e);
        if(!closed && onFail){ try{ onFail(e); }catch(_){} }   // 빈 대화로 끝내지 않는다 — 부르는 쪽이 «못 불러옴» 을 알린다
        return;
      }
      if(!closed && onReady) onReady();
    })();
    return () => { closed = true; subs.delete(sub); };
  }

  /** 최근 limit 줄 목록 구독(안 읽은 수 세기) — 처음에 받고 · 새 줄마다 cb(정렬된 목록). 처음 받기가 실패하면 onFail(오류) 한 번 — 부르는 쪽이 «모름» 으로 그린다(0 으로 그리지 않는다). 반환: 끊는 함수. */
  function subscribeLog(room, cb, limit, appTab, onFail){
    const tab = deps.tabFromWire(deps.historyTabOf(appTab)) || 'general';
    const n = Math.max(1, Math.min(PAGE_LIMIT, (limit | 0) || PAGE_LIMIT));
    const box = new Map();
    let closed = false;
    const emit = () => {
      if(closed) return;
      const list = Array.from(box.values()).sort((a, b) => (a.ts - b.ts) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      cb(list.slice(Math.max(0, list.length - n)));
    };
    const sub = { room, tab, fn: (m) => { box.set(m.id, m); emit(); } };
    subs.add(sub);
    page(room, appTab, null, n).then((p) => { if(closed) return; p.lines.forEach((m) => box.set(m.id, m)); emit(); }, (e) => { warn('최근 줄을 못 받음', (e && (e.code || e.message)) || e); if(!closed && onFail){ try{ onFail(e); }catch(err){ warn('최근 줄 실패 처리 실패', err); } } });
    return () => { closed = true; subs.delete(sub); };
  }

  /* ── 내 이모티콘 8칸 ── */
  /** { 칸: { cmd, url, gif } } — 대화창이 읽던 모양 · 못 받으면 던진다(빈 칸 {} 로 그리면 저장할 때 서버 칸을 덮을 수 있다) */
  async function getEmojis(){
    {
      const d = await api.get(EMOJI_PATH, { auth: true });
      const out = {};
      for(const e of ((d && Array.isArray(d.slots)) ? d.slots : [])){
        if(e && Number.isInteger(e.slot) && typeof e.imageUrl === 'string') out[e.slot] = { cmd: String(e.cmd || ''), url: e.imageUrl, gif: !!e.animated };
      }
      return out;
    }
  }
  /** 칸 하나 — 그림 주소(Storage)는 부르는 쪽이 올려 넘긴다 · { ok } | { ok:false, code } */
  async function putEmoji(slot, cmd, imageUrl){
    try{ await api.put(EMOJI_PATH + '/' + (slot | 0), { cmd: String(cmd || ''), imageUrl: String(imageUrl || '') }); return { ok: true }; }
    catch(e){ return { ok: false, code: (e && e.code) || 'error' }; }
  }
  async function deleteEmoji(slot){
    try{ await api.del(EMOJI_PATH + '/' + (slot | 0)); return { ok: true }; }
    catch(e){ return { ok: false, code: (e && e.code) || 'error' }; }
  }

  /* 계정이 바뀜 — 앞 계정의 줄 · 기다리던 요청 · 다시 보낼 번호를 비운다(session.onReset). 구독은 부르는 쪽(대화창)이 닫는다. */
  function reset(){
    for(const w of Array.from(pendingSay.values())){ try{ w.done({ ok: false, code: 'reset' }); }catch(_){} }
    for(const c of pendingClear.splice(0)){ try{ c.done({ ok: false, code: 'reset' }); }catch(_){} }
    live.clear(); liveRoom = null; subs.clear(); timedOut.clear();
  }

  return { sendText, sendGame, clear, subscribeSince, subscribeLog, getEmojis, putEmoji, deleteEmoji, reset,
    _debug: () => ({ live, subs, pendingSay, pendingClear, timedOut }) };
}

const api = { SAY_WAIT_MS, CLEAR_WAIT_MS, PAGE_LIMIT, PAGE_MAX, LIVE_MAX, CLEAR_SYS, EMOJI_PATH, lineFromWire, createChatRt };
if(typeof window !== 'undefined'){
  /* 앱 한 벌 — realtime 연결 하나 · 방 포트(지금 방 · 탭 바꾸기) · 로그인 API 통로 */
  const R = window.TwRoomRt;
  api.store = createChatRt({
    hub: window.TwRtHub.store, api: window.TwApi.authed,
    roomCode: () => R.store.roomCode(), historyTabOf: R.historyTabOf, tabFromWire: R.tabFromWire,
    newRequestId: () => window.TwRequestId.newId(),
  });
  window.TwChatRt = api;
}
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

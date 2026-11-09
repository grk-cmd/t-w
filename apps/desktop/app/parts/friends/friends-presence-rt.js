/* friends-presence-rt.js — 👥 친구 접속 상태 provider(realtime 연결 하나) — friends-port.js 가 부른다
   책임: 친구들의 접속 상태를 realtime 으로 받는다. 한 번 읽기는 presenceGet(ids 를 한 번에 PRESENCE_IDS_MAX 명씩 나눠 보냄),
     듣기는 watch 하나(서버가 «바뀐 친구만» 알려 준다 — 친구마다 따로 구독하지 않는다). 타이머로 되풀이 묻지 않는다 —
     다시 보내는 때는 연결이 다시 붙었을 때(서버의 듣기는 연결에 묶여 있다)와 사용자가 연 · 누른 때뿐.
   내보냄: createFriendsPresenceRt(deps) → {
     readPresence(ids) → Promise<{ 친구id: { online, lastSeen, room, inRoom } }>   못 받으면 던진다(빈 값과 다르다) · 친구가 아닌 id 는 서버가 빼서 결과에도 없다
     watchPresence(ids, onChange, onStatus) → 해제 함수   onChange({ 친구id: 접속 상태 }) — 처음 전체 + 그 뒤 바뀐 친구 · onStatus(WAITING | LIVE) 필수
   }
   순수: presenceOf(raw) · chunk(ids, n) · usersOf · PRESENCE_IDS_MAX · LIVE · WAITING (TwFriendsPresenceRt 위)
   ⚠️ 듣기는 하나뿐 — 새로 걸면 앞의 것을 푼다(friends-sub 가 «지금 열린 목록의 친구 전부» 한 벌만 건다).
   ⚠️ rid 가 붙은 presence 는 presenceGet 의 답이다(rt-hub 가 요청에 돌려줌) — 늦게 온 것은 듣기 값이 아니라 버린다.
   ⚠️ 연결이 멈췄나(다른 기기 · 업데이트 · 점검 · 계정 없음)는 rt-hub 의 판단이고 화면은 끊김 정책 몫 — 여기서는 «붙어 있지 않음 = WAITING» 하나로 본다.
   ⚠️ 서버는 «보이기 끔» 인 친구를 online:false 로 준다 — 앱이 따로 숨김을 가리지 않는다.
   검사: checks/sim-friends-presence-rt.js */
(function(){
'use strict';

const PRESENCE_IDS_MAX = 100;   // 서버 presenceGet 의 ids 상한 — 친구 상한(FRIEND_MAX)과 같다. 넘으면 나눠 보낸다
/* 듣기 상태 — WAITING 처음 전체를 기다림(보냄 · 연결이 붙지 않음) · LIVE 처음 전체를 받음 */
const LIVE = 'live', WAITING = 'waiting';

/* 서버의 친구 한 명 → 앱 모양. 오프라인이면 방은 없다(서버도 그렇게 주지만 앱도 지킨다). lastSeen 은 모르면 0(옛 앱과 같은 «모름»). */
function presenceOf(raw){
  const p = (raw && typeof raw === 'object') ? raw : {};
  const online = p.online === true;
  return {
    online,
    lastSeen: (typeof p.lastSeen === 'number' && p.lastSeen > 0) ? p.lastSeen : 0,
    room: (online && typeof p.room === 'string' && p.room) ? p.room : null,
    inRoom: online && p.inRoom === true,
  };
}
function chunk(ids, n){
  const out = [];
  for(let i = 0; i < ids.length; i += n) out.push(ids.slice(i, i + n));
  return out;
}
/* 답 메시지 → 받은 친구만 앱 모양으로(want 에 없는 id 는 버린다). 모양이 틀리면 null. */
function usersOf(msg, want){
  const u = msg && msg.users;
  if(!u || typeof u !== 'object' || Array.isArray(u)) return null;
  const out = {};
  for(const id of Object.keys(u)) if(!want || want.has(id)) out[id] = presenceOf(u[id]);
  return out;
}

/** @param {{
 *   rt: {
 *     send: (msg: object) => boolean,
 *     request: (msg: object) => Promise<object | null>,
 *     onMessage: (t: string, fn: (m: any) => void) => () => void,
 *     onState: (fn: (s: string) => void) => () => void,
 *     isReady: () => boolean,
 *   },
 * }} deps — rt: realtime 연결 하나(TwRtHub.store) */
function createFriendsPresenceRt(deps){
  const rt = deps.rt;
  let _cur = null;   // 지금 걸린 듣기 — 하나뿐

  async function readPresence(ids){
    const want = Array.from(new Set((ids || []).filter(Boolean)));
    if(!want.length) return {};
    const replies = await Promise.all(chunk(want, PRESENCE_IDS_MAX).map(part => rt.request({ t: 'presenceGet', ids: part })));
    const out = {}, set = new Set(want);
    for(const r of replies){
      const u = usersOf(r, set);
      if(!u) throw new Error('접속 상태를 받지 못했어요');   // 답이 없음(연결 · 시간 초과 · 거절) — «친구 없음» 과 다르다
      Object.assign(out, u);
    }
    return out;
  }

  function _stop(w){
    if(w.dead) return;
    w.dead = true;
    for(const off of w.offs){ try{ off(); }catch(_){} }
    if(rt.isReady()) rt.send({ t: 'unwatch' });
    if(_cur === w) _cur = null;
  }
  function watchPresence(ids, onChange, onStatus){
    if(_cur) _stop(_cur);
    const w = { dead: false, offs: [], want: new Set((ids || []).filter(Boolean)), last: null, ask: null };
    _cur = w;
    const status = (s) => { if(w.dead || w.last === s) return; w.last = s; onStatus(s); };
    /* 연결이 준비되면 «듣기» 를 보낸다(처음 · 다시 붙은 뒤 · 사용자가 다시 열 때). 보냈든 못 보냈든 처음 전체를 받기 전은 WAITING. */
    w.ask = () => {
      if(rt.isReady()) rt.send({ t: 'watch' });
      status(WAITING);
    };
    w.offs.push(rt.onMessage('presence', (m) => {
      if(w.dead || m.rid !== undefined) return;
      const u = usersOf(m, w.want);
      if(!u) return;
      if(Object.keys(u).length) onChange(u);
      if(m.full === true) status(LIVE);
    }));
    w.offs.push(rt.onState(() => { if(!w.dead) w.ask(); }));
    w.ask();
    return () => _stop(w);
  }
  return { readPresence, watchPresence };
}

const api = { createFriendsPresenceRt, presenceOf, chunk, usersOf, PRESENCE_IDS_MAX, LIVE, WAITING };
if(typeof window !== 'undefined') window.TwFriendsPresenceRt = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

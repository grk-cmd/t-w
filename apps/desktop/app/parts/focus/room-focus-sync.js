/* room-focus-sync.js — 📊 시크릿룸 집중 기록 올리기(내 집중 시간 → 방 기록)
   ⏱️ 포커스 누적(focus-level.js addFocusSeconds)이 «이만큼 쌓였다» 고 알려 주면, 이 방이 시크릿룸이고 내가 «이 방 기록에 올리기» 를 켰을 때만
   그 초를 모았다가 1분에 한 번 서버(provider)에 더한다. 방에 있는 동안만 센다 — 방을 나가면(방 코드가 바뀌면) 그 방 몫은 거기서 끝난다.
   ★ 켜는 것은 사람마다 · 방마다다(localStorage tw.roomFocus.{내 id}.{방} = '1' — 다른 계정은 켜져 있지 않다). 끄면 그 뒤로 안 올라간다(올라간 기록은 그대로 — 지우기는 #집중 탭).
   ★ 날짜는 6시 경계 «집중 하루»(focus-total.js _focusDayStr) — deps.dayKey 가 YYYYMMDD 로 준다.
   ⚠️ 앱이 꺼지거나 방을 나가는 순간 모으던 최대 1분 몫은 못 올린다(의도 — 종료 시점을 따로 잡지 않는다).
   ⚠️ 서버 일은 provider(deps) 한 곳 — 이 파일은 firebaseAPI 를 직접 부르지 않는다. 실패하면 그 몫은 다음 때 다시 얹는다(상한 안에서).
   classic script(window.TwRoomFocusSync) — app.js 가 createRoomFocusSync(deps) 로 만들고, 포커스 모듈이 addFocusSeconds 끝에서 부르는 알림에 건다.
   검사: checks/sim-room-focus.js */
(function(){

const KEY_PREFIX = 'tw.roomFocus.';
const FLUSH_MS = 60 * 1000;
const RETRY_CAP_SEC = 600;   // 서버가 안 받는 동안 쥐고 있는 최대 초(그 이상은 버린다)

/**
 * @param {{
 *   provider: { add(room: string, uid: string, day: string, sec: number): Promise<{ok:boolean}>, setName(room: string, uid: string, name: string): Promise<{ok:boolean}> },
 *   roomCode: () => string, isSecretRoom: () => boolean, getMyUserId: () => string, getMyName: () => string,
 *   dayKey: () => string, now: () => number,
 *   storage: { getItem(k: string): string|null, setItem(k: string, v: string): void, removeItem(k: string): void },
 * }} deps
 */
function createRoomFocusSync(deps){
  const provider = deps.provider;
  const roomCode = deps.roomCode;
  const isSecretRoom = deps.isSecretRoom;
  const getMyUserId = deps.getMyUserId;
  const getMyName = deps.getMyName;
  const dayKey = deps.dayKey;
  const now = deps.now;
  const storage = deps.storage;

  let pending = null;          // { room, day, sec } — 아직 서버에 안 더한 몫
  let lastFlush = 0;
  const nameSent = {};         // 방 → 마지막으로 서버에 쓴 이름

  /* 켜짐 표시는 «내 id · 방» 마다 — 같은 PC 에서 다른 계정이 들어와도 켜져 있지 않다(그 사람 동의 없이 올라가지 않게) */
  const keyOf = (room) => KEY_PREFIX + getMyUserId() + '.' + room;
  function isOn(room){
    if(!room || !getMyUserId()) return false;
    try{ return storage.getItem(keyOf(room)) === '1'; }catch(_){ return false; }
  }
  function setOn(room, on){
    if(!room || !getMyUserId()) return;
    try{ if(on) storage.setItem(keyOf(room), '1'); else storage.removeItem(keyOf(room)); }catch(_){}
    if(!on) pending = null;   // 끄는 순간 모으던 몫은 올리지 않는다(켜 둔 적 없는 것으로)
  }
  /* 서버에서 내 칸을 지운 뒤 — 이름도 같이 지워졌으니 다음 올리기에 다시 쓰게 한다(안 그러면 방 사람들 화면에 «이름 없음») */
  function forgetName(room){ delete nameSent[room]; }

  /* 한 번 올린다 — 정수 초만(남는 소수는 pending 에 둔다). 실패하면 같은 칸이면 되돌려 얹는다. */
  async function send(p){
    const whole = Math.floor(p.sec);
    if(whole < 1) return;
    const uid = getMyUserId();
    if(!uid) return;
    const name = String(getMyName() || '').slice(0, 20);
    if(nameSent[p.room] !== name){
      const nr = await provider.setName(p.room, uid, name).catch(() => null);
      if(nr && nr.ok) nameSent[p.room] = name;
    }
    const r = await provider.add(p.room, uid, p.day, whole).catch(() => null);
    if(!(r && r.ok) && pending && pending.room === p.room && pending.day === p.day && pending.sec + whole <= RETRY_CAP_SEC){
      pending.sec += whole;
    }
  }
  function take(){
    const p = pending; if(!p) return null;
    const whole = Math.floor(p.sec);
    if(whole < 1) return null;
    pending = { room: p.room, day: p.day, sec: p.sec - whole };
    return { room: p.room, day: p.day, sec: whole };
  }

  /* 포커스 누적이 sec 초 쌓일 때마다 부른다(보통 1초 안팎) — 켜져 있지 않으면 아무것도 안 한다. */
  function add(sec){
    if(!(sec > 0)) return;
    const room = roomCode();
    if(!room || !isSecretRoom() || !isOn(room) || !getMyUserId()) return;
    const day = dayKey();
    if(pending && (pending.room !== room || pending.day !== day)){
      const old = pending; pending = null; send(old);   // 방이 바뀌었거나 6시를 넘겼다 — 앞 몫은 그 방 · 그 날에 마무리
    }
    if(!pending) pending = { room, day, sec: 0 };
    pending.sec += sec;
    if(now() - lastFlush >= FLUSH_MS){
      lastFlush = now();
      const t = take(); if(t) send(t);
    }
  }

  return { isOn, setOn, add, forgetName };
}

const api = Object.freeze({ KEY_PREFIX, FLUSH_MS, RETRY_CAP_SEC, createRoomFocusSync });
if(typeof window !== 'undefined') window.TwRoomFocusSync = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

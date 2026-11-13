/* room-focus-net.js — 📊 시크릿룸 집중 기록의 서버 읽기 · 쓰기(provider)
   ★ 데이터: rooms/{방}/_focus/{내 id} = { n(이름 ≤20자), d: { YYYYMMDD: 그날 집중 초(0~86400) }, o(12주보다 오래된 날들을 합친 초) }
     `_` 로 시작해 방 인원으로 안 센다 · 대화 3일 보관(chat-expire.js)이 건드리지 않는다.
   ★ 쓰는 길은 «내 칸» 뿐이다 — 하루 합은 트랜잭션으로 늘리기만 하고(깎지 않는다), 합치기는 날 칸 지우기 + o 올리기 한 묶음, 내 기록 지우기는 내 칸 통째.
   ⚠️ 규칙은 모양 · 범위 · 시크릿룸 코드만 지킨다(Firebase 방은 쓰기가 열려 있다 — 남의 칸 쓰기는 앱이 막는다).
   ⚠️ 실패는 던지지 않고 { ok:false } 로 돌려준다(기술 문구는 싣지 않는다 — 화면이 E-CHAT-02 로 안내).
   classic script(window.TwRoomFocusNet) — firebase-init.js 의 firebaseAPI.roomFocus 가 이것을 만든다(데이터 통로의 함수를 그대로 넘김).
   검사: checks/sim-room-focus.js */
(function(){

const MAX_DAY_SEC = 86400;
const path = (room, uid, rest) => 'rooms/' + room + '/_focus' + (uid ? '/' + uid : '') + (rest ? '/' + rest : '');

/** @param {{ db: unknown, ref: Function, update: Function, remove: Function, set: Function, onValue: Function, off: Function, runTransaction: Function }} d */
function createRoomFocusNet(d){
  const { db, ref, update, remove, set, onValue, off, runTransaction } = d;

  /** 방 전체 기록을 구독 — cb(객체 · 비면 {} · 읽기 실패면 null). 돌려주는 함수가 구독 해제. */
  function subscribe(room, cb){
    if(!room) return () => {};
    const r = ref(db, path(room));
    onValue(r, snap => cb(snap.val() || {}), () => cb(null));
    return () => off(r, 'value');
  }
  /** 내 그날 합에 sec 초를 더한다(하루 상한 86400 · 깎지 않는다). */
  async function add(room, uid, day, sec){
    if(!room || !uid || !day || !(sec > 0)) return { ok: false };
    try{
      const res = await runTransaction(ref(db, path(room, uid, 'd/' + day)), cur => {
        const base = (typeof cur === 'number' && cur >= 0) ? cur : 0;
        return Math.min(MAX_DAY_SEC, base + Math.floor(sec));
      });
      return { ok: !!res.committed };
    }catch(_){ return { ok: false }; }
  }
  async function setName(room, uid, name){
    if(!room || !uid) return { ok: false };
    try{ await set(ref(db, path(room, uid, 'n')), String(name || '').slice(0, 20)); return { ok: true }; }
    catch(_){ return { ok: false }; }
  }
  /** 오래된 날들을 합쳐 o 로 옮긴다 — plan = { newO, keys }. 한 번의 update 라 중간 모양이 남지 않는다. */
  async function compact(room, uid, plan){
    if(!room || !uid || !plan || !plan.keys || !plan.keys.length) return { ok: false };
    try{
      const w = {};
      w[path(room, uid, 'o')] = plan.newO;
      plan.keys.forEach(k => { w[path(room, uid, 'd/' + k)] = null; });
      await update(ref(db), w);
      return { ok: true };
    }catch(_){ return { ok: false }; }
  }
  async function removeMine(room, uid){
    if(!room || !uid) return { ok: false };
    try{ await remove(ref(db, path(room, uid))); return { ok: true }; }
    catch(_){ return { ok: false }; }
  }

  return { subscribe, add, setName, compact, removeMine };
}

const api = Object.freeze({ MAX_DAY_SEC, createRoomFocusNet });
if(typeof window !== 'undefined') window.TwRoomFocusNet = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

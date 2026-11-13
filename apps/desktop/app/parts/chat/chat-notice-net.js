/* chat-notice-net.js — 📢 시크릿룸 공지의 서버 읽기 · 쓰기(Realtime Database) — firebase-init.js 는 연결만(firebaseAPI.chatNotice)
   classic script(window.TwChatNoticeNet) — firebase-init.js(type=module · 늦게 돈다)보다 먼저 싣는다(data-gateway.js 와 같은 방식).
   ★ 자리: rooms/{방}/_notice/{n1..n20} = { text(1~300자), ts, pin? } — 규칙 firebase/firebase-database-rules.json 의 _notice 와 같다.
   ⚠️ `_` 로 시작해야 한다 — 방 인원을 세는 자리가 «`_` 시작 키» 는 사람으로 세지 않는다(_chatTab 과 같은 까닭).
   ⚠️ 자리 이름이 곧 상한(20개)이다 — 규칙에는 자식 수를 세는 함수가 없다. 지운 자리는 다시 쓴다.
   서버 방이어도 어느 방이든 Firebase 다(탭 기록 _chatTab 과 같다). 쓰기는 방장만 — 앱이 막고(시크릿룸 방장은 고정),
   규칙은 모양 · 길이 · 시크릿룸 코드만 지킨다. 글자는 호출하는 쪽이 정리해서 넘긴다(chat-notice.js cleanText).
   돌려주는 { ok, reason? } 의 reason 은 사람이 읽는 말만(꽉 참) — 기술 문구는 안 싣는다.
   검사: checks/sim-chat-notice.js */
(function(){
const NOTICE_SLOT_COUNT = 20;
const NOTICE_SLOTS = Array.from({ length: NOTICE_SLOT_COUNT }, (_, i) => 'n' + (i + 1));
const NOTICE_FULL_MSG = '공지는 ' + NOTICE_SLOT_COUNT + '개까지예요';

/** @param {{ db: unknown, ref: Function, update: Function, remove: Function, set: Function, onValue: Function, off: Function, runTransaction: Function, now?: () => number }} d */
function createChatNoticeNet(d){
  const { db, ref, update, remove, set, onValue, off, runTransaction } = d;
  const now = d.now || (() => Date.now());
  const path = (room, id) => 'rooms/' + room + '/_notice' + (id ? '/' + id : '');

  /** 공지 전체를 구독 — cb(객체 · 비면 {}). 돌려주는 함수가 구독 해제. */
  function subscribe(room, cb){
    if(!room) return () => {};
    const r = ref(db, path(room));
    onValue(r, snap => cb(snap.val() || {}));
    return () => off(r, 'value');
  }
  async function add(room, text){
    if(!room) return { ok: false };
    try{
      let full = false, id = null;
      const ts = now();
      const res = await runTransaction(ref(db, path(room)), cur => {
        const t = cur || {};
        id = NOTICE_SLOTS.find(k => !t[k]) || null;
        if(!id){ full = true; return; }
        t[id] = { text: String(text), ts };
        return t;
      });
      if(full || !res.committed) return { ok: false, reason: full ? NOTICE_FULL_MSG : '' };
      return { ok: true, id };
    }catch(_){ return { ok: false }; }
  }
  async function edit(room, id, text){
    if(!room || !id) return { ok: false };
    try{ await set(ref(db, path(room, id) + '/text'), String(text)); return { ok: true }; }
    catch(_){ return { ok: false }; }
  }
  async function del(room, id){
    if(!room || !id) return { ok: false };
    try{ await remove(ref(db, path(room, id))); return { ok: true }; }
    catch(_){ return { ok: false }; }
  }
  /** 고정 — id 하나만 pin:true 로, 나머지는 pin 을 지운다(한 묶음). clearIds = 지금 pin 이 서 있는 다른 공지 id 들. */
  async function pin(room, id, on, clearIds){
    if(!room || !id) return { ok: false };
    const w = {};
    (clearIds || []).forEach(k => { if(k !== id) w[path(room, k) + '/pin'] = null; });
    w[path(room, id) + '/pin'] = on ? true : null;
    try{ await update(ref(db), w); return { ok: true }; }
    catch(_){ return { ok: false }; }
  }
  return { subscribe, add, edit, remove: del, pin };
}

const api = Object.freeze({ NOTICE_SLOT_COUNT, NOTICE_SLOTS, NOTICE_FULL_MSG, createChatNoticeNet });
if(typeof window !== 'undefined') window.TwChatNoticeNet = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

/*
 * 💬 대화 기록 — 서버 3일 + 이 PC 저장 + 커서로 이어 받기 (entities · 검사 sim-chat-history.js)
 * Firebase 를 직접 import 하지 않는다 — 구독(subscribeSince) · 지우기(clearLog)는 firebase-init.js 가 넘긴다.
 *
 * [왜] 예전엔 대화창을 열 때마다 마지막 100줄을 onValue 로 통째 구독했다. 서버 기록에는 보관 기간이 없어 계속 쌓였고,
 *   그 100줄 밖의 대화는 볼 길이 없었다. 지금은 카카오톡처럼
 *   ・서버  — 3일만 둔다(functions/chat-expire.js 가 매일 지운다 · CHAT_SERVER_KEEP_MS)
 *   ・이 PC — 워킹룸 · 시크릿룸 대화를 IndexedDB 에 개수 제한 없이 쌓는다. 공용 투게더룸은 저장하지 않는다(요청 — 공용 방은 기록을 남기지 않음)
 *   ・이어 받기 — 저장된 마지막 ts(서버 시각) 이후만 받는다. 순서 · 커서는 push key 가 아니라 ts 다
 *     (key 는 보낸 사람 시계로 만들어져 어긋난다 — firebase-init.js _chatOrder 주석). 그래서 규칙에 ts 색인이 있다.
 * [받은 것은 지우지 않는다] 서버에서 3일이 지나 지워져도(child_removed) 이미 받은 줄은 화면 · 저장에 그대로 둔다.
 *   화면 · 저장에서 지우는 것은 넷뿐: ① 방장 [지우기] 표시 줄(CLEAR_SYS) ② 채널 삭제 · 같은 자리에 새 채널(syncTabs)
 *   ③ 내가 직접 방을 나감(wipeRoom — 연결 끊김 · 정원 초과 같은 «튕김» 은 아니다) ④ 설정 › 저장된 대화 지우기 · 계정 놓기(wipeAll)
 * [방장 지우기 표시] 서버 노드를 지우면 커서 구독으로는 «지워졌다» 를 알 수 없고, 꺼져 있던 사람은 아예 못 본다.
 *   그래서 지운 뒤 표시 줄 하나(sys: 'clr')를 남긴다 — 이 줄보다 앞은 모두 버린다. 서버 3일 정리는 이 줄을 남긴다.
 *   옛 앱에는 평범한 한 줄(«알림 : 🗑 …»)로 보인다.
 * ⚠️ 저장 DB 이름에 DB 주소(scope)를 넣는다 — 운영과 dev(start:dev)가 같은 PC 에서 돈다(catalog-cache.js 와 같다).
 */

export const CHAT_SERVER_KEEP_MS = 3 * 24 * 3600 * 1000;   // 서버 보관 — functions/chat-expire.js 와 같은 값(검사가 대조)
export const CHAT_CURSOR_MARGIN_MS = 60 * 1000;            // 커서를 이만큼 앞에서 다시 받는다(같은 ts · 늦게 확정된 줄) — id 로 겹침을 거른다
export const CHAT_FIRST_LIMIT = 100;                        // 저장된 것이 없을 때 처음 받는 줄 수 — 예전 본문 구독과 같다
export const CHAT_VIEW_MAX = 1000;                          // 화면에 넘기는 최근 줄 수 — 저장은 전부, 그리기만 끊는다
export const CLEAR_SYS = 'clr';
export const CLEAR_MARK = { name: '알림', text: '🗑 방장이 대화 기록을 지웠어요', sys: CLEAR_SYS };
const SECRET_ROOM_PREFIX = 'SCRT-';                         // 시크릿룸도 채널은 togetherroom 이다 — 코드로 가른다
const IDB_NAME = 'tw-chat-history';
const FLUSH_MS = 30;                                        // 첫 구독의 child_added 수십 개를 한 번에 그린다

/* 순서 — 서버 ts 가 먼저, 같거나 없으면 id. firebase-init.js 가 같은 함수를 쓴다(_chatOrder). */
export function chatOrder(a, b){
  const ta = (typeof a.ts === 'number' && a.ts > 0) ? a.ts : null;
  const tb = (typeof b.ts === 'number' && b.ts > 0) ? b.ts : null;
  if(ta !== null && tb !== null && ta !== tb) return ta - tb;
  const ka = String(a.id || ''), kb = String(b.id || '');
  return ka < kb ? -1 : (ka > kb ? 1 : 0);
}
/* 합치기 — id 가 같으면 나중 것(서버가 ts 를 확정한 값)이 이긴다 */
export function mergeMsgs(list, add){
  const m = new Map();
  (list || []).forEach(x => { if(x && x.id) m.set(x.id, x); });
  (add || []).forEach(x => { if(x && x.id) m.set(x.id, x); });
  return Array.from(m.values()).sort(chatOrder);
}
/* 마지막 지우기 표시보다 앞은 버린다(표시 줄은 남긴다). dropped = 버린 id */
export function applyClear(list){
  let at = -1;
  (list || []).forEach((x, i) => { if(x && x.sys === CLEAR_SYS) at = i; });
  if(at <= 0) return { list: list || [], dropped: [] };
  return { list: list.slice(at), dropped: list.slice(0, at).map(x => x.id) };
}
/* 이어 받을 자리 — 확정된 ts 의 최댓값에서 여유만큼 앞. 저장된 것이 없으면 null(= 처음 받기) */
export function sinceOf(list){
  let mx = 0;
  (list || []).forEach(x => { if(x && typeof x.ts === 'number' && x.ts > mx) mx = x.ts; });
  return mx > 0 ? Math.max(0, mx - CHAT_CURSOR_MARGIN_MS) : null;
}
/* 이 PC 에 저장하는 방인가 — 공용 투게더룸만 빼고(시크릿룸은 저장) */
export function keepsLocal(room, channel){
  if(!room) return false;
  return channel !== 'togetherroom' || String(room).indexOf(SECRET_ROOM_PREFIX) === 0;
}
/* 지울 채널 — 저장해 둔 채널(id → 만든 시각) 중 지금 방 메타에 없거나 만든 시각이 다른 것(같은 자리에 새 채널) */
export function tabsToDrop(saved, metaTabs){
  const t = metaTabs || {};
  return Object.keys(saved || {}).filter(id => !t[id] || t[id].ts !== saved[id]);
}

/* ── 저장소 ─────────────────────────────────────────────
   msgs: 키 [scope, 방, 탭, id] → 한 줄 · tabs: 키 [scope, 방, 탭] → { ts: 채널 만든 시각 }
   배열 키라 «이 방 전부» 를 범위 한 번으로 지운다([s, r] ~ [s, r, []] — 배열은 문자열보다 크다).
   열기 · 읽기 · 쓰기 실패는 «저장 없음» 으로 본다 — 서버에서 받는 길은 그대로라 대화는 보인다. */
export function createIdbChatStore(idb, scope){
  const s = String(scope || '');
  let dbP = null;
  function open(){
    if(!idb) return Promise.resolve(null);
    return dbP || (dbP = new Promise(res => {
      try{
        const rq = idb.open(IDB_NAME, 1);
        rq.onupgradeneeded = () => {
          const d = rq.result;
          if(!d.objectStoreNames.contains('msgs')) d.createObjectStore('msgs', { keyPath: ['s', 'r', 't', 'id'] });
          if(!d.objectStoreNames.contains('tabs')) d.createObjectStore('tabs', { keyPath: ['s', 'r', 't'] });
        };
        rq.onsuccess = () => res(rq.result);
        rq.onerror = rq.onblocked = () => res(null);
      }catch(_){ res(null); }
    }));
  }
  const range = (lo, hi) => (typeof IDBKeyRange !== 'undefined') ? IDBKeyRange.bound(lo, hi) : null;
  function tx(stores, mode, fn){
    return open().then(d => d ? new Promise(res => {
      try{
        const t = d.transaction(stores, mode);
        const out = fn(t);
        t.oncomplete = () => res(out && 'result' in out ? out.result : true);
        t.onerror = t.onabort = () => res(null);
      }catch(_){ res(null); }
    }) : null);
  }
  return {
    async load(r, t){
      const rows = await tx(['msgs'], 'readonly', x => x.objectStore('msgs').getAll(range([s, r, t], [s, r, t, []])));
      return (rows || []).map(({ s: _s, r: _r, t: _t, ...m }) => m);
    },
    put(r, t, msgs){ return tx(['msgs'], 'readwrite', x => { const o = x.objectStore('msgs'); msgs.forEach(m => o.put(Object.assign({}, m, { s, r, t }))); }); },
    del(r, t, ids){ return tx(['msgs'], 'readwrite', x => { const o = x.objectStore('msgs'); ids.forEach(id => o.delete([s, r, t, id])); }); },
    wipeTab(r, t){ return tx(['msgs', 'tabs'], 'readwrite', x => { x.objectStore('msgs').delete(range([s, r, t], [s, r, t, []])); x.objectStore('tabs').delete([s, r, t]); }); },
    wipeRoom(r){ return tx(['msgs', 'tabs'], 'readwrite', x => { ['msgs', 'tabs'].forEach(n => x.objectStore(n).delete(range([s, r], [s, r, []]))); }); },
    wipeAll(){ return tx(['msgs', 'tabs'], 'readwrite', x => { ['msgs', 'tabs'].forEach(n => x.objectStore(n).delete(range([s], [s, []]))); }); },
    count(){ return tx(['msgs'], 'readonly', x => x.objectStore('msgs').count(range([s], [s, []]))).then(n => n || 0); },
    async getTabs(r){
      const rows = await tx(['tabs'], 'readonly', x => x.objectStore('tabs').getAll(range([s, r], [s, r, []])));
      const out = {}; (rows || []).forEach(x => { out[x.t] = x.ts; }); return out;
    },
    setTab(r, t, ts){ return tx(['tabs'], 'readwrite', x => { x.objectStore('tabs').put({ s, r, t, ts }); }); },
  };
}

/* deps:
   subscribeSince(room, tab, since, onMsg, onReady) → 해제 함수 — since 가 null 이면 마지막 CHAT_FIRST_LIMIT 줄,
     숫자면 ts ≥ since 전부. 새 줄 · 고친 줄(ts 확정)마다 onMsg(한 줄), 처음 받기가 끝나면 onReady() 한 번
   clearLog(room, tab) → Promise<{ok}> · sendLog(room, msg, tab) → Promise
   store(createIdbChatStore 모양 · 없으면 저장 없이) · channel() → 지금 방 채널('workingroom' | 'togetherroom')
   setTimeout(검사용 · 없으면 전역) */
export function createChatHistory(deps){
  const store = deps.store || null;
  const later = deps.setTimeout || ((f, ms) => setTimeout(f, ms));
  const keep = (room) => !!store && keepsLocal(room, deps.channel ? deps.channel() : null);

  /* 한 탭의 기록을 연다 — 저장된 것을 먼저 그리고, 그 뒤만 서버에서 이어 받는다. 반환: 닫기 함수
     ⚠️ 저장된 것이 없으면 서버의 첫 받기가 끝날 때까지 그리지 않는다 — 빈 목록을 먼저 그리면 app.js 의 입장 컷이
       «빈 방에 들어왔다» 로 찍혀 지난 대화가 보여 버린다(_noteChatJoin). */
  function open(room, tab, onList){
    let list = [], closed = false, ready = false, unsub = null, pend = [], timer = null;
    const persist = keep(room);
    const emit = () => { if(!closed) onList(list.length > CHAT_VIEW_MAX ? list.slice(-CHAT_VIEW_MAX) : list); };
    function flush(){
      timer = null;
      if(closed || !pend.length){ if(ready) emit(); return; }
      const add = pend; pend = [];
      const r = applyClear(mergeMsgs(list, add));
      list = r.list;
      if(persist){
        const kept = add.filter(m => r.dropped.indexOf(m.id) < 0);
        if(kept.length) store.put(room, tab, kept);
        if(r.dropped.length) store.del(room, tab, r.dropped);
      }
      if(ready) emit();
    }
    const queue = () => { if(!timer) timer = later(flush, FLUSH_MS); };
    (async () => {
      if(persist){
        const r = applyClear((await store.load(room, tab)).sort(chatOrder));
        list = r.list;
        if(r.dropped.length) store.del(room, tab, r.dropped);
        if(list.length && !closed){ ready = true; emit(); }
      }
      if(closed) return;
      unsub = deps.subscribeSince(room, tab, sinceOf(list),
        m => { if(m && m.id){ pend.push(m); queue(); } },
        () => { ready = true; flush(); });
    })();
    return () => { closed = true; if(unsub){ try{ unsub(); }catch(_){} } };
  }
  /* 방장 [지우기] — 서버를 비우고 표시 줄을 남긴다. 각자의 저장은 그 줄을 받으면서 비워진다(꺼져 있던 사람은 다음 접속 때). */
  async function clear(room, tab){
    const r = await deps.clearLog(room, tab);
    if(r && r.ok){ try{ await deps.sendLog(room, Object.assign({}, CLEAR_MARK), tab); }catch(_){} }
    return r;
  }
  /* 방 메타(채널 목록)가 올 때 — 지워졌거나 같은 자리에 새로 생긴 채널의 저장을 비우고, 지금 채널을 적어 둔다. */
  async function syncTabs(room, metaTabs){
    if(!keep(room)) return [];
    const drop = tabsToDrop(await store.getTabs(room), metaTabs);
    for(const t of drop) await store.wipeTab(room, t);
    const t = metaTabs || {};
    for(const id of Object.keys(t)) if(t[id] && typeof t[id].ts === 'number') await store.setTab(room, id, t[id].ts);
    return drop;
  }
  const wipeRoom = (room) => (store && room) ? store.wipeRoom(room) : Promise.resolve(null);
  const wipeAll = () => store ? store.wipeAll() : Promise.resolve(null);
  const count = () => store ? store.count() : Promise.resolve(0);

  /* 설정 › 시스템 [저장된 대화 지우기] — 첫 누름은 몇 줄인지 보여 주고, 한 번 더 눌러야 지운다(되돌릴 수 없다). */
  function bindSettings(doc, toast){
    const b = doc && doc.getElementById('progChatHistWipe'); if(!b) return;
    const label = b.textContent;
    let armed = false, timer = null;
    b.addEventListener('click', async () => {
      if(!armed){
        const n = await count();
        if(!n){ if(toast) toast('이 PC 에 저장된 대화가 없어요'); return; }
        armed = true; b.textContent = '대화 ' + n + '줄 — 한 번 더 누르면 지워요';
        timer = later(() => { armed = false; b.textContent = label; }, 5000);
        return;
      }
      armed = false; clearTimeout(timer); b.textContent = label;
      await wipeAll();
      if(toast) toast('🗑 이 PC 에 저장된 대화를 지웠어요 — 서버에 남은 최근 3일은 다시 받아요');
    });
  }
  return { open, clear, syncTabs, wipeRoom, wipeAll, count, bindSettings };
}

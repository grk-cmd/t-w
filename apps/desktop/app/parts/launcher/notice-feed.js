/* notice-feed.js — 📢 공지 한 판 — 📢 소식(알림함) · 📰 업데이트 공지 · 📢 런처 배너를 한 번에 받아 들고 있는 곳 (검사 sim-notice-feed.js)
   책임: 공지의 «원본은 서버» — 켤 때 한 번 받고, 서버가 «공지가 바뀌었다»(realtime notices) 하거나 오래 끊겼다 붙으면 다시 받는다(ETag 라 안 바뀌었으면 몸통 0).
     받기는 한 번에 하나만(받는 중에 또 부르면 끝난 뒤 한 번 더). 받는 중 · 받음 · 못 받음을 가른다 — 못 받아도 앞서 받은 판은 지우지 않는다.
     쓰는 쪽(알림함 · 런처 배너 · 업데이트 공지 팝업)은 onChange 로 받아 각자 그린다. 관리자 소식 쓰기(올리기 · 고정 · 내리기)도 여기를 지난다 — 서버가 «됐다» 하면 다시 받는다.
   deps: api — createNoticeApi 가 돌려준 것(notice-api.js) · rt — 알림 걸기(TwRtHub.store.on('notices', fn)) · notifyError — 오류 번호로 알리는 함수(TwErrorCodes.notify)
   내보냄: createNoticeFeed(deps) → {
     start() · refresh() → Promise<boolean>(받았나) · status() → 'idle'|'loading'|'ready'|'error' · ready() → 한 번이라도 받았나 · broadcasts() → { id: 소식 } · hasMore() ·
     updateNotice() → {title, body, ts}|null · banner() → [{img, link}] ·
     onChange(fn) → 해제 함수 — fn({ addedIds }) : 받은 뒤(처음 받은 판의 소식은 «새 소식» 으로 치지 않는다)
     sendBroadcast(o) → Promise<boolean> · togglePin(id) → Promise<boolean> · remove(id) → Promise<boolean>
   }
   ⚠️ broadcasts() 는 받을 때마다 새 객체다 — 받은 값을 고치지 말 것(고정은 togglePin).
   ⚠️ 읽음은 서버에 없다 — 이 PC 에 남긴다(myhome-inbox.js 의 tw.inboxBcRead).
   검사: checks/sim-notice-feed.js */
(function(){
'use strict';

const STATUS = Object.freeze({ IDLE: 'idle', LOADING: 'loading', READY: 'ready', ERROR: 'error' });

function createNoticeFeed(deps){
  const api = deps.api;
  const notifyError = deps.notifyError;
  const subs = [];
  let status = STATUS.IDLE;
  let board = { updateNotice: null, banner: [], broadcasts: {}, hasMore: false };
  let everReady = false, flying = false, again = false, failStreak = false;

  function emit(addedIds){
    for(const fn of subs.slice()){ try{ fn({ addedIds }); }catch(e){ console.warn('[공지] 받는 쪽 처리 실패', e); } }
  }

  async function refresh(){
    if(flying){ again = true; return false; }
    flying = true;
    let ok = false;
    try{
      if(!everReady){ status = STATUS.LOADING; }
      let got;
      try{ got = await api.fetchBoard(); }
      catch(e){
        status = STATUS.ERROR;
        if(!failStreak){ failStreak = true; notifyError('E-MH-05', e); }   // 이어지는 실패는 한 번만
        emit([]);
        return false;
      }
      const before = board.broadcasts;
      const addedIds = everReady ? Object.keys(got.broadcasts).filter((id) => !(id in before)) : [];
      board = got; everReady = true; status = STATUS.READY; failStreak = false;
      emit(addedIds);
      ok = true;
    }finally{
      flying = false;
      if(again){ again = false; refresh(); }
    }
    return ok;
  }

  const start = () => { refresh(); };
  deps.rt.on('notices', () => { refresh(); });   // 바뀜 · 오래 끊겼다 붙음(resync) 모두 같은 일 — 다시 받기

  /* 관리자 쓰기 — 서버가 됐다 하면 다시 받는다. 실패는 한 번 알린다(409 는 «먼저 바뀌었다» 라 다시 받아 그 값으로) */
  async function done(r){
    if(r === 'ok'){ await refresh(); return true; }
    if(r === 'conflict'){ await refresh(); notifyError('E-MH-08', null); return false; }
    notifyError('E-MH-08', null);
    return false;
  }
  async function sendBroadcast(o){
    const r = await api.sendBroadcast(o);
    if(r === 'pinFailed'){ await refresh(); notifyError('E-MH-08', null); return false; }   // 올라는 갔다 — 고정만 못 했다
    return done(r);
  }
  async function togglePin(id){
    const m = board.broadcasts[id];
    if(!m) return false;
    return done(await api.setPinned(id, m.version, !m.pinned));
  }
  async function remove(id){
    const m = board.broadcasts[id];
    if(!m) return false;
    return done(await api.remove(id, m.version));
  }

  return {
    start, refresh, sendBroadcast, togglePin, remove,
    status: () => status, ready: () => everReady, broadcasts: () => board.broadcasts, hasMore: () => board.hasMore,
    updateNotice: () => board.updateNotice, banner: () => board.banner,
    onChange: (fn) => { subs.push(fn); return () => { const i = subs.indexOf(fn); if(i >= 0) subs.splice(i, 1); }; },
  };
}

const api = { createNoticeFeed, STATUS };
if(typeof window !== 'undefined') window.TwNoticeFeed = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

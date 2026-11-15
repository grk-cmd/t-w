/* notice-feed.js — 📢 공지 한 판 — 📢 소식(알림함) · 📰 업데이트 공지 · 📢 런처 배너를 한 번에 받아 들고 있는 곳 (검사 sim-notice-read.js)
   책임: 공지의 «원본은 서버» — 켤 때 한 번 받는다(ETag 라 안 바뀌었으면 몸통 0). 받기는 한 번에 하나만(받는 중에 또 부르면 끝난 뒤 한 번 더).
     받는 중 · 받음 · 못 받음을 가른다 — 못 받아도 앞서 받은 판은 지우지 않는다.
     못 받아도 혼자 다시 받지 않는다 — 다시 받는 길은 refresh() 를 부르는 사용자 동작뿐(타이머 없음). 실패 번호는 사용자가 누른 받기(manual)에서만 띄운다.
     쓰는 쪽(알림함 · 런처 배너 · 업데이트 공지 팝업)은 onChange 로 받아 각자 그린다.
   deps: api — createNoticeApi 가 돌려준 것(notice-api.js) · notifyError — 오류 번호로 알리는 함수(TwErrorCodes.notify)
   내보냄: createNoticeFeed(deps) → {
     start() · refresh({ manual }?) → Promise<boolean>(받았나) · status() → 'idle'|'loading'|'ready'|'error' · ready() → 서버에서 한 번이라도 받았나 · STATUS ·
     broadcasts() → { id: 소식 } · updateNotice() → {title, body, ts}|null · banner() → [{img, link}] ·
     onceReady(fn) → fn(업데이트 공지) 를 딱 한 번 — 이미 받았으면 바로, 아니면 처음 받았을 때 · onChange(fn) → 해제 함수 — fn({ addedIds }) : 받은 뒤(처음 받은 판의 소식은 «새 소식» 으로 치지 않는다)
   }
   ⚠️ broadcasts() 는 받을 때마다 새 객체다 — 받은 값을 고치지 말 것.
   ⚠️ 서버가 «바뀌었다» 알려 주는 길(realtime)이 이 판에 없다 — 켤 때 받은 판이 다음 refresh() 까지 간다.
   검사: checks/sim-notice-read.js */
(function(){
'use strict';

const STATUS = Object.freeze({ IDLE: 'idle', LOADING: 'loading', READY: 'ready', ERROR: 'error' });

/** @param {{ api: { fetchBoard: () => Promise<any> }, notifyError: (code: string, err: any) => boolean }} deps */
function createNoticeFeed(deps){
  const api = deps.api;
  const notifyError = deps.notifyError;
  const subs = [];
  let status = STATUS.IDLE;
  let board = { updateNotice: null, banner: [], broadcasts: {}, hasMore: false };
  let everReady = false, flying = false, again = false, failStreak = false, manualNext = false;

  function emit(addedIds){
    for(const fn of subs.slice()){ try{ fn({ addedIds }); }catch(e){ console.warn('[공지] 받는 쪽 처리 실패', e); } }
  }

  async function refresh(opts){
    if(opts && opts.manual) manualNext = true;
    if(flying){ again = true; return false; }
    flying = true;
    const manual = manualNext; manualNext = false;
    let ok = false;
    try{
      if(!everReady) status = STATUS.LOADING;
      let got;
      try{ got = await api.fetchBoard(); }
      catch(e){
        status = STATUS.ERROR;
        if(!failStreak && manual){ failStreak = true; notifyError('E-MH-09', e); }   // 이어지는 실패는 한 번만 · 자동 받기 실패는 번호 없이 상태만
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

  function start(){ refresh(); }

  /* 처음 받았을 때 한 번 — 못 받은 뒤 받아도 · 그 뒤 다시 받아도 한 번뿐 */
  function onceReady(fn){
    if(everReady){ fn(board.updateNotice); return; }   // 이미 받았으면 바로 한 번
    const off = onChange(() => {
      if(!everReady) return;
      off();
      fn(board.updateNotice);
    });
  }
  function onChange(fn){ subs.push(fn); return () => { const i = subs.indexOf(fn); if(i >= 0) subs.splice(i, 1); }; }

  return {
    start, refresh, onceReady, onChange,
    STATUS, status: () => status, ready: () => everReady, broadcasts: () => board.broadcasts,
    updateNotice: () => board.updateNotice, banner: () => board.banner,
  };
}

const api = { createNoticeFeed, STATUS };
if(typeof window !== 'undefined') window.TwNoticeFeed = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

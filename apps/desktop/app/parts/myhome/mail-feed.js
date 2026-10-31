/* mail-feed.js — 📩 내 우편 한 벌 — 받는 중 · 받음 · 못 받음 상태 · 서버에서 받기(켤 때 · 새 우편 알림 · 오래 끊겼다 붙을 때) · 읽음 · 지우기 (검사 sim-mail-feed.js)
   책임: 우편의 «원본은 서버» — 앱은 받아서 보여 줄 뿐 세지도 지우지도 않는다. 안 읽은 수도 서버가 센 값을 쓴다.
     받기는 한 번에 하나만(받는 중에 또 부르면 끝난 뒤 한 번 더). 계정이 바뀌면 앞 계정의 우편은 비우고 새로 받는다 — 늦게 끝난 앞 계정 응답은 버린다.
     읽음 · 지우기는 서버가 «됐다» 한 뒤에 화면 값을 고친다(실패하면 그대로 두고 오류 번호). 한 번도 받지 못한 동안(받는 중 · 못 받음)에는 고치지 않는다.
     쓰는 동안 계정이 바뀌면(await 앞뒤 uid 가 다르면) 화면 · 수를 건드리지 않고 끝낸다 — 앞 계정 화면에서 누른 것의 늦은 «됐다» 가 새 계정 우편을 고치지 않게.
     못 받으면 스스로 다시 받는다(30초부터 두 배씩 10분 상한 — shared/retry-delay.js). 성공 · 계정 바뀜 · stop 이면 취소.
     받기 실패의 오류 번호는 사용자가 알림함을 보고 있거나 «다시 시도» 를 눌렀을 때만 띄운다(켤 때 화면을 안 열었는데 뜨지 않게). 닫힌 동안 실패한 채(error) 알림함을 열면 화면(myhome-inbox.js)이 manual 로 한 번 다시 받는다.
     한 번 받은 뒤의 실패는 앞서 받은 목록을 그대로 두고 status 만 error 로 바꾼다 — 화면 안 «불러오지 못했어요» + 다시 시도는 한 번도 못 받았을 때만 그려진다.
   deps: api — createInboxApi 가 돌려준 것(inbox-api.js) · rt — 알림 걸기(TwRtHub.store.on('notification', fn)) ·
         notifyError — 오류 번호로 알리는 함수(TwErrorCodes.notify) · isViewing() → 알림함이 지금 보이나(필수 — 없으면 만들 때 던진다) ·
         retryDelay(n) → 다시 받기까지 ms(TwRetryDelay.delay) · setTimer(fn, ms) → id · clearTimer(id)
   내보냄: createMailFeed(deps) → {
     onChange(fn) → 해제 함수 — fn({ addedIds })(화면 다시 그리기 · 새 우편 토스트 — 받은 뒤 · 고친 뒤 · 처음 받은 판의 우편은 새 우편이 아니다) ·
     start(uid) · stop() · refresh({ manual }?) → Promise<boolean>(받았나 — manual 은 «다시 시도» 를 눌렀다) · status() → 'idle'|'loading'|'ready'|'error' · items() → { id: 우편 } · unread() → 서버가 센 안 읽은 수 ·
     complete() → 오래된 우편까지 다 받았나 · busy() → 지금 받는 중인가 · STATUS(상태 이름 상수) · ready() → 한 번이라도 받았나 ·
     markRead(id) · markAllRead() → Promise<boolean> · remove(id) → Promise<boolean> · removeRead() → Promise<number|null>(서버가 한 번에 지운 통 수 — 못 지웠으면 null) · clearing() → 읽은 우편 지우는 중인가
   }
   ⚠️ items() 는 같은 객체를 돌려준다(받으면 새 객체로 바뀐다) — 고치지 말 것(읽음 · 지우기는 위 함수로).
   ⚠️ 못 받음이어도 이미 받아 둔 우편은 지우지 않는다(status 만 error) — 우편이 «없다» 와 «못 받았다» 를 화면이 가른다.
   검사: checks/sim-mail-feed.js */
(function(){
'use strict';

const STATUS = Object.freeze({ IDLE: 'idle', LOADING: 'loading', READY: 'ready', ERROR: 'error' });
const SECTION_MAIL = 'MAIL';

function createMailFeed(deps){
  const api = deps.api;
  const notifyError = deps.notifyError;
  const isViewing = deps.isViewing;
  if(!isViewing) throw new Error('[우편] isViewing 이 필요해요 — 알림함이 보이는지 알려 주는 함수');
  const retryDelay = deps.retryDelay;
  const setTimer = deps.setTimer;
  const clearTimer = deps.clearTimer;
  const subs = [];
  let uid = null;
  let status = STATUS.IDLE, items = {}, unread = 0, complete = true, everReady = false;
  let clearing = false, flying = false, again = false, failStreak = false, manualNext = false;
  let retryTimer = null, failCount = 0;

  function emit(e){
    for(const fn of subs.slice()){ try{ fn(e); }catch(err){ console.warn('[우편] 받는 쪽 처리 실패', err); } }
  }
  function cancelRetry(){ if(retryTimer !== null){ clearTimer(retryTimer); retryTimer = null; } }
  function reset(){ items = {}; unread = 0; complete = true; everReady = false; status = STATUS.IDLE; failStreak = false; failCount = 0; manualNext = false; cancelRetry(); }
  function scheduleRetry(){
    cancelRetry();
    retryTimer = setTimer(() => { retryTimer = null; refresh(); }, retryDelay(failCount));
    failCount++;
  }

  async function refresh(opts){
    if(!uid) return false;
    if(opts && opts.manual) manualNext = true;
    if(flying){ again = true; return false; }
    flying = true;
    const manual = manualNext; manualNext = false;
    const mine = uid;
    let ok = false;
    try{
      if(!everReady) status = STATUS.LOADING;
      let got;
      try{ got = await api.fetchMail(mine); }
      catch(e){
        if(mine !== uid) return false;   // 그 사이 계정이 바뀌었다 — 앞 계정의 실패는 알리지 않는다
        status = STATUS.ERROR;
        if(!failStreak && (manual || isViewing())){ failStreak = true; notifyError('E-MH-08', e); }   // 이어지는 실패는 한 번만 · 화면을 안 보는 동안은 번호를 띄우지 않는다
        scheduleRetry();
        emit({ addedIds: [] });
        return false;
      }
      if(mine !== uid) return false;   // 앞 계정에서 받은 우편 — 버린다
      const before = items;
      const addedIds = everReady ? Object.keys(got.items).filter((id) => !(id in before)) : [];   // 처음 받은 판은 «새 우편» 이 아니다(우르르 안 뜨게)
      items = got.items; unread = got.unread; complete = got.complete;
      everReady = true; status = STATUS.READY; failStreak = false; failCount = 0; cancelRetry();
      emit({ addedIds });
      ok = true;
    }finally{
      flying = false;
      if(again){ again = false; if(uid) refresh(); }
    }
    return ok;
  }

  function start(who){
    if(!who) return stop();
    if(who !== uid){ uid = who; reset(); }
    refresh();
  }
  function stop(){ uid = null; reset(); }

  /* 알림 — 새 우편(section 이 MAIL 이거나 없음) · 오래 끊겼다 붙음(resync). 서버는 새 알림이 생길 때만 알린다 —
     다른 기기에서 읽거나 지운 것은 다음에 받을 때 맞는다 */
  deps.rt.on('notification', (n) => {
    if(!uid) return;
    if(n && (n.resync || !n.section || n.section === SECTION_MAIL)) refresh();
  });

  /* 한 번이라도 받은 뒤에만 고친다 — 받는 중에는 «모두 읽음» 이 아직 못 본 우편까지 덮으면 안 된다.
     나중에 다시 받다 실패해도 앞서 받아 둔 우편은 그대로 고칠 수 있다. */
  const usable = () => !!uid && everReady;

  async function markRead(id){
    if(!usable() || !(id in items)) return false;
    if(items[id].read) return true;
    const who = uid;
    const r = await api.markRead(who, id);
    if(who !== uid) return false;   // 그 사이 계정이 바뀌었다 — 새 계정 화면은 건드리지 않는다
    if(r === 'failed') notifyError('E-MH-10', null);
    if(r !== 'ok') return false;
    if(items[id] && !items[id].read){ items[id].read = true; unread = Math.max(0, unread - 1); }
    emit({ addedIds: [] });
    return true;
  }
  async function markAllRead(){
    if(!usable()) return false;
    const who = uid;
    const r = await api.markAllRead(who);
    if(who !== uid) return false;
    if(r === 'failed') notifyError('E-MH-10', null);
    if(r !== 'ok') return false;
    for(const id of Object.keys(items)) items[id].read = true;
    unread = 0;
    emit({ addedIds: [] });
    return true;
  }
  async function remove(id){
    if(!usable() || !(id in items)) return false;
    const who = uid;
    const r = await api.remove(who, id);
    if(who !== uid) return false;
    if(r === 'failed') notifyError('E-MH-11', null);
    if(r !== 'ok') return false;
    /* 기다리는 사이 다시 받기가 끝나 이미 목록에서 빠졌을 수 있다(서버에서 지워졌다) — 있을 때만 고친다 */
    if(items[id]){
      if(!items[id].read) unread = Math.max(0, unread - 1);
      delete items[id];
    }
    emit({ addedIds: [] });
    return true;
  }
  /* 읽은 우편 한꺼번에 — 서버가 내 읽은 우편을 한 번에 지운다(고르는 쪽은 서버). 성공하면 목록을 서버에서 다시 받는다.
     실패하면 아무것도 안 지운 그대로 두고 E-MH-11 을 한 번 알린다. 지우는 중에 또 부르면 건너뛴다. */
  async function removeRead(){
    if(!usable() || clearing) return null;
    const who = uid;
    clearing = true;
    let r;
    try{ r = await api.removeRead(who); }
    finally{ clearing = false; }
    if(who !== uid) return null;   // 그 사이 계정이 바뀌었다 — 조용히 버린다
    if(r.status === 'failed') notifyError('E-MH-11', null);
    if(r.status !== 'ok') return null;
    await refresh();
    return r.deleted;
  }

  return {
    start, stop, refresh, markRead, markAllRead, remove, removeRead,
    onChange: (fn) => { subs.push(fn); return () => { const i = subs.indexOf(fn); if(i >= 0) subs.splice(i, 1); }; },
    STATUS, busy: () => flying, clearing: () => clearing, status: () => status, items: () => items, unread: () => unread, complete: () => complete, ready: () => everReady,
  };
}

const api = { createMailFeed, STATUS };
if(typeof window !== 'undefined') window.TwMailFeed = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

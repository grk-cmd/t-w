/* guestbook-feed.js — 📖 방명록 한 벌 — 새 글 배지 · 열어 둔 방명록 · 글 쓰기 · 지우기 · 박수 · 폭죽 (검사 sim-guestbook-feed.js)
   책임: 방명록의 «원본은 서버» — 앱은 받아서 보여 줄 뿐 세지도 정리하지도 않는다.
     · 새 글 배지: 마이홈을 열 때 «마지막으로 연 때 뒤 글 수» 숫자 하나만 받는다(글 목록을 상시 받지 않는다). 서버가 방명록이 바뀌었다고 알리면 숫자만 다시 받는다.
     · 열어 둔 방명록(창이 떠 있는 동안): 열 때 받고, 서버 알림(guestbook · 남의 방명록은 guestbookWatch 로 «보는 중» 을 알려야 온다)이 오면 다시 받는다.
       창을 닫으면 «보는 중» 을 떼고 받은 것을 비운다.
     · 글 쓰기 가능 여부(canWrite) · 하루 박수 남은 수(todayLeft) · 글 30개 정리는 전부 서버가 정한 값이다.
     받기는 한 번에 하나(받는 중에 또 부르면 끝난 뒤 한 번 더). 못 받아도 혼자 다시 받지 않는다 — 다시 받는 길은 창을 여는 것 · 서버 알림 · «다시 시도» 뿐이다.
     받기 실패의 오류 번호는 사용자가 연 · 누른 받기(manual)에서만 띄운다(알림으로 자동 받다 실패하면 상태만 error).
     쓰기는 서버가 «됐다» 한 뒤에 화면을 고친다 — 글 쓰기 · 지우기 · 폭죽은 다시 받아 맞추고, 박수는 서버 답의 수를 쓴다.
   deps: api — createGuestbookApi 가 돌려준 것(guestbook-api.js)
         rt — { on(kind, fn)→해제, onState(fn)→해제, send(msg) }(TwRtHub.store) · rtState — TwRtHub.STATE
         pending — TwRequestId.createPending() (같은 일 다시 보내기는 같은 번호)
         lastRead — createLastReadStore 가 돌려준 것({ get(uid), set(uid, ts) } — «마지막으로 방명록을 연 때»)
         notifyError — 오류 번호로 알리는 함수(TwErrorCodes.notify) · translate(err, table) · ACTION — TwApiErrors
         now() — 시각(ms)
   내보냄: createGuestbookFeed(deps) → {
     startBadge(uid) · stopBadge() · refreshBadge() · badgeCount() · markRead() — 배지(markRead = 지금까지 다 읽음)
     openBook(uid, owner) → boolean · closeBook() · refreshBook({ manual }?) → Promise<boolean> · view() · status() · owner() — 열어 둔 방명록
     write(text) · remove(id) · clap() · setEmoji(v) · setImage(dataUrl) → Promise<{ ok, reason?, code?, ... }> — clapBusy() = 박수 답을 기다리는 중인가
     onChange(fn) → 해제 함수 — fn({ kind:'badge'|'book' })
     STATUS · ERRORS(이 묶음이 아는 서버 오류 → 오류 번호 표)
   }
     순수: createLastReadStore(storage) (TwGuestbookFeed 위)
   ⚠️ 알림 걸기(rt.on · rt.onState)는 배지나 방명록이 켜져 있는 동안만 — 둘 다 꺼지면 뗀다(stop 이 빠진 채 남지 않게). 연결을 끈 것(OFF — 로그아웃 등)이면 스스로 모두 비운다. 인증 실패 · 다른 기기에 밀림 · 업데이트로 끊긴 것은 받은 것만 거두고 걸기는 둔다(다시 붙으면 READY 가 받는다).
   ⚠️ 박수를 보내는 중에 또 누르면 보내지 않는다('busy') — 같은 번호로 서버가 한 번만 세지만, 화면이 «눌렀는데 안 올라간다» 가 되지 않게.
   검사: checks/sim-guestbook-feed.js */
(function(){
'use strict';

const STATUS = Object.freeze({ IDLE: 'idle', LOADING: 'loading', READY: 'ready', ERROR: 'error' });
const MSG = Object.freeze({ WATCH: 'guestbookWatch', UNWATCH: 'guestbookUnwatch' });   // realtime 규약 4-4 «방명록 보는 중»
const LAST_READ_PREFIX = 'tw.mhGbLastRead:';
const CLAP_LIMIT_CODE = 'GUESTBOOK_CLAP_DAILY_LIMIT';
const NOT_FRIEND_CODE = 'GUESTBOOK_NOT_FRIEND';

/* «마지막으로 방명록을 연 때» — 이 PC 에 계정별로 기억한다(서버가 «그 뒤 글 수» 를 센다) */
function createLastReadStore(storage){
  return {
    get(uid){
      try{ const v = parseInt(storage.getItem(LAST_READ_PREFIX + uid) || '0', 10); return isFinite(v) && v > 0 ? v : 0; }catch(_){ return 0; }
    },
    set(uid, ts){ try{ storage.setItem(LAST_READ_PREFIX + uid, String(ts)); }catch(_){} },
  };
}

function createGuestbookFeed(deps){
  const api = deps.api;
  const rt = deps.rt;
  const RT = deps.rtState;
  const ids = deps.pending;
  const lastRead = deps.lastRead;
  const notifyError = deps.notifyError;
  const now = deps.now;
  /* 서버가 준 이름을 이 묶음의 오류 번호로 — 표에 없는 것은 공통 표(로그인 · 점검 · 다시 받기 · 닿지 못함)가 맡는다. 번호는 글자 그대로(검사가 찾는다) */
  const NOTICE = deps.ACTION.NOTICE;
  const ERRORS = Object.freeze({
    GUESTBOOK_TEXT_INVALID: { action: NOTICE, notice: (notifyError, e) => notifyError('E-GB-02', e) },
    [NOT_FRIEND_CODE]: { action: NOTICE, notice: (notifyError, e) => notifyError('E-GB-03', e) },
    GUESTBOOK_NOT_AUTHOR: { action: NOTICE, notice: (notifyError, e) => notifyError('E-GB-04', e) },
    GUESTBOOK_EMOJI_INVALID: { action: NOTICE, notice: (notifyError, e) => notifyError('E-GB-05', e) },
    GUESTBOOK_IMAGE_INVALID: { action: NOTICE, notice: (notifyError, e) => notifyError('E-GB-06', e) },
    IMAGE_INVALID: { action: NOTICE, notice: (notifyError, e) => notifyError('E-GB-06', e) },
    UNSUPPORTED_MEDIA_TYPE: { action: NOTICE, notice: (notifyError, e) => notifyError('E-GB-06', e) },
    PAYLOAD_TOO_LARGE: { action: NOTICE, notice: (notifyError, e) => notifyError('E-GB-07', e) },
  });
  const subs = [];
  let me = null;
  let offKind = null, offState = null;
  /* 배지 */
  let badgeOn = false, badgeNum = 0, badgeGen = 0, badgeFlying = false, badgeAgain = false;
  /* 열어 둔 방명록 */
  let owner = null, status = STATUS.IDLE, view = null, bookGen = 0, bookFlying = false, bookAgain = false, failStreak = false, manualNext = false;
  let watching = false, clapping = false, looking = false;

  function emit(kind){
    for(const fn of subs.slice()){ try{ fn({ kind }); }catch(err){ console.warn('[방명록] 받는 쪽 처리 실패', err); } }
  }

  /* ── 서버 알림 걸기 — 배지나 방명록이 켜져 있는 동안만 ── */
  function hook(){
    if(!offKind) offKind = rt.on('guestbook', onNotify);
    if(!offState) offState = rt.onState(onState);
  }
  function unhookIfIdle(){
    if(badgeOn || owner) return;
    if(offKind){ offKind(); offKind = null; }
    if(offState){ offState(); offState = null; }
  }
  function onNotify(n){
    if(!me) return;
    const all = !!(n && n.resync);   // 오래 끊겼다 붙음 — 놓친 알림을 메운다
    const subject = n && n.subject;
    if(badgeOn && (all || subject === me)) refreshBadge();
    if(owner && (all || subject === owner)) refreshBook();
  }
  function onState(s){
    if(s === RT.READY){
      /* 다시 붙으면(«여기서 계속» 포함) «보는 중» 이 풀려 있고 끊긴 동안 알림을 놓쳤다 — 배지 · 열린 방명록을 한 번씩 다시 받고 «보는 중» 을 다시 알린다 */
      if(badgeOn) refreshBadge();
      if(owner){ syncWatch(); refreshBook(); }
    }else if(s === RT.OFF){
      reset();   // 연결을 끈 것(로그아웃 · 계정을 놓음) — 모두 비운다. 보낼 길이 없으니 떼기 메시지도 없다
    }else if(s === RT.AUTH_FAILED || s === RT.SESSION_LOST || s === RT.UPDATE){
      release();   // 연결만 끊겼다 — 다시 붙을 수 있으니 받은 것만 거두고 «누구 것을 보는 중인가» 와 알림 걸기는 둔다
    }
  }
  /* «보는 중» 알리기 — 남의 방명록만(내 것은 주인이라 원래 온다). 연결이 아직 없으면 붙을 때 다시(onState) */
  function syncWatch(){
    if(owner && owner !== me){
      watching = rt.send({ t: MSG.WATCH, owner }) === true;
    }else if(watching){
      rt.send({ t: MSG.UNWATCH });
      watching = false;
    }
  }

  /* 연결이 끊겨 받은 것을 믿을 수 없다 — 받은 값 · 늦은 답만 거둔다. 내 코드 · 배지 켜짐 · 열어 둔 주인 · 알림 걸기는 그대로(다시 붙으면 READY 가 받는다) */
  function release(){
    bookGen++; badgeGen++;
    view = null; failStreak = false; manualNext = false; watching = false; badgeNum = 0;
    status = owner ? STATUS.ERROR : STATUS.IDLE;   // 열어 둔 창은 «불러오지 못했어요 · 다시 시도» 로
    emit('book'); emit('badge');
  }

  function reset(){
    bookGen++; badgeGen++;
    owner = null; view = null; status = STATUS.IDLE; failStreak = false; manualNext = false; watching = false;
    badgeOn = false; badgeNum = 0; me = null;
    unhookIfIdle();
    emit('book'); emit('badge');
  }

  /* ── 새 글 배지 ── */
  async function refreshBadge(){
    if(!me || !badgeOn) return false;
    if(badgeFlying){ badgeAgain = true; return false; }
    badgeFlying = true;
    const who = me, gen = badgeGen;
    let ok = false;
    try{
      let n;
      try{ n = await api.fetchNewCount(who, lastRead.get(who)); }
      catch(_){ return false; }   // 배지는 덤 — 못 받으면 있던 숫자 그대로(알림으로 자동 받은 것이라 오류 번호 없음 · api 가 진단 기록)
      if(gen !== badgeGen || who !== me) return false;   // 그 사이 다 읽음 · 끔 · 계정이 바뀜 — 늦은 답은 버린다
      badgeNum = n; ok = true;
      emit('badge');
    }finally{
      badgeFlying = false;
      if(badgeAgain){ badgeAgain = false; if(me && badgeOn) refreshBadge(); }
    }
    return ok;
  }
  function startBadge(uid){
    if(!uid) return stopBadge();
    if(uid !== me){ reset(); me = uid; }
    badgeOn = true;
    hook();
    refreshBadge();
  }
  function stopBadge(){
    badgeOn = false; badgeNum = 0; badgeGen++;
    unhookIfIdle();
    emit('badge');
  }
  /* 지금까지 다 읽음 — 숫자를 내리고, 이미 날아간 옛 숫자가 되살리지 못하게 한다 */
  function markRead(){
    if(!me) return;
    lastRead.set(me, Math.max(now(), lastRead.get(me)));
    badgeGen++; badgeNum = 0;
    emit('badge');
  }

  /* ── 열어 둔 방명록 ── */
  async function refreshBook(opts){
    if(!me || !owner) return false;
    if(opts && opts.manual) manualNext = true;
    if(bookFlying){ bookAgain = true; return false; }
    bookFlying = true;
    const manual = manualNext; manualNext = false;
    const who = me, ow = owner, gen = bookGen;
    let ok = false;
    try{
      if(!view) status = STATUS.LOADING;
      let got;
      try{ got = await api.fetchView(who, ow); }
      catch(e){
        if(gen !== bookGen) return false;   // 그 사이 창을 닫았거나 주인이 바뀌었다 — 앞 방명록의 실패는 알리지 않는다
        status = STATUS.ERROR;
        if(manual && !failStreak){ failStreak = true; notifyError('E-GB-01', e); }   // 이어지는 실패는 한 번만
        emit('book');
        return false;
      }
      if(gen !== bookGen) return false;   // 앞 방명록에서 받은 것 — 버린다
      view = got; status = STATUS.READY; failStreak = false;
      /* 내 방명록을 보고 있으면 받은 글까지는 읽은 것 — 글 시각은 서버 시계라 PC 시계가 늦어도 «새 글» 로 남지 않게 마지막 읽은 때를 최신 글 시각까지 올린다 */
      if(ow === who && got.entries.length){
        const newest = got.entries.reduce((m, en) => Math.max(m, en.ts), 0);
        if(newest > lastRead.get(who)){ lastRead.set(who, newest); badgeGen++; badgeNum = 0; emit('badge'); }
      }
      emit('book');
      ok = true;
    }finally{
      bookFlying = false;
      if(bookAgain){ bookAgain = false; if(me && owner) refreshBook(); }
    }
    return ok;
  }
  /* 내 코드(uid)는 입구에서 받는다 — 배지를 켠 적이 없어도(연결이 끊겼다 이어진 뒤 포함) 열 수 있다. 다른 계정이면 앞 계정 것을 비우고 시작 */
  function openBook(uid, ow){
    if(!uid || !ow) return false;
    if(uid !== me){ reset(); me = uid; }
    if(owner !== ow){
      bookGen++;
      owner = ow; view = null; status = STATUS.LOADING; failStreak = false; manualNext = false;
      syncWatch();
    }
    hook();
    emit('book');
    refreshBook({ manual: true });
    return true;
  }
  function closeBook(){
    if(!owner) return;
    bookGen++;
    owner = null; view = null; status = STATUS.IDLE; failStreak = false; manualNext = false;
    syncWatch();   // owner 가 없으니 «보는 중» 이면 뗀다
    unhookIfIdle();
    emit('book');
  }

  /* ── 쓰기 ── */
  /* 서버가 답을 줬나(거절 포함) — 닿지 못한 것은 같은 번호로 다시 보낼 수 있게 번호를 남긴다 */
  const answered = (e) => !!e && (e.kind === 'request' || e.kind === 'auth');
  /* 실패 한 번 — 오류 번호를 띄우고 { ok:false, reason:'failed', code } . 다른 곳에서 먼저 바뀌었으면(409) 다시 받는다 */
  function fail(err){
    const t = deps.translate(err, ERRORS);
    let code = null;
    const raise = notifyError;   // 표의 notice 가 고른 번호를 받아 띄우고 기억한다(번호는 표 쪽에 글자 그대로 있다)
    if(t.notice) t.notice((c, e, x) => { code = c; return raise(c, e, x); }, err);
    if(t.action === deps.ACTION.REFETCH || (err && err.code === NOT_FRIEND_CODE)) refreshBook();
    return { ok: false, reason: 'failed', code };
  }
  /* 쓰는 동안 계정 · 방명록이 바뀌었으면 화면을 건드리지 않는다 */
  const same = (who, ow) => who === me && ow === owner;

  async function write(text){
    if(!me || !owner) return { ok: false, reason: 'closed' };
    if(!view || !view.canWrite) return { ok: false, reason: 'blocked' };   // 쓸 수 있는지는 서버가 정한 값(canWrite)
    const t = String(text == null ? '' : text).trim();
    if(!t) return { ok: false, reason: 'empty' };
    const who = me, ow = owner, key = 'w:' + ow + ':' + t;
    const r = await api.write(who, ow, t, ids.idFor(key));
    if(r.status === 'ok' || (r.status === 'failed' && answered(r.err))) ids.settle(key);
    if(!same(who, ow)) return { ok: false, reason: 'gone' };
    if(r.status === 'stale') return { ok: false, reason: 'stale' };
    if(r.status === 'failed') return fail(r.err);
    refreshBook();
    return { ok: true };
  }
  async function remove(id){
    if(!me || !owner) return { ok: false, reason: 'closed' };
    const who = me, ow = owner;
    const r = await api.remove(who, ow, id);
    if(!same(who, ow)) return { ok: false, reason: 'gone' };
    if(r.status === 'stale') return { ok: false, reason: 'stale' };
    if(r.status === 'failed') return fail(r.err);
    refreshBook();
    return { ok: true };
  }
  async function clap(){
    if(!me || !owner) return { ok: false, reason: 'closed' };
    if(clapping) return { ok: false, reason: 'busy' };
    const who = me, ow = owner, key = 'c:' + ow;
    clapping = true;
    let r;
    try{ r = await api.clap(who, ow, ids.idFor(key)); }
    finally{ clapping = false; }
    if(r.status === 'ok' || (r.status === 'failed' && answered(r.err))) ids.settle(key);
    if(!same(who, ow)) return { ok: false, reason: 'gone' };
    if(r.status === 'stale') return { ok: false, reason: 'stale' };
    if(r.status === 'failed'){
      if(r.err && r.err.code === CLAP_LIMIT_CODE){ refreshBook(); return { ok: false, reason: 'limit' }; }   // 오늘 몫을 다 썼다 — 번호 없는 안내(오류가 아니다)
      return fail(r.err);
    }
    if(view) view = Object.assign({}, view, { clap: Object.assign({}, view.clap, { count: r.count, todayLeft: r.todayLeft, dailyMax: r.dailyMax }) });
    emit('book');
    return { ok: true, count: r.count, todayLeft: r.todayLeft, dailyMax: r.dailyMax };
  }
  /* 폭죽 이모지 — 내 방명록만 · 받은 판(version)으로. '' 이면 끈다 */
  async function setEmoji(v){
    if(!me || !owner) return { ok: false, reason: 'closed' };
    if(owner !== me || !view) return { ok: false, reason: 'blocked' };
    if(looking) return { ok: false, reason: 'busy' };
    const who = me, ow = owner;
    looking = true;
    let r;
    try{ r = await api.changeLook(who, view.version, { clapEmoji: v === '' ? null : v }); }
    finally{ looking = false; }
    if(!same(who, ow)) return { ok: false, reason: 'gone' };
    if(r.status === 'stale') return { ok: false, reason: 'stale' };
    if(r.status === 'failed') return fail(r.err);
    refreshBook();   // 판이 올랐다 — 다음 고침을 위해 다시 받는다
    return { ok: true };
  }

  /* 박수 그림 — 내 방명록만. 올리고(url) → 그 주소를 받은 판(version)으로 겉모습에 넣는다. 올리기에 실패하면 겉모습은 건드리지 않는다 */
  async function setImage(dataUrl){
    if(!me || !owner) return { ok: false, reason: 'closed' };
    if(owner !== me || !view) return { ok: false, reason: 'blocked' };
    if(looking) return { ok: false, reason: 'busy' };
    const who = me, ow = owner;
    looking = true;
    let r;
    try{
      r = await api.uploadImage(who, dataUrl);
      if(r.status === 'ok' && same(who, ow) && view) r = await api.changeLook(who, view.version, { clapImageUrl: r.url });
    }finally{ looking = false; }
    if(!same(who, ow)) return { ok: false, reason: 'gone' };
    if(r.status === 'stale') return { ok: false, reason: 'stale' };
    if(r.status === 'failed') return fail(r.err);
    refreshBook();
    return { ok: true };
  }

  return {
    startBadge, stopBadge, refreshBadge, markRead, badgeCount: () => badgeNum,
    openBook, closeBook, refreshBook, view: () => view, status: () => status, owner: () => owner,
    write, remove, clap, setEmoji, setImage, clapBusy: () => clapping,
    onChange: (fn) => { subs.push(fn); return () => { const i = subs.indexOf(fn); if(i >= 0) subs.splice(i, 1); }; },
    STATUS, ERRORS,
  };
}

const api = { createGuestbookFeed, createLastReadStore, STATUS, MSG, LAST_READ_PREFIX };
if(typeof window !== 'undefined') window.TwGuestbookFeed = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

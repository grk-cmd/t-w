/* friends-sub.js — 👥 내 친구 목록 구독 한 벌 — 상태(불러오는 중 · 못 불러옴 · 받음) · 다시 걸기 · 판정용 한 번 읽기
   책임: subscribeMyFriends 를 «동시에 하나만» 건다. 실패하면 목록을 열 때(친구 탭 · 워킹룸 초대 목록)만 다시 건다 — 타이머 재시도는 없다.
     친구 추가 · 수락 판정은 friendsForCheck() 로 — 받았으면 지금 목록, 아니면 이 모듈 한 곳에서만 한 번 읽는다(진행 중이면 모두가 같은 Promise).
     화면은 notice() 하나로 같은 문구 · 같은 상태를 읽는다.
   deps: subscribe(myId, onChange, onError) → 해제 함수 · fetchOnce(myId) → Promise<{친구id:{addedAt}}> · current() → 지금 목록 ·
         setFriends(v) · getMyUserId() · toast(msg) · setTimer(fn, ms) → id · clearTimer(id) · onUnload(fn)(앱 종료 · 로그아웃 뒤 재시작 때 정리)
   내보냄: start(myId, onFriends, onStatus) · stop() · status() · notice() · retryIfFailed() · friendsForCheck()
     순수: noticeFor(status) · NOTICE · STATUS · SUB_WAIT_MS (TwFriendsSub 위)
   ⚠️ 구독이 연결 시도 중이면 따로 읽지 않고 그 결과를 SUB_WAIT_MS 까지 기다린다 — 같은 경로를 두 번 읽지 않게.
   ⚠️ 한 번 읽은 값은 그 판정에만 쓴다(받음으로 치지 않는다 · 따로 캐시 안 함). 그 사이 구독 값이 왔으면 구독 값이 이긴다.
   ⚠️ 받은 목록이 비어 있으면 READY 다(«친구 없음»). 아직 못 받았거나 못 받은 것과 섞지 않는다.
   검사: checks/sim-friends-sub.js */
(function(){

const SUB_WAIT_MS = 3000;   // 판정이 연결 시도 중인 구독을 기다리는 상한 — 넘으면 그때 한 번 읽는다
const STATUS = { IDLE: 'idle', LOADING: 'loading', ERROR: 'error', READY: 'ready' };
const NOTICE = {
  loading: '친구 목록을 불러오는 중이에요',
  error: '친구 목록을 불러오지 못했어요. 잠시 후 다시 시도할게요',
  checkFail: '친구 목록을 불러오지 못했어요. 잠시 후 다시 눌러 주세요',
};

/* 받기 전(IDLE · LOADING)은 «불러오는 중», 못 받았으면 «못 불러옴», 받았으면 null(목록을 그린다). */
function noticeFor(status){
  if(status === STATUS.READY) return null;
  return status === STATUS.ERROR ? NOTICE.error : NOTICE.loading;
}

function createFriendsSub(deps){
const subscribe = deps.subscribe;
const fetchOnce = deps.fetchOnce;
const current = deps.current;
const setFriends = deps.setFriends;
const getMyUserId = deps.getMyUserId;
const toast = deps.toast;
const setTimer = deps.setTimer;
const clearTimer = deps.clearTimer;
const onUnload = deps.onUnload;
let _status = STATUS.IDLE;
let _myId = null, _onFriends = null, _onStatus = null;
let _unsub = null;     // 지금 걸린 구독의 해제 함수(하나뿐)
let _gen = 0;          // 구독마다 올린다 — 풀었거나 새로 건 구독의 늦은 소식은 버린다
let _okSeq = 0;        // 구독 값이 올 때마다 올린다 — 늦게 끝난 한 번 읽기가 구독 값을 덮지 않게
let _waiters = [];     // 연결 시도 중인 구독의 결과를 기다리는 판정들
let _check = null;     // 진행 중인 판정(하나뿐 — 부르는 곳 모두가 같이 기다린다)
let _fetching = false, _retryAfterFetch = false;

function _setStatus(s){
  if(_status === s) return;
  _status = s;
  try{ if(_onStatus) _onStatus(s); }catch(e){ console.warn('[친구 목록] 상태 그리기 실패', e); }
}
function _wake(){ const w = _waiters; _waiters = []; w.forEach(fn => fn()); }
function _detach(){
  const u = _unsub; _unsub = null;
  if(u){ try{ u(); }catch(_){} }
}
function _ok(gen, friends){
  if(gen !== _gen) return;
  _okSeq++;
  _status = STATUS.READY;   // 그리기 전에 바꾼다 — onFriends 가 그리는 화면이 notice() 를 읽는다
  if(_onFriends) _onFriends(friends || {});
  _wake();
}
function _fail(gen, err){
  if(gen !== _gen) return;
  _gen++;   // 이 구독은 끝 — subscribe 가 돌아오기 전에 실패를 알려도 돌려받은 해제 함수를 부른다(_attach)
  _detach();
  console.warn('[친구 목록] 구독 실패 — 목록을 열면 다시 걸어요', err);
  _setStatus(STATUS.ERROR);
  _wake();
}
function _attach(){
  _detach();
  const gen = ++_gen;
  let u = null;
  try{ u = subscribe(_myId, f=>_ok(gen, f), e=>_fail(gen, e)); }
  catch(e){ _fail(gen, e); }
  if(gen === _gen) _unsub = u;
  else if(u){ try{ u(); }catch(_){} }
}

function start(myId, onFriends, onStatus){
  stop();
  _myId = myId; _onFriends = onFriends || null; _onStatus = onStatus || null;
  /* 내 코드가 없으면(로그인 전 · 처음 쓰는 PC) 구독 · 읽기 · 다시 걸기 없이 «친구 없음» — users/null/friends 는 규칙이 거부해 «못 불러옴» 이 된다.
     코드가 생기면 마이홈 시작(start)이 그때 건다. */
  if(!myId){ _myId = null; _setStatus(STATUS.READY); return; }
  _setStatus(STATUS.LOADING);
  _attach();
}
function stop(){
  _gen++;
  _detach();
  _status = STATUS.IDLE;
  _wake();
}
/* 목록을 열 때 부른다. 못 불러온 상태일 때만 다시 건다 — 받았거나 · 거는 중이면 아무것도 안 한다.
   한 번 읽기가 진행 중이면 그게 끝난 뒤에 건다(같은 경로를 동시에 두 번 읽지 않게). */
function retryIfFailed(){
  if(_status !== STATUS.ERROR || !_myId) return false;
  if(_fetching){ _retryAfterFetch = true; return false; }
  _setStatus(STATUS.LOADING);
  _attach();
  return true;
}
function _waitSub(){
  return new Promise(res=>{
    let t = null;
    const done = ()=>{ if(t != null){ clearTimer(t); t = null; } _waiters = _waiters.filter(f => f !== done); res(); };
    _waiters.push(done);
    t = setTimer(done, SUB_WAIT_MS);
  });
}
async function _fetch(){
  const seq = _okSeq;
  _fetching = true;
  try{
    const ids = await fetchOnce(_myId || getMyUserId());
    if(_okSeq !== seq || _status === STATUS.READY) return current() || {};   // 그 사이 구독 값이 왔다 — 구독 값이 이긴다
    const cur = current() || {}, out = {};
    Object.keys(ids || {}).forEach(fid=>{
      out[fid] = cur[fid] || { name: '...', online: false, lastSeen: 0, addedAt: (ids[fid] || {}).addedAt };
    });
    setFriends(out);
    return out;
  }catch(e){
    console.warn('[친구 목록] 판정용 읽기 실패', e);
    toast(NOTICE.checkFail);
    return null;
  }finally{
    _fetching = false;
    if(_retryAfterFetch){ _retryAfterFetch = false; retryIfFailed(); }
  }
}
/* 친구 추가 · 수락 판정에 쓸 목록 → Promise<목록 | null(못 읽음 — 토스트는 여기서 한 번)>.
   받았으면 지금 목록 그대로. 아니면 구독을 SUB_WAIT_MS 까지 기다리고, 그래도 없으면 한 번 읽는다. */
function friendsForCheck(){
  if(_status === STATUS.READY) return Promise.resolve(current() || {});
  if(_check) return _check;
  _check = (async ()=>{
    if(_status === STATUS.LOADING){
      await _waitSub();
      if(_status === STATUS.READY) return current() || {};
    }
    return _fetch();
  })();
  const mine = _check;
  mine.then(()=>{ if(_check === mine) _check = null; });
  return mine;
}
function status(){ return _status; }
function notice(){ return noticeFor(_status); }

onUnload(stop);

return {
  start,
  stop,
  status,
  notice,
  retryIfFailed,
  friendsForCheck,
};
}

const api = { createFriendsSub, noticeFor, NOTICE, STATUS, SUB_WAIT_MS };
if(typeof window !== 'undefined') window.TwFriendsSub = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

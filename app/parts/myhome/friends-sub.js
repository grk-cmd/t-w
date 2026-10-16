/* friends-sub.js — 👥 내 친구 목록 구독 한 벌 — 상태(불러오는 중 · 못 불러옴 · 받음) · 실패 뒤 자동 다시 걸기
   책임: subscribeMyFriends 를 «동시에 하나만» 걸고, 거부 · 끊김이면 간격을 늘려 가며 다시 건다.
     화면(마이홈 친구 탭 · 워킹룸 초대 고르기)은 notice() 하나로 같은 문구 · 같은 상태를 읽는다.
   deps: subscribe(myId, onChange, onError) → 해제 함수 · setTimer(fn, ms) → id · clearTimer(id) · onUnload(fn)(앱 종료 · 로그아웃 뒤 재시작 때 정리)
   내보냄: start(myId, onFriends, onStatus) · stop() · status() · notice()
     순수: retryDelayMs(n) · noticeFor(status) · RETRY_DELAYS_MS · NOTICE · STATUS (TwFriendsSub 위)
   ⚠️ 다시 걸기 타이머는 하나뿐이고, 새로 걸기 전에 늘 앞의 구독을 푼다 — 친구 1명당 onValue 가 4개라 겹치면 비용이 곱이 된다.
   ⚠️ 받은 목록이 비어 있으면 READY 다(«친구 없음»). 아직 못 받았거나 못 받은 것과 섞지 않는다.
   검사: checks/sim-friends-sub.js */
(function(){

/* n 번째(0부터) 실패 뒤 기다림. 끝 값에서 멈춘다 — 성공하면 처음부터. */
const RETRY_DELAYS_MS = [5000, 15000, 30000, 60000];
const STATUS = { IDLE: 'idle', LOADING: 'loading', ERROR: 'error', READY: 'ready' };
const NOTICE = {
  loading: '친구 목록을 불러오는 중이에요',
  error: '친구 목록을 불러오지 못했어요. 잠시 후 다시 시도할게요',
};

function retryDelayMs(n){
  const i = Math.max(0, Math.floor(Number(n) || 0));
  return RETRY_DELAYS_MS[Math.min(i, RETRY_DELAYS_MS.length - 1)];
}
/* 받기 전(IDLE · LOADING)은 «불러오는 중», 못 받았으면 «못 불러옴», 받았으면 null(목록을 그린다). */
function noticeFor(status){
  if(status === STATUS.READY) return null;
  return status === STATUS.ERROR ? NOTICE.error : NOTICE.loading;
}

function createFriendsSub(deps){
const subscribe = deps.subscribe;
const setTimer = deps.setTimer;
const clearTimer = deps.clearTimer;
const onUnload = deps.onUnload;
let _status = STATUS.IDLE;
let _myId = null, _onFriends = null, _onStatus = null;
let _unsub = null;   // 지금 걸린 구독의 해제 함수(하나뿐)
let _timer = null;   // 다시 걸기 타이머(하나뿐)
let _fails = 0;      // 이어진 실패 수 — 성공하면 0
let _gen = 0;        // 구독마다 올린다 — 풀었거나 새로 건 구독의 늦은 소식은 버린다

function _setStatus(s){
  if(_status === s) return;
  _status = s;
  try{ if(_onStatus) _onStatus(s); }catch(e){ console.warn('[친구 목록] 상태 그리기 실패', e); }
}
function _detach(){
  const u = _unsub; _unsub = null;
  if(u){ try{ u(); }catch(_){} }
}
function _clearRetry(){
  if(_timer != null){ try{ clearTimer(_timer); }catch(_){} _timer = null; }
}
function _ok(gen, friends){
  if(gen !== _gen) return;
  _fails = 0;
  _status = STATUS.READY;   // 그리기 전에 바꾼다 — onFriends 가 그리는 화면이 notice() 를 읽는다
  if(_onFriends) _onFriends(friends || {});
}
function _fail(gen, err){
  if(gen !== _gen) return;
  _gen++;   // 이 구독은 끝 — subscribe 가 돌아오기 전에 실패를 알려도 돌려받은 해제 함수를 부른다(_attach)
  _detach();
  console.warn('[친구 목록] 구독 실패 — ' + Math.round(retryDelayMs(_fails) / 1000) + '초 뒤 다시 걸어요', err);
  _setStatus(STATUS.ERROR);
  _clearRetry();
  _timer = setTimer(()=>{ _timer = null; _attach(); }, retryDelayMs(_fails));
  _fails++;
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
  _fails = 0;
  _setStatus(STATUS.LOADING);
  _attach();
}
function stop(){
  _clearRetry();
  _gen++;
  _detach();
  _status = STATUS.IDLE;
}
function status(){ return _status; }
function notice(){ return noticeFor(_status); }

onUnload(stop);

return {
  start,
  stop,
  status,
  notice,
};
}

const api = { createFriendsSub, retryDelayMs, noticeFor, RETRY_DELAYS_MS, NOTICE, STATUS };
if(typeof window !== 'undefined') window.TwFriendsSub = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

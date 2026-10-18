/* friends-sub.js — 👥 내 친구 목록 한 벌 — 상태(불러오는 중 · 못 불러옴 · 받음) · 다시 걸기 · 판정용 한 번 읽기 · 목록 열기/닫기
   책임: 친구 목록 구독(포트 friends/friends-port.js 의 watchList — 추가 · 삭제)을 «동시에 하나만» 건다. 실패하면 목록을 열 때(친구 탭 · 워킹룸 초대 목록)만 다시 건다 — 타이머 재시도는 없다.
     이름 · 레벨 · 소개 · 사진은 실시간이 아니다 — 켤 때 한 번 + 목록을 열 때 포트의 listFriends(서버 먼저)로 받아 목록에 얹는다.
     그 사이 새로 생긴 친구(구독에 늘어난 id)는 그 친구만 readFriend(서버 먼저)로 한 번 받는다 — 실행마다 친구당 한 번 · 실패면 자리표시('...') 그대로.
     접속 상태(온라인 · 방)는 목록이 하나라도 열려 있는 동안만 듣는다(watchPresence — 친구 n명이면 n개) · 닫으면 푼다(마지막 값은 남는다).
     닫혀 있을 때 접속 상태가 필요한 곳(놀러 가기 · 파도타기 친구 고르기)은 refreshPresence(ids) 로 그 친구만 한 번 읽는다.
     친구 추가 · 수락 판정은 friendsForCheck() 로 — 받았으면 지금 목록, 아니면 이 모듈 한 곳에서만 한 번 읽는다(진행 중이면 모두가 같은 Promise).
     화면은 notice() 하나로 같은 문구 · 같은 상태를 읽는다.
   deps: subscribe(myId, onChange, onError) → 해제 함수 · fetchOnce(myId) → Promise<{친구id:{addedAt}}>(판정용) ·
         listFriends(myId) → Promise<{친구id: 친구}>(이름 · 레벨 · 소개 · 사진) · readFriend(fid) → Promise<친구 | null>(새 친구 한 명) · watchPresence(myId, ids, onChange) → 해제 함수 ·
         readPresence(fid) → Promise<접속 상태> · current() → 지금 목록 ·
         setFriends(v) · getMyUserId() · toast(msg) · setTimer(fn, ms) → id · clearTimer(id) · onUnload(fn)(앱 종료 · 로그아웃 뒤 재시작 때 정리)
   내보냄: start(myId, onFriends, onStatus) · stop() · status() · notice() · retryIfFailed() · friendsForCheck() ·
         open(key, onUpdate)(목록을 열 때 — 다시 걸기 · 이름 받기 · 접속 상태 듣기 · 열려 있는 동안 바뀌면 onUpdate) · close(key) ·
         refreshPresence(ids) → Promise(듣고 있지 않은 친구만 한 번 읽기)
     순수: noticeFor(status) · friendOf(entry, card, pres) · mergeFriends(ids, details, presence) · NOTICE · STATUS · SUB_WAIT_MS (TwFriendsSub 위)
   ⚠️ 구독이 연결 시도 중이면 따로 읽지 않고 그 결과를 SUB_WAIT_MS 까지 기다린다 — 같은 경로를 두 번 읽지 않게.
   ⚠️ 한 번 읽은 값은 그 판정에만 쓴다(받음으로 치지 않는다 · 따로 캐시 안 함). 그 사이 구독 값이 왔으면 구독 값이 이긴다.
   ⚠️ 받은 목록이 비어 있으면 READY 다(«친구 없음»). 아직 못 받았거나 못 받은 것과 섞지 않는다.
   검사: checks/sim-friends-sub.js */
(function(){

const SUB_WAIT_MS = 3000;   // 판정이 연결 시도 중인 구독을 기다리는 상한 — 넘으면 그때 한 번 읽는다
const STATUS = { IDLE: 'idle', LOADING: 'loading', ERROR: 'error', READY: 'ready' };
const NOTICE = {
  loading: '친구 목록을 불러오는 중이에요',
  error: '친구 목록을 불러오지 못했어요.\n잠시 후 다시 시도할게요',   // 두 문장 사이 줄바꿈 — 그리는 쪽은 white-space:pre-line(마이홈 친구 탭 · 초대 목록)
  checkFail: '친구 목록을 불러오지 못했어요.\n잠시 후 다시 눌러 주세요',   // 토스트 — 줄바꿈은 toast 의 pre-line(fix/toast-newline)이 그린다
};

/* 친구 한 명 = 목록 칸(entry — addedAt) 위에 이름 · 사진(card) · 접속 상태(pres)를 얹는다. 값이 undefined 인 칸은 덮지 않는다
   (null 은 덮는다 — level null = 배지 숨김). 아직 아무것도 없으면 예전 자리표시와 같다(이름 '...' · 오프라인). */
const FRIEND_BLANK = Object.freeze({ name: '...', online: false, lastSeen: 0 });
function friendOf(entry, card, pres){
  const out = Object.assign({}, FRIEND_BLANK, entry || {});
  for(const src of [card, pres]){
    if(!src) continue;
    for(const k of Object.keys(src)) if(src[k] !== undefined) out[k] = src[k];
  }
  return out;
}
/* 목록(ids — 구독이 준 { 친구id: 칸 })에 있는 친구만. 받은 이름 목록에만 있는 id(서버 사본이 늦음)는 버린다. */
function mergeFriends(ids, details, presence){
  const out = {};
  for(const fid of Object.keys(ids || {})) out[fid] = friendOf(ids[fid], details && details[fid], presence && presence[fid]);
  return out;
}

/* 받기 전(IDLE · LOADING)은 «불러오는 중», 못 받았으면 «못 불러옴», 받았으면 null(목록을 그린다). */
function noticeFor(status){
  if(status === STATUS.READY) return null;
  return status === STATUS.ERROR ? NOTICE.error : NOTICE.loading;
}

function createFriendsSub(deps){
const subscribe = deps.subscribe;
const fetchOnce = deps.fetchOnce;
const listFriends = deps.listFriends;
const readFriend = deps.readFriend;
const watchPresence = deps.watchPresence;
const readPresence = deps.readPresence;
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
let _ids = {};         // 구독이 준 목록 { 친구id: 칸 } — 누가 친구인지는 이것만 본다
let _details = {};     // listFriends 로 받은 이름 · 레벨 · 소개 · 사진 { 친구id: 칸 }
let _detailsP = null;  // 진행 중인 이름 받기(하나뿐)
let _detailsTried = false;   // 이름 받기를 한 번이라도 끝냈나(성공이든 실패든) — 첫 받기 동안만 «불러오는 중»
let _run = 0;          // start · stop 마다 올린다 — 지난 실행의 늦은 이름 받기는 버린다
let _gotIds = false;   // 이번 실행에서 구독 값을 한 번이라도 받았나 — 그 뒤에 늘어난 id 만 «새 친구»
let _asked = {};       // 이번 실행에서 한 명 받기를 이미 물은 친구 { 친구id: true } — 진행 중 · 실패도 다시 안 묻는다(다음 목록 받기가 채운다)
let _open = {};        // 열려 있는 목록 { key: onUpdate | null }
let _presence = {};    // 접속 상태 { 친구id: { online, lastSeen, room, inRoom } } — 닫은 뒤에도 마지막 값은 남는다
let _presOff = null;   // 지금 걸린 접속 상태 듣기의 해제 함수(하나뿐 — 친구 n명을 한 벌로)
let _presKey = '';     // 그 듣기가 보는 친구 id(정렬해 이은 글) — 같으면 다시 걸지 않는다

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
/* 지금 목록을 그리는 쪽에 넘긴다 — 받은 뒤에만(받기 전에 넘기면 판정용으로 한 번 읽은 목록을 빈 값으로 덮는다). */
function _emit(){
  if(_status !== STATUS.READY) return;
  if(_onFriends) _onFriends(mergeFriends(_ids, _details, _presence));
  for(const k of Object.keys(_open)){
    const fn = _open[k];
    if(fn){ try{ fn(); }catch(e){ console.warn('[친구 목록] 열린 목록 다시 그리기 실패', k, e); } }
  }
}
function _ok(gen, friends){
  if(gen !== _gen) return;
  _okSeq++;
  const prev = _gotIds ? _ids : null;
  _ids = friends || {};
  _gotIds = true;
  _status = STATUS.READY;   // 그리기 전에 바꾼다 — onFriends 가 그리는 화면이 notice() 를 읽는다
  _emit();
  _wake();
  _syncPresence();   // 목록이 열려 있으면 늘어난 · 줄어든 친구에 맞춰 다시 듣는다
  if(prev) _loadNew(Object.keys(_ids).filter(fid=>!(fid in prev)));
}
/* 새로 생긴 친구(지난 구독 값에 없던 id) 중 이름을 아직 모르는 친구만 한 명씩 받는다.
   첫 구독 값은 새 친구로 치지 않는다 — 첫 목록 받기가 실패했을 때 친구 n명을 한 명씩 묻지 않게. 첫 목록 받기 중이면 그것이 채운다. */
function _loadNew(added){
  if(!_detailsTried || !_myId) return;
  const run = _run;
  for(const fid of added){
    if(_details[fid] || _asked[fid]) continue;
    _asked[fid] = true;
    Promise.resolve()
      .then(()=>readFriend(fid))
      .then(v=>{ if(run !== _run || !v) return; _details[fid] = v; _emit(); },
            e=>{ if(run === _run) console.warn('[친구 목록] 새 친구 이름 · 사진을 못 받음 — 자리표시 그대로', fid, e); });
  }
}
function _stopPresence(){
  const u = _presOff; _presOff = null; _presKey = '';
  if(u){ try{ u(); }catch(_){} }
}
/* 접속 상태 듣기 — 목록이 하나라도 열려 있고 받은 뒤일 때만. 친구가 같으면 그대로 · 바뀌면 풀고 다시 · 아니면 푼다. */
function _syncPresence(){
  const want = (Object.keys(_open).length && _status === STATUS.READY && _myId) ? Object.keys(_ids).sort().join(',') : '';
  if(want && want === _presKey && _presOff) return;
  _stopPresence();
  if(!want) return;
  const run = _run;
  _presKey = want;
  try{ _presOff = watchPresence(_myId, want.split(','), p=>{ if(run !== _run) return; Object.assign(_presence, p); _emit(); }); }
  catch(e){ _presOff = null; console.warn('[친구 목록] 접속 상태 듣기 실패', e); }
}
/* 다시 받은 목록에 없는 지금 친구(서버 사본이 늦음)는 알던 이름을 남긴다 — 한 명 받기로 채운 새 친구가 '...' 로 돌아가지 않게. */
function _keepKnown(next){
  const out = Object.assign({}, next);
  for(const fid of Object.keys(_ids)) if(!out[fid] && _details[fid]) out[fid] = _details[fid];
  return out;
}
/* 이름 · 레벨 · 소개 · 사진 받기 — 포트가 서버 먼저 · 못 받으면 옛 길. 진행 중이면 그것을 같이 기다린다. 실패해도 목록은 그대로 그린다. */
function _loadDetails(){
  if(_detailsP) return _detailsP;
  if(!_myId) return Promise.resolve();
  const run = _run, myId = _myId;
  _detailsP = Promise.resolve()
    .then(()=>listFriends(myId))
    .then(v=>{ if(run === _run) _details = _keepKnown(v || {}); },
          e=>{ if(run === _run) console.warn('[친구 목록] 이름 · 사진을 못 받음 — 받은 목록 그대로', e); })
    .then(()=>{
      if(run !== _run) return;
      _detailsP = null; _detailsTried = true;
      _emit();
    });
  return _detailsP;
}
function _fail(gen, err){
  if(gen !== _gen) return;
  _gen++;   // 이 구독은 끝 — subscribe 가 돌아오기 전에 실패를 알려도 돌려받은 해제 함수를 부른다(_attach)
  _detach();
  console.warn('[친구 목록] 구독 실패 — 목록을 열면 다시 걸어요', err);
  _setStatus(STATUS.ERROR);
  _wake();
  _syncPresence();
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
  _loadDetails();   // 켤 때 한 번 — 다른 곳(파도타기 · 마이홈 구경 · 스케줄러)도 이름을 쓴다
}
function stop(){
  _gen++; _run++;
  _detach();
  _stopPresence();
  _status = STATUS.IDLE;
  _ids = {}; _details = {}; _detailsP = null; _detailsTried = false; _presence = {}; _asked = {}; _gotIds = false;
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
  const id = _myId || getMyUserId();
  if(!id) return {};
  const seq = _okSeq;
  _fetching = true;
  try{
    const ids = await fetchOnce(id);
    if(_okSeq !== seq || _status === STATUS.READY) return current() || {};   // 그 사이 구독 값이 왔다 — 구독 값이 이긴다
    const cur = current() || {}, out = {};
    Object.keys(ids || {}).forEach(fid=>{
      out[fid] = cur[fid] || friendOf(ids[fid], _details[fid]);
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
/* 목록을 열 때(친구 탭 · 워킹룸 초대 목록) — 못 불러왔으면 다시 걸고, 이름 · 사진을 다시 받는다(서버부터).
   onUpdate 는 열려 있는 동안 목록이 바뀌면 부른다(다시 그리기). 같은 key 로 또 열면 onUpdate 만 바꾼다(다시 받지 않음). */
function open(key, onUpdate){
  const first = !(key in _open);
  _open[key] = onUpdate || null;
  if(!_myId) return;
  retryIfFailed();
  if(first) _loadDetails();
  _syncPresence();
}
function close(key){ delete _open[key]; _syncPresence(); }
/* 듣고 있지 않은 친구의 접속 상태만 한 번 읽어 얹는다(놀러 가기 · 파도타기 친구 고르기). 실패한 친구는 지난 값 그대로. */
function refreshPresence(ids){
  const watching = _presKey ? _presKey.split(',') : [];
  const need = (ids || []).filter(fid=>fid && watching.indexOf(fid) < 0);
  if(!need.length) return Promise.resolve();
  const run = _run;
  return Promise.all(need.map(fid=>Promise.resolve()
    .then(()=>readPresence(fid))
    .then(p=>{ if(run === _run && p) _presence[fid] = p; }, e=>{ console.warn('[친구 목록] 접속 상태 한 번 읽기 실패', fid, e); })))
    .then(()=>{ if(run === _run) _emit(); });
}
function status(){ return _status; }
/* 받은 뒤라도 첫 이름 받기가 끝나기 전에는 «불러오는 중» — 이름 없는 목록('...')을 잠깐 보여 주지 않게. */
function notice(){
  if(_status === STATUS.READY && _detailsP && !_detailsTried) return NOTICE.loading;
  return noticeFor(_status);
}

onUnload(stop);

return {
  start,
  stop,
  status,
  notice,
  retryIfFailed,
  friendsForCheck,
  open,
  close,
  refreshPresence,
};
}

const api = { createFriendsSub, noticeFor, friendOf, mergeFriends, NOTICE, STATUS, SUB_WAIT_MS };
if(typeof window !== 'undefined') window.TwFriendsSub = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

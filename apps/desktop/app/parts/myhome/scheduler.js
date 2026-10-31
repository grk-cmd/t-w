/* scheduler.js — 📅 스케줄러(마이홈 [스케줄러] 탭: 달력 · 📌 기념일 카드 · ⏳ D-day 배너) + 🔔 일정 알림(상태칩 알림창)
   원본은 서버다 — 일정 · 디데이 보드 · 친구가 태그한 알림을 schedule-api.js(provider)로 읽고 쓴다(앱 FSD 1번 — docs/APP_FSD_MAP.md).

   ★ 받는 동안 · 못 받음 · 받음을 가른다(달력 · 기념일 · D-day 각각). 받기 전에는 고치는 동작을 잠근다 — 받은 값이 덮어 고친 것으로 사라지지 않게.
     못 받으면 그 자리를 눌러 다시 받는다(빈 목록과 다르게 말한다).
   ★ 디데이 보드는 통째로 읽고 통째로 저장한다(판 version). 저장은 한 번에 하나씩 줄 세워 보낸다 — 보내는 중에 또 고쳐도 끝난 뒤 최신 값으로 이어 보낸다.
     다른 기기가 먼저 고쳤으면(409) 덮어쓰지 않고 서버 값을 다시 받아 그리고 알린다.
   ★ 서버가 바뀌었다고 알리면(realtime `schedule` · `notification`) 다시 받는다. 친구 일정 알림은 서버 알림함의 🔔 칸에서 읽는다.
   ★ 앱에만 있는 것: 오늘 날짜를 이 기기 시간대로 보는 셈(그날이 1일 · 이정표) · 🔔 읽음 시각 · 창 자리 · 구분선 높이.
   ★ 다른 구역이 다시 대입하던 상태는 읽는 함수 · 쓰는 함수로 받는다(_mhViewingUserId → viewingUserId() · _myHomeFriends → myHomeFriends()).
     BELL_SEEN_KEY 는 deps.bellSeenKey — 계정 전환 지움 목록(ACCOUNT_LOCAL_KEYS)이 같은 이름을 쓰므로 정의는 app.js 에 남겼다.
   ★ createScheduler 는 app.js 의 원래 자리에서 부른다. 만들 때 바로 도는 것(달력 버튼 · D-day 편집창 연결 · 구분선 높이 복원 ·
     🔔 알림 받기 · 서버 알림 걸기 · 자정 넘김 1분 타이머)이 예전과 같은 순서 · 같은 때에 돈다.
   ⚠️ localStorage · document 는 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   검사: checks/sim-scheduler.js — 셈 · 🔔 뱃지 · 알림 목록 · 받는 상태 · 잠금 · 저장 줄 세우기 · 409 · 관람 모드 · app.js 배선. */
(function(){

function createScheduler(deps){
const twNav = deps.twNav;                       // 🧭 창 열기 통로(nav.js) — 🏠 마이홈 열기
const scheduleApi = deps.scheduleApi;           // 🌐 일정 · 디데이 · 알림 서버 길(schedule-api.js)
const apiErrors = deps.apiErrors;               // 🧭 서버 오류 → 할 일 · 오류 번호(TwApiErrors.store)
const notifyError = deps.notifyError;           // 사용자에게 보이는 실패 — 번호 표(shared/error-codes.js)
const rtOn = deps.rtOn;                         // 🛰 서버가 «바뀌었다» 고 알리는 길(TwRtHub.store.on) → 해제 함수
const getMyUserId = deps.getMyUserId;
const viewingUserId = deps.viewingUserId;      // 👀 지금 관람 중인 친구 uid(없으면 null) — app.js 의 _mhViewingUserId
const myHomeFriends = deps.myHomeFriends;      // 👥 친구 목록 캐시 — app.js 의 _myHomeFriends
const toast = deps.toast;
const uiIconEl = deps.uiIconEl;
const escRegisterWindow = deps.escRegisterWindow;
const _closeChipPopups = deps.closeChipPopups;
const _positionInputBelowChar = deps.positionInputBelowChar;
const _inboxUnreadCount = deps.inboxUnreadCount;
const _refreshFriendTabBadge = deps.refreshFriendTabBadge;

/* ═══════════════════════ 📅 스케줄러 ═══════════════════════
   좌: 월별 달력 (일정 등록/삭제, 일정별 공개 여부, 친구 태그)
   우: D-day 목록 (기념일 카운트다운, 최대 5개)
   기본 비공개 — "친구에게 공개"를 체크해야 관람 모드에서 보임.
   친구를 태그하면 그 친구의 🔔 알림함에 기록이 들어감. */
const ANNIV_MAX = scheduleApi.LIMITS.DDAY_PER_KIND;   // 📌 기념일 카드 최대 개수 — 6개 넘으면 3열로 바뀌며 카드가 작아짐
const DDAY_MAX  = scheduleApi.LIMITS.DDAY_PER_KIND;   // ⏳ D-day 배너 최대 개수
const KIND = scheduleApi.KIND;                        // 'anniv'(기념일 카드) | 'dday'(배너)
const DDAY_CARD_IMG_MAX = 150;      // 카드 배경 이미지 리사이즈 상한 (정사각 cover)
/* 받는 상태 — 달력 · 내 보드 · 친구 보드가 각각 가진다. IDLE(아직 안 물음)은 화면에서 LOADING 과 같게 보인다 */
const LOAD = Object.freeze({ IDLE: 'idle', LOADING: 'loading', READY: 'ready', ERROR: 'error' });
const LOAD_TEXT = Object.freeze({ loading: '불러오는 중이에요', error: '불러오지 못했어요 — 눌러서 다시 시도' });
const TAG_NOT_FRIEND_TEXT = '친구가 아닌 사람은 태그할 수 없어요';
const PUBLIC_TAG_HINT = '태그한 친구가 볼 수 있게 공개돼요';   // 서버 규칙: 친구를 태그한 일정 · 기념일은 공개로 저장된다
const LOCK_TEXT = '아직 불러오는 중이에요 — 잠시 뒤에 다시 눌러 주세요';   // 받기 전에 고치려 할 때(토스트)
let _gen = 0;                       // reset 마다 오른다 — 앞 계정의 늦은 답이 새 계정 화면을 건드리지 않게
let _schedTagTarget = 'sched';      // 지금 태그 팝업이 누구를 위한 것인지: 'sched'(일정) | 'dday'
let _schedYM        = null;   // 지금 보고 있는 달 'YYYY-MM'
let _schedSelDD     = null;   // 선택한 날짜 'DD'
let _schedMonthData = {};     // { DD: { id: {text, public, ts, version, date} } }
let _monthState     = LOAD.IDLE;   // 지금 보는 달(내 것 또는 친구 것)을 받은 상태
let _monthSeq       = 0;      // 달을 받을 때마다 오른다 — 늦게 온 앞 달 · 앞 사람 답은 버린다
let _schedDdays     = {};     // { id: {kind, text, date, public, notify, base1, bgColor, bgImg, order, ts} } — 내 보드(서버 값)
let _boardState     = LOAD.IDLE;
let _boardChain     = Promise.resolve();   // 내 보드를 받고 · 저장하는 일을 한 줄로 세운다
/* 👀 관람 모드용 — 친구의 D-day 중 "친구에게 공개" 한 것만 (서버가 공개한 것만 준다) */
let _schedDdaysVisit = null, _visitBoardState = LOAD.IDLE, _visitSeq = 0;
let _visitFriend = null, _visitRound = 0, _visitRefreshing = false, _visitAgain = false;   // 구경 중인 친구 · 알림으로 다시 받는 한 바퀴(겹치면 끝난 뒤 한 번 더)
function _schedDdaySrc(){ return viewingUserId() ? (_schedDdaysVisit || {}) : _schedDdays; }
function _ddayStateNow(){ return viewingUserId() ? _visitBoardState : _boardState; }
let _schedTagSel    = [];     // 지금 등록할 일정에 태그할 친구 uid 목록
let _schedAdding    = false;  // 일정 보내는 중 — 한 번에 하나
let _loadFailing    = false;  // 받기 실패가 이어지는 동안 오류 번호는 한 번만

/* 서버 오류 → 할 일. 기능 표가 공통 표보다 먼저다 */
const ERR_TABLE = Object.freeze({
  SCHEDULE_TAG_NOT_FRIEND: { action: 'notice', notice: () => toast(TAG_NOT_FRIEND_TEXT) },   // 안내만 — 오류 번호 없이
  SCHEDULE_TAG_SELF: { action: 'notice', notice: (notifyError, e) => notifyError('E-MH-06', e) },
  SCHEDULE_DDAY_FULL: { action: 'notice', notice: (notifyError, e) => notifyError('E-MH-07', e) },
  SCHEDULE_INVALID_IMAGE_URL: { action: 'notice', notice: (notifyError, e) => notifyError('E-MH-05', e) },
  IMAGE_UPLOAD: { action: 'notice', notice: (notifyError, e) => notifyError('E-MH-05', e) },
  OWNER_CHANGED: { action: 'quiet', notice: null },        // 로그인한 사람이 바뀌는 중 — 곧 reset · 다시 받기가 온다
  NOT_RECEIVED: { action: 'quiet', notice: null },         // 받기 전 잠금이 먼저 막는다 — 여기까지 오면 조용히
});
/* 쓰기 실패 알림. 돌려주는 값 = 다시 받아야 하는가(다른 기기가 먼저 고쳤다 — 409) */
function _writeFail(e){
  const t = apiErrors.notify(e, ERR_TABLE);
  return t.action === 'refetch';
}
/* 받기 실패 알림 — 이어지는 동안 한 번만 */
function _loadFail(e){
  if(_loadFailing) return;
  _loadFailing = true;
  notifyError('E-MH-04', e);
}

/* 친구를 태그하면 서버가 공개로 바꾼다 — 앱이 몰래 바꾸지 않게 «공개» 체크를 켜고 잠그고 까닭을 보인다.
   태그를 다 빼면 태그 전에 사용자가 둔 값으로 돌리고 잠금을 푼다 */
function _syncPublicLock(chk, hint, tagCount){
  if(!chk) return;
  if(tagCount > 0){
    if(!chk.disabled) chk.dataset.orig = chk.checked ? '1' : '';
    chk.checked = true; chk.disabled = true;
    if(hint) hint.textContent = PUBLIC_TAG_HINT;
    return;
  }
  if(chk.disabled){ chk.checked = chk.dataset.orig === '1'; chk.disabled = false; }
  if(hint) hint.textContent = '';
}

function _pad2(n){ return String(n).padStart(2,'0'); }
function _todayParts(){ const d=new Date(); return { y:d.getFullYear(), m:d.getMonth()+1, d:d.getDate() }; }
function _todayYMD(){ const t=_todayParts(); return `${t.y}-${_pad2(t.m)}-${_pad2(t.d)}`; }
function _localYMD(ts){ const d=new Date(ts); return `${d.getFullYear()}-${_pad2(d.getMonth()+1)}-${_pad2(d.getDate())}`; }   // 이 기기 시간대의 날짜(_todayYMD 와 같은 셈)
function _ymOf(y,m){ return `${y}-${_pad2(m)}`; }

/* 날짜 문자열 두 개의 일수 차이 (b - a). 시간대 영향을 없애려고 UTC 기준으로 계산 */
function _daysBetween(aYMD, bYMD){
  const [ay,am,ad] = aYMD.split('-').map(Number);
  const [by,bm,bd] = bYMD.split('-').map(Number);
  const a = Date.UTC(ay, am-1, ad), b = Date.UTC(by, bm-1, bd);
  return Math.round((b - a) / 86400000);
}

/* 보는 달 받기 — 달을 옮길 때마다 다시 받는다. 👀 관람 중이면 친구의 달력(서버가 공개한 일정만).
   quiet 는 서버가 «바뀌었다» 고 알려서 조용히 다시 받는 것 — 받는 동안 화면을 비우지 않고, 못 받아도 있던 값을 둔다. */
async function loadMonth(quiet){
  const friend = viewingUserId();
  const owner = friend || getMyUserId();
  if(!owner || !_schedYM) return;   // 내 코드가 없으면 달력을 받지 않는다
  const seq = ++_monthSeq, ym = _schedYM, gen = _gen;
  if(!quiet || _monthState !== LOAD.READY){ _monthState = LOAD.LOADING; renderSchedGrid(); renderSchedDay(); }
  try{
    const data = friend ? await scheduleApi.fetchMonthOf(friend, ym) : await scheduleApi.fetchMonth(owner, ym);
    if(seq !== _monthSeq || gen !== _gen) return;
    _schedMonthData = data; _monthState = LOAD.READY; _loadFailing = false;
  }catch(e){
    if(seq !== _monthSeq || gen !== _gen) return;
    if(quiet && _monthState === LOAD.READY) return;
    _schedMonthData = {}; _monthState = LOAD.ERROR; _loadFail(e);
  }
  renderSchedGrid();
  renderSchedDay();
}

/* 받는 중 · 못 받음 안내 한 줄 — 못 받음은 눌러서 다시 받는다 */
function _statusEl(cls, state, retry){
  const e = document.createElement('div');
  e.className = cls;
  e.textContent = state === LOAD.ERROR ? LOAD_TEXT.error : LOAD_TEXT.loading;
  if(state === LOAD.ERROR){ e.style.cursor = 'pointer'; e.onclick = retry; }
  return e;
}

function renderSchedCalendar(){
  if(!_schedYM){
    const t = _todayParts();
    _schedYM = _ymOf(t.y, t.m);
    _schedSelDD = _pad2(t.d);
    loadMonth();
  }else if(_monthState === LOAD.ERROR){
    loadMonth();   // 탭을 다시 열면 못 받았던 것을 다시 받는다
  }
  if(!viewingUserId() && (_boardState === LOAD.ERROR || _boardState === LOAD.IDLE) && getMyUserId()) _boardLoad(false);
  const title = document.getElementById('mhSchedTitle');
  const [y,m] = _schedYM.split('-').map(Number);
  if(title) title.textContent = `${y}년 ${m}월`;
  renderSchedGrid();
  renderSchedDay();
}

function renderSchedGrid(){
  const grid = document.getElementById('mhSchedGrid');
  if(!grid || !_schedYM) return;
  const [y,m] = _schedYM.split('-').map(Number);
  const first = new Date(y, m-1, 1);
  const startDow = first.getDay();                 // 0=일
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = _todayParts();
  const isThisMonth = (today.y===y && today.m===m);

  grid.innerHTML = '';
  // 앞쪽 빈칸 + 날짜 + 뒤쪽 빈칸(6주 그리드로 높이 안정화)
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;
  for(let i=0; i<totalCells; i++){
    const dnum = i - startDow + 1;
    const cell = document.createElement('div');
    if(dnum < 1 || dnum > daysInMonth){
      cell.className = 'mh-cell out';
      grid.appendChild(cell);
      continue;
    }
    const dd = _pad2(dnum);
    const dow = i % 7;
    cell.className = 'mh-cell' + (dow===0?' sun':'') + (dow===6?' sat':'')
      + (isThisMonth && dnum===today.d ? ' today' : '')
      + (dd === _schedSelDD ? ' sel' : '');
    const num = document.createElement('div');
    num.className = 'dnum'; num.textContent = String(dnum);
    cell.appendChild(num);
    // 일정이 있으면 점 표시 (최대 3개)
    const items = _schedMonthData[dd] ? Object.keys(_schedMonthData[dd]) : [];
    if(items.length){
      const dots = document.createElement('div'); dots.className = 'dots';
      for(let k=0; k<Math.min(items.length,3); k++){
        const dot = document.createElement('div'); dot.className='dot'; dots.appendChild(dot);
      }
      cell.appendChild(dots);
    }
    cell.onclick = ()=>{ _schedSelDD = dd; renderSchedGrid(); renderSchedDay(); };
    // ⏳ 우클릭 → 이 날짜로 D-day 추가 (날짜가 이미 정해진 상태로 편집창이 열림)
    cell.addEventListener('contextmenu', e=>{
      e.preventDefault();
      if(viewingUserId()) return;   // 👀 관람: 추가 불가
      _schedSelDD = dd; renderSchedGrid(); renderSchedDay();
      _ddayOpenEdit(null, 'dday', `${y}-${_pad2(m)}-${dd}`);
    });
    cell.title = viewingUserId() ? '클릭: 일정 보기' : '클릭: 일정 보기 · 우클릭: 이 날짜로 D-day 추가';
    grid.appendChild(cell);
  }
}

/* 서버가 돌려준 새 일정을 보는 달 · 오늘 목록에 얹는다 */
function _schedPutItem(item){
  const dd = item.date.slice(8, 10);
  if(item.date.slice(0, 7) === _schedYM && !viewingUserId()){
    const day = (_schedMonthData[dd] = _schedMonthData[dd] || {});
    day[item.id] = { text: item.text, public: item.public, ts: item.ts, version: item.version, date: item.date };
    renderSchedGrid(); renderSchedDay();
  }
  if(item.date === _todayYMD()){
    _bellTodayItems = _bellTodayItems.concat([{ id: item.id, text: item.text, ts: item.ts }]);
    refreshBellBadge();
  }
}

/* 일정 지우기 — 서버에서 지운 뒤 화면에서 뺀다. 다른 기기가 먼저 고쳤으면(409) 지우지 않고 달을 다시 받는다 */
async function _schedDeleteItem(id){
  if(viewingUserId() || _monthState !== LOAD.READY) return;
  const dd = _schedSelDD, it = (_schedMonthData[dd] || {})[id], gen = _gen;
  if(!it) return;
  try{
    await scheduleApi.deleteItem(getMyUserId(), id, it.version);
  }catch(e){
    if(gen !== _gen) return;
    if(_writeFail(e)) loadMonth(true);
    return;
  }
  if(gen !== _gen) return;
  if(_schedMonthData[dd]){ delete _schedMonthData[dd][id]; if(!Object.keys(_schedMonthData[dd]).length) delete _schedMonthData[dd]; }
  _bellTodayItems = _bellTodayItems.filter(x => x.id !== id);
  renderSchedGrid(); renderSchedDay(); refreshBellBadge();
}

function renderSchedDay(){
  const titleEl = document.getElementById('mhSchedDayTitle');
  const listEl  = document.getElementById('mhSchedDayList');
  if(!titleEl || !listEl) return;
  if(!_schedSelDD){ titleEl.textContent = '날짜를 선택하세요'; listEl.innerHTML=''; return; }
  const [y,m] = _schedYM.split('-').map(Number);
  titleEl.textContent = `${m}월 ${Number(_schedSelDD)}일 일정`;

  const items = _schedMonthData[_schedSelDD] || {};
  const ids = Object.keys(items).sort((a,b)=> (items[a].ts||0) - (items[b].ts||0));
  listEl.innerHTML = '';
  if(_monthState !== LOAD.READY){
    listEl.appendChild(_statusEl('mh-si-empty', _monthState, ()=>loadMonth()));
    return;
  }
  if(!ids.length){
    const e = document.createElement('div');
    e.className='mh-si-empty'; e.textContent='등록된 일정이 없어요';
    listEl.appendChild(e);
    return;
  }
  ids.forEach(id=>{
    const it = items[id];
    const row = document.createElement('div'); row.className='mh-si';
    const t = document.createElement('div'); t.className='t'; t.textContent = it.text||''; t.title = it.text||'';
    row.appendChild(t);
    if(it.public){ const p=document.createElement('span'); p.className='pub'; p.textContent='공개'; row.appendChild(p); }
    if(viewingUserId()){ listEl.appendChild(row); return; }   // 👀 관람: 삭제 × 없이 표시만
    const x = document.createElement('span'); x.className='x'; x.textContent='×'; x.title='삭제';
    x.onclick = ()=>{ _schedDeleteItem(id); };
    row.appendChild(x);
    listEl.appendChild(row);
  });
}

/* 📌 D-day 카드 그리드 — 최대 6개(추가 카드 포함). hover 시 정보가 페이드인.
   지난 날짜는 "1000일"처럼 경과 일수로, 다가오는 건 D-3, 당일은 D-day로 표시. */
/* '2026-07-24' → '26-07-24' — 연도 두 자리로 줄여서 한 줄에 넣기 */
function _shortYMD(ymd){
  if(!ymd || ymd.length < 10) return ymd || '';
  return ymd.slice(2);
}
/* 📌 한국식 기념일 셈법 — «그날이 1일».
   [무엇을 푸는가] 제보 「기념일 지정하면 하루씩 부족하다」. 경과일을 today − 날짜 그대로 썼는데,
     한국에서 100일·1000일은 **만난 날을 1일로** 센다. 그래서 언제나 정확히 하루가 모자랐다.
   ★ 이 셈법을 쓰는 자리가 셋이다 — 기념일 카드 · D-day 배너 · 🔔 알림. 셋이 따로 세면
     「카드는 100일인데 알림은 하루 뒤에 온다」가 된다. 그래서 아래 두 함수 하나씩만 지난다.
   ⚠️ 미래 날짜(D-N)에는 안 걸린다. D-N 은 «며칠 남았나»라 세는 방향이 반대다.
     체크를 켜도 D-3 은 D-3 그대로다 — 그래서 배너에는 이 체크박스를 아예 안 보여 준다. */
function _ddayBase1(dd){
  /* ⏳ 배너는 D-N 이 본체다. 지난 뒤의 경과일은 곁다리라 예전 셈법을 그대로 둔다. 기념일 카드의 값은 서버가 늘 정해서 준다(처음 만들 땐 켜짐). */
  return !!dd && dd.kind !== KIND.BANNER && dd.base1 === true;
}
/* 오늘 화면에 나올 «며칠째». 음수면 아직 오지 않은 날이다. */
function _ddayShownDays(dd, todayYMD){
  return _daysBetween(dd.date || todayYMD, todayYMD) + (_ddayBase1(dd) ? 1 : 0);
}
function _ddayCountLabel(diff, base1){
  /* 미래는 셈법과 무관하다 — 여기서 base1 을 더하면 D-3 이 D-4 가 된다. */
  if(diff > 0) return { txt:'D-'+diff, today:false };
  if(base1)    return { txt:(1 - diff)+'일', today: diff === 0 };
  if(diff === 0) return { txt:'D-day', today:true };
  return { txt:(-diff)+'일', today:false };   // 지난 것 = 그날로부터 며칠 지났는지
}
function renderDdays(){
  renderAnnivCards();
  renderDdayBanners();
}

/* 📌 기념일 카드 (정사각, 배경 색/이미지 지정 가능) */
function renderAnnivCards(){
  const grid = document.getElementById('mhDdayGrid');
  if(!grid) return;
  const today = _todayYMD();
  const state = _ddayStateNow();
  if(state !== LOAD.READY){
    grid.className = 'cols3';
    grid.innerHTML = '';
    grid.appendChild(_statusEl('mh-dban-empty', state, _ddayRetry));
    return;
  }
  const ids = _ddayOrderedIds(KIND.CARD);

  // 열 수 결정 — 카드 전체가 스크롤 없이 영역 안에 들어가는 최소 열 수를 찾음.
  //   구분선을 위로 끌어 영역이 낮아지면 열이 늘어나 카드가 실제로 작아짐(스크롤 대신).
  const total = ids.length + (ids.length < ANNIV_MAX ? 1 : 0);
  const area = document.getElementById('mhAnnivArea');
  const areaW = (area && area.clientWidth)  ? area.clientWidth  : 240;
  const areaH = (area && area.clientHeight) ? area.clientHeight : 240;   // 탭이 안 열려 0이면 기본값
  let cols = 3;
  for(; cols <= 6; cols++){
    const rows = Math.ceil(total / cols);
    const cardW = (areaW - (cols-1)*7 - 8) / cols;   // gap 7px, 좌우 패딩 대략 8px
    const need = rows * cardW + (rows-1)*7;
    if(need <= areaH || cols === 6) break;
  }
  grid.className = 'cols' + Math.min(6, Math.max(3, cols));
  grid.innerHTML = '';

  ids.forEach(id=>{
    const dd = _schedDdaySrc()[id];
    const diff = _daysBetween(today, dd.date || today);
    const lab = _ddayCountLabel(diff, _ddayBase1(dd));
    const isPast = diff < 0;

    const card = document.createElement('div');
    card.className = 'mh-dcard' + (dd.bgImg ? ' hasimg' : '') + (isPast ? ' past' : '');
    card.draggable = true;
    card.dataset.id = id;
    if(dd.bgImg) card.style.backgroundImage = TwSafeHtml.cssUrl(dd.bgImg);   // 허용된 그림 주소만
    else if(dd.bgColor) card.style.backgroundColor = dd.bgColor;

    const face = document.createElement('div'); face.className = 'dc-face';
    const cnt = document.createElement('div');
    cnt.className = 'dc-cnt' + (lab.today ? ' today' : '');
    cnt.textContent = lab.txt;
    const dt = document.createElement('div');
    dt.className = 'dc-date'; dt.textContent = dd.date || '';
    const info = document.createElement('div');
    info.className = 'dc-info'; info.textContent = dd.text || ''; info.title = dd.text || '';
    face.appendChild(cnt); face.appendChild(dt); face.appendChild(info);

    const badges = document.createElement('div');
    badges.className = 'dc-badges';
    /* 🔔 알림 뱃지 — 그림으로 바꿨다. .dc-badges span{font-size:9px} 는 <img> 에 안 걸리므로
       크기는 uiIconEl 의 11px 이 정한다(예전 9px 글리프보다 살짝 크게 잡았다 — 그림은 여백이 있다). */
    if(dd.notify){ const b=uiIconEl('bell', 11, '알림 켜짐'); b.title='알림 켜짐'; badges.appendChild(b); }
    if(dd.public){ const b=document.createElement('span'); b.textContent='👁'; b.title='친구에게 공개'; badges.appendChild(b); }

    card.appendChild(face); card.appendChild(badges);
    card.title = '클릭: 하트 · 우클릭: 수정 · 드래그: 순서 변경';

    card.addEventListener('click', e=>{ _ddaySpawnHearts(card, e); });
    card.addEventListener('contextmenu', e=>{ e.preventDefault(); _ddayOpenEdit(id, 'anniv'); });
    _ddayBindDrag(card, id, 'anniv');
    grid.appendChild(card);
  });

  if(!viewingUserId() && ids.length < ANNIV_MAX){   // 👀 관람: + 카드 없음
    const add = document.createElement('div');
    add.className = 'mh-dcard add';
    const plus = document.createElement('div'); plus.className='plus'; plus.textContent='+';
    add.appendChild(plus);
    add.title = '기념일 추가';
    add.onclick = ()=> _ddayOpenEdit(null, 'anniv');
    grid.appendChild(add);
  }
  _ddayApplyTiny();
}

/* 카드가 작아져서 글자가 카드 밖으로 넘칠 지경이면 .tiny를 붙여 hover 정보를 아예 숨김.
   (구분선을 위로 끌어 기념일 영역을 줄이면 카드가 작아지므로 그때마다 다시 계산) */
const DDAY_TINY_PX = 58;   // 카드 한 변이 이보다 작으면 글자를 띄우지 않음
function _ddayApplyTiny(){
  const grid = document.getElementById('mhDdayGrid');
  if(!grid) return;
  grid.querySelectorAll('.mh-dcard').forEach(card=>{
    const w = card.getBoundingClientRect().width;
    card.classList.toggle('tiny', w > 0 && w < DDAY_TINY_PX);
  });
}

/* ⏳ D-day 배너 (가로로 긴 형태, 배경 지정 없음)
   [ 제목 (날짜 작게)          D-nn   × ] */
function renderDdayBanners(){
  const wrap = document.getElementById('mhDdayBanners');
  if(!wrap) return;
  const today = _todayYMD();
  wrap.innerHTML = '';
  const state = _ddayStateNow();
  if(state !== LOAD.READY){
    wrap.appendChild(_statusEl('mh-dban-empty', state, _ddayRetry));
    return;
  }
  const ids = _ddayOrderedIds(KIND.BANNER);

  ids.forEach(id=>{
    const dd = _schedDdaySrc()[id];
    const diff = _daysBetween(today, dd.date || today);
    const lab = _ddayCountLabel(diff, _ddayBase1(dd));

    const ban = document.createElement('div');
    ban.className = 'mh-dban';
    ban.draggable = true;
    ban.dataset.id = id;

    const main = document.createElement('div'); main.className='db-main';
    const t = document.createElement('div'); t.className='db-title';
    t.textContent = dd.text || ''; t.title = dd.text || '';
    const dt = document.createElement('div'); dt.className='db-date';
    dt.textContent = _shortYMD(dd.date);   // 2026-07-24 → 26-07-24 (세로 폭을 얇게 유지)
    dt.title = dd.date || '';
    main.appendChild(t); main.appendChild(dt);

    const badges = document.createElement('div'); badges.className='db-badges';
    /* 🔔 알림 뱃지 — 그림으로 바꿨다. .dc-badges span{font-size:9px} 는 <img> 에 안 걸리므로
       크기는 uiIconEl 의 11px 이 정한다(예전 9px 글리프보다 살짝 크게 잡았다 — 그림은 여백이 있다). */
    if(dd.notify){ const b=uiIconEl('bell', 11, '알림 켜짐'); b.title='알림 켜짐'; badges.appendChild(b); }
    if(dd.public){ const b=document.createElement('span'); b.textContent='👁'; b.title='친구에게 공개'; badges.appendChild(b); }

    const cnt = document.createElement('div');
    cnt.className = 'db-cnt' + (lab.today ? ' today' : (diff < 0 ? ' past' : ''));
    cnt.textContent = lab.txt;

    const x = document.createElement('span'); x.className='db-x'; x.textContent='×'; x.title='삭제';
    x.onclick = (e)=>{ e.stopPropagation(); _ddayDelete(id); };

    ban.appendChild(main); ban.appendChild(badges); ban.appendChild(cnt); ban.appendChild(x);
    ban.title = '우클릭: 수정 · 드래그: 순서 변경';
    ban.addEventListener('contextmenu', e=>{ e.preventDefault(); _ddayOpenEdit(id, 'dday'); });
    _ddayBindDrag(ban, id, 'dday');
    wrap.appendChild(ban);
  });

  // 추가 버튼 없음 — 달력에서 날짜를 우클릭해 추가함
  if(!ids.length){
    const e = document.createElement('div');
    e.className = 'mh-dban-empty';
    e.textContent = '달력에서 날짜를 우클릭하면 D-day를 추가할 수 있어요';
    wrap.appendChild(e);
  }
}

/* 드래그 바인딩 — 같은 종류(kind)끼리만 순서 교환 */
function _ddayBindDrag(el, id, kind){
  if(viewingUserId()){ el.draggable = false; return; }   // 👀 관람: 순서 변경 불가
  el.addEventListener('dragstart', e=>{
    _ddayDragId = id; _ddayDragKind = kind;
    el.classList.add('dragging');
    try{ e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain', id); }catch(_){}
  });
  el.addEventListener('dragend', ()=>{
    _ddayDragId = null; _ddayDragKind = null;
    el.classList.remove('dragging');
    document.querySelectorAll('.dragover').forEach(x=>x.classList.remove('dragover'));
  });
  el.addEventListener('dragover', e=>{
    if(!_ddayDragId || _ddayDragId === id) return;
    if(_ddayDragKind !== kind) return;   // 기념일 ↔ 배너 간 이동은 막음
    e.preventDefault();
    el.classList.add('dragover');
  });
  el.addEventListener('dragleave', ()=>el.classList.remove('dragover'));
  el.addEventListener('drop', e=>{
    e.preventDefault();
    el.classList.remove('dragover');
    if(!_ddayDragId || _ddayDragId === id) return;
    if(_ddayDragKind !== kind) return;
    _ddayReorder(_ddayDragId, id, kind);
  });
}

/* 카드 표시 순서 — 서버가 준 순서(order), 같으면 만든 순. 저장도 같은 함수로 순서를 낸다 */
function _ddayOrderedIds(kind){
  return scheduleApi.orderedIds(_schedDdaySrc(), kind);
}

/* ═══ 🎂 내 보드 받기 · 저장 — 한 줄로 세운다 ═══
   받기와 저장이 겹치면 늦게 끝난 쪽이 최신 값을 덮을 수 있다. 그래서 둘 다 _boardChain 에 이어 붙여 한 번에 하나만 돈다 —
   저장은 돌 차례가 되었을 때의 _schedDdays(그 사이 서버가 알려 받은 값 · 먼저 끝난 저장의 결과)에서 시작한다. */
function _boardRun(fn){
  const run = _boardChain.then(fn);
  _boardChain = run.catch(()=>{});
  return run;
}
/* 받았으면(또는 받을 필요가 없어졌으면) true, 못 받았으면 false */
async function _boardFetchNow(quiet){
  const me = getMyUserId(), gen = _gen;
  if(!me) return true;
  if(!quiet || _boardState !== LOAD.READY){ _boardState = LOAD.LOADING; renderDdays(); }
  try{
    const dd = await scheduleApi.fetchBoard(me);
    if(gen !== _gen) return true;
    _schedDdays = dd; _boardState = LOAD.READY; _loadFailing = false;
  }catch(e){
    if(gen !== _gen) return true;
    if(quiet && _boardState === LOAD.READY) return false;   // 조용히 다시 받다 못 받았다 — 있던 값을 둔다
    _boardState = LOAD.ERROR; _loadFail(e);
    renderDdays();
    return false;
  }
  renderDdays();
  refreshBellBadge();
  return true;
}
function _boardLoad(quiet){ return _boardRun(()=>_boardFetchNow(quiet)); }
function _ddayRetry(){ if(viewingUserId()) loadVisit(viewingUserId()); else _boardLoad(false); }

/* 내 보드를 고쳐 저장 — mutate(복사본) 이 고친 맵을 돌려주면 보낸다(null 이면 할 일 없음). tag = { id, userCodes } 이면 그 한 장에 대해 친구에게 알린다.
   성공하면 서버가 돌려준 보드(새 장의 id · 순서)로 바꿔 그린다. true = 저장됨.
   받기 전에는 보내지 않는다. 다른 기기가 먼저 고쳤으면(409) 보내지 않은 채 서버 값을 다시 받아 그리고 알린다. */
function _boardSave(mutate, tag){
  return _boardRun(async ()=>{
    const gen = _gen, me = getMyUserId();
    if(!me || _boardState !== LOAD.READY) return false;
    const next = mutate(JSON.parse(JSON.stringify(_schedDdays)));
    if(!next) return false;
    try{
      const out = await scheduleApi.saveBoard(me, next, tag);
      if(gen !== _gen) return false;
      _schedDdays = out;
      renderDdays(); refreshBellBadge();
      return true;
    }catch(e){
      if(gen !== _gen) return false;
      if(_writeFail(e)) await _boardFetchNow(false);
      return false;
    }
  });
}
async function _ddayDelete(id){
  if(viewingUserId()) return;
  if(_boardState !== LOAD.READY){ toast(LOCK_TEXT); return; }
  const ok = await _boardSave(m=>{ if(!m[id]) return null; delete m[id]; return m; }, null);
  if(ok) toast('D-day를 삭제했어요');
}

/* 드래그로 순서 변경 — from을 to 자리에 끼워넣고 그 종류(kind) 안에서 order를 다시 매김 */
let _ddayDragId = null;
let _ddayDragKind = null;
async function _ddayReorder(fromId, toId, kind){
  if(_boardState !== LOAD.READY) return;
  const ids = _ddayOrderedIds(kind);
  const fi = ids.indexOf(fromId), ti = ids.indexOf(toId);
  if(fi < 0 || ti < 0) return;
  ids.splice(fi, 1);
  ids.splice(ti, 0, fromId);
  // 낙관적 갱신 — 서버 응답을 기다리지 않고 먼저 화면에 반영(끊김 없이 느껴지도록). 서버 값이 오면 그 값으로 바뀐다
  const before = JSON.parse(JSON.stringify(_schedDdays)), gen = _gen;   // 못 보내고 다시 받기도 못 하면 이 사본으로 되돌린다
  ids.forEach((id, i)=>{ if(_schedDdays[id]) _schedDdays[id].order = i; });
  renderDdays();
  const ok = await _boardSave(m=>{ ids.forEach((id, i)=>{ if(m[id]) m[id].order = i; }); return m; }, null);
  if(ok) return;
  const fresh = await _boardLoad(true);   // 못 보냈으면 먼저 그린 순서를 서버 것으로 되돌린다
  if(!fresh && gen === _gen && _boardState === LOAD.READY){ _schedDdays = before; renderDdays(); }   // 서버에서도 못 받았다 — 받아 둔 사본으로
}

/* 카드를 클릭하면 하트가 뿜어짐 (캐릭터 쓰다듬기와 같은 느낌) */
function _ddaySpawnHearts(card, ev){
  const rect = card.getBoundingClientRect();
  const cx = ev ? ev.clientX : rect.left + rect.width/2;
  const cy = ev ? ev.clientY : rect.top + rect.height/2;
  for(let i=0; i<5; i++){
    const h = document.createElement('div');
    h.textContent = '♥';
    const dx = (Math.random()*44 - 22);
    const dur = 700 + Math.random()*400;
    h.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;z-index:200;pointer-events:none;
      font-size:${13 + Math.random()*8}px;color:#f2607d;font-weight:bold;
      transform:translate(-50%,-50%);opacity:1;
      transition:transform ${dur}ms ease-out, opacity ${dur}ms ease-out;`;
    document.body.appendChild(h);
    // 다음 프레임에 목표 위치로 — transition이 걸리려면 초기 스타일이 한 번 적용돼야 함
    requestAnimationFrame(()=>{
      h.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% - ${50 + Math.random()*30}px)) scale(1.15)`;
      h.style.opacity = '0';
    });
    setTimeout(()=>{ try{ h.remove(); }catch(_){} }, dur + 60);
  }
}

/* D-day 편집 모달 — id가 null이면 신규 추가 */
let _ddayPrefillDate = null;   // 달력에서 우클릭해 연 경우 그 날짜(입력칸 대신 사용)
let _ddayEditId   = null;
let _ddayEditKind = 'anniv';   // 'anniv'(기념일 카드) | 'dday'(배너)
let _ddayEditImg  = null;      // dataURL(새로 고른 것) 또는 기존 URL 또는 null
let _ddayTagSel   = [];
function _ddayOpenEdit(id, kind, prefillDate){
  if(viewingUserId()) return;   // 👀 관람 모드에선 편집 불가
  const modal   = document.getElementById('mhDdayEdit');
  const titleEl = document.getElementById('mhDdayEditTitle');
  const textIn  = document.getElementById('mhDdayText');
  const dateIn  = document.getElementById('mhDdayDate');
  const colorIn = document.getElementById('mhDdayColor');
  const notifyIn= document.getElementById('mhDdayNotify');
  const pubIn   = document.getElementById('mhDdayPublic');
  const delBtn  = document.getElementById('mhDdayDelBtn');
  const imgInfo = document.getElementById('mhDdayImgInfo');
  const msgEl   = document.getElementById('mhDdayEditMsg');
  const tagInfo = document.getElementById('mhDdayTagInfo');
  if(!modal) return;
  if(_boardState !== LOAD.READY){ toast(LOCK_TEXT); return; }   // 받기 전에는 고치지 못하게 잠근다

  _ddayEditId = id;
  _ddayTagSel = [];
  const dd = id ? (_schedDdays[id] || {}) : {};
  // kind: 명시된 값 > 기존 데이터의 값 > 기념일(기본)
  _ddayEditKind = kind || (dd.kind === KIND.BANNER ? KIND.BANNER : KIND.CARD);
  _ddayEditImg = (_ddayEditKind === 'anniv') ? (dd.bgImg || null) : null;

  const isAnniv = _ddayEditKind === 'anniv';
  // ⏳ D-day 배너는 배경(색·이미지)을 지정하지 않음 — 섹션 자체를 숨김
  const bgSec = document.getElementById('mhDdayBgSection');
  if(bgSec) bgSec.style.display = isAnniv ? '' : 'none';

  if(titleEl){
    const what = isAnniv ? '기념일' : 'D-day';
    titleEl.textContent = (isAnniv ? '📌 ' : '⏳ ') + what + (id ? ' 수정' : ' 추가');
  }
  if(textIn)  textIn.value  = dd.text || '';
  // 날짜 → yyyy/mm/dd 3칸에 나눠 채움. 달력에서 우클릭으로 연 경우 prefillDate가 들어옴.
  const useDate = prefillDate || dd.date || '';
  {
    const [yy,mm,ddv] = String(useDate).split('-');
    const yIn=document.getElementById('mhDdayY'), mIn=document.getElementById('mhDdayM'), dIn=document.getElementById('mhDdayD');
    if(yIn) yIn.value = yy||''; if(mIn) mIn.value = mm||''; if(dIn) dIn.value = ddv||'';
  }
  // 달력에서 날짜를 이미 골라 들어온 경우엔 날짜 입력칸을 감추고, 고른 날짜를 문구로만 보여줌
  const dateRow = document.getElementById('mhDdayDateRow');
  const dateLbl = document.getElementById('mhDdayDateLbl');
  const datePick = document.getElementById('mhDdayDatePicked');
  const fromCalendar = !!prefillDate;
  if(dateRow) dateRow.style.display = fromCalendar ? 'none' : 'flex';
  if(dateLbl) dateLbl.style.display = fromCalendar ? 'none' : '';
  if(datePick){
    datePick.style.display = fromCalendar ? 'block' : 'none';
    datePick.textContent = fromCalendar ? ('📅 ' + prefillDate) : '';
  }
  _ddayPrefillDate = prefillDate || null;
  if(colorIn) colorIn.value = dd.bgColor || '#ffffff';
  /* 📌 「그날이 1일」 — 기념일 카드에만 보인다. 배너는 D-N 이 본체라 켜도 표시가 안 바뀐다.
     ★ 새로 만들 때는 켜진 상태로 연다. 고칠 때는 서버에 저장된 값 그대로(_ddayBase1 과 같은 값). */
  const b1Row = document.getElementById('mhDdayBase1Row');
  const b1In  = document.getElementById('mhDdayBase1');
  if(b1Row) b1Row.style.display = isAnniv ? '' : 'none';
  if(b1In)  b1In.checked = isAnniv ? (id ? dd.base1 === true : true) : false;
  _ddaySyncBase1Hint();
  if(notifyIn) notifyIn.checked = !!dd.notify;
  if(pubIn){ pubIn.disabled = false; pubIn.dataset.orig = ''; pubIn.checked = !!dd.public; }   // 이전 태그의 잠금을 푼다
  { const h = document.getElementById('mhDdayPublicHint'); if(h) h.textContent = ''; }
  if(delBtn)   delBtn.style.display = id ? '' : 'none';
  if(imgInfo)  imgInfo.textContent = _ddayEditImg ? '이미지 있음' : '';
  if(msgEl){ msgEl.style.display='none'; msgEl.textContent=''; }
  if(tagInfo) tagInfo.textContent = '';

  modal.style.display = 'block';
  if(textIn) textIn.focus();
}
/* 📌 체크박스 밑 한 줄 — 「지금 이 날짜는 무엇으로 표시되는가」를 그대로 보여 준다.
   [왜 설명 문구가 아니라 결과인가] 「오늘부터 1일」이라는 말은 과거 날짜를 넣었을 때
     실제 동작(그 날짜부터 센다)과 어긋난다. 말로 풀면 길어지고, 결과 한 줄이면 안 헷갈린다.
   ⚠️ 날짜가 아직 덜 채워졌으면 아무 말도 안 한다 — 입력 도중에 숫자가 튀면 방해가 된다. */
function _ddaySyncBase1Hint(){
  const el = document.getElementById('mhDdayBase1Hint'); if(!el) return;
  const b1In = document.getElementById('mhDdayBase1');
  if(_ddayEditKind !== 'anniv'){ el.textContent = ''; return; }
  const y = _ddayPrefillDate ? _ddayPrefillDate.slice(0,4) : (document.getElementById('mhDdayY')||{}).value;
  const m = _ddayPrefillDate ? _ddayPrefillDate.slice(5,7) : (document.getElementById('mhDdayM')||{}).value;
  const d = _ddayPrefillDate ? _ddayPrefillDate.slice(8,10) : (document.getElementById('mhDdayD')||{}).value;
  const Y = parseInt(y,10), M = parseInt(m,10), D = parseInt(d,10);
  if(!isFinite(Y) || !isFinite(M) || !isFinite(D) || String(y).length < 4){ el.textContent = ''; return; }
  const chk = new Date(Y, M-1, D);
  if(chk.getFullYear()!==Y || chk.getMonth()!==M-1 || chk.getDate()!==D){ el.textContent = ''; return; }
  const date = Y + '-' + String(M).padStart(2,'0') + '-' + String(D).padStart(2,'0');
  const diff = _daysBetween(_todayYMD(), date);
  const lab = _ddayCountLabel(diff, !!(b1In && b1In.checked));
  el.textContent = '오늘은 «' + lab.txt + '»로 표시돼요';
}
function _ddayCloseEdit(){
  const modal = document.getElementById('mhDdayEdit');
  if(modal) modal.style.display = 'none';
  _ddayEditId = null; _ddayEditKind = 'anniv'; _ddayEditImg = null; _ddayTagSel = []; _ddayPrefillDate = null;
}

/* ⌛ 구분선 드래그 — 기념일 영역과 D-day 영역의 높이 비율 조절.
   기념일 영역 높이를 직접 정하고, D-day는 나머지를 flex:1로 채움.
   저장은 localStorage(개인 취향이므로 서버까지 갈 필요 없음). */
const ANNIV_H_KEY = 'tw.annivAreaH';
const ANNIV_H_MIN = 48;    // 최소 — 6열 기준 카드 한 줄(+ 추가 카드)이 항상 보이는 높이
function _applyAnnivHeight(px){
  const area = document.getElementById('mhAnnivArea');
  const panel = document.getElementById('mhSchedDday');
  if(!area || !panel) return;
  const panelH = panel.clientHeight;
  const maxH = Math.max(ANNIV_H_MIN, panelH - 90);   // D-day 영역 최소 공간 확보
  const h = Math.max(ANNIV_H_MIN, Math.min(px, maxH));
  area.style.height = h + 'px';
  area.style.flex = '0 0 auto';
  // 높이가 바뀌면 열 수부터 다시 계산(카드가 실제로 작아지도록) — 렌더가 tiny 판정까지 해줌
  renderAnnivCards();
  return h;
}
(function bindSchedSplit(){
  const split = document.getElementById('mhSchedSplit');
  const area  = document.getElementById('mhAnnivArea');
  if(!split || !area) return;

  // 저장해둔 높이 복원
  try{
    const saved = parseInt(localStorage.getItem(ANNIV_H_KEY), 10);
    if(isFinite(saved) && saved > 0){
      // 패널이 아직 레이아웃되지 않았을 수 있어 다음 프레임에 적용
      requestAnimationFrame(()=>_applyAnnivHeight(saved));
    }
  }catch(e){}

  let dragging = false, startY = 0, startH = 0;
  split.addEventListener('mousedown', e=>{
    e.preventDefault();
    dragging = true;
    startY = e.clientY;
    startH = area.getBoundingClientRect().height;
    split.classList.add('dragging');
    document.body.style.cursor = 'ns-resize';
  });
  window.addEventListener('mousemove', e=>{
    if(!dragging) return;
    _applyAnnivHeight(startH + (e.clientY - startY));
  });
  window.addEventListener('mouseup', ()=>{
    if(!dragging) return;
    dragging = false;
    split.classList.remove('dragging');
    document.body.style.cursor = '';
    const h = area.getBoundingClientRect().height;
    try{ localStorage.setItem(ANNIV_H_KEY, String(Math.round(h))); }catch(e){}
  });

  // 마이홈 창 크기가 바뀌면 tiny 재판정
  window.addEventListener('resize', ()=>{ _ddayApplyTiny(); });
})();

(function bindScheduler(){
  const prevBtn  = document.getElementById('mhSchedPrev');
  const nextBtn  = document.getElementById('mhSchedNext');
  const todayBtn = document.getElementById('mhSchedToday');
  const addBtn   = document.getElementById('mhSchedAddBtn');
  const input    = document.getElementById('mhSchedInput');
  const pubChk   = document.getElementById('mhSchedPublic');
  const tagBtn   = document.getElementById('mhSchedTagBtn');
  const tagInfo  = document.getElementById('mhSchedTagInfo');
  const tagPop   = document.getElementById('mhSchedTagPop');
  const tagList  = document.getElementById('mhSchedTagList');
  const tagOk    = document.getElementById('mhSchedTagOk');
  const tagCancel= document.getElementById('mhSchedTagCancel');

  const shiftMonth = (delta)=>{
    if(!_schedYM) return;
    let [y,m] = _schedYM.split('-').map(Number);
    m += delta;
    if(m < 1){ m = 12; y--; } else if(m > 12){ m = 1; y++; }
    _schedYM = _ymOf(y,m);
    _schedSelDD = null;
    _schedMonthData = {};
    loadMonth();
    renderSchedCalendar();
  };
  if(prevBtn) prevBtn.addEventListener('click', ()=>shiftMonth(-1));
  if(nextBtn) nextBtn.addEventListener('click', ()=>shiftMonth(1));
  if(todayBtn) todayBtn.addEventListener('click', ()=>{
    const t=_todayParts();
    _schedYM = _ymOf(t.y, t.m); _schedSelDD = _pad2(t.d);
    _schedMonthData = {};
    loadMonth();
    renderSchedCalendar();
  });

  const refreshTagInfo = ()=>{
    _syncPublicLock(pubChk, document.getElementById('mhSchedPublicHint'), _schedTagSel.length);
    if(!tagInfo) return;
    tagInfo.textContent = _schedTagSel.length ? `👥 ${_schedTagSel.length}명 태그됨` : '';
  };

  // 👥 친구 태그 팝업
  if(tagBtn && tagPop && tagList){
    tagBtn.addEventListener('click', ()=>{
      _schedTagTarget = 'sched';
      const fids = Object.keys(myHomeFriends()||{});
      tagList.innerHTML = '';
      if(!fids.length){
        const e=document.createElement('div'); e.style.cssText='font-size:10px;color:#aaa;padding:6px;';
        e.textContent='친구가 없어요';
        tagList.appendChild(e);
      } else {
        fids.forEach(fid=>{
          const lbl = document.createElement('label');
          const cb = document.createElement('input'); cb.type='checkbox'; cb.value=fid;
          cb.checked = _schedTagSel.includes(fid);
          const nm = document.createElement('span');
          nm.textContent = (myHomeFriends()[fid]||{}).name || '(이름 없음)';
          lbl.appendChild(cb); lbl.appendChild(nm);
          tagList.appendChild(lbl);
        });
      }
      tagPop.style.display = 'block';
    });
    if(tagOk) tagOk.addEventListener('click', ()=>{
      const picked = Array.from(tagList.querySelectorAll('input:checked')).map(c=>c.value);
      tagPop.style.display = 'none';
      if(_schedTagTarget === 'dday'){
        // 📌 D-day 편집 모달에서 연 경우
        _ddayTagSel = picked;
        const ddTagInfo2 = document.getElementById('mhDdayTagInfo');
        if(ddTagInfo2) ddTagInfo2.textContent = picked.length ? `👥 ${picked.length}명` : '';
        _syncPublicLock(document.getElementById('mhDdayPublic'), document.getElementById('mhDdayPublicHint'), picked.length);
        return;
      }
      // 📅 일정에서 연 경우
      _schedTagSel = picked;
      refreshTagInfo();
    });
    if(tagCancel) tagCancel.addEventListener('click', ()=>{ tagPop.style.display='none'; });
  }

  // 일정 추가 — 서버에 쓰고, 서버가 돌려준 일정을 달력에 얹는다. 친구를 태그했으면 같은 요청이 알림까지 보낸다(일정만 되고 알림만 빠지는 일이 없다)
  const doAddSched = async ()=>{
    if(viewingUserId() || _schedAdding) return;
    if(!_schedSelDD){ toast('날짜를 먼저 선택해 주세요'); return; }
    const text = (input ? input.value : '').trim();
    if(!text) return;
    if(_monthState !== LOAD.READY){ toast(LOCK_TEXT); return; }   // 받기 전에는 고치지 못하게 잠근다
    const isPublic = !!(pubChk && pubChk.checked);
    const date = `${_schedYM}-${_schedSelDD}`, tags = _schedTagSel.slice(), gen = _gen;
    _schedAdding = true;
    let item;
    try{
      item = await scheduleApi.createItem(getMyUserId(), { date, text, public: isPublic, tagFriends: tags });
    }catch(e){
      _schedAdding = false;
      if(gen === _gen) _writeFail(e);   // 입력칸 · 태그는 그대로 둔다 — 다시 누르면 된다
      return;
    }
    _schedAdding = false;
    if(gen !== _gen) return;
    _schedPutItem(item);
    toast(tags.length ? `일정을 추가하고 친구 ${tags.length}명에게 알렸어요` : '일정을 추가했어요');
    if(input && input.value.trim() === text) input.value = '';
    _schedTagSel = []; refreshTagInfo();
  };
  if(addBtn) addBtn.addEventListener('click', doAddSched);
  if(input) input.addEventListener('keydown', e=>{ if(e.key==='Enter') doAddSched(); });

  // ── 📌 D-day 편집 모달 ──
  const ddText   = document.getElementById('mhDdayText');
  const ddY      = document.getElementById('mhDdayY');
  const ddM      = document.getElementById('mhDdayM');
  const ddD      = document.getElementById('mhDdayD');
  const ddColor  = document.getElementById('mhDdayColor');
  const ddBase1  = document.getElementById('mhDdayBase1');
  const ddNotify = document.getElementById('mhDdayNotify');
  const ddPub    = document.getElementById('mhDdayPublic');
  const ddImgBtn = document.getElementById('mhDdayImgBtn');
  const ddImgClr = document.getElementById('mhDdayImgClear');
  const ddImgInfo= document.getElementById('mhDdayImgInfo');
  const ddSave   = document.getElementById('mhDdaySaveBtn');
  const ddDel    = document.getElementById('mhDdayDelBtn');
  const ddCancel = document.getElementById('mhDdayCancelBtn');
  const ddTagBtn = document.getElementById('mhDdayTagBtn');
  const ddTagInfo= document.getElementById('mhDdayTagInfo');
  const ddMsg    = document.getElementById('mhDdayEditMsg');

  // 날짜 칸: 숫자만 입력 가능, 자릿수를 다 채우면 다음 칸으로 자동 이동
  [[ddY,ddM,4],[ddM,ddD,2],[ddD,null,2]].forEach(([inp,next,len])=>{
    if(!inp) return;
    inp.addEventListener('input', ()=>{
      inp.value = inp.value.replace(/[^0-9]/g,'');
      if(next && inp.value.length >= len) next.focus();
      _ddaySyncBase1Hint();      // 📌 날짜를 다 치는 순간 «오늘은 100일» 이 바로 뜬다
    });
  });
  if(ddBase1) ddBase1.addEventListener('change', _ddaySyncBase1Hint);

  const ddShowMsg = (text, isErr)=>{
    if(!ddMsg) return;
    ddMsg.textContent = text;
    ddMsg.style.color = isErr ? 'var(--win-error)' : 'var(--ink-soft)';
    ddMsg.style.display = text ? 'block' : 'none';
  };

  // 📁 카드 배경 이미지 — 150×150으로 리사이즈해서 저장(카드가 작으니 이 정도면 충분)
  if(ddImgBtn){
    ddImgBtn.addEventListener('click', ()=>{
      const fi = document.createElement('input');
      fi.type='file'; fi.accept='image/*';
      fi.onchange = ()=>{
        const file = fi.files && fi.files[0]; if(!file) return;
        const reader = new FileReader();
        reader.onload = e=>{
          const img = new Image();
          img.onload = ()=>{
            const MAX = DDAY_CARD_IMG_MAX;
            // 카드가 정사각형이므로 짧은 변 기준으로 꽉 채우고 중앙을 잘라냄(cover)
            const side = Math.min(img.width, img.height);
            const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
            const c = document.createElement('canvas');
            c.width = MAX; c.height = MAX;
            c.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, MAX, MAX);
            _ddayEditImg = c.toDataURL('image/jpeg', 0.85);
            if(ddImgInfo) ddImgInfo.textContent = `이미지 선택됨 (${MAX}×${MAX})`;
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      };
      fi.click();
    });
  }
  if(ddImgClr){
    ddImgClr.addEventListener('click', ()=>{
      _ddayEditImg = null;
      if(ddImgInfo) ddImgInfo.textContent = '';
    });
  }

  // 👥 D-day에도 친구 태그 — 저장 시 그 친구들 알림함에 기록
  if(ddTagBtn && tagPop && tagList){
    ddTagBtn.addEventListener('click', ()=>{
      _schedTagTarget = 'dday';
      const fids = Object.keys(myHomeFriends()||{});
      tagList.innerHTML = '';
      if(!fids.length){
        const e=document.createElement('div'); e.style.cssText='font-size:10px;color:#aaa;padding:6px;';
        e.textContent='친구가 없어요';
        tagList.appendChild(e);
      } else {
        fids.forEach(fid=>{
          const lbl = document.createElement('label');
          const cb = document.createElement('input'); cb.type='checkbox'; cb.value=fid;
          cb.checked = _ddayTagSel.includes(fid);
          const nm = document.createElement('span');
          nm.textContent = (myHomeFriends()[fid]||{}).name || '(이름 없음)';
          lbl.appendChild(cb); lbl.appendChild(nm);
          tagList.appendChild(lbl);
        });
      }
      tagPop.style.display = 'block';
    });
  }

  if(ddCancel) ddCancel.addEventListener('click', _ddayCloseEdit);

  if(ddSave){
    ddSave.addEventListener('click', async ()=>{
      const text = (ddText ? ddText.value : '').trim();
      // yyyy/mm/dd 3칸 → 'YYYY-MM-DD'. 실제 존재하는 날짜인지까지 확인(2월 30일 등 차단)
      // 달력 우클릭으로 연 경우 날짜는 이미 확정 — 입력칸 대신 그 값을 씀
      const y = _ddayPrefillDate ? parseInt(_ddayPrefillDate.slice(0,4),10)  : parseInt((ddY?ddY.value:'').trim(), 10);
      const m = _ddayPrefillDate ? parseInt(_ddayPrefillDate.slice(5,7),10)  : parseInt((ddM?ddM.value:'').trim(), 10);
      const d = _ddayPrefillDate ? parseInt(_ddayPrefillDate.slice(8,10),10) : parseInt((ddD?ddD.value:'').trim(), 10);
      if(!text){ ddShowMsg('이름을 입력해 주세요', true); return; }
      if(!isFinite(y) || !isFinite(m) || !isFinite(d) || y < 1900 || y > 2200){
        ddShowMsg('날짜를 숫자로 입력해 주세요 (yyyy mm dd)', true); return;
      }
      const chk = new Date(y, m-1, d);
      if(chk.getFullYear()!==y || chk.getMonth()!==m-1 || chk.getDate()!==d){
        ddShowMsg('존재하지 않는 날짜예요', true); return;
      }
      const date = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isAnnivSave = _ddayEditKind === 'anniv';
      const limit = isAnnivSave ? ANNIV_MAX : DDAY_MAX;
      if(!_ddayEditId && _ddayOrderedIds(_ddayEditKind).length >= limit){
        ddShowMsg(`${isAnnivSave?'기념일':'D-day'}는 최대 ${limit}개까지만 등록할 수 있어요`, true); return;
      }
      if(_boardState !== LOAD.READY){ ddShowMsg(_boardState === LOAD.ERROR ? LOAD_TEXT.error : LOCK_TEXT, true); return; }   // 받기 전에는 고치지 못하게 잠근다
      ddSave.disabled = true; ddShowMsg('저장 중…', false);
      const editId = _ddayEditId, kind = _ddayEditKind, tagSel = _ddayTagSel.slice();
      const key = editId || ('new-' + Date.now().toString(36));   // 새 장의 임시 열쇠 — 서버가 진짜 id 를 정해 돌려준다
      const dd = {
        kind,
        text, date,
        public: !!(ddPub && ddPub.checked),
        notify: !!(ddNotify && ddNotify.checked),
        /* 📌 셈법 · 배경은 기념일 카드에만 — 배너는 늘 꺼진 값 · 없는 값으로 보낸다 */
        base1: isAnnivSave ? !!(ddBase1 && ddBase1.checked) : false,
        bgColor: (isAnnivSave && ddColor && ddColor.value !== '#ffffff') ? ddColor.value : null,
        bgImg: isAnnivSave ? _ddayEditImg : null,
      };
      let gone = false;
      const ok = await _boardSave(m=>{
        if(editId && !m[editId]){ gone = true; return null; }   // 다른 기기에서 이미 지웠다
        const prev = editId ? m[editId] : null;
        const order = prev ? prev.order : scheduleApi.orderedIds(m, kind).length;
        m[key] = Object.assign({}, dd, { order, ts: prev ? prev.ts : Date.now() });
        return m;
      }, tagSel.length ? { id: key, userCodes: tagSel } : null);
      ddSave.disabled = false;
      if(ok){
        const what2 = isAnnivSave ? '기념일' : 'D-day';
        toast(tagSel.length ? `D-day를 저장하고 친구 ${tagSel.length}명에게 알렸어요` : (editId ? `${what2}을 수정했어요` : `${what2}을 추가했어요`));
        _ddayCloseEdit();
      }else{
        /* 말없이 끝나지 않게 — 받기 상태(받는 중 · 못 받음)이면 그 문구를, 아니면(실패 알림은 이미 떴다) 비운다 */
        const waiting = _boardState !== LOAD.READY;
        ddShowMsg(gone ? '이미 지워진 항목이에요' : (waiting ? (_boardState === LOAD.ERROR ? LOAD_TEXT.error : LOAD_TEXT.loading) : ''), gone || waiting);
      }
    });
  }

  if(ddDel){
    ddDel.addEventListener('click', async ()=>{
      if(!_ddayEditId) return;
      await _ddayDelete(_ddayEditId);
      if(_boardState === LOAD.READY && !_schedDdays[_ddayEditId]) _ddayCloseEdit();
    });
  }
})();


/* ═══════════════════════ 🔔 일정 알림 ═══════════════════════
   내용: (1) 오늘 날짜인 내 일정  (2) 친구가 나를 태그해서 보낸 일정 알림(서버 알림함의 🔔 칸)
   당일에만 뜸. 창은 바깥을 눌러도 닫히지 않고 ✕ 로만 닫음(포커싱 기록창과 같은 방식).
   읽음 처리: 창을 한 번 열면 그때까지의 알림은 "본 것"으로 간주해 뱃지가 사라짐. */
const BELL_SEEN_KEY = deps.bellSeenKey;   // 'tw.bellSeenTs' — 값은 app.js 에 있다(계정 전환 지움 목록 ACCOUNT_LOCAL_KEYS 가 같이 쓴다)
let _bellNotices = {};        // 친구가 태그해서 온 알림 { id: {fromId, fromName, text, date, ts} } — 서버 알림함의 🔔 칸
let _bellTodayItems = [];     // 오늘 날짜인 내 일정 [{id, text, ts(만든 시각)}]

function _bellSeenTs(){ try{ return Number(localStorage.getItem(BELL_SEEN_KEY)||0) || 0; }catch(e){ return 0; } }
function _bellMarkSeen(){ try{ localStorage.setItem(BELL_SEEN_KEY, String(Date.now())); }catch(e){} refreshBellBadge(); }

/* 오늘 날짜인 내 일정을 따로 받는다 — 스케줄러 탭을 안 열어도 알림이 떠야 하므로 달력과 별도로 이번 달을 받아 오늘 것만 고른다 */
async function _bellLoadToday(){
  const me = getMyUserId(), gen = _gen;
  if(!me) return;   // 내 코드가 없으면 오늘 일정을 받지 않는다
  const t = _todayParts();
  try{
    const data = await scheduleApi.fetchMonth(me, _ymOf(t.y, t.m));
    if(gen !== _gen) return;
    const dayObj = data[_pad2(t.d)] || {};
    _bellTodayItems = Object.keys(dayObj).map(id=>({ id, text: dayObj[id].text||'', ts: dayObj[id].ts }));
    _loadFailing = false;
  }catch(e){
    if(gen !== _gen) return;
    _loadFail(e);   // 있던 목록은 둔다
  }
  refreshBellBadge();
  if(_bellWinOpen()) renderBellList();
}

/* 친구가 일정에 태그한 알림 받기. 새로 들어온 것만 토스트(앱을 켤 때 기존 알림이 우르르 뜨지 않게 «마지막으로 연 시각» 이후 것만) */
async function _bellLoadNotices(){
  const me = getMyUserId(), gen = _gen;
  if(!me) return;   // 내 코드가 없으면 태그 알림을 받지 않는다
  let notices;
  try{ notices = await scheduleApi.fetchBell(me); }
  catch(e){ if(gen === _gen) _loadFail(e); return; }
  if(gen !== _gen) return;
  _loadFailing = false;
  const prevIds = Object.keys(_bellNotices||{});
  _bellNotices = notices;
  refreshBellBadge();
  if(_bellWinOpen()) renderBellList();
  const seen = _bellSeenTs();
  Object.keys(_bellNotices).forEach(id=>{
    const n = _bellNotices[id];
    if(!prevIds.includes(id) && (n.ts||0) > seen){
      toast('🔔 ' + (n.fromName||'친구') + ' 님이 일정에 태그했어요');
    }
  });
}
async function _bellRemoveNotice(id){
  const gen = _gen;
  try{ await scheduleApi.deleteBell(getMyUserId(), id); }
  catch(e){ if(gen === _gen) _writeFail(e); return; }
  if(gen !== _gen) return;
  delete _bellNotices[id];
  refreshBellBadge();
  if(_bellWinOpen()) renderBellList();
}

function _bellWinOpen(){
  const w = document.getElementById('bellWin');
  return !!(w && w.style.display !== 'none');
}

/* 알림 개수 = 오늘 내 일정 + 친구 태그 알림. 뱃지는 "마지막으로 창을 연 시각 이후" 것만 셈. */
function refreshBellBadge(){
  const badge = document.getElementById('myBellBadge');
  if(!badge) return;
  const seen = _bellSeenTs();
  const newNotices = Object.keys(_bellNotices||{}).filter(id => (_bellNotices[id].ts||0) > seen).length;
  const todayYMD = _todayYMD();
  const seenDay = seen ? _localYMD(seen) : '';   // ⚠️ toISOString 은 UTC 라 한국 0~9시엔 어제로 읽혀 «오늘 본 기념일» 을 다시 셌다
  const newToday   = _bellTodayItems.filter(it => (it.ts||0) > seen).length;
  /* 오늘이 이정표(당일/50일/100일 단위)인 D-day 는 ts 비교가 아니라 «오늘 해당하는가» 로 판정한다 — 창을 열어 읽음 처리하면 그날은 다시 안 센다. */
  const ddayHits = (seenDay === todayYMD) ? 0 : Object.keys(_schedDdays||{}).filter(id=>{
    const dd = _schedDdays[id];
    if(!dd.notify || !dd.date) return false;
    /* ⚠️ 카드와 **같은 셈**을 써야 한다. 예전엔 여기만 날것(today − 날짜)이라,
       「그날이 1일」을 켠 기념일은 카드가 100일을 띄운 다음 날에야 알림이 왔다. */
    return _ddayMilestoneDays(_daysBetween(dd.date, todayYMD), _ddayShownDays(dd, todayYMD));
  }).length;
  const inboxNew = _inboxUnreadCount();   // 📩 수령함 안 읽은 공지/업데이트
  const n = newNotices + newToday + ddayHits + inboxNew;
  badge.textContent = n > 9 ? '9+' : String(n);
  badge.classList.toggle('on', n > 0);
  _refreshFriendTabBadge();   // 🎁 친구 탭 보상 배지도 함께 갱신
}

/* 지난 기념일 이정표 알림 — 당일, 50일, 그리고 100일 단위(100/200/300…)에만 뜸.
   raw   = 기념일 날짜로부터 오늘까지 지난 «날 수». 0 이 곧 당일이고, 음수면 아직 안 온 날이다.
   shown = 화면에 나올 숫자. 「그날이 1일」이면 raw+1 이다.
   ★ 당일은 raw 로, 이정표는 shown 으로 본다.
     [왜 둘을 나누나] 셈법을 켜면 당일의 shown 이 1 이라 «0일» 이 영영 안 온다 —
       raw 로 안 보면 **당일 알림이 통째로 사라진다.** 반대로 50·100 을 raw 로 보면
       카드가 100일을 띄운 날이 아니라 그 다음 날에 알림이 온다. 그래서 각각 맞는 쪽을 본다. */
function _ddayMilestoneDays(raw, shown){
  if(raw < 0) return false;
  if(raw === 0) return true;           // 당일
  if(shown === 50) return true;        // 50일
  return shown % 100 === 0;            // 100일 단위
}
function renderBellList(){
  const list = document.getElementById('bellList');
  if(!list) return;
  list.innerHTML = '';
  const today = _todayYMD();

  // 1) 오늘 내 일정
  _bellTodayItems.forEach(it=>{
    const row = document.createElement('div'); row.className = 'bell-row today';
    const main = document.createElement('div'); main.className='bmain';
    const t = document.createElement('div'); t.className='btitle'; t.textContent = it.text; t.title = it.text;
    main.appendChild(t);
    const meta = document.createElement('div'); meta.className='bmeta'; meta.textContent = 'D-DAY';
    row.appendChild(main); row.appendChild(meta);
    list.appendChild(row);
  });

  // 2) 알림 켠 D-day — 당일이거나, 지난 기념일의 이정표(50일 / 100일 단위)에 해당하는 날
  const today2 = _todayYMD();
  Object.keys(_schedDdays||{}).forEach(id=>{
    const dd = _schedDdays[id];
    if(!dd.notify || !dd.date) return;
    const raw   = _daysBetween(dd.date, today2);    // 0 = 당일, 음수면 아직 안 온 날
    const shown = _ddayShownDays(dd, today2);       // 카드에 나오는 바로 그 숫자
    if(!_ddayMilestoneDays(raw, shown)) return;

    /* 문구: 당일이면 "[이름] D-day!", 지났으면 "[이름] 100일째 되는 날!"
       ⚠️ 「그날이 1일」인 기념일은 당일이 곧 1일이다 — 그때 D-day 라고 쓰면 카드(1일)와 어긋난다. */
    const asDday = (raw === 0) && !_ddayBase1(dd);
    const msg   = asDday ? `${dd.text||''} D-day!` : `${dd.text||''} ${shown}일째 되는 날!`;
    const label = asDday ? 'D-day' : `${shown}일`;

    const row = document.createElement('div'); row.className = 'bell-row today';
    const main = document.createElement('div'); main.className='bmain';
    const t = document.createElement('div'); t.className='btitle';
    t.textContent = msg; t.title = msg;
    const f = document.createElement('div'); f.className='bfrom'; f.textContent = '📌 D-day';
    main.appendChild(t); main.appendChild(f);
    const meta = document.createElement('div'); meta.className='bmeta'; meta.textContent = label;
    row.appendChild(main); row.appendChild(meta);
    list.appendChild(row);
  });

  // 3) 친구가 태그한 일정 — 오늘 것만(당일 알림), 지난 건 자동으로 정리
  const nids = Object.keys(_bellNotices||{})
    .filter(id => (_bellNotices[id].date||'') === today)
    .sort((a,b)=> (_bellNotices[b].ts||0) - (_bellNotices[a].ts||0));
  nids.forEach(id=>{
    const n = _bellNotices[id];
    const row = document.createElement('div'); row.className = 'bell-row today';
    const main = document.createElement('div'); main.className='bmain';
    const t = document.createElement('div'); t.className='btitle'; t.textContent = n.text||''; t.title = n.text||'';
    const f = document.createElement('div'); f.className='bfrom'; f.textContent = (n.fromName||'친구') + ' 님이 태그함';
    main.appendChild(t); main.appendChild(f);
    const meta = document.createElement('div'); meta.className='bmeta'; meta.textContent = 'D-DAY';
    const x = document.createElement('span'); x.className='bx'; x.textContent='×'; x.title='알림 지우기';
    x.onclick = ()=>{ _bellRemoveNotice(id); };
    row.appendChild(main); row.appendChild(meta); row.appendChild(x);
    list.appendChild(row);
  });

  if(!list.children.length){
    const e = document.createElement('div');
    e.className = 'bell-empty';
    e.textContent = '오늘 예정된 일정이 없어요';
    list.appendChild(e);
  }

  // 📩 알림함 확인 버튼 — 일정 아래 구분선 + [알림함 확인] (안 읽은 게 있으면 NEW 뱃지)
  const inboxNew = _inboxUnreadCount();
  const hr = document.createElement('div'); hr.className = 'bell-inbox-sep'; list.appendChild(hr);
  const btn = document.createElement('div'); btn.className = 'bell-inbox-btn';
  btn.innerHTML = '📪 알림함 확인' + (inboxNew > 0 ? ' <span class="bell-inbox-new">NEW '+Number(inboxNew)+'</span>' : '');
  btn.onclick = ()=>{
    window._closeBellWin();   // closeBell 은 창을 만드는 함수 안의 이름이라 여기서는 안 보인다 — 그 함수가 거는 고리로 닫는다
    // 마이홈 열고 → 우편함 탭(수령함)으로 이동
    twNav.go(twNav.NAV.MY_HOME);
    /* ⚠️ 예전엔 친구 탭을 눌렀다 — 수령함이 그 탭 오른쪽 칸에 얹혀 있었기 때문이다.
       수령함이 독립 탭으로 나갔으므로 여기도 같이 옮긴다. 안 옮기면 알림을 눌러도
       친구 목록만 뜨고 정작 읽으려던 공지가 안 보인다. */
    setTimeout(()=>{
      const mailTab = document.querySelector('.mh-tab[data-tab="mail"]');
      if(mailTab) mailTab.click();   // 탭에 들어오면 안 읽은 우편이 있는 칸부터 보인다(inbox-sections.js firstSec)
      // 소식 종류는 «전체» 로 — 그 실행에서 «업데이트» 를 골라 뒀으면 새 공지가 목록에 안 보인다
      const allTab = document.querySelector('#mhInboxTabs .mh-ibx-tab[data-tag="all"]');
      if(allTab) allTab.click();
    }, 320);
  };
  list.appendChild(btn);
}

(function bindBell(){
  const btn   = document.getElementById('myBellBtn');
  const win   = document.getElementById('bellWin');
  const close = document.getElementById('bellClose');
  if(!btn || !win) return;

  /* 🔔 창을 옮겨둔 자리 기억 — 없으면(null) 기존처럼 캐릭터 발 밑에 배치.
     플레이리스트(#myPlaylistBox)와 같은 방식이라 동작이 일관된다. */
  const BELL_POS_KEY = 'tw.bellWinPos';
  let _bellPos = null;
  try{ const raw = localStorage.getItem(BELL_POS_KEY); if(raw) _bellPos = JSON.parse(raw); }catch(_){}
  /* 🪟 창 위치 초기화 버튼이 부른다(가챠·플레이리스트와 같은 이유). */
  (window.__winPosResetters = window.__winPosResetters || []).push(()=>{ _bellPos = null; });
  function _bellSavePos(){
    try{
      if(_bellPos) localStorage.setItem(BELL_POS_KEY, JSON.stringify(_bellPos));
      else localStorage.removeItem(BELL_POS_KEY);
    }catch(_){}
  }
  function _bellApplyPos(){
    if(!_bellPos) return false;
    // 해상도가 바뀌었거나 저장값이 이상하면 화면 안으로 되돌린다(창이 밖에 숨어 안 보이는 사고 방지).
    const w = win.offsetWidth || 280, h = win.offsetHeight || 120;
    let x = _bellPos.x, y = _bellPos.y;
    if(!isFinite(x) || !isFinite(y)) return false;
    x = Math.max(8, Math.min(x, innerWidth  - w - 8));
    y = Math.max(8, Math.min(y, innerHeight - h - 8));
    win.style.left = x + 'px'; win.style.top = y + 'px';
    win.style.right = 'auto'; win.style.bottom = 'auto';
    return true;
  }

  const openBell = ()=>{
    _closeChipPopups('bellWin');   // 다른 칩 팝업은 닫음
    renderBellList();
    /* ★ 첫 클릭 때 창이 좌측 상단 구석에 나타나던 원인 —
       _closeChipPopups는 모든 칩 팝업에 .hidden을 붙인다(🔔도 포함). 다른 팝업을 한 번이라도 열면
       bellWin에 .hidden이 남는데, 이 창은 display로만 여닫으므로 그 클래스를 아무도 떼지 않았다.
       그 상태로 열면 _positionInputBelowChar가 맨 앞의 hidden 가드에 걸려 그냥 빠져나가고,
       left/top이 한 번도 안 정해진 채 position:fixed 기본값(0,0)에 붙어버렸다.
       닫을 때 classList.remove('hidden')을 하니 두 번째부터는 정상이었던 것.
       → 위치를 잡기 전에 여기서 확실히 떼어낸다. */
    win.classList.remove('hidden');
    win.style.display = 'block';
    btn.classList.add('on');
    // 옮겨둔 자리가 있으면 그 자리, 없으면 캐릭터 발 밑에 배치 (채팅/커스텀 상태 입력창과 같은 방식)
    if(!_bellApplyPos()){
      _positionInputBelowChar(win);
    }
    _bellMarkSeen();   // 열었으니 읽음 처리 → 뱃지 사라짐
  };
  const closeBell = ()=>{
    win.style.display = 'none';
    win.classList.remove('hidden');   // _closeChipPopups가 붙였을 수 있는 클래스 정리(이 창은 display로만 제어)
    btn.classList.remove('on');
  };
  /* ⎋ ESC 스택 — 이 창도 여태 ESC 로 닫히지 않았다.
     ⚠️ 열림 판정이 **style.display** 다(위 openBell 주석 참고 — 이 창만 클래스가 아니라 display 로
       여닫는다). _closeChipPopups 가 .hidden 을 붙이는 경우까지 있어 둘을 함께 본다.
       그래서 관찰 대상 속성에 'style' 이 들어 있어야 한다(escRegisterWindow 가 이미 그렇게 본다). */
  escRegisterWindow({
    key:'bell', el:win,
    isOpen:()=>win.style.display !== 'none' && !win.classList.contains('hidden'),
    close:closeBell,
  });
  window._closeBellWin = closeBell;   // _closeChipPopups에서 호출

  /* 타이틀바 드래그 — 이동/놓기 리스너는 document에 단다(창을 다시 그려도 안 끊긴다).
     ✕ 위에서 시작한 것은 닫기이므로 드래그로 삼지 않는다. */
  const head = document.getElementById('bellTitle');
  if(head){
    head.addEventListener('pointerdown', e=>{
      if(e.button !== 0) return;
      if(e.target && e.target.closest && e.target.closest('.mh-x')) return;
      e.preventDefault();
      const r = win.getBoundingClientRect();
      const gx = e.clientX - r.left, gy = e.clientY - r.top;   // 잡은 지점 유지 — 창이 커서로 튀지 않게
      const x0 = e.clientX, y0 = e.clientY;
      let moved = false;
      const onMove = ev=>{
        if(!moved && Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 3) return;
        moved = true;
        _bellPos = { x: ev.clientX - gx, y: ev.clientY - gy };
        _bellApplyPos();
      };
      const onUp = ()=>{
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
        if(moved) _bellSavePos();
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    });
    // 타이틀바 더블클릭 = 옮긴 자리를 버리고 캐릭터 발 밑으로 복귀
    head.addEventListener('dblclick', e=>{
      if(e.target && e.target.closest && e.target.closest('.mh-x')) return;
      _bellPos = null; _bellSavePos();
      _positionInputBelowChar(win);
    });
  }

  btn.addEventListener('click', e=>{
    e.stopPropagation();
    if(_bellWinOpen()) closeBell(); else openBell();
  });
  if(close) close.addEventListener('click', e=>{
    e.stopPropagation();   // 안 막으면 상위로 퍼져서 다시 열리는 것처럼 보임
    closeBell();
  });
  // ★ 바깥 클릭으로는 닫히지 않음 (포커싱 기록창과 동일) — document 클릭 핸들러를 일부러 두지 않음.

})();

/* 🚀 계정 확인 뒤 한 번(launcher/app-boot.js) — 오늘 일정 · 알림 받기 · 서버 신호 걸기 · 자정 넘김 확인 */
function startSchedule(){
  // 오늘 일정 · 친구 태그 알림 받기 — 네트워크가 준비되면 한 번
  const sub = ()=>{
    if(!getMyUserId()) return;   // 내 코드가 없으면 받지 않는다
    _bellLoadNotices();
    _bellLoadToday();
  };
  TwNetReady.whenNetReady(sub);

  /* 서버가 «내 일정 · 보드가 바뀌었다»(다른 기기에서 고침) · «알림이 왔다» 고 알리면 다시 받는다. 오래 끊겼다 붙을 때(resync)도 같다.
     알림은 데이터 없이 «바뀌었다» 만 온다 — 값은 우리가 다시 받는다. 관람 중이면 달력은 친구 것이라 건드리지 않는다. */
  rtOn('schedule', ()=>{
    if(!getMyUserId()) return;
    _boardLoad(true);
    if(!viewingUserId() && _schedYM) loadMonth(true);
    _bellLoadToday();
  });
  /* 구경 중인 친구의 일정이 바뀌었다는 알림(내용 없음) — 지금 보는 친구일 때만 달력 · 보드를 다시 받는다.
     오래 끊겼다 붙을 때(resync)는 알림에 친구가 없다 — 지금 구경 중인 친구(없으면 요청 0)를 한 번 다시 받는다 */
  rtOn('friendSchedule', (n)=>{
    if(!getMyUserId() || !n) return;
    const friend = n.resync ? _visitFriend : n.subject;
    if(!friend) return;
    refreshVisit(friend);
  });
  rtOn('notification', (n)=>{
    if(!getMyUserId()) return;
    if(n && (n.resync || n.section === 'BELL')) _bellLoadNotices();
  });

  // 날짜가 바뀌면(자정 넘김) 오늘 일정을 새 날짜로 다시 받는다
  let _bellDay = _todayYMD();
  setInterval(()=>{
    const now = _todayYMD();
    if(now !== _bellDay){
      _bellDay = now;
      _bellLoadToday();
    }
  }, 60 * 1000);
}

/* 👀 친구 홈 구경 — 달력(서버가 공개한 일정만) · 디데이 보드(공개한 장만)를 친구 것으로. 구경 중인 uid 가 정해진 뒤에 부른다 */
async function loadVisit(friendId){
  _visitStop(); _visitFriend = friendId;
  const seq = ++_visitSeq, gen = _gen;
  _schedDdaysVisit = {}; _visitBoardState = LOAD.LOADING;
  renderDdays();
  loadMonth();
  try{
    const dd = await scheduleApi.fetchBoardOf(friendId);
    if(seq !== _visitSeq || gen !== _gen) return;
    _schedDdaysVisit = dd; _visitBoardState = LOAD.READY; _loadFailing = false;
  }catch(e){
    if(seq !== _visitSeq || gen !== _gen) return;
    _visitBoardState = LOAD.ERROR; _loadFail(e);
  }
  renderDdays();
}
/* 구경 중 다시 받던 것을 멈춘다 — 늦게 오는 답은 _visitSeq · _visitRound 가 버린다 */
function _visitStop(){ _visitSeq++; _visitRound++; _visitRefreshing = false; _visitAgain = false; _visitFriend = null; }

/* 구경 중인 친구의 달력(보는 달) · 보드를 조용히 다시 받는다 — 사용자가 연 받기가 아니라서 실패해도 번호 없이 지금 화면을 둔다.
   받는 중에 또 오면 끝난 뒤 한 번만 더 받는다(받는 중 값이 알림보다 먼저일 수 있어서). */
async function refreshVisit(friendId){
  if(friendId !== _visitFriend || viewingUserId() !== friendId) return;
  if(_visitBoardState !== LOAD.READY) return;   // 처음 받는 중이거나 못 받은 상태는 «다시 시도» 길이 있다
  if(_visitRefreshing){ _visitAgain = true; return; }
  _visitRefreshing = true;
  const round = ++_visitRound, gen = _gen;
  try{
    do{
      _visitAgain = false;
      const seq = ++_visitSeq;
      const month = (_monthState === LOAD.READY && _schedYM) ? loadMonth(true) : null;
      try{
        const dd = await scheduleApi.fetchBoardOf(friendId);
        if(seq !== _visitSeq || gen !== _gen) return;
        _schedDdaysVisit = dd; renderDdays();
      }catch(_){ if(seq !== _visitSeq || gen !== _gen) return; }
      if(month) await month;
    }while(_visitAgain && round === _visitRound);
  }finally{ if(round === _visitRound) _visitRefreshing = false; }
}
/* 구경 끝 — 내 달력 · 내 보드로. 늦게 오는 친구 답은 버린다 */
function endVisit(){
  _visitStop();
  _schedDdaysVisit = null; _visitBoardState = LOAD.IDLE;
  loadMonth();
  renderDdays();
}

/* 내 것 전부 받기 — 계정을 이어받은 뒤(reset 다음). 보드 · 보는 달 · 오늘 일정 · 태그 알림 */
function loadMine(){
  _boardLoad(false);
  if(_schedYM && !viewingUserId()) loadMonth();
  _bellLoadToday();
  _bellLoadNotices();
}
/* 계정을 놓을 때 · 이어받기 시작 — 앞 계정 값을 비우고 받기 전으로 돌린다(늦게 오는 앞 계정 답은 _gen 이 버린다) */
function reset(){
  _gen++; _monthSeq++; _visitStop();
  _schedYM = null; _schedSelDD = null;   // 탭을 다시 열면 이번 달부터 새로 받는다
  _schedMonthData = {}; _monthState = LOAD.IDLE;
  _schedDdays = {}; _boardState = LOAD.IDLE;
  _schedDdaysVisit = null; _visitBoardState = LOAD.IDLE;
  _bellNotices = {}; _bellTodayItems = [];
  _schedTagSel = []; _loadFailing = false; _schedAdding = false;
  _syncPublicLock(document.getElementById('mhSchedPublic'), document.getElementById('mhSchedPublicHint'), 0);   // 앞 계정에서 태그하다 만 공개 잠금을 푼다
  scheduleApi.reset();
  const grid = document.getElementById('mhSchedGrid');
  if(grid) grid.innerHTML = '';   // renderSchedGrid 는 달이 없으면 아무것도 안 그린다 — 앞 계정 달력이 남지 않게 여기서 비운다
  renderSchedDay(); renderDdays(); refreshBellBadge();
}

return {
  startSchedule,
  renderSchedCalendar,                  // 마이홈 [스케줄러] 탭을 열 때
  renderDdays,                          // 관람 시작/끝 · 탭을 열 때
  loadBoard: ()=>_boardLoad(false),     // 로그인 뒤 — 내 디데이 보드 받기
  loadMine,                             // 계정 이어받기 뒤 — 내 것 전부 다시 받기
  reset,                                // 계정을 놓을 때 · 이어받기 시작
  startVisit: loadVisit,                // 친구 홈 구경 시작 — 달력 · 보드를 친구 것으로
  endVisit,                             // 구경 끝 — 내 것으로
  refreshBellBadge,                     // 수령함 · 공지가 바뀌었을 때
  renderBellList,
  isBellOpen: _bellWinOpen,
  /* 화면 없이 검사하는 셈 — sim-scheduler.js */
  calc: { daysBetween:_daysBetween, ddayBase1:_ddayBase1, ddayShownDays:_ddayShownDays,
          ddayCountLabel:_ddayCountLabel, ddayMilestoneDays:_ddayMilestoneDays },
};
}

const api = { createScheduler };
/* ⚠️ window.Scheduler 가 아니다 — 크로미움에 같은 이름의 내장 전역(작업 예약 API 의 Scheduler · scheduler)이 있다. */
if(typeof window !== 'undefined') window.MhScheduler = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

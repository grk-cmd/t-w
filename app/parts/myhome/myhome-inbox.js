/* myhome-inbox.js — 📩 수령함 · 💝 선물함 · 👥 마이홈 친구 목록(Ctrl+F 검색)
   app.js 의 세 구역(«📩 수령함 상태 · 안 읽은 수 · 친구 탭 배지» 의 함수 · «👥 마이홈 친구 목록 · Ctrl+F 검색» ·
   «📩 수령함 · 💝 선물함 그리기»)과 sanitize 구역 사이에 끼어 있던 친구 방 표시 둘(_friendRoomTag · _friendInRoom)을
   그대로 옮긴 모듈이다(앱 FSD 15번 — docs/APP_FSD_MAP.md). 동작은 옮기기 전과 같다.

   ★ 아래 본문은 app.js 에 있던 글 그대로다 — 들여쓰기도 바꾸지 않았다(옮기기 전 줄과 견주어 볼 수 있게). 구역 머리 주석 둘은
     app.js 에 남겼다(구역 번호가 밀리지 않게 — 그 아래에 연결 · 옮긴 곳 안내만 있다).
     바뀐 것은 열네 줄뿐이다 — 모두 app.js 가 다시 대입하는 let 을 읽는 함수로 읽는다.
       · _myInbox → _myInbox() · _inboxBroadcast → _inboxBroadcast()   (수령함 · 공용 공지 구독이 다시 대입 — 마이홈 열기)
       · _myHomeFriends → _myHomeFriends()                             (친구 목록 구독이 다시 대입)
       · isAdmin → isAdmin()                                           (로그인할 때 다시 대입 · 만드는 줄보다 뒤에 선언 — 값이면 TDZ)
     구독이 쓰는 _myInbox · _myInboxReady · _inboxBroadcast 와 로그아웃 지움 목록이 같이 쓰는 INBOX_BC_READ_KEY 는
     app.js 에 남겼다(_myHomeFriends 와 같은 방식 — 쓰는 곳이 app.js 라 쓰는 함수를 새로 낼 까닭이 없다).
   ★ 이 모듈의 상태는 _mhSelectedFriend · _friendFilter · _inboxFilter · _inboxOpenId 넷이다. 밖(🏠 마이홈 창 버튼 연결)에서
     쓰던 셋은 setInboxFilter · setInboxOpenId · setFriendFilter 로 쓴다.
   ★ 밖으로 내놓는 이름은 createMyHomeInbox 의 반환값이다 — app.js 의 부르는 곳(마이홈 열기의 구독 · 마이홈 창 버튼 연결 ·
     공지 팝업 · 스케줄러 · 친구 관리 · 방 초대 · 친구 방 놀러 가기 연결)은 inboxMod.이름 으로 부른다. 전부 만드는 줄보다 늦게 돈다.
   ★ createMyHomeInbox 는 app.js 의 원래 자리(«👥 마이홈 친구 목록 · Ctrl+F 검색» 머리 아래 · 🏠 놀러 가기 연결 바로 뒤)에서 부른다.
   ★ 함수는 app.js 가 화살표로 넘긴다. 본문의 typeof 가드(typeof openFriendHomeView · typeof _inboxUnreadReward · typeof toast ·
     typeof _inboxTimeStr)는 예전처럼 늘 통과한다.
   ★ 값으로 받는 것 — INBOX_BC_READ_KEY · FRIEND_MAX(상수) · mhScheduler(만드는 줄보다 앞에서 만들어지는 const) ·
     friendVisit(🏠 친구 방 놀러 가기 — 예전 자리 그대로 만드는 줄 바로 앞 · 모듈이 없으면 null).
   ⚠️ firebaseAPI · companion · document · window · navigator · confirm · localStorage · queueMicrotask 는 예전처럼 전역 이름으로 쓴다
     (이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwMyHomeInbox — 크로미움 내장 전역과 겹치는 이름(Scheduler 같은)을 쓰면 typeof 가드가 늘 통과한다(#103).
   검사: checks/sim-myhome-inbox.js — 수령함 합치기 · 안 읽은 수 · 배지 · 공용 공지 읽음 · 목록(필터 · 고정 · 펼침 · 읽음 · 삭제 · 📌) ·
         링크 · 키 복사 · 선물함(격자 · ⭐ · 다시 불러오기 · 삭제 확인) · 친구 목록(정렬 · 검색 · 방 표시 · 선택 · 삭제) · app.js 배선 · html 순서. */
(function(){

function createMyHomeInbox(deps){
const escHtml = deps.escHtml;
const toast = deps.toast;
const getMyUserId = deps.getMyUserId;
// 📩 수령함 — app.js 의 let(구독이 다시 대입)과 저장 키
const _myInbox = deps.myInbox;                       // 읽는 함수 — 개인 수령함(마이홈 열기의 subscribeInbox 가 다시 대입)
const _inboxBroadcast = deps.inboxBroadcast;         // 읽는 함수 — 공용 공지(subscribeInboxBroadcast 가 다시 대입)
const INBOX_BC_READ_KEY = deps.INBOX_BC_READ_KEY;    // 공용 공지 읽음 id 집합(로컬) — 로그아웃 지움 목록이 같이 쓴다
const isAdmin = deps.isAdmin;                        // 읽는 함수 — app.js 의 let(로그인할 때 다시 대입 · 이 줄보다 뒤에 선언)
const mhScheduler = deps.mhScheduler;                // 🔔 벨 뱃지 — 만드는 줄보다 앞에서 만들어지는 const
// 👥 친구 목록
const _myHomeFriends = deps.myHomeFriends;           // 읽는 함수 — 친구 목록 캐시(구독마다 다시 대입)
const FRIEND_MAX = deps.FRIEND_MAX;                  // 👥 친구 상한(상수)
const friendVisit = deps.friendVisit;                // 🏠 친구 방 놀러 가기(friend-visit.js — 없으면 null)
const _mhStripHtml = deps.mhStripHtml;               // 소개글 한 줄 요약 — 태그를 걷어낸 글자(sanitize 구역)
const starFromRemote = deps.starFromRemote;          // 🌟 회차 친구 배지
const lvStarBadgeClass = deps.lvStarBadgeClass;
const lvStarStr = deps.lvStarStr;
const lvBadgeClass = deps.lvBadgeClass;              // 🏅 레벨 배지 구간
const openFriendHomeView = deps.openFriendHomeView;  // 아바타 클릭 → 친구 마이홈 관람
const renderMhProfileRail = deps.renderMhProfileRail;   // (제거된 프로필 레일 — 빈 함수)
let _mhSelectedFriend = null;   // (구 DM 자리) 지금은 사용하지 않지만 다른 곳에서 참조할 수 있어 유지
function _inboxBcReadSet(){ try{ return new Set(JSON.parse(localStorage.getItem(INBOX_BC_READ_KEY)||'[]')); }catch(e){ return new Set(); } }
function _inboxBcMarkRead(id){ try{ const s=_inboxBcReadSet(); s.add(id); localStorage.setItem(INBOX_BC_READ_KEY, JSON.stringify([...s])); }catch(e){} }
function _inboxBcMarkAllRead(){ try{ const s=_inboxBcReadSet(); Object.keys(_inboxBroadcast()||{}).forEach(id=>s.add(id)); localStorage.setItem(INBOX_BC_READ_KEY, JSON.stringify([...s])); }catch(e){} }
// 개인 inbox + 공용 공지를 합친 목록 (렌더·카운트 공용). 공용 공지의 read는 로컬 집합으로 판정.
function _inboxMerged(){
  const out = {};
  const bcRead = _inboxBcReadSet();
  Object.keys(_myInbox()||{}).forEach(id=>{ out[id] = Object.assign({ _src:'personal' }, _myInbox()[id]); });
  Object.keys(_inboxBroadcast()||{}).forEach(id=>{
    out[id] = Object.assign({ _src:'broadcast', read: bcRead.has(id) }, _inboxBroadcast()[id]);
  });
  return out;
}
// 📩 안 읽은 메시지 개수 — 벨 뱃지/버튼 표시에 사용 (개인 + 공용 공지)
function _inboxUnreadCount(){
  const m = _inboxMerged();
  return Object.keys(m).filter(id => !m[id].read).length;
}
// 🎁 안 읽은 '보상' 메시지 수 — 친구 탭 배지에 쓰임.
function _inboxUnreadReward(){
  const m = _inboxMerged();
  return Object.keys(m).filter(id => !m[id].read && (m[id].tag==='reward')).length;
}
/* 📩 우편함 탭에 안 읽은 보상이 있으면 배지 표시.
   ⚠️ 예전엔 이 배지가 **친구 탭**에 붙어 있었다 — 수령함이 친구 탭 오른쪽 칸에 얹혀 있었기 때문이다.
     수령함이 우편함 탭으로 나가면서 배지도 같이 옮겼다. 안 옮기면 "친구 탭에 빨간 점이 떠서
     눌렀는데 아무것도 없다"가 된다(수령함이 그 탭에 더 이상 없으므로). */
function _refreshFriendTabBadge(){
  const tab = document.querySelector('.mh-tab[data-tab="mail"]');
  if(!tab) return;
  const n = (typeof _inboxUnreadReward==='function') ? _inboxUnreadReward() : 0;
  let badge = tab.querySelector('.mh-tab-badge');
  if(n > 0){
    if(!badge){ badge=document.createElement('span'); badge.className='mh-tab-badge'; tab.appendChild(badge); }
    badge.textContent = n > 9 ? '9+' : String(n);
    badge.style.display='inline-block';
  } else if(badge){
    badge.style.display='none';
  }
}
let _inboxFilter = 'all';       // 태그 필터: 'all' | 'notice' | 'update' | 'reward'
let _inboxOpenId = null;        // 지금 펼쳐진 메시지 id
/* 🔒 친구 목록에 보여줄 방 표시 — 시크릿룸이면 빈 문자열(= 표시 없음).
   presence 의 room 값은 친구라면 누구나 읽으므로, 시크릿룸 코드는 애초에 올리지 않는다
   (firebase-init `_syncPresenceRoom`). 여기는 그 이전 판에서 이미 올라간 값을 위한 그물이다.
   ⚠️ 'SCRT- 로 시작하면 숨긴다'는 판정을 여기 말고 다른 곳에 복사하지 말 것 — 배지·🏠·나중에
     생길 '친구 따라가기' 버튼이 각자 판단하면 그중 하나가 반드시 새 코드를 흘린다. */
function _friendRoomTag(f){
  const r = (f && f.room) ? String(f.room) : '';
  if(!r || r.indexOf('SCRT-') === 0) return '';
  return r;
}
/* 🏠 이 친구가 지금 방에 있는가 — **코드와는 다른 질문이다.**
   시크릿룸에 있는 친구는 코드가 안 올라오므로 _friendRoomTag 는 빈 값이지만, presence 의
   inRoom 은 true 다. 즉 "방에 있다"는 보이고 "어느 방인지"는 안 보인다.
   ⚠️ 🏠 를 f.room 으로 판정하지 말 것 — 그러면 시크릿룸에 있는 친구만 조용히 🏠 가 빠져서,
     오히려 "🏠 없는 온라인 친구 = 시크릿룸"이라는 반대 방향 단서가 된다.
   ★ 옛 판으로 접속한 친구는 inRoom 이 없다 — 그때는 코드 유무로 떨어진다(하위호환). */
function _friendInRoom(f){
  if(!f || !f.online) return false;
  if(f.inRoom !== undefined) return !!f.inRoom;
  return !!f.room;
}
/* ── 🔍 Ctrl+F 친구 검색 ────────────────────────────────────────────────
   순수 클라이언트 필터다 — 서버·규칙과 무관하고, 이미 구독으로 받아둔 _myHomeFriends 만 본다.
   🔍 버튼은 만들지 않는다. 헤더 오른쪽의 'Ctrl+F 검색'은 **글자 힌트**이지 클릭 대상이 아니다. */
let _friendFilter = '';

/* 검색어와 겹치는 부분만 노랗게.
   ★ **원문에서 자리를 찾고, 잘라낸 세 조각을 각각 이스케이프한다.** 새어 나가는 조각이 없다.
   ⚠️ 예전엔 "먼저 이스케이프하고 그 위에서 찾기"였다. 그때는 헬퍼가 `&`·`<` 둘만 막았으므로
     엔티티가 짧아 잘 드러나지 않았는데, 다섯 문자를 다 막는 `escHtml` 로 바꾸면
     `&amp;`·`&quot;`·`&#39;` 가 늘어나 **찾은 자리가 엔티티 한가운데일 수 있다.**
     그러면 `a&<span>amp</span>;b` 처럼 엔티티가 쪼개져 이름이 깨져 보인다
     (마크업이 새는 건 아니지만 글자가 틀린다). 그래서 순서를 뒤집었다.
   ⚠️ 되돌리지 말 것 — "이스케이프를 먼저 해야 안전하다"는 직관은 **조각을 안 씻을 때만** 맞다.
     여기는 세 조각 전부 `escHtml` 을 지나므로 안전은 그대로다. */
function _mhHl(name, q){
  const s = String(name == null ? '' : name);
  if(!q) return escHtml(s);
  const qs = String(q);
  const i = s.toLowerCase().indexOf(qs.toLowerCase());
  if(i < 0) return escHtml(s);
  return escHtml(s.slice(0, i))
       + '<span class="mh-hl">' + escHtml(s.slice(i, i + qs.length)) + '</span>'
       + escHtml(s.slice(i + qs.length));
}

function _mhUpdateFriendHit(q, n){
  const hit = document.getElementById('mhFriendHit');
  if(!hit) return;
  hit.classList.toggle('on', !!q);
  if(q) hit.textContent = n + '명 찾음 · Esc 로 닫기';
}

/* 검색줄 열고 닫기. 닫으면 검색어도 비운다 — 접힌 채로 필터만 남아 있으면
   "친구가 갑자기 사라졌다"가 된다. */
function _mhFriendSearchToggle(on){
  const row  = document.getElementById('mhFriendSearch');
  const inp  = document.getElementById('mhFriendSearchInput');
  const hint = document.getElementById('mhFriendHint');
  if(!row) return;
  const isOn = row.classList.contains('on');
  if(!!on === isOn) return;                       // 같은 상태면 아무 일도 하지 않는다
  row.classList.toggle('on', !!on);
  if(hint) hint.style.display = on ? 'none' : ''; // 열려 있는 동안엔 같은 말을 두 군데서 하지 않는다
  if(on){ if(inp){ inp.focus(); inp.select(); } return; }
  if(inp) inp.value = '';
  _friendFilter = '';
  renderMyHomeFriendList();
}

function renderMyHomeFriendList(){
  // 👑 테마 재적용 — 이 함수가 목록 DOM을 새로 만들기 때문에, 렌더가 끝난 직후 친구 이름 글씨색 등을 다시 칠함
  queueMicrotask(()=>{ if(typeof window._mhApplyTheme==='function') window._mhApplyTheme(); });
  const list=document.getElementById('mhFriendList');
  if(!list) return;
  const ids=Object.keys(_myHomeFriends());
  // A안 헤더에 (n/상한) 표시 — 하단 문구는 제거됨.
  //   ⚠️ 숫자를 여기 다시 박지 말 것 — 상한은 FRIEND_MAX 한 곳에서만 나온다.
  //     예전엔 50 이 박혀 있어서, 추가·수락 쪽 상한을 올려도 이 표기만 옛 숫자로 남았다.
  const headCnt = document.getElementById('mhFriendHeadCount');
  if(headCnt) headCnt.textContent = '('+ids.length+'/'+FRIEND_MAX+')';
  if(_mhSelectedFriend && !_myHomeFriends()[_mhSelectedFriend]) _mhSelectedFriend=null;   // 삭제된 친구가 선택돼 있으면 해제
  if(!ids.length){
    _mhUpdateFriendHit('', 0);
    list.innerHTML='<div class="mh-fempty">아직 친구가 없어요.<br>아래 [+ 친구 추가]로<br>친구 코드를 입력해보세요.</div>';
    renderMhChat();
    return;
  }
  /* 🔍 검색 필터. 헤더의 (n/상한) 은 **전체 수**를 계속 보여준다 —
     검색 중이라고 친구가 줄어든 것처럼 보이면 안 된다. */
  const _q = (_friendFilter || '').trim().toLowerCase();
  const shown = _q ? ids.filter(id => (_myHomeFriends()[id].name || '').toLowerCase().indexOf(_q) >= 0) : ids;
  _mhUpdateFriendHit(_q, shown.length);
  if(_q && !shown.length){
    list.innerHTML='<div class="mh-fempty">찾는 이름이 없어요.<br><small>Esc 로 검색을 닫아요</small></div>';
    renderMhChat();
    return;
  }
  /* 🏅 레벨 배지 — 구간·표식 클래스는 lvBadgeClass() 한 곳에서 나온다.
     ⚠️ 여기에 경계값을 다시 적지 말 것. 예전에는 같은 삼항 사슬이 이 자리와 _plFillLv,
       경험치 바 세 군데에 복사돼 있어서 한 곳만 고치면 색이 어긋났다. */
  const _lvBadge = (lv, f)=>{
    /* 🌟 회차 친구 — 흰 별 + 이번 바퀴 레벨 · 몸통은 그 사람이 고른 색(개정 70).
       ★ 색은 starFromRemote 가 **팔레트 안의 값으로만** 돌려준다. 그래도 속성값이라 escHtml 을 한 겹 더 건다(audit 검사 19). */
    const st = starFromRemote(f);
    if(st) return '<span class="mh-flv ' + escHtml(lvStarBadgeClass()) + '" style="--pre-c:' + escHtml(st.color) + '"><i class="pre">' + lvStarStr(st.cyc) + '</i>' + st.lv + '</span>';
    // 레벨 정보가 없는 친구(구버전 접속 상태)는 배지를 표시하지 않는다 — Lv.1로 오해되지 않게.
    if(lv == null) return '';
    const n = Math.max(1, parseInt(lv,10) || 1);
    /* ★ 접두사를 <i class="lvp"> 로 분리한다 — 숫자만 Consolas(등폭)로 찍고 'Lv' 는 본문 폰트로
       두어서, 3/8 을 갈라내면서도 배지 폭은 예전과 같게 유지한다(.mh-flv 주석 참고).
       마침표도 뺐다 — 등폭에서 점 하나가 숫자 한 칸을 통째로 먹는다. */
    return '<span class="mh-flv '+lvBadgeClass(n)+'"><i class="lvp">Lv</i>'+n+'</span>';
  };
  const byName=(a,b)=>(_myHomeFriends()[a].name||'').localeCompare(_myHomeFriends()[b].name||'');
  const online = shown.filter(id=>_myHomeFriends()[id].online).sort(byName);
  const offline = shown.filter(id=>!_myHomeFriends()[id].online).sort(byName);
  list.innerHTML='';
  // 목업처럼 "온라인 — N" / "오프라인 — N" 섹션으로 나눠 표시
  const addGroup=(label, arr)=>{
    if(!arr.length) return;
    const head=document.createElement('div'); head.className='mh-fgroup'; head.textContent=label+' — '+arr.length;
    list.appendChild(head);
    arr.forEach(fid=>{
      const f=_myHomeFriends()[fid];
      const row=document.createElement('div');
      row.className='mh-frow'+(f.online?'':' off')+(fid===_mhSelectedFriend?' sel':'');
      // 소개글은 리치텍스트라 <b>/<i>/<span style> 등이 섞여 있음 → 태그를 걷어내고 글자만 씀
      const bioText = _mhStripHtml(f.bio);
      const sub = bioText ? bioText : (f.online?'온라인':'오프라인');   // 이름 아래 한 줄
      /* 🔒 시크릿룸에 있는 친구는 방 표시를 아예 안 한다 — 코드도, 🏠 도.
         [두 겹인 이유] 올리는 쪽(firebase-init `_syncPresenceRoom`)이 이미 SCRT- 를 null 로
           바꿔 올린다. 여기는 그 이전 판으로 접속해 있던 사람의 presence 에 코드가 남아 있는
           경우를 위한 것이다(방을 옮기거나 오프라인이 되기 전까지 그 값이 그대로 산다).
         ★ 판정을 한 군데(_friendRoomTag)로 모은다 — 배지와 🏠 가 따로 판단하면 한쪽만 고쳐진다. */
      const roomTag = _friendRoomTag(f);
      const inRoom  = _friendInRoom(f);   // 🏠 — 시크릿룸이어도 붙는다(코드만 안 붙는다)
      const pill = fid===_mhSelectedFriend
        ? `<span class="mh-fpill">${f.online ? ('온라인'+(roomTag?' · <span class="mh-fpill-code'+(friendVisit?' go" title="클릭하면 놀러 가요':'')+'">'+escHtml(roomTag)+'</span>':'')) : '오프라인'}</span>` : '';
      /* 🛡️ 아바타 칸은 **속성에 보간을 쓰지 않는다.** `title` 은 남이 정한 닉네임이고
           `src` 는 남의 `users/$fid/home/avatar`(20만 자까지 허용되는 문자열)다. 둘 다
           예전엔 `title="…${…}…"` · `src="${…}"` 로 문자열에 박혀 있었는데, 그때 쓰던 헬퍼
           (`_mhEsc`, 지금은 없다)는 `"` 를 안 막고 `src` 는 이스케이프가 아예 없어서
           **속성을 빠져나와 `on*` 이벤트를 새로 붙일 수 있었다.** 아래에서 프로퍼티 대입으로 넣는다.
         ⚠️ 헬퍼가 `escHtml` 로 세져도 **이 자리를 보간으로 되돌리지 말 것.** 이스케이프는 한 번
           빠뜨리면 끝이고, 프로퍼티 대입은 빠뜨릴 것이 없다 — 검사 19 가 이 모양을 지킨다. */
      row.innerHTML = `<span class="mh-fdot ${f.online?'on':'off'}"></span>
        <span class="mh-favatar" style="cursor:pointer;"></span>
        <span class="mh-fmain">
          <span class="mh-fname">${_mhHl(f.name||'(이름 없음)', _q)}${_lvBadge(f.level, f)}${inRoom?' 🏠':''}</span>
          <span class="mh-fsub">${escHtml(sub)}</span>
        </span>${pill}
        <span class="mh-fremove" title="친구 삭제">✕</span>`;
      // 마이홈2-B: 아바타 클릭 → 그 친구의 마이홈으로 진입 (읽기 전용)
      const avatarEl=row.querySelector('.mh-favatar');
      if(avatarEl){
        avatarEl.title = '클릭 = ' + (f.name || '친구') + ' 마이홈 관람';   // 프로퍼티 = 마크업 경로가 아니다
        /* 아바타 이미지도 만들어 붙인다. 스킴은 한 번 본다 — 지금 저장은 `pickImage` 가 만드는
           `data:image/…` 이고 Storage URL(http(s))도 있을 수 있다. 그 둘만 통과시킨다.
           (`<img src>` 는 `javascript:` 를 실행하지 않지만, 통과 목록을 좁혀 두면 나중에
            아바타 저장 경로가 바뀌어도 이 자리가 먼저 막는다) */
        if(f.avatar && /^(data:image\/|https?:)/i.test(String(f.avatar))){
          const im = document.createElement('img');
          im.draggable = false;
          im.src = f.avatar;
          avatarEl.appendChild(im);
        }
        avatarEl.addEventListener('click', e=>{
          e.stopPropagation();
          if(typeof openFriendHomeView==='function') openFriendHomeView(fid);
        });
      }
      const visitEl = row.querySelector('.mh-fpill-code.go');   // 🏠 방 코드 누르기 → 놀러 가기 창
      if(visitEl) visitEl.addEventListener('click', e=>{ e.stopPropagation(); friendVisit.ask(fid); });
      row.querySelector('.mh-fremove').onclick=async (e)=>{
        e.stopPropagation();
        if(!confirm('이 친구를 목록에서 삭제할까요?')){ window.focus(); return; } window.focus();
        try{
          await firebaseAPI.removeFriend(getMyUserId(), fid);
          if(_mhSelectedFriend===fid){
            _mhSelectedFriend=null;
            renderMhChat();
          }
        }catch(e){ toast('삭제 실패'); }
      };
      row.addEventListener('click', ()=>{
        _mhSelectedFriend=fid;
        renderMyHomeFriendList();
      });
      // 🎁 우클릭 → 말랑이 선물 보내기 창
      row.addEventListener('contextmenu', e=>{
        e.preventDefault(); e.stopPropagation();
        if(typeof window._mallangOpenGift==='function') window._mallangOpenGift(fid, f.name||'친구');
      });
      row.title = (row.title ? row.title + ' · ' : '') + '우클릭: 말랑이 선물';
      list.appendChild(row);
    });
  };
  addGroup('온라인', online);
  addGroup('오프라인', offline);
  renderMhChat();
}
/* 📩 수령함 렌더 — 태그 필터 + 목록. 클릭하면 본문이 펼쳐지고 자동으로 읽음 처리.
   구 DM 대화 패널(mhChatInline) 자리를 그대로 씀. renderMhChat 이름은 여러 곳에서 호출하므로 유지. */
function renderMhChat(){ renderInbox(); renderMhProfileRail(); }

/* 📩 태그 표시 이름. ⚠️ 데이터의 태그 키는 여전히 'reward' 다 — 바꾸면 이미 발송된 우편이
   전부 [공지]로 떨어진다(폴백이 notice 다). 보이는 글자만 [보상] → [우편] 으로 바꿨다.
   [왜] 보상 말고도 시스템이 개인에게 보내는 우편(제재 안내 등)이 이 태그로 온다. */
function _inboxTagLabel(tag){
  return tag==='update' ? '🆕 업데이트' : tag==='reward' ? '📩 우편' : tag==='bug' ? '🐞 버그제보' : '📢 공지';
}
function _inboxTimeStr(ts){
  if(!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if(sameDay){
    const h = d.getHours(), mm = String(d.getMinutes()).padStart(2,'0');
    const ampm = h<12 ? '오전' : '오후';
    const h12 = h===0 ? 12 : (h>12 ? h-12 : h);
    return ampm + ' ' + h12 + ':' + mm;
  }
  return `${d.getFullYear()-2000}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* 🔗 본문 속 URL을 클릭 가능한 링크로 바꾼다(공지·업데이트·보상 등).
   ★ 먼저 HTML을 이스케이프한 뒤 링크만 되살린다 — 순서가 반대면 본문에 태그를 넣어
     원하는 걸 심을 수 있다(XSS). 주소는 http/https만 인정한다.
   클릭하면 companion.openBrowser로 시스템 기본 브라우저(크롬·웨일 등)에서 열린다. */
function _linkifyText(text){
  /* 🛡️ 이스케이프는 공용 `escHtml` 하나로 한다 — 예전엔 여기에 네 문자를 손으로 적어 뒀는데
       `'` 가 빠져 있었다(홑따옴표 속성 안에서 뚫린다). 손으로 적은 목록은 반드시 한 개가 빠진다. */
  let esc = escHtml(text);
  // 1) 주소를 클릭 가능한 링크로
  esc = esc.replace(/(https?:\/\/[^\s<]+)/g, u=>{
    const clean = u.replace(/[.,;:)\]]+$/, '');            // 문장 끝 문장부호는 주소에서 제외
    const tail  = u.slice(clean.length);
    return '<span class="ext-link" data-url="'+clean+'">'+clean+'</span>'+tail;
  });
  // 2) 라이선스 키(XXXX-XXXX-XXXX-XXXX)를 클릭하면 복사되는 요소로 (수령함에서 받은 키를 쉽게 복사)
  esc = esc.replace(/\b([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})\b/g, k=>{
    return '<span class="lic-key" data-key="'+k+'" title="클릭하면 복사돼요">'+k+'</span>';
  });
  return esc;
}
/* 링크 클릭을 한 곳에서 처리 — 본문이 다시 그려져도 계속 동작하도록 위임 방식. */
function _bindExtLinks(root){
  if(!root || root._extLinkBound) return;
  root._extLinkBound = true;
  root.addEventListener('click', e=>{
    // 라이선스 키 클릭 → 클립보드 복사
    const keyEl = e.target && e.target.closest ? e.target.closest('.lic-key') : null;
    if(keyEl && keyEl.dataset.key){
      e.preventDefault(); e.stopPropagation();
      const key = keyEl.dataset.key;
      try{
        if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(key); }
        else { const ta=document.createElement('textarea'); ta.value=key; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
        if(typeof toast==='function') toast('라이선스 키를 복사했어요');
      }catch(_){ if(typeof toast==='function') toast('복사 실패 — 직접 선택해 복사해 주세요'); }
      return;
    }
    const a = e.target && e.target.closest ? e.target.closest('.ext-link') : null;
    if(!a || !a.dataset.url) return;
    e.preventDefault();
    e.stopPropagation();   // 알림 항목이 접히거나 창이 닫히지 않게
    try{ if(window.companion && companion.openBrowser) companion.openBrowser(a.dataset.url); }catch(_){}
  });
}
/* 💝 선물함 — 받은 말랑이 선물 목록. 마이홈에서 클릭해 없앨 때까지 여기 남아있음.
   ⚠️ 예전엔 renderInbox() 안의 `_inboxFilter === 'gift'` 분기였다. 선물은 친구에게서 오는
     것이라 친구 관리로 옮기면서 **그리는 칸을 인자로 받게** 떼어냈다 — #mhInboxList 를
     이름으로 붙잡고 있으면 다른 칸에서 못 쓴다.
   ⚠️ 배지 확인 처리(_mallangSeenGifts)는 여기 없다. **선물함 서브탭을 눌렀을 때**만 부른다 —
     탭을 스치기만 해도 선물을 본 것으로 처리되면 안 되기 때문이다. */
function renderGiftBox(listEl){
  if(!listEl) return;
  listEl.innerHTML = '<div class="mh-ibx-empty">불러오는 중…</div>';
  (async ()=>{
    let gifts = {};
    try{ if(window.firebaseAPI && firebaseAPI.getMallangGifts) gifts = await firebaseAPI.getMallangGifts(getMyUserId()) || {}; }catch(_){}
    _giftBoxPaint(listEl, gifts);
  })();
}
/* 받아 둔 gifts 로 다시 그린다 — ⭐ 토글·삭제·다시 불러오기마다 서버에서 통째로 다시 받지 않으려고
   renderGiftBox 에서 떼어 냈다. */
function _giftBoxPaint(listEl, gifts){
  const lim = window._mallangGiftLimits || { max:30, starMax:20 };
  const keys = (typeof window._mallangGiftOrder === 'function')
    ? window._mallangGiftOrder(gifts)
    : Object.keys(gifts).sort((a,b)=>(gifts[b].ts||0)-(gifts[a].ts||0));
  if(!keys.length){
    listEl.innerHTML = '<div class="mh-ibx-empty">💝 아직 받은 선물이 없어요<br><small>친구가 보낸 말랑이가 여기에 표시돼요</small></div>';
    listEl.onclick = null; listEl.oncontextmenu = null;
    _giftStat('');
    return;
  }
  const starN = keys.filter(k=>gifts[k] && gifts[k].starred === true).length;
  /* 🛡️ 여기 있던 지역 이스케이프(`_e`)는 지웠다 — `'` 가 빠진 네 문자짜리였다.
     공용 escHtml 을 쓴다. 선물의 `fromName`·`msg`·`imgUrl` 은 **친구가 정한 문자열**이고
     그 넷 전부 속성값 안으로 들어간다(`data-*`·`title`·`img src`). */
  /* 🎁 6×5 격자 — 30칸이 보관 한도(GIFT_MAX=30)와 딱 맞는다.
     칸이 작아 글자를 넣을 자리가 없으므로, 보낸 사람·메시지·시각은 title(마우스를 올리면 뜨는 설명)에 담는다.
     fromName은 선물을 받을 때 이미 함께 저장돼 오는 값이라 추가로 받아오는 데이터가 없다(사용량 0).
     ⭐ 순서는 mallang.js giftOrder — ⭐ 아닌 것의 가장 오래된 것이 늘 마지막 칸이라, 꽉 찼을 때
       그 칸이 곧 자동 정리의 다음 대상이다(마우스를 올리면 설명에 적힌다). */
  const full = keys.length >= lim.max;
  const cells = keys.map((k, i)=>{
    const g = gifts[k];
    const when = (typeof _inboxTimeStr==='function') ? _inboxTimeStr(g.ts) : '';
    const isHidden = (typeof window._mallangIsGiftHidden==='function') ? window._mallangIsGiftHidden(k) : false;
    const star = g.starred === true;
    const next = full && !star && i === keys.length - 1;
    const who = (g.fromName||'친구') + ' 님이 선물했어요';
    const tip = who + (g.msg ? ('\n“'+g.msg+'”') : '') + (when ? ('\n'+when) : '')
              + '\n' + (isHidden ? '클릭하면 마이홈에 다시 불러와요' : '마이홈에 나와 있어요')
              + (next ? '\n새 선물이 오면 이 선물이 먼저 지워져요' : '');
    return '<div class="gift-cell gift-item'+(isHidden?' out':'')+(star?' star':'')+'" data-gid="'+escHtml(k)+'"'+
           ' data-img="'+escHtml(g.imgUrl||'')+'" data-msg="'+escHtml(g.msg||'')+'" title="'+escHtml(tip)+'">'+
           '<img src="'+escHtml(g.imgUrl||'')+'" alt="" draggable="false">'+   // 이름은 title(마우스 올림)에만
           '<span class="gift-star" title="'+(star?'즐겨찾기 풀기':'즐겨찾기')+'">'+(star?'⭐':'☆')+'</span></div>';
  });
  // 남은 칸은 빈 칸으로 채워 격자 모양을 유지
  for(let i=keys.length;i<lim.max;i++) cells.push('<div class="gift-cell empty"></div>');
  listEl.innerHTML = '<div class="gift-grid">'+cells.join('')+'</div>';
  _giftStat('⭐ '+starN+'/'+lim.starMax+' · 보관 '+keys.length+'/'+lim.max);
  const repaint = ()=>{ try{ _giftBoxPaint(listEl, gifts); }catch(_){} };
  // ★ 선물함 항목 클릭 → 마이홈에 다시 소환. innerHTML로 만든 목록이라 위임 방식으로 한 번만 건다.
  listEl.onclick = (ev)=>{
    const it = ev.target && ev.target.closest ? ev.target.closest('.gift-item') : null;
    if(!it || !it.dataset.gid) return;
    const k = it.dataset.gid;
    /* ⭐ 칸 클릭(다시 불러오기)으로 번지면 안 된다 — 여기서 끊는다. */
    if(ev.target.closest('.gift-star')){
      ev.stopPropagation();
      _giftToggleStar(k, gifts, starN, lim, repaint);
      return;
    }
    if(typeof window._mallangRespawnGift !== 'function') return;
    const r = window._mallangRespawnGift(k, it.dataset.img, it.dataset.msg);
    if(r === 'ok'){ toast('🎁 마이홈에 다시 불러왔어요'); repaint(); }   // 목록의 '치움' 표시 갱신
    else if(r === 'already') toast('이미 마이홈에 나와 있어요');
    else if(r === 'full') toast('말랑이가 너무 많아요 — 몇 마리 치우고 다시 시도해 주세요');
  };
  // 우클릭 → 영구 삭제 (⭐ 는 막음). 확인은 창 안 확인창으로 — confirm() 금지(audit 검사 4).
  listEl.oncontextmenu = (ev)=>{
    const it = ev.target && ev.target.closest ? ev.target.closest('.gift-item') : null;
    if(!it || !it.dataset.gid) return;
    ev.preventDefault(); ev.stopPropagation();
    const k = it.dataset.gid, g = gifts[k]; if(!g) return;
    if(g.starred === true){
      _mhAsk('선물 삭제', '즐겨찾기한 선물이에요. ⭐를 먼저 풀어 주세요.', [{ label:'확인' }]);
      return;
    }
    _mhAsk('선물 삭제',
      (g.fromName||'친구')+' 님의 선물을 삭제할까요?\n삭제하면 되돌릴 수 없어요. 마이홈에 나와 있으면 같이 사라져요.',
      [{ label:'삭제', danger:true, run: async ()=>{
          const r = (typeof window._mallangDeleteGift === 'function') ? await window._mallangDeleteGift(k, g) : 'error';
          if(r === 'ok'){ delete gifts[k]; repaint(); toast('🗑 선물을 삭제했어요'); }
          else toast('삭제하지 못했어요 — 네트워크를 확인해 주세요');
        } },
       { label:'취소' }]);
  };
}
/* 서브탭 줄 오른쪽의 「⭐ n/20 · 보관 m/30」. 다른 서브탭으로 가면 renderFriendManage 가 비운다. */
function _giftStat(text){
  const el = document.getElementById('mhGiftStat');
  if(el) el.textContent = text;
}
async function _giftToggleStar(k, gifts, starN, lim, repaint){
  const g = gifts[k]; if(!g) return;
  const on = g.starred !== true;
  if(on && starN >= lim.starMax){ toast('즐겨찾기는 '+lim.starMax+'개까지예요'); return; }
  if(!(window.firebaseAPI && firebaseAPI.setMallangGiftStarred)){ toast('이 기능은 앱을 재시작한 후에 사용할 수 있어요'); return; }
  const r = await firebaseAPI.setMallangGiftStarred(getMyUserId(), k, on);
  if(!(r && r.ok)){ toast('저장하지 못했어요 — 네트워크를 확인해 주세요'); return; }
  if(on) g.starred = true; else delete g.starred;
  repaint();
}
/* 마이홈 창 안 확인창 — btns: [{label, danger?, run?}]. 아무 버튼이나 누르면 닫힌다.
   ⚠️ #myHomeWin 의 자식으로 붙인다. body 로 빼면 run 모드에서 클릭이 뒤로 뚫린다(.mh-color-pop 사고). */
function _mhAsk(title, text, btns){
  const win = document.getElementById('myHomeWin'); if(!win) return;
  const old = document.getElementById('mhAskOv'); if(old) old.remove();
  const ov = document.createElement('div');
  ov.id = 'mhAskOv'; ov.className = 'mh-ask-ov';
  ov.innerHTML = '<div class="mh-ask-win"><div class="ma-head">'+escHtml(title)+'</div>'+
    '<div class="ma-body">'+escHtml(text)+'</div><div class="ma-foot">'+
    btns.map((b,i)=>'<button type="button" data-i="'+i+'"'+(b.danger?' class="danger"':'')+'>'+escHtml(b.label)+'</button>').join('')+
    '</div></div>';
  const close = ()=>{ try{ ov.remove(); }catch(_){} };
  ov.addEventListener('mousedown', e=>e.stopPropagation());
  ov.addEventListener('contextmenu', e=>{ e.preventDefault(); e.stopPropagation(); });
  ov.addEventListener('click', e=>{
    e.stopPropagation();
    if(e.target === ov){ close(); return; }
    const bt = e.target.closest && e.target.closest('button[data-i]'); if(!bt) return;
    const b = btns[+bt.dataset.i]; close();
    if(b && typeof b.run === 'function') b.run();
  });
  win.appendChild(ov);
}
function renderInbox(){
  const listEl = document.getElementById('mhInboxList');
  const cntEl  = document.getElementById('mhInboxCount');
  if(!listEl) return;

  /* 💝 선물함은 이제 여기 없다 — 친구 관리(#mhFmTabs)로 갔다. renderGiftBox() 참고.
     _inboxFilter 에 옛 값이 남아 있으면 아무 탭에도 안 걸려 목록이 통째로 빈 채 뜨므로 되돌린다. */
  if(_inboxFilter === 'gift') _inboxFilter = 'all';

  /* 태그 탭 상태 반영.
     ⚠️ **반드시 #mhInboxTabs 안으로 좁힐 것.** 친구 관리 서브탭이 같은 .mh-ibx-tab 클래스를
       쓰기 때문에, 전역으로 걸면 여기서 그쪽 서브탭의 `on` 을 전부 떼어 버린다
       (data-tag 이 없으니 undefined !== 'all' 이라 항상 꺼진다). */
  document.querySelectorAll('#mhInboxTabs .mh-ibx-tab').forEach(t=>{
    t.classList.toggle('on', t.dataset.tag === _inboxFilter);
  });

  const merged = _inboxMerged();
  const ids = Object.keys(merged);
  const filtered = ids.filter(id=>{
    if(_inboxFilter === 'all') return true;
    return (merged[id].tag||'notice') === _inboxFilter;
  }).sort((a,b)=>{
    // 📌 고정 항목이 항상 먼저 — 그다음 최신순.
    const pa = merged[a].pinned ? 1 : 0, pb = merged[b].pinned ? 1 : 0;
    if(pa !== pb) return pb - pa;
    return (merged[b].ts||0) - (merged[a].ts||0);
  });

  const unreadN = ids.filter(id => !merged[id].read).length;
  if(cntEl) cntEl.textContent = unreadN > 0 ? `(안 읽음 ${unreadN})` : '';

  if(!filtered.length){
    listEl.innerHTML = '<div class="mh-ibx-empty">받은 메시지가 없어요</div>';
    return;
  }

  listEl.innerHTML = '';
  filtered.forEach(id=>{
    const m = merged[id];
    const tag = (m.tag==='update'||m.tag==='reward'||m.tag==='bug') ? m.tag : 'notice';
    const item = document.createElement('div');
    item.className = 'mh-ibx-item' + (m.read ? '' : ' unread') + (_inboxOpenId===id ? ' open' : '') + (m.pinned ? ' pinned' : '');

    const head = document.createElement('div'); head.className='mh-ibx-head';
    // 📌 고정 항목 표시 — 제목 앞 핀 아이콘
    if(m.pinned){
      const pin = document.createElement('span'); pin.className='mh-ibx-pin'; pin.textContent='📌'; pin.title='상단 고정됨';
      head.appendChild(pin);
    }
    const tagEl = document.createElement('span'); tagEl.className='mh-ibx-tag '+tag;
    tagEl.textContent = _inboxTagLabel(tag);
    const title = document.createElement('div'); title.className='mh-ibx-title';
    title.textContent = m.title || '(제목 없음)';
    const time = document.createElement('span'); time.className='mh-ibx-time';
    time.textContent = _inboxTimeStr(m.ts);
    const x = document.createElement('span'); x.className='mh-ibx-x'; x.textContent='×'; x.title='삭제';
    x.onclick = async (e)=>{
      e.stopPropagation();
      if(m._src === 'broadcast'){
        // 공용 공지: 관리자면 전체 삭제, 일반 유저는 "로컬 숨김(읽음 처리)"만
        if(isAdmin() && firebaseAPI.deleteInboxBroadcast){ try{ await firebaseAPI.deleteInboxBroadcast(id); }catch(err){} }
        else { _inboxBcMarkRead(id); renderInbox(); mhScheduler.refreshBellBadge(); }
        return;
      }
      if(!window.firebaseAPI || !firebaseAPI.deleteInboxMessage) return;
      try{ await firebaseAPI.deleteInboxMessage(getMyUserId(), id); }catch(err){}
    };
    // 📌 관리자 전용 고정 토글 — 공용 공지(broadcast)에만 노출. 클릭하면 pinned를 켜고/끄고 즉시 재정렬.
    let pinBtn = null;
    if(isAdmin() && m._src === 'broadcast' && firebaseAPI.setInboxBroadcastPinned){
      pinBtn = document.createElement('span');
      pinBtn.className = 'mh-ibx-pinbtn' + (m.pinned ? ' on' : '');
      pinBtn.textContent = '📌';
      pinBtn.title = m.pinned ? '고정 해제' : '상단 고정';
      pinBtn.onclick = async (e)=>{
        e.stopPropagation();
        const next = !m.pinned;
        try{
          const r = await firebaseAPI.setInboxBroadcastPinned(id, next);
          if(r && r.ok){
            if(_inboxBroadcast()[id]){ if(next) _inboxBroadcast()[id].pinned = true; else delete _inboxBroadcast()[id].pinned; }
            toast(next ? '📌 상단에 고정했어요' : '고정을 해제했어요');
            renderInbox();
          } else toast('변경에 실패했어요');
        }catch(_){ toast('변경에 실패했어요'); }
      };
    }
    head.appendChild(tagEl); head.appendChild(title); head.appendChild(time);
    if(pinBtn) head.appendChild(pinBtn);
    head.appendChild(x);

    const body = document.createElement('div'); body.className='mh-ibx-body';
    body.innerHTML = _linkifyText(m.body || '(내용 없음)');   // 본문 속 주소를 클릭 가능하게
    _bindExtLinks(body);

    item.appendChild(head); item.appendChild(body);
    item.onclick = ()=>{
      _inboxOpenId = (_inboxOpenId === id) ? null : id;
      // 펼치는 순간 읽음 처리 (소스별)
      if(_inboxOpenId === id && !m.read){
        if(m._src === 'broadcast'){ _inboxBcMarkRead(id); }
        else if(window.firebaseAPI && firebaseAPI.markInboxRead){ firebaseAPI.markInboxRead(getMyUserId(), id); }
        mhScheduler.refreshBellBadge();
      }
      // 🐞 답변 알림 — 펼치는 대신 버그제보 탭의 그 글로 간다(bug-board-ui.js)
      if(m.tag === 'bug' && m.bugId && typeof window._bugBoardOpen === 'function'){
        _inboxOpenId = null; window._bugBoardOpen(m.bugId); return;
      }
      renderInbox();
    };
    listEl.appendChild(item);
  });
}

return {
  renderMyHomeFriendList,                          // 👥 친구 목록 그리기 — 친구 구독 · 마이홈 열기 · 검색 입력
  friendSearchToggle: _mhFriendSearchToggle,       // 🔍 검색줄 열고 닫기 — Ctrl+F · Esc · ✕ · 탭 바꾸기 · 마이홈 닫기
  setFriendFilter: (v)=>{ _friendFilter = v; },    // 🔍 검색어 — 검색 입력
  friendRoomTag: _friendRoomTag,                   // 🔒 친구 방 코드(시크릿룸은 빈 값) — 친구 방 놀러 가기 연결
  friendInRoom: _friendInRoom,                     // 🏠 친구가 방에 있는가 — 방 초대 고르기 창
  renderInbox,                                     // 📩 수령함 그리기 — 수령함 · 공지 구독 · 우편함 탭 · 필터 · 모두 읽음
  setInboxFilter: (v)=>{ _inboxFilter = v; },      // 📩 태그 필터 — 수령함 탭 줄
  setInboxOpenId: (v)=>{ _inboxOpenId = v; },      // 📩 펼친 메시지 — 필터 바꾸면 비운다
  inboxTagLabel: _inboxTagLabel,                   // 📩 태그 이름 — 새 우편 토스트 · 관리자 공지 보내기 확인
  inboxTimeStr: _inboxTimeStr,                     // 📩 시각 글자 — 친구 관리(요청 · 보낸 요청)
  inboxUnreadCount: _inboxUnreadCount,             // 📩 안 읽은 수 — 🔔 벨 뱃지(스케줄러)
  inboxBcMarkAllRead: _inboxBcMarkAllRead,         // 📢 공용 공지 모두 읽음 — [모두 읽음]
  refreshFriendTabBadge: _refreshFriendTabBadge,   // 📩 우편함 탭 보상 배지 — 마이홈 열기 · 스케줄러
  linkifyText: _linkifyText,                       // 🔗 본문 주소 · 라이선스 키 — 업데이트 공지 팝업
  bindExtLinks: _bindExtLinks,                     // 🔗 링크 · 키 누르기(위임) — 업데이트 공지 팝업
  renderGiftBox,                                   // 💝 선물함 — 친구 관리 선물함 서브탭
  giftStat: _giftStat,                             // 💝 「⭐ n/20 · 보관 m/30」 — 친구 관리(다른 서브탭이면 비움)
  // 검사용
  inboxMerged: _inboxMerged,
  inboxUnreadReward: _inboxUnreadReward,
  mhHl: _mhHl,
  mhAsk: _mhAsk,
  state: ()=>({ selectedFriend: _mhSelectedFriend, friendFilter: _friendFilter, inboxFilter: _inboxFilter, inboxOpenId: _inboxOpenId }),
};
}

const api = { createMyHomeInbox };
if(typeof window !== 'undefined') window.TwMyHomeInbox = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

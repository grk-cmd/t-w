/* friend-manage.js — 👥 친구 관리(친구 탭 오른쪽 칸 — 받은 요청 · 보낸 요청 · 선물함 서브탭) · 👋 새 친구 요청 팝업 · 친구 탭 배지
   app.js 의 «🐞 버그 제보 탭» 구역에 섞여 있던 친구 쪽 코드(요청 팝업 · 👥 친구 관리 · 📤 보낸 요청)를 그대로 옮긴 모듈이다
   (앱 FSD 5번 — docs/APP_FSD_MAP.md). 동작은 옮기기 전과 같다. 같은 구역 앞머리의 🐞 버그 제보 탭(오픈카톡 기본 링크)은
   버그제보 게시판 화면 옆인 parts/bug-board-ui.js 끝으로 옮겼다.

   ★ 아래 본문은 app.js 에 있던 글 그대로다 — 들여쓰기도 바꾸지 않았다(옮기기 전 줄과 견주어 볼 수 있게).
     바뀐 것은 이름을 읽는 방법뿐이다.
       · _myFriendRequests → _myFriendRequests() · _myHomeFriends → _myHomeFriends() · myHomeOpen → myHomeOpen()
         app.js 가 나중에 다시 대입하는 let 이라(요청 구독 · 친구 목록 구독 · 마이홈 열고 닫기) 값이 아니라 읽는 함수로 받는다.
       · _inboxTimeStr 의 typeof 가드는 글자 그대로 두었다(받은 것이 함수라 늘 통과한다 — 예전에도 늘 정의돼 있던 이름이다).
   ★ 밖으로 내놓는 이름은 createFriendManage 의 반환값이다 — app.js 의 부르는 곳(🖥️ 구역의 요청 구독 · 마이홈 열기 ·
     탭 전환 · 친구 코드 추가 · 서브탭 · 일괄 처리 바)은 friendManage.이름 으로 부른다.
     다시 대입되던 _fmTab 은 setTab · tab 으로, _fmPicked(같은 Set 하나 — 다시 대입되지 않는다)는 picked 로.
   ★ createFriendManage 는 app.js 의 원래 자리에서 부른다. 만들 때 바로 도는 일은 없다(상태 초기값뿐).
   ⚠️ firebaseAPI · document · window · confirm 은 예전처럼 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwFriendManage — 크로미움 내장 전역과 겹치는 이름(Scheduler 같은)을 쓰면 typeof 가드가 늘 통과한다(#103).
   검사: checks/sim-friend-manage-module.js — 만들 때 배선 · 받은 요청 · 일괄 수락 · 거절 · 보낸 요청 · 팝업 · 배지 · app.js 배선 · html 순서.
         일괄 수락의 자리 계산 · 서브탭 클래스 공유는 sim-friend-manage 가, 선물함 표시 비우기는 sim-gift-star 가 이 파일을 읽어 본다. */
(function(){

function createFriendManage(deps){
const getMyUserId = deps.getMyUserId;
const toast = deps.toast;
const escHtml = deps.escHtml;
const _giftStat = deps.giftStat;                 // 🎁 서브탭 줄 오른쪽 「⭐ n/20 · 보관 m/30」 — app.js(선물함)
const renderGiftBox = deps.renderGiftBox;        // 🎁 선물함 서브탭 — app.js(같은 칸 #mhFmList 를 돌려 쓴다)
const _inboxTimeStr = deps.inboxTimeStr;
const myHomeOpen = deps.myHomeOpen;              // 🏠 마이홈이 열려 있는가 — app.js 의 let(다시 대입된다)
const _myHomeFriends = deps.myHomeFriends;       // 👥 친구 목록 캐시 — app.js 의 let(구독마다 다시 대입된다)
const _myFriendRequests = deps.myFriendRequests; // 👋 나에게 온 친구 요청 — app.js 의 let(구독마다 다시 대입된다)
const FRIEND_MAX = deps.friendMax;               // 👥 친구 상한 — app.js 한 곳(다섯 곳이 이 값 하나를 본다)

/* 👋 대기 중 친구 요청 팝업 — 요청이 여러 개면 한 번에 하나씩 순차로.

   ⚠️ **2단계에서 역할을 갈랐다.** 예전엔 마이홈을 열 때마다 밀린 요청을 전부 모달로 물었다.
     이제 '친구 관리'(친구 탭 오른쪽 칸)가 밀린 요청을 맡으므로, 팝업은
     **마이홈이 열려 있는 동안 새로 도착한 요청**에만 뜬다(호출부 한 곳: 요청 구독 콜백).
     게다가 지금 보고 있는 화면이 바로 그 목록이면(_fmReqVisible) 팝업조차 뜨지 않는다 —
     뒤에 같은 줄이 이미 보이는데 모달로 한 번 더 묻는 꼴이라서다.
     둘을 이렇게 갈라두면 "팝업에서 거절했는데 목록에 남아 있다" 가 애초에 생기지 않는다
     (양쪽 모두 같은 firebaseAPI 를 부르고, 구독 콜백이 목록을 다시 그린다).

   onlyIds: 이 요청들만 묻는다. 생략하면 전부 — 지금 생략해서 부르는 곳은 없다. */
let _friendReqPopupBusy = false;
async function showFriendRequestPopup(onlyIds){
  if(_friendReqPopupBusy) return;
  let ids = Object.keys(_myFriendRequests() || {});
  if(Array.isArray(onlyIds)) ids = ids.filter(id => onlyIds.includes(id));
  if(!ids.length) return;
  _friendReqPopupBusy = true;
  // 오래된 순으로(ts 오름차순) — 먼저 온 요청부터 처리
  ids.sort((a,b)=> ((_myFriendRequests()[a]||{}).ts||0) - ((_myFriendRequests()[b]||{}).ts||0));
  for(const fromId of ids){
    // 처리 도중 이미 사라진 요청은 건너뜀 (다른 클라이언트에서 처리됐거나 상대가 취소)
    if(!_myFriendRequests()[fromId]) continue;
    const req = _myFriendRequests()[fromId];
    const nm = req.name || '(이름 없음)';
    const answer = await new Promise(resolve=>{
      const ov = document.createElement('div');
      ov.className = 'friend-req-popup-ov app-popup-ov';
      ov.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;pointer-events:auto;';
      const box = document.createElement('div');
      box.style.cssText = 'width:300px;background:var(--win-face);border:2px solid;border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);box-shadow:inset -1px -1px 0 var(--win-lo), inset 1px 1px 0 var(--win-face-2), 4px 4px 0 rgba(0,0,0,.35);font-family:Tahoma,"Malgun Gothic",sans-serif;';
      box.innerHTML =
        '<div style="background:linear-gradient(90deg, var(--win-title-a), var(--win-title-b));color:#fff;padding:5px 8px;font-size:12px;font-weight:bold;">👋 친구 요청</div>' +
        '<div style="padding:16px 14px;color:var(--ink);font-size:12px;line-height:1.6;">' +
          '<b>' + escHtml(nm) + '</b> 님이 친구 요청을 보냈어요.<br>수락하면 서로 친구가 돼요.' +
        '</div>' +
        '<div style="display:flex;gap:6px;padding:0 14px 14px;justify-content:flex-end;">' +
          '<button class="lc-btn" data-a="ok" style="min-width:70px;">수락</button>' +
          '<button class="lc-btn ghost" data-a="no" style="min-width:70px;">거절</button>' +
        '</div>';
      ov.appendChild(box); document.body.appendChild(ov);
      const done = (val)=>{ try{ ov.remove(); }catch(_){} resolve(val); };
      box.querySelector('[data-a="ok"]').onclick = ()=>done('ok');
      box.querySelector('[data-a="no"]').onclick = ()=>done('no');
    });
    if(answer === 'ok'){
      if(Object.keys(_myHomeFriends()).length >= FRIEND_MAX){
        toast('친구는 최대 '+FRIEND_MAX+'명까지만 추가할 수 있어요 — 나중에 자리를 만든 뒤 다시 요청받아 주세요');
        continue;   // 이 요청은 남겨둠 — 나중에 처리
      }
      try{
        await firebaseAPI.acceptFriendRequest(getMyUserId(), fromId);
        toast(nm + ' 님과 친구가 됐어요');
      }catch(e){ toast('수락에 실패했어요'); }
    } else if(answer === 'no'){
      try{ await firebaseAPI.rejectFriendRequest(getMyUserId(), fromId); }
      catch(e){ toast('거절에 실패했어요'); }
    }
  }
  _friendReqPopupBusy = false;
}
/* ── 👥 친구 관리 (친구 탭 오른쪽 칸) ─────────────────────────────────────
   수령함이 우편함 탭으로 나가면서 비게 된 칸이다. 서브탭은 **받은 요청 · 선물함** 둘.

   📤 보낸 요청은 **(나) 미러 노드 + 존재 확인**으로 갔다.
     스키마가 friendRequests/{받는사람}/{보낸사람} 이라 "내가 보낸 것"을 서버에서 못 찾으므로,
     보낼 때 sentFriendRequests/{나}/{상대} 에 한 벌 더 적어 그것을 목록으로 쓴다.
     ⚠️ **미러만 믿으면 안 된다.** 구버전 클라이언트가 수락하면 진짜 요청은 사라지는데
       미러를 지우는 줄이 그쪽 코드에 없어 '기다리는 중'이 영영 남는다. 그래서 목록을 열 때
       한 건씩 isFriendRequestAlive() 로 확인하고, 죽은 것은 화면에서 빼고 서버에서도 치운다.
     ⚠️ 규칙 파일(firebase-database-rules.json)에 sentFriendRequests 블록이 **먼저 배포돼 있어야**
       한다. 순서가 뒤바뀌면 루트가 .write:false 라 미러 쓰기가 전부 거부되고,
       요청은 가는데 보낸 목록만 비는 모양이 된다.

   ⚠️ 서브탭은 수령함과 **같은 .mh-ibx-tab 클래스**를 쓴다(검사 12·15의 축이라 새 클래스를
     만들지 않는다). 대신 클릭 바인딩과 `on` 표시를 반드시 **컨테이너로 좁혀야** 한다 —
     전역 `.mh-ibx-tab` 으로 걸면 여기 서브탭이 수령함 태그 필터까지 바꾼다. */
let _fmTab = 'req';          // 'req' | 'sent' | 'gift'
let _fmPicked = new Set();   // 체크된 요청 fromId — 렌더를 넘어 유지된다
let _fmSent = null;          // 📤 보낸 요청 { [상대id]: {ts, toName?, toCode?} } — null = 아직 안 읽음
let _fmSentBusy = false;     // 목록을 읽는 중 (중복 요청 방지)

/* 📤 보낸 요청 한 줄의 이름표 — **닉네임이 앞, 코드가 뒤**(닉네임 (MATE-9K2M)).
   코드로 추가하면 이름을 모른 채 요청이 나가서 예전엔 코드만 덩그러니 떴다.
   ⚠️ 둘 중 하나만 있는 경우가 정상이다 — 좌석 우클릭으로 보낸 건은 코드가 없고(uid 로 보냄),
     구버전이 남긴 미러는 이름표가 통째로 없다. 그래서 폴백이 세 단이다.
   ⚠️ 여기서 escHtml 을 부르지 말 것. 부르는 쪽이 textContent 에 넣는다(이중 이스케이프가 된다). */
function _fmSentLabel(m, toId){
  const name = (m && m.toName) ? String(m.toName).trim() : '';
  const code = (m && m.toCode) ? String(m.toCode).trim() : '';
  if(name && code) return name + ' (' + code + ')';
  if(name) return name;
  if(code) return code;
  return '상대 ' + String(toId).slice(0, 6);
}
/* 이름표를 한 줄 안에 그린다 — 닉네임은 그대로, 코드는 .mh-req-code 로 한 단 흐리게.
   ⚠️ innerHTML 을 쓰지 않는다(검사 19). 닉네임은 남이 정한 문자열이라 노드로 붙인다. */
function _fmSentFillName(el, m, toId){
  if(!el) return;
  const name = (m && m.toName) ? String(m.toName).trim() : '';
  const code = (m && m.toCode) ? String(m.toCode).trim() : '';
  el.textContent = '';
  if(name && code){
    el.appendChild(document.createTextNode(name + ' '));
    const c = document.createElement('span');
    c.className = 'mh-req-code'; c.textContent = '(' + code + ')';
    el.appendChild(c);
  } else {
    el.textContent = _fmSentLabel(m, toId);
  }
  el.title = _fmSentLabel(m, toId);
}
/* 이름 조회 캐시 — 같은 상대를 목록 열 때마다 다시 읽지 않는다.
   ⚠️ 실패(null)도 캐시한다. 탈퇴했거나 프로필이 없는 상대를 목록 열 때마다 다시 물으면
     보낸 요청 수만큼 헛 왕복이 매번 난다. 실패는 코드 폴백으로 충분히 읽힌다. */
const _fmNameCache = new Map();
async function _fmLookupName(uid){
  if(!uid) return null;
  if(_fmNameCache.has(uid)) return _fmNameCache.get(uid);
  let nm = null;
  try{
    if(window.firebaseAPI && firebaseAPI.getUserNameById) nm = await firebaseAPI.getUserNameById(uid);
  }catch(_){ return null; }   // 네트워크 실패는 캐시하지 않는다 — 다음에 다시 시도한다
  nm = (nm && String(nm).trim()) || null;
  _fmNameCache.set(uid, nm);
  return nm;
}

// 지금 '받은 요청' 목록이 눈앞에 보이는가 — 팝업을 띄울지 말지의 유일한 기준
function _fmReqVisible(){
  if(!myHomeOpen()) return false;
  const on = document.querySelector('#myHomeTabs .mh-tab.on');
  return !!(on && on.dataset.tab === 'friend' && _fmTab === 'req');
}
// 남은 친구 자리. ⚠️ 숫자를 다시 박지 말 것 — 상한은 FRIEND_MAX 한 곳에서만 나온다.
function _fmSeatsLeft(){ return FRIEND_MAX - Object.keys(_myHomeFriends() || {}).length; }

function renderFriendManage(){
  if(_fmTab !== 'gift') _giftStat('');
  document.querySelectorAll('#mhFmTabs .mh-ibx-tab').forEach(t=>{
    t.classList.toggle('on', t.dataset.fm === _fmTab);
  });
  if(_fmTab !== 'req'){
    const bar = document.getElementById('mhFmBar');
    if(bar) bar.classList.remove('on');   // 일괄 처리 바는 '받은 요청' 전용이다
    const listEl = document.getElementById('mhFmList');
    if(listEl && _fmTab === 'gift') renderGiftBox(listEl);
    if(listEl && _fmTab === 'sent') renderSentRequests(listEl);
    // 서브탭 이름의 (n) 은 다른 서브탭을 보고 있어도 맞아야 한다
    renderFriendRequests();
    return;
  }
  renderFriendRequests();
}

/* ── 📤 보낸 요청 ────────────────────────────────────────────────────────
   미러 노드(sentFriendRequests/{나})를 읽고, **한 건씩 진짜 요청이 살아 있는지 확인**한다.
   살아 있으면 '기다리는 중', 죽었으면(상대가 수락/거절했거나 구버전으로 처리) 목록에서 빼고
   서버의 미러도 치운다 — 다음에 열 때는 확인 자체가 줄어든다(자가 치유).

   ⚠️ 구독이 아니라 **서브탭을 열 때 한 번**이다. 상시 구독으로 만들면 친구 수 × 4 인
     기존 구독에 보낸 요청 수만큼이 더 붙는다(친구 100명 상한을 정할 때 센 그 축이다).
   ⚠️ 확인이 실패하면(네트워크 등) 살아 있는 것으로 본다 — 멀쩡한 요청을 목록에서 지우는 쪽이
     더 나쁘다. isFriendRequestAlive 가 catch 에서 true 를 돌려주는 이유다. */
async function renderSentRequests(listEl){
  if(!listEl) return;
  if(_fmSentBusy) return;
  _fmSentBusy = true;
  listEl.onclick = null;   // 선물함이 걸어둔 위임 클릭 해제 (같은 칸을 돌려 쓴다)
  if(_fmSent === null) listEl.innerHTML = '<div class="mh-ibx-empty">불러오는 중…</div>';
  try{
    const api = window.firebaseAPI;
    if(!api || !api.getSentFriendRequests){
      listEl.innerHTML = '<div class="mh-ibx-empty">아직 준비 중이에요</div>';
      return;
    }
    const raw = await api.getSentFriendRequests(getMyUserId()) || {};
    const ids = Object.keys(raw);
    // 살아 있는 것만 남긴다 — 죽은 미러는 서버에서도 치운다
    const alive = [];
    for(const toId of ids){
      let ok = true;
      if(api.isFriendRequestAlive) ok = await api.isFriendRequestAlive(toId, getMyUserId());
      if(ok) alive.push(toId);
      else if(api.pruneSentFriendRequest) api.pruneSentFriendRequest(getMyUserId(), toId);   // 기다리지 않는다
    }
    _fmSent = {};
    alive.forEach(id => { _fmSent[id] = raw[id]; });
    _fmSyncSentCount();
    if(!alive.length){
      listEl.innerHTML = '<div class="mh-ibx-empty">📤 기다리는 중인 요청이 없어요' +
        '<br><small>상대가 수락하면 목록에서 저절로 사라져요</small></div>';
      return;
    }
    alive.sort((a,b)=> (raw[b].ts||0) - (raw[a].ts||0));   // 최근에 보낸 것이 위
    listEl.innerHTML = '';
    alive.forEach(toId=>{
      const m = raw[toId] || {};
      const row = document.createElement('div');
      row.className = 'mh-req';

      const main = document.createElement('div'); main.className = 'mh-req-main';
      const nm = document.createElement('div'); nm.className = 'mh-req-nm';
      // 닉네임 (코드) 순. 이름표가 아예 없으면(구버전이 보낸 미러) 상대 id 를 짧게 — 빈 줄보다는 낫다
      _fmSentFillName(nm, m, toId);
      /* 🔎 이름이 비어 있는 건(=코드로 보낸 옛 요청)만 뒤늦게 채운다. 보내는 쪽이 이제 이름표를
         같이 적으므로 이 경로는 **이미 쌓여 있던 요청**에만 돈다. 화면은 먼저 그려두고 이름이
         오면 그 줄만 갈아끼운다 — 목록 전체를 다시 그리면 취소 버튼 상태가 날아간다. */
      if(!m.toName){
        _fmLookupName(toId).then(n=>{
          if(!n) return;
          m.toName = n;                                   // _fmSent 와 같은 객체다 — 다시 열어도 유지된다
          _fmSentFillName(nm, m, toId);
        }).catch(()=>{});
      }
      const sub = document.createElement('div'); sub.className = 'mh-req-sub';
      sub.textContent = (m.ts && typeof _inboxTimeStr === 'function') ? (_inboxTimeStr(m.ts) + '에 보냄') : '';
      main.appendChild(nm); main.appendChild(sub);

      const pend = document.createElement('span');
      pend.className = 'mh-req-pend'; pend.textContent = '기다리는 중';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button'; cancelBtn.textContent = '취소';
      cancelBtn.onclick = async ()=>{
        cancelBtn.disabled = true;
        if(!api.cancelFriendRequest){ toast('아직 준비 중이에요'); cancelBtn.disabled = false; return; }
        const r = await api.cancelFriendRequest(getMyUserId(), toId);
        if(r && r.ok){
          toast('요청을 취소했어요');
          if(_fmSent) delete _fmSent[toId];
          _fmSyncSentCount();
          row.remove();
          if(!Object.keys(_fmSent || {}).length) renderSentRequests(listEl);   // 빈 목록 안내로 되돌린다
        } else {
          toast('취소에 실패했어요');
          cancelBtn.disabled = false;
        }
      };
      const btns = document.createElement('div'); btns.className = 'mh-req-btns';
      btns.appendChild(cancelBtn);
      row.appendChild(main); row.appendChild(pend); row.appendChild(btns);
      listEl.appendChild(row);
    });
  }catch(e){
    listEl.innerHTML = '<div class="mh-ibx-empty">목록을 불러오지 못했어요<br><small>잠시 뒤 다시 열어 주세요</small></div>';
  }finally{
    _fmSentBusy = false;
  }
}
// 📤 서브탭 이름의 (n) — 아직 안 읽었으면 숫자를 안 붙인다(0 으로 보이면 없는 줄 안다)
function _fmSyncSentCount(){
  const tab = document.querySelector('#mhFmTabs .mh-ibx-tab[data-fm="sent"]');
  if(!tab) return;
  const n = _fmSent ? Object.keys(_fmSent).length : null;
  tab.textContent = '📤 보낸 요청' + (n ? ' (' + n + ')' : '');
}

/* 수락 한 건 — **단건과 일괄이 같은 함수를 쓴다.** 자리 판정과 문구가 두 벌이 되면 한쪽만
   고쳐진다(친구 상한을 50→100 으로 올릴 때 겪은 종류).
   ⚠️ seats 를 호출자가 세어 넘기는 것이 핵심이다. 서버 왕복 뒤에도 _myHomeFriends 는
     구독 콜백이 와야 갱신되므로, 매 건 다시 세면 **자리가 1칸인데 3건이 전부 통과한다.** */
async function _fmAcceptOne(fromId, seats){
  if(!window.firebaseAPI || !firebaseAPI.acceptFriendRequest) return 'noapi';
  if(seats <= 0) return 'full';
  try{
    await firebaseAPI.acceptFriendRequest(getMyUserId(), fromId);
    return 'ok';
  }catch(e){ return 'err'; }
}

// 일괄 처리 바 상태 동기화 — 선택 수/전체선택 체크박스/버튼 활성
function _fmSyncBar(){
  const bar = document.getElementById('mhFmBar');
  if(!bar) return;
  const total = Object.keys(_myFriendRequests() || {}).length;
  const n = _fmPicked.size;
  const sel = document.getElementById('mhFmBarSel');
  if(sel) sel.textContent = n
    ? (total + '개 중 ' + n + '개 선택됨')
    : (total + '개 요청 · 줄을 체크하면 한 번에 처리할 수 있어요');
  const all = document.getElementById('mhFmAll');
  if(all){ all.checked = total > 0 && n === total; all.indeterminate = n > 0 && n < total; }
  const a = document.getElementById('mhFmAcceptSel');
  const r = document.getElementById('mhFmRejectSel');
  if(a) a.disabled = (n === 0);
  if(r) r.disabled = (n === 0);
}

/* 👋 받은 요청 목록 렌더.
   ⚠️ 예전엔 친구 목록 위 #mhReqSection 에 그렸다. 그 마크업은 지웠다 — 안 지우면
     같은 요청이 두 군데에 뜬다. */
function renderFriendRequests(){
  const ids = Object.keys(_myFriendRequests() || {});
  // (a) 서브탭 이름의 (n) 과 친구 탭 배지는 **어느 화면에 있든** 항상 갱신한다
  const tabBtn = document.querySelector('#mhFmTabs .mh-ibx-tab[data-fm="req"]');
  if(tabBtn) tabBtn.textContent = '👋 받은 요청' + (ids.length ? ' (' + ids.length + ')' : '');
  _refreshFriendReqBadge();
  // (b) 그 사이 사라진 요청은 선택에서도 뺀다 (다른 기기·팝업에서 처리됐거나 상대가 취소)
  _fmPicked.forEach(id=>{ if(!_myFriendRequests()[id]) _fmPicked.delete(id); });

  const list = document.getElementById('mhFmList');
  const bar  = document.getElementById('mhFmBar');
  if(!list) return;
  if(_fmTab !== 'req') return;   // 선물함을 보고 있으면 목록은 건드리지 않는다

  if(!ids.length){
    if(bar) bar.classList.remove('on');
    list.onclick = null;
    list.innerHTML = '<div class="mh-ibx-empty">👋 받은 친구 요청이 없어요' +
      '<br><small>내 친추 코드를 받은 사람이 요청을 보내면 여기에 표시돼요</small></div>';
    return;
  }
  if(bar) bar.classList.add('on');
  list.onclick = null;   // ⚠️ 선물함이 걸어둔 위임 클릭을 떼어낸다 — 같은 칸(#mhFmList)을 돌려 쓰기 때문
  ids.sort((a,b)=> ((_myFriendRequests()[b]||{}).ts||0) - ((_myFriendRequests()[a]||{}).ts||0));   // 최근이 위
  list.innerHTML = '';
  ids.forEach(fromId=>{
    const req = _myFriendRequests()[fromId] || {};
    const row = document.createElement('div');
    row.className = 'mh-req' + (_fmPicked.has(fromId) ? ' picked' : '');

    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = _fmPicked.has(fromId); cb.title = '선택';
    cb.onclick = ()=>{
      if(cb.checked) _fmPicked.add(fromId); else _fmPicked.delete(fromId);
      row.classList.toggle('picked', cb.checked);
      _fmSyncBar();
    };

    const main = document.createElement('div'); main.className = 'mh-req-main';
    const nm = document.createElement('div'); nm.className = 'mh-req-nm';
    nm.textContent = req.name || '(이름 없음)'; nm.title = req.name || '';
    const sub = document.createElement('div'); sub.className = 'mh-req-sub';
    sub.textContent = (req.ts && typeof _inboxTimeStr === 'function') ? _inboxTimeStr(req.ts) : '';
    main.appendChild(nm); main.appendChild(sub);

    const okBtn = document.createElement('button');
    okBtn.className = 'ok'; okBtn.type = 'button'; okBtn.textContent = '수락';
    const noBtn = document.createElement('button');
    noBtn.type = 'button'; noBtn.textContent = '거절';
    const lock   = ()=>{ okBtn.disabled = true;  noBtn.disabled = true;  };
    const unlock = ()=>{ okBtn.disabled = false; noBtn.disabled = false; };

    okBtn.onclick = async ()=>{
      lock();
      const r = await _fmAcceptOne(fromId, _fmSeatsLeft());
      if(r === 'ok'){ toast((req.name || '친구') + ' 님과 친구가 됐어요'); _fmPicked.delete(fromId); return; }
      // 자리가 없으면 요청은 **남겨둔다** — 지우면 상대가 다시 보내야 한다
      if(r === 'full') toast('친구는 최대 ' + FRIEND_MAX + '명까지만 추가할 수 있어요');
      else if(r === 'err') toast('수락에 실패했어요');
      unlock();
    };
    noBtn.onclick = async ()=>{
      if(!window.firebaseAPI || !firebaseAPI.rejectFriendRequest) return;
      lock();
      try{ await firebaseAPI.rejectFriendRequest(getMyUserId(), fromId); _fmPicked.delete(fromId); }
      catch(e){ toast('거절에 실패했어요'); unlock(); }
    };

    const btns = document.createElement('div'); btns.className = 'mh-req-btns';
    btns.appendChild(okBtn); btns.appendChild(noBtn);
    row.appendChild(cb); row.appendChild(main); row.appendChild(btns);
    list.appendChild(row);
  });
  _fmSyncBar();
}

/* 선택 일괄 수락.
   ⚠️ **자리를 매 건 확인한다.** 3건을 한 번에 수락하는데 자리가 1개뿐이면 하나만 받고
     나머지 둘은 목록에 그대로 남긴 채 안내한다(요청을 지우면 안 된다).
     단건 수락(위)과 같은 문구·같은 함수를 쓴다. */
async function _fmBulkAccept(){
  const ids = [..._fmPicked].filter(id => _myFriendRequests()[id]);
  if(!ids.length){ toast('선택된 요청이 없어요'); return; }
  ids.sort((a,b)=> ((_myFriendRequests()[a]||{}).ts||0) - ((_myFriendRequests()[b]||{}).ts||0));   // 먼저 온 요청이 먼저 자리를 받는다
  /* ⚠️ 한 줄에 몰아 선언하지 말 것 — 검사 6(const 재대입)은 `let a, b, c` 의 **첫 이름만**
     let 으로 등록한다. ok/full/err 는 app.js 어딘가에 const 로도 있어서, 몰아 쓰면
     `err++` 가 const 재대입으로 잡힌다(실제로 걸렸다). */
  let seats = _fmSeatsLeft();
  let ok = 0;
  let full = 0;
  let err = 0;
  for(const id of ids){
    if(!_myFriendRequests()[id]) continue;   // 그 사이 다른 기기에서 처리됨
    const r = await _fmAcceptOne(id, seats);
    if(r === 'ok'){ ok++; seats--; _fmPicked.delete(id); }
    else if(r === 'full') full++;
    else err++;
  }
  if(ok)   toast(ok + '명과 친구가 됐어요');
  if(full) toast('친구는 최대 ' + FRIEND_MAX + '명까지만 추가할 수 있어요 — ' + full + '건은 자리가 없어 그대로 남겨뒀어요');
  if(err)  toast(err + '건은 수락에 실패했어요');
  if(!ok && !full && !err) toast('처리할 요청이 없었어요');
  renderFriendRequests();
}

async function _fmBulkReject(){
  const ids = [..._fmPicked].filter(id => _myFriendRequests()[id]);
  if(!ids.length){ toast('선택된 요청이 없어요'); return; }
  if(!confirm(ids.length + '건의 친구 요청을 거절할까요?')){ window.focus(); return; }
  window.focus();
  if(!window.firebaseAPI || !firebaseAPI.rejectFriendRequest){ toast('아직 준비 중이에요'); return; }
  let ok = 0;
  let err = 0;   // ⚠️ 검사 6 — 한 줄에 몰아 선언하면 둘째부터 const 재대입으로 잡힌다
  for(const id of ids){
    if(!_myFriendRequests()[id]) continue;
    try{ await firebaseAPI.rejectFriendRequest(getMyUserId(), id); ok++; _fmPicked.delete(id); }
    catch(e){ err++; }
  }
  if(ok)  toast(ok + '건을 거절했어요');
  if(err) toast(err + '건은 처리에 실패했어요');
  renderFriendRequests();
}

/* 👋 받은 요청이 있으면 **친구 탭**에 배지.
   ⚠️ 우편함 탭 배지(_refreshFriendTabBadge)와 **다른 탭**이다 — 이름이 비슷하니 헷갈리지 말 것.
     이 배지는 "마이홈 열 때 밀린 요청을 전부 팝업으로 묻던" 자리를 메운다. 팝업만 빼고
     이걸 안 넣으면, 밀린 요청이 있어도 친구 탭을 직접 열어봐야만 알 수 있게 된다. */
function _refreshFriendReqBadge(){
  const tab = document.querySelector('#myHomeTabs .mh-tab[data-tab="friend"]');
  if(!tab) return;
  const n = Object.keys(_myFriendRequests() || {}).length;
  let badge = tab.querySelector('.mh-tab-badge');
  if(n > 0){
    if(!badge){ badge = document.createElement('span'); badge.className = 'mh-tab-badge'; tab.appendChild(badge); }
    badge.textContent = n > 9 ? '9+' : String(n);
    badge.style.display = 'inline-block';
  } else if(badge){
    badge.style.display = 'none';
  }
}

return {
  showFriendRequestPopup,                          // 👋 새로 온 요청 팝업 — 요청 구독 콜백(유일한 호출부)
  reqVisible: _fmReqVisible,                       // 지금 '받은 요청' 목록이 눈앞에 보이는가 — 팝업을 띄울지의 기준
  renderFriendManage,                              // 👥 친구 관리 칸 다시 그리기 — 마이홈 열기 · 친구 탭 · 서브탭 클릭
  renderFriendRequests,                            // 👋 받은 요청 목록 · (n) · 친구 탭 배지 — 요청 구독 · 전체 선택
  refreshFriendReqBadge: _refreshFriendReqBadge,   // 친구 탭 배지 — 마이홈 열기
  lookupName: _fmLookupName,                       // 📤 이름 조회(캐시) — 친구 코드로 추가할 때 이름표
  bulkAccept: _fmBulkAccept,                       // 일괄 처리 바 [선택 수락]
  bulkReject: _fmBulkReject,                       // 일괄 처리 바 [선택 거절]
  setTab: (t)=>{ _fmTab = t; },                    // 서브탭 클릭 — 'req' | 'sent' | 'gift'
  tab: ()=>_fmTab,
  picked: _fmPicked,                               // 체크된 요청 fromId(같은 Set) — 전체 선택 체크박스
  acceptOne: _fmAcceptOne,                         // 검사용(sim-friend-manage — 자리 계산)
  seatsLeft: _fmSeatsLeft,                         // 검사용
};
}

const api = { createFriendManage };
if(typeof window !== 'undefined') window.TwFriendManage = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

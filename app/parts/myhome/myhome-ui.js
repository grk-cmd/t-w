/* myhome-ui.js — 🏠 마이홈 창 버튼 연결(bindMyHomeUI) — 열기 · 닫기 · 탭 · 프로필 레일
   app.js «🏠 마이홈 창 버튼 연결(bindMyHomeUI)» 구역의 본문을 그대로 옮긴 모듈이다(앱 FSD 22번 — docs/APP_FSD_MAP.md). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 12줄 —
     _mhViewingUserId · _myFriendRequests · _myHomeFriends · isAdmin · myHomeOpen · myHomeSticker 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setMyHomeOpen(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 12개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: renderMhProfileRail · syncFriendsOpen — app.js 는 myHomeUiMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwMyHomeUi — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-myhome-ui.js */
(function(){

function createMyHomeUi(deps){
const twNav = deps.twNav;   // 🧭 창 열기 통로(nav.js)
const FRIEND_MAX = deps.FRIEND_MAX;
const MY_FRIEND_CODE_KEY = deps.MY_FRIEND_CODE_KEY;
const _mhApplyVisitUI = deps._mhApplyVisitUI;
const _mhCloseStickerAnim = deps._mhCloseStickerAnim;
const _mhViewingUserId = deps._mhViewingUserId;   // 읽는 함수
const _myFriendRequests = deps._myFriendRequests;   // 읽는 함수
const _myHomeFriends = deps._myHomeFriends;   // 읽는 함수
const _saveFailMsg = deps._saveFailMsg;
const applyDesktopRunClass = deps.applyDesktopRunClass;
const closeFriendHomeView = deps.closeFriendHomeView;
const escRegisterWindow = deps.escRegisterWindow;
const friendManage = deps.friendManage;
const friendsForCheck = deps.friendsForCheck;   // 👥 판정용 친구 목록(friends-sub.js) — 못 받았으면 한 번 읽고 · 실패면 null(토스트는 거기서)
const friendsRetry = deps.friendsRetry;   // 👥 친구 목록을 못 불러왔으면 다시 건다(친구 탭을 열 때)
const friendsOpen = deps.friendsOpen;     // 👥 친구 목록이 보이기 시작함(friends-sub open — 이름 · 사진 다시 받기)
const friendsClose = deps.friendsClose;   // 👥 친구 목록이 안 보이게 됨
const getDisplayName = deps.getDisplayName;
const getMyUserId = deps.getMyUserId;
const inboxMod = deps.inboxMod;
const isAdmin = deps.isAdmin;   // 읽는 함수
const loadMyHomePage = deps.loadMyHomePage;
const mhScheduler = deps.mhScheduler;
const myHomeOpen = deps.myHomeOpen;   // 읽는 함수
const myHomeSticker = deps.myHomeSticker;   // 읽는 함수
const renderMyHomePage = deps.renderMyHomePage;
const renderMyHomeStickers = deps.renderMyHomeStickers;
const toast = deps.toast;
const setMyHomeOpen = deps.setMyHomeOpen;   // 쓰는 함수
const mhHooks = TwMyHomeHooks;   // 🪝 마이홈 고리판(myhome-hooks.js) — BGM 창 자리를 걸고, 저장 · BGM 창 · 스튜디오 닫기는 편집 묶음 것을 부른다
// 🖼 우측 프로필 레일 — 위 칸: 선택한 친구의 마이홈 프로필 사진(없으면 [상대 없음] 빈 박스),
//   아래 칸: 내 마이홈 프로필 사진(마이홈 탭에서 등록한 사진과 자동 연동, 없으면 안내 문구).
// 프로필 레일은 수령함 확장으로 제거됨 — 기존 호출부가 있어 no-op으로 유지
function renderMhProfileRail(){ /* 제거됨 */ }
/* 👥 친구 목록이 «보이는 동안» = 마이홈이 떠 있고(.on) 친구 탭(#mhPageFriend.on)일 때만 friends-sub 에 «열림».
   여는 길이 여럿이라(열기 · 친구 홈 구경 · 런처 복귀 · 단축키) 부르는 자리를 늘리지 않고, app.js 가 두 칸의 class 를 지켜보다 이것을 부른다. */
function syncFriendsOpen(){
  const ov = document.getElementById('myHomeOverlay'), pf = document.getElementById('mhPageFriend');
  const on = !!ov && ov.classList.contains('on') && !!pf && pf.classList.contains('on');
  if(on) friendsOpen('myhome'); else friendsClose('myhome');
}
(function bindMyHomeUI(){
  const btn=document.getElementById('fsMyHomeBtn');   // ★ 상태칩 독립 버튼 대신 설정창 안 버튼으로 이동
  const overlay=document.getElementById('myHomeOverlay');
  const closeBtn=document.getElementById('myHomeClose');
  if(!overlay) return;
  // ★ 마이홈3: 마이홈 창을 DOM 드래그로 이동 — 이전엔 -webkit-app-region:drag였는데 그러면 Electron이
  //   OS 창(캐릭터·설정창 포함 전체)을 이동시켜버림. 마이홈 창(#myHomeWin)만 옮겨져야 하므로 pointer
  //   이벤트로 left/top을 직접 조작.
  //   BGM 자식창은 별도 OS 창이라 자동으로 따라오지 않으므로, 이동/열림/닫힘마다 setBgmBounds로
  //   마이홈 사각형을 main.js에 전달해서 BGM 창이 그 뒤로 정확히 숨도록 함(요청사항 4).
  function _mhSyncBgmBounds(){
    if(!(window.companion && companion.setBgmBounds)) return;
    const win=document.getElementById('myHomeWin');
    if(!win) return;
    const r=win.getBoundingClientRect();
    if(r.width<10) return;   // 마이홈 렌더 전 등 무효 좌표는 무시
    companion.setBgmBounds({x:r.left, y:r.top, w:r.width, h:r.height});
  }
  window._mhSyncBgmBounds = _mhSyncBgmBounds;   // 다른 훅(open/close/resize)에서 재사용
  mhHooks.on(mhHooks.HOOK.SYNC_BGM_BOUNDS, _mhSyncBgmBounds);   // 편집 묶음 · 바탕화면 · 설정 패널은 고리판으로 부른다
  (function bindMhDrag(){
    const win=document.getElementById('myHomeWin');
    const title=document.getElementById('myHomeTitle');
    if(!win || !title) return;
    let dragging=false, offX=0, offY=0, dragScreenX=0, dragScreenY=0, dragMovesOsWindow=false;
    title.addEventListener('pointerdown', e=>{
      if(e.target.closest && e.target.closest('#myHomeClose, #mhEditHomeBtn, #mhBackHomeBtn, #mhPreviewBtn, #mhPreviewExitBtn, #mhMallangHideBtn')) return;
      dragging=true;
      // 런처(=런처 카드가 켜져 있는) 화면에선 마이홈 창이 뷰포트보다 커서 DOM 드래그로는 사실상 못 옮김 —
      //  이 경우엔 OS 창(Electron mainWindow) 자체를 이동. deskBar grip과 같은 방식.
      const launcherOn = document.getElementById('launcher')?.classList.contains('on');
      dragMovesOsWindow = !!(launcherOn && window.companion && companion.moveWindow);
      if(dragMovesOsWindow){
        dragScreenX = e.screenX; dragScreenY = e.screenY;
      } else {
        const r=win.getBoundingClientRect();
        offX=e.clientX-r.left; offY=e.clientY-r.top;
        win.style.transform='none';
        win.style.left = r.left+'px';
        win.style.top  = r.top +'px';
      }
      try{ title.setPointerCapture(e.pointerId); }catch(_){}
      e.preventDefault();
    });
    title.addEventListener('pointermove', e=>{
      if(!dragging) return;
      if(dragMovesOsWindow){
        companion.moveWindow(e.screenX-dragScreenX, e.screenY-dragScreenY);
        dragScreenX = e.screenX; dragScreenY = e.screenY;
        return;
      }
      const x=e.clientX-offX, y=e.clientY-offY;
      const w=win.offsetWidth, h=win.offsetHeight;
      // run 모드(전체 데스크탑 오버레이)에선 뷰포트 안에 clamp — 창 전체가 화면 안에 남게.
      const maxLeft = Math.max(0, innerWidth  - w);
      const maxTop  = Math.max(0, innerHeight - h);
      win.style.left = Math.max(0, Math.min(maxLeft, x))+'px';
      win.style.top  = Math.max(0, Math.min(maxTop,  y))+'px';
      _mhSyncBgmBounds();   // 드래그 중 실시간으로 BGM 창도 따라오게
    });
    const endDrag=e=>{ if(!dragging) return; dragging=false; dragMovesOsWindow=false; try{ title.releasePointerCapture(e.pointerId); }catch(_){}
      _mhSyncBgmBounds();
    };
    title.addEventListener('pointerup', endDrag);
    title.addEventListener('pointercancel', endDrag);
  })();
  const open=()=>{
    // ★ 이전에 드래그로 옮겨둔 위치(inline style)가 남아있으면, 창 크기가 바뀐 뒤 재열기 시 화면 밖에 뜰 수 있음.
    //   재열기할 때마다 위치를 원점(중앙)으로 초기화해서 항상 새 창 크기에 맞춰 뜨게 함.
    const win=document.getElementById('myHomeWin');
    if(win){ win.style.left=''; win.style.top=''; win.style.transform=''; }
    overlay.classList.add('on');
    /* 🛟 **여기서부터는 한 칸이 죽어도 나머지가 살아야 한다.**
       [경위] 예전엔 renderMyHomeFriendList() 와 loadMyHomePage() 가 맨몸으로 앞줄에 있었다.
         그 둘 중 하나가 던지면 open() 이 거기서 멈추고, 뒤에 있던 것들이 통째로 안 돌았다 —
         myHomeOpen 플래그 · 방명록 뱃지 감시 · BGM 좌표 · 그리고 **🧸 말랑이 폴더**.
         증상은 "말랑이 폴더가 사라졌다" 하나로만 보이는데 원인은 친구창·우편함 쪽이라,
         엉뚱한 파일을 뒤지게 된다(실제로 그 제보를 받았다).
       ★ 그래서 칸마다 따로 감싸고 **콘솔에 어느 칸이 죽었는지 남긴다.** 열기는 계속 진행된다.
       ⚠️ 새 초기화를 여기 추가할 때도 반드시 자기 칸으로 감쌀 것. 맨몸으로 끼워 넣으면
         그 줄 하나가 다시 마이홈 열기 전체를 인질로 잡는다. */
    const _step = (name, fn)=>{ try{ fn(); }catch(e){ console.error('[마이홈 열기] '+name+' 실패 — 나머지는 계속 진행합니다', e); } };
    _step('친구 목록', ()=>inboxMod.renderMyHomeFriendList());
    _step('마이홈 페이지', ()=>{ loadMyHomePage(); });   // ★ 마이홈 탭이 기본으로 열리므로 프로필 데이터도 같이 로드
    setMyHomeOpen(true);
    _step('창 크기', ()=>{ applyDesktopRunClass(); });   // 런처에서 열렸으면 창을 생성기처럼 넓게
    _step('방명록 뱃지', ()=>{ _mhGbStartWatch(); });   // 방명록 새 글 뱃지 감시 시작
    // ★ 마이홈4 후속: 창이 화면에 렌더된 뒤 한 프레임 기다렸다가 BGM 창에 좌표 전달(마이홈이 열리자마자
    //   음악이 재생 중이면 BGM 창이 마이홈 뒤로 정확히 숨도록).
    requestAnimationFrame(()=>{ window._mhSyncBgmBounds(); });
    // 🧸 말랑이: 내 마이홈 기준으로 이미지 로드 (방문 여부는 _mhApplyVisitUI가 다시 갱신)
    //   ⚠️ async 함수다 — 안에서 실패하면 이 try/catch 가 아니라 반환된 Promise 가 거부된다. .catch 로 받는다.
    try{
      Promise.resolve(window._mallangOnOpen((typeof _mhViewingUserId()!=='undefined' && _mhViewingUserId()) ? _mhViewingUserId() : getMyUserId(), !!(typeof _mhViewingUserId()!=='undefined' && _mhViewingUserId())))
        .catch(e=>console.error('[말랑이] 열기 실패', e));
    }catch(e){ console.warn('[말랑이] 열기 실패', e); }
  };
  const close=()=>{
    /* 🛟 open() 과 같은 이유로 칸마다 감싼다 — 다만 **여기가 더 위험하다.**
       [경위] 예전엔 `_mallangOnClose()` 가 맨 앞줄이고 그 다음이 `commitMyHomePage(true)` 였다.
         말랑이 정리에서 한 번 던지면 **마이홈 마지막 저장이 통째로 건너뛰어진다** — 편집한 내용이
         조용히 사라진다. 그 뒤 `overlay.classList.remove('on')` 도 못 돌아서 창이 안 닫힌다.
       ★ 순서도 바꿨다: **저장이 맨 먼저다.** 정리(말랑이·BGM·스티커)는 실패해도 다음에 열 때
         덮어써지지만, 저장은 그 순간을 놓치면 되돌릴 수 없다.
       ⚠️ 새 정리를 추가할 때도 자기 칸으로 감쌀 것. */
    const _step = (name, fn)=>{ try{ fn(); }catch(e){ console.error('[마이홈 닫기] '+name+' 실패 — 나머지는 계속 진행합니다', e); } };
    window._mhPreviewMode = false;   // 👁 미리보기 상태 해제
    _step('마지막 저장', ()=>{ mhHooks.call(mhHooks.HOOK.COMMIT, true); });
    overlay.classList.remove('on');
    setMyHomeOpen(false);
    _step('말랑이 정리', ()=>{ window._mallangOnClose(); });   // 🧸 말랑이 전부 제거
    _step('확인창 닫기', ()=>{ const a=document.getElementById('mhAskOv'); if(a) a.remove(); });   // 다시 열 때 남아 있지 않게
    // 🔍 검색줄도 접는다 — 다음에 열었을 때 필터만 남아 친구가 사라져 보이지 않게
    _step('검색줄', ()=>{ if(typeof inboxMod.friendSearchToggle==='function') inboxMod.friendSearchToggle(false); });
    _step('방명록 뱃지', ()=>{ _mhGbStopWatch(); });   // 방명록 뱃지 감시 종료
    // ★ BGM 자식창은 마이홈에 종속된 창이므로 마이홈 닫힐 때 같이 파괴 (창 상태도 초기화)
    _step('BGM 창', ()=>{
      mhHooks.call(mhHooks.HOOK.BGM_DESTROY);
    });
    // 👑 디자인 스튜디오 창도 마이홈 편집용이므로 같이 닫음 (위치는 main.js가 기억)
    _step('디자인 스튜디오', ()=>{ mhHooks.call(mhHooks.HOOK.DS_CLOSE); });
    // 스티커 링크 입력 등 프롬프트가 열려있으면 같이 닫기 (마이홈에 종속된 UI)
    const promptOv=document.getElementById('mhPromptOverlay');
    if(promptOv && promptOv._cleanup) try{ promptOv._cleanup(); }catch(_){}
    // 스티커 크기 조절 핸들도 정리
    _step('스티커 핸들', ()=>{ document.querySelectorAll('.mh-sticker-handle').forEach(h=>h.remove()); });
    // 🎨 스티커 관리/움직임 창도 마이홈에 종속된 UI — 같이 닫는다.
    //   안 닫으면 마이홈이 사라진 화면 한가운데에 창만 덩그러니 남는다(움직임 창에서 실제로 겪은 종류).
    _step('스티커 창', ()=>{
      myHomeSticker().close();
      _mhCloseStickerAnim();
    });
    _step('창 크기 복귀', ()=>{ applyDesktopRunClass(); });   // 창 크기 원래대로 복귀
  };
  window.openMyHome = open;   // ★ 런처의 "🏠 마이홈" 버튼 등 다른 곳에서도 재사용
  // 원래 open을 감싸서 — 마이홈이 열릴 때 대기 중인 친구 요청이 있으면 팝업으로 자동 표시
  const _origOpen = window.openMyHome;
  window.openMyHome = function(){
    _origOpen();
    if(typeof inboxMod.refreshFriendTabBadge==='function') inboxMod.refreshFriendTabBadge();   // 📩 열릴 때 우편함 탭 안 읽은 수 배지 갱신
    /* ⚠️ 예전엔 여기서 300ms 뒤에 showFriendRequestPopup() 을 불러 **밀린 요청을 전부 모달로**
       물었다. 2단계에서 뺐다 — 친구 관리 화면이 그 일을 맡는데, 화면이 열리자마자 모달이 그
       앞을 덮으면 관리 화면을 만든 의미가 없다. 대신 친구 탭에 배지(n)를 띄운다. */
    friendManage.refreshFriendReqBadge();
    friendManage.renderFriendManage();
  };
  twNav.on(twNav.NAV.MY_HOME, (...a)=>window.openMyHome(...a));   // 🧭 일정 알림 · 채팅 · 방 입장이 «마이홈 열어 줘» 를 이 통로로(감싼 함수를 부를 때 찾는다)
  if(btn) btn.addEventListener('click', e=>{ e.stopPropagation(); open(); });
  if(closeBtn) closeBtn.addEventListener('click', ()=>{
    if(_mhViewingUserId()) closeFriendHomeView();   // 관람 중이었으면 우선 관람 종료 처리(내 데이터 복원)
    close();
  });
  const backBtn=document.getElementById('mhBackHomeBtn');
  if(backBtn) backBtn.addEventListener('click', ()=>closeFriendHomeView());
  // 👁 방문자 시점 미리보기 — 내 홈을 방문자가 보는 것처럼 (데이터는 안 건드리는 순수 UI 미리보기)
  const previewBtn=document.getElementById('mhPreviewBtn');
  if(previewBtn) previewBtn.addEventListener('click', ()=>{
    if(_mhViewingUserId()) return;   // 남의 집 관람 중엔 미리보기 없음
    window._mhPreviewMode = true;
    _mhApplyVisitUI();
    toast('👁 방문자 시점으로 보고 있어요');
  });
  const previewExitBtn=document.getElementById('mhPreviewExitBtn');
  if(previewExitBtn) previewExitBtn.addEventListener('click', ()=>{
    window._mhPreviewMode = false;
    _mhApplyVisitUI();
  });
  /* ⎋ ESC 스택 — 옛 핸들러(document keydown 버블)를 대신한다. 닫기 절차는 그대로다:
     남의 집을 구경하던 중이었으면 **먼저 관람을 끝내** 내 데이터를 되돌린 뒤 창을 닫는다.
     ⚠️ 마이홈 안의 하위 UI(친구검색 줄)는 ESC_YIELD_SEL 이 먼저 처리한다 — 검색을 열어 둔 채
       ESC 를 누르면 검색만 닫히고 마이홈은 남아 있어야 한다(그 핸들러 주석과 짝). */
  escRegisterWindow({
    key:'myHome', el:overlay,
    isOpen:()=>overlay.classList.contains('on'),
    close:()=>{
      if(_mhViewingUserId()) closeFriendHomeView();
      close();
    },
  });
  // 창 이동은 타이틀바의 -webkit-app-region:drag 로 처리 — Electron이 OS 창 자체를 옮겨줌.
  //   (이전에는 JS로 inner CSS 위치만 옮겨서 뷰포트 밖으로는 못 나가고 갇히던 문제가 있었음)
  // 탭 전환 — 1단계에선 친구 탭만 실제 내용이 있고 나머지는 "준비 중" 표시
  overlay.querySelectorAll('.mh-tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      const wasHomeTab = overlay.querySelector('.mh-tab.on')?.dataset.tab==='home';
      if(wasHomeTab && tab.dataset.tab!=='home') mhHooks.call(mhHooks.HOOK.COMMIT, true);
      overlay.querySelectorAll('.mh-tab').forEach(t=>t.classList.toggle('on', t===tab));
      const target='mhPage'+tab.dataset.tab.charAt(0).toUpperCase()+tab.dataset.tab.slice(1);
      overlay.querySelectorAll('.mh-page').forEach(p=>p.classList.toggle('on', p.id===target));
      // 📅 스케줄러 탭에 들어올 때 달력을 그림(처음이면 이번 달 구독도 시작)
      if(tab.dataset.tab==='scheduler'){
        mhScheduler.renderSchedCalendar(); mhScheduler.renderDdays();
      }
      // 🎨 스티커 — 마이홈 탭에서만 보이고 나머지(친구/스케줄러/우편함/버그제보)에서는 숨김
      renderMyHomeStickers();
      // 📩 우편함 탭에 들어올 때 수령함을 그림 — 예전엔 친구 탭 옆에 늘 떠 있어서
      //   renderMhChat 이 대신 그려주고 있었다. 이제 자기 탭이 생겼으니 여기서 그린다.
      if(tab.dataset.tab==='mail'){ inboxMod.inboxEnter(); inboxMod.renderInbox(); }   // 안 읽은 우편이 있으면 우편, 없으면 소식부터
      // 👥 친구 탭에 들어올 때 오른쪽 '친구 관리' 칸을 그림 (받은 요청 / 선물함)
      if(tab.dataset.tab==='friend') friendManage.renderFriendManage();
      // 👥 친구 목록을 못 불러왔으면 탭을 열 때 다시 건다(다시 시도는 목록을 열 때만)
      if(tab.dataset.tab==='friend') friendsRetry();
      // 🔍 다른 탭으로 나가면 검색줄을 접는다 — 접힌 채 필터만 남으면 다음에 와서 친구가 사라져 보인다
      if(tab.dataset.tab!=='friend' && typeof inboxMod.friendSearchToggle==='function') inboxMod.friendSearchToggle(false);
      // ★ 예전엔 탭 전환 시 loadMyHomePage()를 다시 호출했는데, 프리미엄 스튜디오 등에서 방금 커밋한
      //   (아직 firebase에 반영 안 된) 로컬 편집분이 옛 데이터로 덮어써지는 문제가 있었음.
      //   _myHomeData는 이미 최신 로컬 상태를 갖고 있으므로 홈 탭으로 돌아올 땐 재렌더만 하면 됨.
      if(tab.dataset.tab==='home') renderMyHomePage();
      /* 🎁 선물 뱃지 확인 처리는 여기 없다 — 친구 관리의 **💝 선물함 서브탭을 누를 때**로 옮겼다
         (아래 #mhFmTabs 바인딩). 마이홈 탭을 스치기만 해도 선물을 본 것으로 처리되면 안 된다. */
    });
  });
  // 내 코드 복사
  const copyBtn=document.getElementById('mhMyCodeCopy');
  if(copyBtn) copyBtn.addEventListener('click', ()=>{
    const code=document.getElementById('mhMyCode').textContent;
    if(code && code!=='------'){ navigator.clipboard.writeText(code).then(()=>toast('코드를 복사했어요')).catch(()=>{}); }
  });
  /* ⚠️ 여기 있던 #mhMyNameEdit 바인딩은 지웠다. lcNameBtn 이 마이홈 열기로 바뀌던 시절 이름 설정을
     친구 탭에 임시로 두었던 자리인데, HTML 에서 이미 없어졌다(친구 탭에 남은 것은 친추 코드 복사뿐).
     `if(nameEdit)` 로 감싸여 있어 아무도 눈치채지 못한 채 죽어 있었다 — 되살릴 것이 아니라면
     다시 만들지 말 것. 닉네임 편집은 마이홈 탭의 _mhBeginNameEdit 한 벌뿐이다. */
  // 친구 추가 — 직접 바인딩 (원래 방식으로 복원)
  const addBtn=document.getElementById('mhAddBtn');
  const addInput=document.getElementById('mhAddInput');
  const doAdd=async ()=>{
    const ai = addInput || document.getElementById('mhAddInput');
    if(!ai){ return; }
    let code=ai.value.trim().toUpperCase().replace(/\s/g,'');
    if(!code){ toast('친구 코드를 입력해 주세요'); return; }
    // 뒷 4자리만 입력해도 되게 접두어 자동 보완 —
    //   · 4자리(예: 9K2M) → MATE-9K2M로 조회, 없으면 COZY-9K2M(옛 친구코드)로도 조회
    //   · MATE-/COZY- 전체를 넣었으면 그대로 사용
    let candidates;
    if(/^[A-Z0-9]{4}$/.test(code)){ candidates = ['MATE-'+code, 'COZY-'+code]; }
    else if(/^(MATE|COZY)-[A-Z0-9]{4}$/.test(code)){ candidates = [code]; }
    else { candidates = [code]; }   // 혹시 다른 형식이면 그대로 시도
    if(!window.firebaseAPI || !firebaseAPI.lookupFriendCode){ toast('아직 준비 중이에요, 잠시 후 다시 시도해주세요'); return; }
    /* 👥 받은 목록으로 판정한다 — 못 받았으면 friends-sub 가 한 번 읽는다(못 읽으면 아무것도 안 보낸다). */
    const _fr = await friendsForCheck();
    if(!_fr) return;
    if(Object.keys(_fr).length>=FRIEND_MAX){ toast('친구는 최대 '+FRIEND_MAX+'명까지만 추가할 수 있어요'); return; }
    const myCode=localStorage.getItem(MY_FRIEND_CODE_KEY);
    if(myCode && candidates.includes(myCode)){ toast('내 코드는 추가할 수 없어요'); return; }
    try{
      let friendId = null;
      let matchedCode = null;
      for(const cand of candidates){
        friendId = await firebaseAPI.lookupFriendCode(cand);
        if(friendId){ matchedCode = cand; break; }
      }
      if(!friendId){ toast('존재하지 않는 코드예요'); return; }
      if(_fr[friendId] || _myHomeFriends()[friendId]){ toast('이미 친구예요'); return; }
      if(!firebaseAPI.sendFriendRequest){ toast('아직 준비 중이에요'); return; }
      /* 📤 뒤 두 인자는 **보낸 요청 목록에 보여줄 이름표**다. 코드로 추가하면 상대 이름을 모르니
         프로필에서 한 번 읽어 넘긴다 — 목록에 '닉네임 (MATE-5H3K)' 로 뜨게 하는 값이다.
         ⚠️ 실패해도 그냥 보낸다(null). 이름은 목록 렌더가 _fmLookupName 으로 다시 시도하고,
           그것도 안 되면 코드만 뜬다 — 이름 조회 때문에 친구 요청 자체가 막히면 안 된다. */
      const toName = await friendManage.lookupName(friendId);
      const res = await firebaseAPI.sendFriendRequest(getMyUserId(), friendId, getDisplayName(), toName, matchedCode);
      if(res && res.ok){ toast('친구 요청을 보냈어요 — 상대가 수락하면 친구가 돼요'); ai.value=''; }
      else if(res && res.reason==='already'){ toast('이미 친구예요'); }
      else if(res && res.reason==='self'){ toast('내 코드는 추가할 수 없어요'); }
      else toast('요청에 실패했어요');
    }catch(e){ toast('요청 중 오류가 발생했어요'); }
  };
  if(addBtn) addBtn.addEventListener('click', ()=>{ console.log('[친구추가] 추가 버튼 클릭됨'); doAdd(); });
  else console.warn('[친구추가] mhAddBtn을 찾지 못함 — 바인딩 실패');
  if(addInput) addInput.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); doAdd(); } });
  // [+ 친구 추가] 토글 — 코드 입력줄 펼치고 접음
  const addToggle=document.getElementById('mhAddToggleBtn');
  const addRow=document.getElementById('mhAddRow');
  if(addToggle && addRow) addToggle.addEventListener('click', ()=>{
    addRow.classList.toggle('on');
    if(addRow.classList.contains('on')){ const ai=document.getElementById('mhAddInput'); if(ai) ai.focus(); }
  });
  // 🟢 온라인 표시 토글(목업: "온라인 (누르면 오프라인)") — 친구 목록에서 나를 오프라인으로 보이게 함
  let _mhPresenceOnline = true;
  const presToggle=document.getElementById('mhPresenceToggle');
  if(presToggle) presToggle.addEventListener('click', ()=>{
    _mhPresenceOnline = !_mhPresenceOnline;
    if(window.firebaseAPI && firebaseAPI.setMyPresenceState){
      try{ firebaseAPI.setMyPresenceState(getMyUserId(), _mhPresenceOnline); }catch(e){}
    }
    presToggle.innerHTML = _mhPresenceOnline
      ? '<span class="mh-fdot on"></span> 온라인 <small>(누르면 오프라인)</small>'
      : '<span class="mh-fdot off"></span> 오프라인 <small>(누르면 온라인)</small>';
    toast(_mhPresenceOnline ? '이제 친구들에게 온라인으로 보여요' : '이제 친구들에게 오프라인으로 보여요');
  });
  /* 📩 우편함 UI 바인딩 — 왼쪽 세로 메뉴, 소식 종류, 읽은 우편 지우기, 전체 읽음, 관리자 작성.
     ⚠️ 소식 종류는 반드시 #mhInboxTabs 안으로 좁힐 것 — 친구 관리 서브탭이 같은 .mh-ibx-tab 클래스라
       전역으로 걸면 '받은 요청'을 눌렀을 때 소식 종류가 undefined→'all' 로 같이 바뀐다. */
  document.querySelectorAll('#mhInboxRail .mh-ibx-sec').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      inboxMod.setInboxSec(btn.dataset.sec);
      inboxMod.setInboxOpenId(null);   // 칸 바꾸면 펼친 우편은 접는다
      inboxMod.renderInbox();
    });
  });
  document.querySelectorAll('#mhInboxTabs .mh-ibx-tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      inboxMod.setInboxFilter(tab.dataset.tag || 'all');
      inboxMod.renderInbox();
    });
  });
  const clearReadBtn = document.getElementById('mhInboxClearRead');
  if(clearReadBtn) clearReadBtn.addEventListener('click', ()=>inboxMod.inboxClearRead());

  /* ── 🔍 Ctrl+F 친구 검색 바인딩 ──────────────────────────────────────
     ⚠️ **마이홈이 열려 있고 친구 탭일 때만** 먹어야 한다. 조건을 안 걸면 실행 화면이나
       캐릭터 생성기에서 Ctrl+F 가 엉뚱하게 반응한다. */
  const _mhFriendTabOn = ()=>{
    if(!overlay.classList.contains('on')) return false;
    const on = overlay.querySelector('.mh-tab.on');
    return !!(on && on.dataset.tab === 'friend');
  };
  document.addEventListener('keydown', e=>{
    if(!(e.ctrlKey || e.metaKey) || String(e.key||'').toLowerCase() !== 'f') return;
    if(!_mhFriendTabOn()) return;
    e.preventDefault();
    inboxMod.friendSearchToggle(true);
  });
  /* Esc 로 닫기 — ⚠️ **캡처 단계여야 한다.** 마이홈 자체를 닫는 Esc 핸들러가 같은 document 에
     걸려 있어서, 버블 단계에서 잡으면 검색을 닫으면서 마이홈까지 같이 닫힌다.
     캡처에서 stopPropagation 하면 그 한 번은 검색만 닫히고, 다음 Esc 가 마이홈을 닫는다. */
  document.addEventListener('keydown', e=>{
    if(e.key !== 'Escape') return;
    const row = document.getElementById('mhFriendSearch');
    if(!row || !row.classList.contains('on')) return;
    e.preventDefault(); e.stopPropagation();
    inboxMod.friendSearchToggle(false);
  }, true);
  const fsInput = document.getElementById('mhFriendSearchInput');
  if(fsInput) fsInput.addEventListener('input', ()=>{
    inboxMod.setFriendFilter(fsInput.value || '');
    inboxMod.renderMyHomeFriendList();
  });
  const fsClear = document.getElementById('mhFriendSearchClear');
  if(fsClear) fsClear.addEventListener('click', ()=>inboxMod.friendSearchToggle(false));

  // 👥 친구 관리 서브탭 — 받은 요청 / 선물함
  document.querySelectorAll('#mhFmTabs .mh-ibx-tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      friendManage.setTab(tab.dataset.fm || 'req');
      friendManage.renderFriendManage();
      /* 🎁 선물 배지 확인 처리는 **바로 이 자리**다. 렌더 안이 아니라 클릭에 건다 —
         친구 탭에 들어오기만 해도(직전에 보던 서브탭이 선물함이라) 본 것으로 처리되면 안 된다. */
      if(friendManage.tab() === 'gift') window._mallangSeenGifts();
    });
  });
  // 일괄 처리 바
  const fmAll = document.getElementById('mhFmAll');
  if(fmAll) fmAll.addEventListener('change', ()=>{
    friendManage.picked.clear();
    if(fmAll.checked) Object.keys(_myFriendRequests()||{}).forEach(id=>friendManage.picked.add(id));
    friendManage.renderFriendRequests();
  });
  const fmAcc = document.getElementById('mhFmAcceptSel');
  if(fmAcc) fmAcc.addEventListener('click', ()=>{ friendManage.bulkAccept(); });
  const fmRej = document.getElementById('mhFmRejectSel');
  if(fmRej) fmRej.addEventListener('click', ()=>{ friendManage.bulkReject(); });
  /* 📩 우편 · 소식 목록 — 스크롤바를 숨겨서 마우스로 끌어 움직인다(휠은 그대로).
     펼친 우편 본문 · 링크 위에서는 끌기를 시작하지 않는다 — 글자를 끌어 골라 복사할 수 있게. */
  const INBOX_DRAG_SKIP = '.mh-ibx-body, a';
  ['mhInboxList', 'mhNewsList'].forEach(id=>TwDragScroll.attachDragScroll(document.getElementById(id), { skip: INBOX_DRAG_SKIP }));
  const readAllBtn = document.getElementById('mhInboxReadAllBtn');
  if(readAllBtn) readAllBtn.addEventListener('click', async ()=>{
    inboxMod.inboxBcMarkAllRead();   // 공용 공지도 로컬 읽음 처리
    mhScheduler.refreshBellBadge();
    if(typeof inboxMod.renderInbox==='function') inboxMod.renderInbox();
    if(!window.firebaseAPI || !firebaseAPI.markAllInboxRead){ toast('모두 읽음 처리했어요'); return; }
    try{ await firebaseAPI.markAllInboxRead(getMyUserId()); toast('모두 읽음 처리했어요'); }
    catch(e){ toast('처리에 실패했어요'); }
  });

  // 관리자 작성 모달 — .admin-only 클래스로 숨김/표시가 자동 관리됨
  const composeBtn    = document.getElementById('mhInboxComposeBtn');
  const composeOv     = document.getElementById('mhInboxCompose');
  const composeTitle  = document.getElementById('mhInboxComposeTitle');
  const composeBody   = document.getElementById('mhInboxComposeBody');
  const composeMsg    = document.getElementById('mhInboxComposeMsg');
  const composeSend   = document.getElementById('mhInboxComposeSend');
  const composeCancel = document.getElementById('mhInboxComposeCancel');
  const showComposeMsg = (text, isErr)=>{
    if(!composeMsg) return;
    composeMsg.textContent = text;
    composeMsg.style.color = isErr ? 'var(--win-error)' : 'var(--ink-soft)';
    composeMsg.style.display = text ? 'block' : 'none';
  };
  if(composeBtn && composeOv){
    composeBtn.addEventListener('click', ()=>{
      if(!isAdmin()) return;
      if(composeTitle) composeTitle.value = '';
      if(composeBody) composeBody.value = '';
      showComposeMsg('', false);
      const firstRadio = composeOv.querySelector('input[name="ibcTag"][value="notice"]');
      if(firstRadio) firstRadio.checked = true;
      composeOv.style.display = 'block';
      if(composeTitle) composeTitle.focus();
    });
  }
  if(composeCancel && composeOv) composeCancel.addEventListener('click', ()=>{ composeOv.style.display='none'; });
  // 💝 선물 모달 닫기
  const giftClose = document.getElementById('mhGiftClose');
  const giftModal = document.getElementById('mhGiftModal');
  if(giftClose && giftModal) giftClose.addEventListener('click', ()=>{ giftModal.style.display='none'; });
  if(composeSend){
    composeSend.addEventListener('click', async ()=>{
      if(!isAdmin()){ toast('관리자만 전송할 수 있어요'); return; }
      if(!window.firebaseAPI || !firebaseAPI.sendInboxBroadcast){ toast('네트워크 연결이 필요해요'); return; }
      const title = (composeTitle ? composeTitle.value : '').trim();
      const body  = (composeBody  ? composeBody.value  : '').trim();
      const tagInput = composeOv.querySelector('input[name="ibcTag"]:checked');
      const tag = tagInput ? tagInput.value : 'notice';
      const pinEl = document.getElementById('mhInboxComposePin');
      const pinned = !!(pinEl && pinEl.checked);
      if(!title){ showComposeMsg('제목을 입력해 주세요', true); return; }
      if(!body){ showComposeMsg('내용을 입력해 주세요', true); return; }
      // 전체 유저에게 뿌리는 작업이라 명시적 확인
      if(!confirm(`전체 유저에게 [${inboxMod.inboxTagLabel(tag)}]${pinned?' 📌고정':''} "${title}" 메시지를 보낼까요?`)){ window.focus(); return; } window.focus();
      composeSend.disabled = true; showComposeMsg('전송 중…', false);
      try{
        const r = await firebaseAPI.sendInboxBroadcast(tag, title, body, pinned);
        if(r && r.ok){
          toast(`${r.count}명에게 전송했어요`);
          composeOv.style.display = 'none';
          if(pinEl) pinEl.checked = false;   // 다음 작성 때 기본값 복귀
        } else showComposeMsg('전송에 실패했어요', true);
      }catch(e){ showComposeMsg(_saveFailMsg(e, '전송에 실패했어요 — 네트워크 확인'), true); }
      composeSend.disabled = false;
    });
  }
})();

// 📩 수령함으로 대체 — 친구 선택 시 별도 구독은 필요 없음(수령함은 사용자 계정 단위 구독).
//   기존 이름을 호출하는 곳이 있을 수 있어 no-op 함수만 남겨둠.
function _mhSubscribeDMForSelected(){ /* 수령함으로 대체됨 */ }

return {
  renderMhProfileRail,
  syncFriendsOpen,
};
}

const api = { createMyHomeUi };
if(typeof window !== 'undefined') window.TwMyHomeUi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

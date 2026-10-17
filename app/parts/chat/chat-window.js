/* chat-window.js — 💬 대화창 배선(닫기 · 최소화 · 끌기 · 크기 · 메뉴 · 버튼 · 입력 · 이모티콘)
   app.js 의 «💬 대화창 배선» 구역을 그대로 옮긴 모듈이다(앱 FSD 14번 — docs/APP_FSD_MAP.md). 동작은 옮기기 전과 같다.

   ★ 아래 본문은 app.js 에 있던 글 그대로다 — 들여쓰기도 바꾸지 않았다(옮기기 전 줄과 견주어 볼 수 있게).
     바뀐 것은 여덟 줄뿐이다.
       · 읽는 함수 — officeMode → officeMode()(두 줄) · _flyAiming → _flyAiming() · isAdmin → isAdmin() · _emojiCache → _emojiCache()
       · 쓰는 함수 — _chatFlyOn = x → _setChatFlyOn(x) · _chatFlySize = x → _setChatFlySize(x) · _chatFlyColor = x → _setChatFlyColor(x)
     모두 app.js 가 다시 대입하는 let 이다. officeMode · isAdmin 은 이 모듈을 만드는 줄보다 뒤에 선언되므로 값으로 넘기면 TDZ 에 걸린다.
   ★ 함수는 app.js 가 화살표로 넘긴다. 본문의 typeof 가드(typeof getFocusLevel · typeof _rollDice · typeof toast · typeof isAdmin)는
     예전처럼 늘 통과한다. #chatCloseBtn 의 onclick 은 closeChatWindow 를 부르는 화살표가 된다(부르는 일은 같다).
   ★ 값으로 받는 것 — FLY_COLOR_LEVEL · FLY_MIN_LEVEL · EMOJI_SLOTS(상수) · seats(다시 대입되지 않는 배열) ·
     purikuraUi(만드는 줄보다 앞에서 만들어지는 const).
   ★ 밖에서 부르는 이름은 없다 — 버튼 · 메뉴 · 끌기 · 크기 손잡이 · ESC · 입력 Enter · 링크 · 이모티콘 그리드를 전부 만들 때 건다.
     저장된 글자 크기 · 알림음 · 투명도 반영(_applyChat*)과 _bindChatCopy · _bindChatTabs 도 만들 때 예전 순서 그대로 부른다.
   ★ createChatWindow 는 app.js 의 원래 자리(💬 대화창 배선 머리 아래)에서 부른다. 만들 때 바로 도는 것이 예전과 같은 순서 · 같은 때에 돈다.
   ⚠️ document · window · innerWidth · innerHeight · requestAnimationFrame 은 예전처럼 전역 이름으로 쓴다
     (이 파일은 app.js 앞에 싣는 classic script). window._activeChannel · window.companion 도 그대로다.
   ⚠️ 전역 이름은 TwChatWindow — 크로미움 내장 전역과 겹치는 이름(Scheduler 같은)을 쓰면 typeof 가드가 늘 통과한다(#103).
   검사: checks/sim-chat-window.js — 만들 때 배선 · 최소화 · 끌기(화면 안) · 크기 · 메뉴 · 알림음 · 투명도 · ESC 한 겹씩 · Enter(조합 중 무시) ·
         날리기 · 잠금 · 기록 삭제 · 이모티콘 · 주사위 · 💣 · 📷 · app.js 배선 · html 순서. */
(function(){

function createChatWindow(deps){
// 대화창 코어
const closeChatWindow = deps.closeChatWindow;
const _chatWindowIsOpen = deps.chatWindowIsOpen;       // ⎋ ESC — 열려 있을 때만
const _chatIsMinimized = deps.chatIsMinimized;
const _setChatMinimized = deps.setChatMinimized;       // ▁ 최소화 버튼
const _saveChatWinPos = deps.saveChatWinPos;           // 끌기 · 크기 바꾸기 끝에 자리 저장
const _sendChatWindowMsg = deps.sendChatWindowMsg;     // 입력 Enter
const _bindChatCopy = deps.bindChatCopy;               // 📋 드래그 · 복사 · 우클릭 메뉴
const _bindChatTabs = deps.bindChatTabs;               // 💬 채팅 탭 줄
const toast = deps.toast;
// 기록
const _saveChatLog = deps.saveChatLog;                 // 파일 ▸ 대화 저장
const _chatClearNow = deps.chatClearNow;               // 🧹 지우기(가리기)
const _chatClearUndo = deps.chatClearUndo;             // 🧹 다시 보기
// 투명도 · 글자 크기
const _clampChatOpacity = deps.clampChatOpacity;
const _setChatOpacity = deps.setChatOpacity;
const _applyChatOpacity = deps.applyChatOpacity;
const _setChatFontSize = deps.setChatFontSize;
const _applyChatFontSize = deps.applyChatFontSize;
// 🔔 알림음
const _chatSfxOn = deps.chatSfxOn;
const _setChatSfxOn = deps.setChatSfxOn;
const _setChatSfxId = deps.setChatSfxId;
const _chatSfxPreview = deps.chatSfxPreview;
const _applyChatSfxUI = deps.applyChatSfxUI;
const _chatSfxOfficeLock = deps.chatSfxOfficeLock;     // 🏢 회사원 모드면 켜고 끌 수 없다
// 🌊 날리기
const _setChatFlyOn = deps.setChatFlyOn;               // 쓰는 함수 — app.js 의 let(세션 변수)
const _setChatFlySize = deps.setChatFlySize;           // 쓰는 함수 — app.js 의 let(세션 변수)
const _setChatFlyColor = deps.setChatFlyColor;         // 쓰는 함수 — app.js 의 let(세션 변수)
const _chatFlyRefreshUI = deps.chatFlyRefreshUI;
const _flySizeOk = deps.flySizeOk;
const FLY_COLOR_LEVEL = deps.FLY_COLOR_LEVEL;          // 🎨 색 해금 레벨(상수)
const getFocusLevel = deps.getFocusLevel;
const isAdmin = deps.isAdmin;                          // 읽는 함수 — app.js 의 let(로그인할 때 다시 대입 · 이 줄보다 뒤에 선언)
// 🔇 채팅 잠금 · 🗑 기록 삭제
const _chatOffToggleClick = deps.chatOffToggleClick;
const _chatDelOpen = deps.chatDelOpen;
const _chatDelClose = deps.chatDelClose;
const _chatDelRun = deps.chatDelRun;
// 😊 이모티콘
const _toggleEmojiPanel = deps.toggleEmojiPanel;
const _emojiCache = deps.emojiCache;                   // 읽는 함수 — app.js 의 let(다시 대입된다)
const EMOJI_SLOTS = deps.EMOJI_SLOTS;                  // 내 이모티콘 칸 수(상수)
const _onEmojiSlotClick = deps.onEmojiSlotClick;
const _onEmojiFilePicked = deps.onEmojiFilePicked;
const _deleteEmoji = deps.deleteEmoji;
// 🎲 주사위
const _rollDice = deps.rollDice;
// 💣 플라잉체어 조준
const FLY_MIN_LEVEL = deps.FLY_MIN_LEVEL;              // 💣 해금 레벨(상수)
const seats = deps.seats;                              // 좌석 배열(같은 배열 — 다시 대입되지 않는다)
const setFlyAiming = deps.setFlyAiming;
const _flyAiming = deps.flyAiming;                     // 읽는 함수 — app.js 의 let(setFlyAiming 이 다시 대입)
const officeMode = deps.officeMode;                    // 읽는 함수 — app.js 의 let(🏢 회사원 모드 · 이 줄보다 뒤에 선언)
// 📷 스티커사진
const _purikura = deps.purikura;
const purikuraUi = deps.purikuraUi;                    // 📷 창 모듈(만드는 줄보다 앞에서 만들어지는 const)
// ── 대화창 배선 (한 번만)
(function _wireChatWindow(){
  const close=document.getElementById('chatCloseBtn');
  if(close) close.onclick=closeChatWindow;
  // ▁ 최소화 — 입력칸과 😊🎲💣 만 남긴다. 같은 버튼으로 다시 펼친다.
  const minBtn=document.getElementById('chatMinBtn');
  if(minBtn) minBtn.onclick=(e)=>{ e.stopPropagation(); _setChatMinimized(!_chatIsMinimized()); };
  // ★ F4 마이홈처럼 타이틀바 드래그로 창 이동 + 위치 기억 (배경 오버레이 없음 — 다른 요소 클릭 방해 안 함)
  (function _bindChatDrag(){
    const win=document.getElementById('chatWindow');
    const title=document.querySelector('#chatWindow .chat-titlebar');
    if(!win || !title) return;
    let dragging=false, offX=0, offY=0;
    title.addEventListener('pointerdown', e=>{
      /* 닫기 버튼과 투명도 슬라이더는 드래그 시작 안 함 — 타이틀바가 드래그 핸들이라
         여기서 빼주지 않으면 슬라이더를 잡는 순간 창이 끌려가 값을 못 바꾼다
         (#gachaInvHead 의 closeSel 예외와 같은 관례). */
      // ▁ 최소화 버튼도 드래그 예외 — 안 넣으면 누를 때마다 창이 따라 움직인다
      if(e.target.closest && e.target.closest('#chatCloseBtn, #chatMinBtn, #chatOpacity')) return;
      dragging=true;
      const r=win.getBoundingClientRect();
      offX=e.clientX-r.left; offY=e.clientY-r.top;
      win.style.transform='none';
      win.style.left=r.left+'px';
      win.style.top =r.top +'px';
      try{ title.setPointerCapture(e.pointerId); }catch(_){}
      e.preventDefault();
    });
    title.addEventListener('pointermove', e=>{
      if(!dragging) return;
      const x=e.clientX-offX, y=e.clientY-offY;
      const w=win.offsetWidth, h=win.offsetHeight;
      const maxLeft=Math.max(0, innerWidth-w), maxTop=Math.max(0, innerHeight-h);
      win.style.left=Math.max(0, Math.min(maxLeft, x))+'px';
      win.style.top =Math.max(0, Math.min(maxTop,  y))+'px';
    });
    const endDrag=e=>{ if(!dragging) return; dragging=false; try{ title.releasePointerCapture(e.pointerId); }catch(_){} _saveChatWinPos(); };
    title.addEventListener('pointerup', endDrag);
    title.addEventListener('pointercancel', endDrag);
  })();
  // ★ 8방향 리사이즈 — 모든 가장자리/모서리에서 크기 조절. 최소/최대는 CSS(min/max)가 강제.
  (function _bindChatResize(){
    const win=document.getElementById('chatWindow'); if(!win) return;
    const handles=win.querySelectorAll('.chat-rz');
    let rz=null, sx=0, sy=0, sw=0, sh=0, sl=0, st=0;
    handles.forEach(hd=>{
      hd.addEventListener('pointerdown', e=>{
        e.preventDefault(); e.stopPropagation();
        // 드래그 리사이즈 시작 — 현재 절대좌표/크기를 고정값으로 전환(중앙정렬 transform 해제)
        const r=win.getBoundingClientRect();
        win.style.transform='none';
        win.style.left=r.left+'px'; win.style.top=r.top+'px';
        win.style.width=r.width+'px'; win.style.height=r.height+'px';
        rz=hd.getAttribute('data-rz'); sx=e.clientX; sy=e.clientY;
        sw=r.width; sh=r.height; sl=r.left; st=r.top;
        try{ hd.setPointerCapture(e.pointerId); }catch(_){}
      });
      hd.addEventListener('pointermove', e=>{
        if(rz!==hd.getAttribute('data-rz') || rz===null) return;
        const dx=e.clientX-sx, dy=e.clientY-sy;
        const minW=300, minH=260;
        const maxW=Math.min(innerWidth*0.96, innerWidth-4), maxH=Math.min(innerHeight*0.92, innerHeight-4);
        let w=sw, h=sh, l=sl, t=st;
        if(rz.indexOf('e')>=0){ w=Math.max(minW, Math.min(maxW, sw+dx)); }
        if(rz.indexOf('s')>=0){ h=Math.max(minH, Math.min(maxH, sh+dy)); }
        if(rz.indexOf('w')>=0){ w=Math.max(minW, Math.min(maxW, sw-dx)); l=sl+(sw-w); }
        if(rz.indexOf('n')>=0){ h=Math.max(minH, Math.min(maxH, sh-dy)); t=st+(sh-h); }
        win.style.width=w+'px'; win.style.height=h+'px';
        win.style.left=Math.max(0,l)+'px'; win.style.top=Math.max(0,t)+'px';
      });
      const end=e=>{ if(rz===null) return; rz=null; try{ hd.releasePointerCapture(e.pointerId); }catch(_){} _saveChatWinPos(); };
      hd.addEventListener('pointerup', end);
      hd.addEventListener('pointercancel', end);
    });
  })();
  // 파일 메뉴 드롭다운
  const fileMenu=document.getElementById('chatFileMenu');
  if(fileMenu){
    fileMenu.addEventListener('click', e=>{ e.stopPropagation(); fileMenu.classList.toggle('open'); fileMenu.classList.contains('open') && _chatCloseMenus(fileMenu); });
    document.addEventListener('click', ()=> fileMenu.classList.remove('open'));
  }
  /* ⚙️ 설정 메뉴 — 채팅 글자 크기. #chatWindow 의 --chat-font 하나로 .chat-messages 와
     그 하위(em 기준)가 함께 커진다. 저장은 로컬(기기별) — 창 크기·위치와 같은 성격이라 서버에 안 올린다. */
  function _chatCloseMenus(except){
    document.querySelectorAll('#chatWindow .chat-menu-item.open').forEach(m=>{ if(m!==except) m.classList.remove('open'); });
  }
  const viewMenu=document.getElementById('chatViewMenu');
  if(viewMenu){
    viewMenu.addEventListener('click', e=>{ e.stopPropagation(); viewMenu.classList.toggle('open'); viewMenu.classList.contains('open') && _chatCloseMenus(viewMenu); });
    document.addEventListener('click', ()=>{
      viewMenu.classList.remove('open');
      const fm = document.getElementById('chatFsMenu'); if(fm) fm.classList.remove('sub-open');
    });
    document.querySelectorAll('.chat-fs-item').forEach(it=>{
      it.addEventListener('click', e=>{
        e.stopPropagation();
        _setChatFontSize(parseInt(it.dataset.fs, 10));
        viewMenu.classList.remove('open');
      });
    });
    /* 🔔 알림음 — 켬/끔과 소리 고르기는 **메뉴를 닫지 않는다.** 켜자마자 목록이 나타나는 것을 보고,
       ▷ 로 들어 보며 고를 수 있어야 한다. 모든 줄이 stopPropagation — 안 하면 위 viewMenu 의
       토글이 받아 메뉴가 닫힌다. */
    const sfxTg = document.getElementById('chatSfxToggle');
    if(sfxTg) sfxTg.addEventListener('click', e=>{
      e.stopPropagation();
      if(_chatSfxOfficeLock()){ toast('회사원 모드에서는 알림음이 꺼져 있어요'); return; }   // 저장값은 그대로
      _setChatSfxOn(!_chatSfxOn());
    });
    document.querySelectorAll('.chat-sfx-item').forEach(it=>{
      const id = parseInt(it.dataset.sfx, 10);
      it.addEventListener('click', e=>{ e.stopPropagation(); _setChatSfxId(id); });
      const pv = it.querySelector('.chat-sfx-pv');
      if(pv) pv.addEventListener('click', e=>{ e.stopPropagation(); _chatSfxPreview(id); });   // 듣기만 — 고르지 않는다
    });
    /* 🔠 글자 크기 ▶ — 여는 것은 CSS :hover 다. 여기서는 (a) 화면 오른쪽 끝이면 왼쪽으로 뒤집고
       (b) 눌러도 열리게(.sub-open) 한다. 재는 것은 들어올 때 한 번뿐 — 매번 재면 뒤집힘이 오가며 떨린다. */
    const fsMenu = document.getElementById('chatFsMenu'), fsSub = document.getElementById('chatFsSub');
    if(fsMenu && fsSub){
      fsMenu.addEventListener('mouseenter', ()=>{
        fsSub.classList.remove('flip');
        requestAnimationFrame(()=>{
          try{
            const r = fsSub.getBoundingClientRect();
            if(r.width && r.right > window.innerWidth) fsSub.classList.add('flip');
          }catch(_){}
        });
      });
      fsMenu.addEventListener('click', e=>{
        e.stopPropagation();
        if(e.target === fsMenu || !fsSub.contains(e.target)) fsMenu.classList.toggle('sub-open');
      });
    }
  }
  /* 🧹 지우기 메뉴 — 설정 옆. 되돌리기(다시 보기)를 같이 둔다: 실제로 지우는 게 아니라
     가리는 것뿐이라 되돌릴 수 있고, 없으면 잘못 눌렀을 때 되돌릴 길이 없는 것처럼 보인다. */
  const clearMenu=document.getElementById('chatClearMenu');
  if(clearMenu){
    clearMenu.addEventListener('click', e=>{ e.stopPropagation(); clearMenu.classList.toggle('open'); clearMenu.classList.contains('open') && _chatCloseMenus(clearMenu); });
    document.addEventListener('click', ()=> clearMenu.classList.remove('open'));
    const _ci=(id,fn)=>{ const el=document.getElementById(id); if(el) el.addEventListener('click', e=>{ e.stopPropagation(); fn(); clearMenu.classList.remove('open'); }); };
    _ci('chatClearNow',  _chatClearNow);
    _ci('chatClearUndo', _chatClearUndo);
  }
  _applyChatFontSize();   // 저장된 값 반영 + ✓ 표시
  _applyChatSfxUI();      // 🔔 알림음 켜짐/꺼짐 · 고른 소리 표시
  /* 🌫️ 투명도 슬라이더 — input 으로 즉시 반영(끌면서 보인다), change 로 저장.
     매 픽셀마다 localStorage 에 쓰지 않기 위해 둘을 나눠 놨다. */
  const opa=document.getElementById('chatOpacity');
  if(opa){
    opa.addEventListener('pointerdown', e=>e.stopPropagation());   // 타이틀바 드래그로 새지 않게
    opa.addEventListener('input',  ()=>{
      const pct=_clampChatOpacity(opa.value);
      ['chatWindow','chatEmojiWin'].forEach(id=>{
        const el=document.getElementById(id); if(el) el.style.opacity = (pct>=100) ? '' : String(pct/100);
      });
      opa.title = '투명도 ' + pct + '%';
    });
    opa.addEventListener('change', ()=>_setChatOpacity(opa.value));
    /* ⌨️ 슬라이더에 포커스가 간 뒤의 방향키·ESC 가 창 단축키로 새지 않게 막는다. */
    opa.addEventListener('keydown', e=>e.stopPropagation());
  }
  _applyChatOpacity();    // 저장된 값 반영 + 슬라이더 위치 맞춤
  /* ⎋ ESC 로 닫기 — 다른 창들과 같은 관례(document keydown + 자기 열림 상태 확인).
     ⚠️ 한 겹씩 닫는다. 😊 이모티콘 창이 떠 있으면 그것만 닫고 대화창은 남긴다 —
       한 번에 둘 다 닫히면 이모티콘을 접으려다 대화창까지 잃는다.
     ⚠️ 입력창에 포커스가 있을 때의 ESC 는 위 #chatInput 핸들러가 stopPropagation 으로
       먼저 처리한다(마이홈 제목 편집이 마이홈 ESC 와 충돌을 막는 그 방식과 같다).
       그래서 여기까지 올라오지 않고, 이중으로 닫히지도 않는다. */
  document.addEventListener('keydown', e=>{
    if(e.key!=='Escape' || !_chatWindowIsOpen()) return;
    const ep=document.getElementById('chatEmojiWin');
    if(ep && ep.classList.contains('on')){ e.stopPropagation(); ep.classList.remove('on'); return; }
    e.stopPropagation();
    closeChatWindow();
  });
  const saveLog=document.getElementById('chatSaveLog');
  if(saveLog) saveLog.onclick=(e)=>{ e.stopPropagation(); _saveChatLog(); const fm=document.getElementById('chatFileMenu'); if(fm) fm.classList.remove('open'); };
  // 입력 Enter 전송
  const inp=document.getElementById('chatInput');
  if(inp){
    inp.addEventListener('keydown', e=>{
      e.stopPropagation();
      /* ⌨️ [Mac 제보 2026-09-23] "안녕하세요 → 1: 안녕하세요 1: 요" — 끝 글자가 한 번 더 간다.
         [원인] mac 한글 입력기는 마지막 글자(요)를 **조합 중인 채로** Enter 의 keydown 을 보낸다(isComposing).
           그 자리에서 보내면 줄 전체가 나가고 → 입력기가 «요» 를 비운 칸에 확정해 넣고 → 뒤따르는 Enter 가 그걸 또 보낸다.
         ★ 조합 중 Enter 는 조합 확정에 쓰게 두고 무시한다(keyCode 229 는 조합 중 키의 옛 표식). Windows 는 원래 이 순서가 아니라 영향 없다. */
      if(e.isComposing || e.keyCode === 229) return;
      if(e.key==='Enter'){ e.preventDefault(); _sendChatWindowMsg(); }
      else if(e.key==='Escape'){ closeChatWindow(); }
    });
  }
  try{ _bindChatCopy(); }catch(_){}   // 📋 드래그 · 복사 · 우클릭 메뉴
  try{ _bindChatTabs(); }catch(_){}   // 💬 채팅 탭 줄
  // 링크 클릭 → 외부 열기(Electron: shell.openExternal, 웹: 새 탭)
  const msgs=document.getElementById('chatMessages');
  if(msgs){
    msgs.addEventListener('click', e=>{
      const a=e.target.closest('.cm-link'); if(!a) return;
      e.preventDefault();
      const url=a.getAttribute('data-url'); if(!url) return;
      try{
        if(window.companion && window.companion.openBrowser) window.companion.openBrowser(url);   // Electron: 외부 브라우저
        else window.open(url, '_blank', 'noopener');                                              // 웹 폴백
      }catch(_){ try{ window.open(url,'_blank','noopener'); }catch(__){}}
    });
  }
  // 이모티콘 버튼 → 패널 토글
  /* 🌊 날리기 체크 — 상태는 세션 변수 하나(_chatFlyOn)다. 저장하지 않는다(§결정 ④).
     ⚠️ stopPropagation 이 필요하다 — 이 줄은 #chatWindow 안에 있고, 바깥 클릭 처리가
       위로 올라온 클릭을 «창 밖을 눌렀다»로 읽는 자리가 있다(다른 버튼들과 같은 관례). */
  const fchk=document.getElementById('chatFlyChk');
  if(fchk){
    fchk.addEventListener('click', e=>{ e.stopPropagation(); });
    fchk.addEventListener('change', ()=>{ _setChatFlyOn(!!fchk.checked); _chatFlyRefreshUI(); });
  }
  /* 🔠 크기 단추 — 색 고르개와 같은 방식(위임 하나). 여기엔 레벨 문턱이 없다. */
  const fszBox=document.getElementById('chatFlySizes');
  if(fszBox) fszBox.addEventListener('click', e=>{
    e.stopPropagation();
    const b=e.target.closest('.fsz'); if(!b) return;
    _setChatFlySize(_flySizeOk(b.getAttribute('data-flysize')));
    _chatFlyRefreshUI();
  });
  /* 🎨 색 고르개 — 한 줄에 여섯 칸뿐이라 위임 하나로 받는다.
     레벨 판정은 _chatFlyRefreshUI 가 이미 했다(미달이면 이 묶음이 아예 안 보인다).
     그래도 여기서 한 번 더 본다 — 보이지 않는 요소를 스크립트로 누르는 길이 남기 때문이다. */
  const fsw=document.getElementById('chatFlySwatches');
  if(fsw) fsw.addEventListener('click', e=>{
    e.stopPropagation();
    const b=e.target.closest('.fsw'); if(!b) return;
    const lv=getFocusLevel();
    if(lv < FLY_COLOR_LEVEL && !isAdmin()){
      toast('🔒 Lv.'+FLY_COLOR_LEVEL+' 달성 시 색을 고를 수 있어요');
      return;
    }
    _setChatFlyColor(b.getAttribute('data-flycolor') || '');
    _chatFlyRefreshUI();
  });
  // 🔇 채팅 켜기/끄기 — 시크릿룸 방장만. 권한 판정은 _chatOffToggleClick 안에 있다.
  const coff=document.getElementById('chatOffToggle');
  if(coff) coff.onclick=(e)=>{ e.stopPropagation(); _chatOffToggleClick(); };
  /* 🗑 기록 삭제 — 방장만. 권한 판정은 _chatDelOpen / _chatDelRun 안에 있다.
     ⚠️ 배경(#chatDelOv)을 눌러도 닫는다. 다만 창 안쪽 클릭이 배경까지 올라가면 지우려다 닫히므로
       #chatDelWin 에서 전파를 끊는다 — 확인창에서 제일 흔한 실수 자리다. */
  const cdel=document.getElementById('chatDelLog');
  if(cdel) cdel.onclick=(e)=>{ e.stopPropagation(); _chatDelOpen(); };
  const cdOv=document.getElementById('chatDelOv');
  if(cdOv) cdOv.onclick=(e)=>{ e.stopPropagation(); _chatDelClose(); };
  const cdWin=document.getElementById('chatDelWin');
  if(cdWin) cdWin.onclick=(e)=>{ e.stopPropagation(); };
  const cdX=document.getElementById('chatDelX');
  if(cdX) cdX.onclick=(e)=>{ e.stopPropagation(); _chatDelClose(); };
  const cdC=document.getElementById('chatDelCancel');
  if(cdC) cdC.onclick=(e)=>{ e.stopPropagation(); _chatDelClose(); };
  const cdOk=document.getElementById('chatDelOk');
  if(cdOk) cdOk.onclick=(e)=>{ e.stopPropagation(); if(!cdOk.disabled) _chatDelRun(); };
  const emo=document.getElementById('chatEmojiBtn');
  if(emo) emo.onclick=(e)=>{ e.stopPropagation(); _toggleEmojiPanel(); };
  const ewc=document.getElementById('chatEmojiWinClose');
  if(ewc) ewc.onclick=()=>{ const w=document.getElementById('chatEmojiWin'); if(w) w.classList.remove('on'); };
  // 🎲 주사위 버튼 → 굴리기
  const dice=document.getElementById('chatDiceBtn');
  if(dice) dice.onclick=(e)=>{ e.stopPropagation(); _rollDice(); };
  /* 💣 플라잉체어 — 조준 모드를 켜고 상대를 클릭해 날린다.
     ★ 채널 게이트를 여기서 한 번 더 본다 — 채팅창 자체가 투게더룸(채널2)에서만 열리지만,
       버튼이 HTML 에 상시 존재하므로 창이 다른 경로로 떠도 새지 않게.
     ★ 레벨 게이트는 **버튼을 숨기지 않고** 눌렀을 때 안내한다. 숨기면 이런 기능이 있다는
       것 자체를 모른 채 지나간다 — 해금이 목표를 만들어 주는 자리라 보이는 편이 낫다. */
  const bomb=document.getElementById('chatBombBtn');
  if(bomb) bomb.onclick=(e)=>{
    e.stopPropagation();
    if(window._activeChannel !== 2){ toast('투게더룸에서만 쓸 수 있어요'); return; }
    /* 🏢 회사원 모드 — 조준 자체를 안 켠다.
       ★ 여기는 **토스트를 띄운다.** '상대 우클릭이 조용한 것'과 다른 경우다 — 그쪽은 남의 행동에
         내 화면이 반응하면 안 되는 것이고, 이건 내가 방금 누른 버튼이라 아무 응답이 없으면
         고장으로 읽힌다. 바로 위 채널·레벨 게이트가 이미 같은 방식으로 안내한다. */
    if(officeMode()){ toast('🏢 회사원 모드에서는 쓸 수 없어요'); return; }
    const lv = getFocusLevel();
    if(lv < FLY_MIN_LEVEL){ toast('💣 는 레벨 ' + FLY_MIN_LEVEL + '부터 쓸 수 있어요 (지금 레벨 ' + lv + ')'); return; }
    if(!seats.some(s=>s.remote)){ toast('방에 다른 분이 있어야 해요'); return; }
    setFlyAiming(!_flyAiming());
  };
  /* 📷 스티커사진 — 지금은 **문 앞까지만** 붙어 있다(핸드오프 6절 3번).
     누르면 하루 정원을 한 번 읽어서 남은 횟수나 닫힘 안내를 띄운다. 촬영 창은 다음 세션이다.
     ★ 채널 게이트는 💣 와 같은 한 줄이다 — 버튼은 HTML 에 상시 있으므로 창이 다른 경로로 떠도 새지 않게.
     ★ 정원은 **읽기만** 한다. 차감(takeQuota)은 「촬영 시작」 순간이다 —
       누를 때 깎으면 로비에서 구경만 하다 닫는 사람이 하루치를 갉아먹는다.
     ⚠️ 상시 구독(watchQuota)을 여기에 걸지 말 것. 아무도 안 보는 화면을 위해 하루 400번의
       갱신을 접속자 전원에게 뿌리는 구조가 된다. 구독은 촬영 창이 열려 있는 동안만이다. */
  const cam=document.getElementById('chatPhotoBtn');
  if(cam) cam.onclick=async (e)=>{
    e.stopPropagation();
    if(window._activeChannel !== 2){ toast('투게더룸에서만 쓸 수 있어요'); return; }
    /* 🏢 회사원 모드 — 💣 와 같은 자리·같은 방식이다. **버튼을 숨기지 않고** 눌렀을 때 안내한다.
       숨기면 이런 기능이 있다는 것 자체를 모른 채 지나가고, 모드를 껐을 때 버튼이 갑자기
       생기는 것도 «고장»으로 읽힌다. 여기는 내가 방금 누른 버튼이라 토스트가 맞다. */
    if(officeMode()){ toast('🏢 회사원 모드에서는 쓸 수 없어요'); return; }
    const pk=_purikura();
    /* 아직 안 붙었거나(구버전 HTML) firebase 가 늦게 뜬 경우 — 눌러도 반응 없는 버튼으로 두지 않는다 */
    if(!pk){ toast('📷 스티커사진은 아직 준비 중이에요'); return; }
    if(cam.dataset.busy === '1') return;              // 연타로 자리 잡기가 겹치는 것만 막는다
    cam.dataset.busy = '1';
    /* 정원 확인·닫힘 안내·자리 잡기는 전부 openPurikura 안에 있다 —
       여기와 그 안에서 각각 읽으면 문 한 번 여는 데 정원을 두 번 읽게 된다. */
    try{ await purikuraUi.open(); }
    finally{ cam.dataset.busy = '0'; }
  };
  // 이모티콘 그리드 클릭(위임) — 슬롯 삽입 / 삭제
  const grid=document.getElementById('emojiGrid');
  if(grid){
    grid.addEventListener('click', e=>{
      const del=e.target.closest('.es-del');
      if(del){ e.stopPropagation(); _deleteEmoji(parseInt(del.getAttribute('data-del'),10)); return; }
      const add=e.target.closest('[data-add]');
      if(add){   // ＋ — 빈 슬롯을 찾아 기존 등록 흐름으로
        let s=-1; for(let i=0;i<EMOJI_SLOTS;i++){ if(!(_emojiCache()[i]&&_emojiCache()[i].url)){ s=i; break; } }
        if(s<0){ toast('내 이모티콘은 '+EMOJI_SLOTS+'개까지 등록할 수 있어요'); return; }
        _onEmojiSlotClick(s); return;
      }
      const dc=e.target.closest('[data-cmd]');
      if(dc){   // 기본 이모티콘 — /명령어 삽입 (바로 전송 안 함)
        const inp=document.getElementById('chatInput');
        if(inp){ inp.value=(inp.value||'')+'/'+dc.getAttribute('data-cmd')+' '; inp.focus(); }
        return;
      }
      const slot=e.target.closest('.emoji-chip[data-slot], .emoji-slot[data-slot]');   // 커스텀 이모티콘은 .emoji-chip[data-slot]로 렌더됨(클래스명 불일치 수정)
      if(slot){ _onEmojiSlotClick(parseInt(slot.getAttribute('data-slot'),10)); }
    });
  }
  // 파일 선택 → 등록
  const fi=document.getElementById('emojiFileInput');
  if(fi){ fi.addEventListener('change', ()=>{ const f=fi.files&&fi.files[0]; _onEmojiFilePicked(f||null); }); }
})();

return {};   // 밖에서 부르는 이름 없음 — 전부 만들 때 건다
}

const api = { createChatWindow };
if(typeof window !== 'undefined') window.TwChatWindow = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

/* focus-log.js — 🕒 포커스 기록 팝업(현재 / 누적 · 오늘 기록 · 미니미 _ □ · 타이틀바 끌기 · ⎋ 닫기)
   app.js 의 «🕒 포커스 기록 팝업» 구역을 그대로 옮긴 모듈이다(앱 FSD 13번 — docs/APP_FSD_MAP.md). 동작은 옮기기 전과 같다.

   ★ 아래 본문은 app.js 에 있던 글 그대로다 — 들여쓰기도 바꾸지 않았다(옮기기 전 줄과 견주어 볼 수 있게).
     바뀐 것은 두 줄뿐이다 — _focusTotalSec → _focusTotalSec() · _focusSessionSec → _focusSessionSec().
     app.js 가 포커스 시간마다 다시 대입하는 let 이고 이 모듈을 만드는 줄보다 한참 뒤에 선언되므로 값이 아니라 읽는 함수로 받는다.
   ★ 함수(formatHMS · _rolloverFocusToday · bringWinToFront · escRegisterWindow)는 app.js 가 화살표로 넘긴다.
     본문의 typeof 가드(typeof bringWinToFront)는 예전처럼 늘 통과한다.
   ★ 밖에서 부르는 이름은 없다 — 버튼([기록 열기] #fsFocusLogBtn · ✕ · _ · □ · 누적기록) 연결 · ESC 등록 · 매초 갱신 ·
     타이틀바 끌기를 전부 만들 때 건다. 👑 달성표 · 🍅 뽀모 서랍이 부르는 window._focusLogClamp 도 예전처럼 만들 때 건다.
   ★ createFocusLog 는 app.js 의 원래 자리(🕒 포커스 기록 팝업 머리 아래)에서 부른다. 만들 때 바로 도는 것이 예전과 같은 순서 · 같은 때에 돈다.
   ⚠️ document · window · localStorage · innerWidth · innerHeight · setInterval 은 예전처럼 전역 이름으로 쓴다
     (이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwFocusLog — 크로미움 내장 전역과 겹치는 이름(Scheduler 같은)을 쓰면 typeof 가드가 늘 통과한다(#103).
   검사: checks/sim-focus-log.js — 만들 때 배선 · 열기(현재 기록부터 · 설정창 닫기 · 맨 앞) · 누적 / 오늘 두 줄 · 미니미(저장 · 좌상단 고정 ·
         본문 누름 토글) · 매초 갱신 · 끌기(화면 안) · ESC · app.js 배선 · html 순서. */
(function(){

function createFocusLog(deps){
const formatHMS = deps.formatHMS;
const _rolloverFocusToday = deps.rolloverFocusToday;   // 오늘 기록 — 자정이 지났으면 0 으로 넘기고 돌려준다
const bringWinToFront = deps.bringWinToFront;          // 🪟 열 때 맨 앞으로
const escRegisterWindow = deps.escRegisterWindow;      // ⎋ ESC 스택
const _focusTotalSec = deps.focusTotalSec;             // 읽는 함수 — app.js 가 다시 대입하는 let(누적 기록)
const _focusSessionSec = deps.focusSessionSec;         // 읽는 함수 — app.js 가 다시 대입하는 let(현재 기록)
/* 포커스 기록 팝업 — [기록 열기] 클릭 시 오늘 누적 포커스 시간(hh:mm:ss)을 보여주고, 타이틀바 드래그로 위치 이동 가능 */
(function bindFocusLog(){
  const overlay=document.getElementById('focusLogOverlay');
  const win=document.getElementById('focusLogWin');
  const title=document.getElementById('focusLogTitle');
  const timeEl=document.getElementById('focusLogTime');
  const captionEl=document.getElementById('focusLogCaption');
  const openBtn=document.getElementById('fsFocusLogBtn');
  const closeBtn=document.getElementById('focusLogClose');
  const toggleBtn=document.getElementById('focusLogOk');
  if(!overlay||!win) return;

  /* ── 미니미(최소화) 상태 ────────────────────────────────────────
     _ = 118px 한 줄짜리 미니미, □ = 원래 크기. 상태는 재시작해도 유지된다.
     전환할 때 창의 '좌상단 좌표'를 고정해서 오른쪽·아래로만 줄었다 늘어난다 —
     화면 밖으로 밀려나면 clampWin()이 다시 끌어들인다. */
  const MINI_KEY='tw.focusLogMini';
  const titleTxtEl=document.getElementById('focusLogTitleTxt');
  const minBtn=document.getElementById('focusLogMin');
  const maxBtn=document.getElementById('focusLogMax');
  const cap2El=document.getElementById('focusLogCaption2');
  const bodyEl=document.getElementById('focusLogBody');
  let miniOn=false;
  try{ miniOn = localStorage.getItem(MINI_KEY)==='1'; }catch(_){}
  function clampWin(){
    // transform 기반 중앙정렬 상태(아직 한 번도 안 옮김)면 건드리지 않는다 — 중앙정렬이 풀려버림.
    if(win.style.transform==='none' && win.style.left){
      win.style.left=Math.max(0,Math.min(innerWidth -win.offsetWidth,  parseFloat(win.style.left)||0))+'px';
      win.style.top =Math.max(0,Math.min(innerHeight-win.offsetHeight, parseFloat(win.style.top )||0))+'px';
    }
  }
  /* 👑 달성표 서랍이 펼쳐지면 창이 세로로 길어져 화면 밖으로 삐져나갈 수 있다.
     서랍 쪽에서 여닫을 때마다 이걸 불러 다시 끌어들인다. */
  try{ window._focusLogClamp = clampWin; }catch(_){}
  function setMini(on, {persist=true}={}){
    miniOn=!!on;
    if(persist){ try{ localStorage.setItem(MINI_KEY, miniOn?'1':'0'); }catch(_){} }
    // 이미 열려있을 때만 좌상단 고정 — 닫혀있으면 getBoundingClientRect가 0이라 좌표가 망가진다.
    if(overlay.classList.contains('on')){
      const r=win.getBoundingClientRect();
      win.style.transform='none'; win.style.left=r.left+'px'; win.style.top=r.top+'px';
    }
    win.classList.toggle('mini', miniOn);
    if(titleTxtEl) titleTxtEl.textContent = miniOn ? '기록' : '포커스 기록';
    refreshTime();
    clampWin();
  }

  /* 'session' = 현재 기록(앱을 켠 시점부터, 재시작하면 0부터)
     'total'   = 누적 기록 + 오늘 기록(0시~자정 기준, 앱을 껐다 켜도 이어짐)을 두 줄로 함께 표시.
     ★ '오늘 기록'은 저장되는 _focusTodaySec라 재시작해도 이어지고, '현재 기록'은 메모리 전용이라
       앱을 켤 때마다 0부터 시작한다 — 둘의 성격이 달라 누적 탭에 함께 두는 편이 읽기 쉽다. */
  const row2El=document.getElementById('focusLogRow2');
  const time2El=document.getElementById('focusLogTime2');
  let logMode='session';
  function refreshTime(){
    const showTotal = (logMode==='total');
    // 미니미는 폭이 126px뿐이라 라벨을 두 글자로 줄인다("누적 기록"→"누적").
    const mini = win.classList.contains('mini');
    win.classList.toggle('total', showTotal);
    if(showTotal){
      captionEl.textContent = mini?'누적':'누적 기록'; timeEl.textContent=formatHMS(_focusTotalSec());
      if(cap2El) cap2El.textContent = mini?'오늘':'오늘 기록';
      if(time2El) time2El.textContent=formatHMS(_rolloverFocusToday());
      toggleBtn.textContent='현재기록';
    }else{
      captionEl.textContent = mini?'현재':'현재 기록'; timeEl.textContent=formatHMS(_focusSessionSec());
      toggleBtn.textContent='누적기록';
    }
    // 둘째 줄(오늘 기록)은 누적 탭에서만 노출
    if(row2El) row2El.style.display = showTotal ? 'flex' : 'none';
  }
  function openLog(){
    logMode='session';   // 열 때마다 "현재 기록"부터 보여줌
    // 지난번에 미니미로 두고 껐으면 그대로 미니미로 연다(persist=false: 이미 저장된 값이라 다시 안 씀)
    setMini(miniOn, {persist:false});
    overlay.classList.add('on');
    if(typeof bringWinToFront==='function') bringWinToFront('focusLogOverlay');   // 🪟 열 때는 맨 앞으로(대화창·설정창과 같은 규약)
    clampWin();          // 미니미↔일반 폭 차이로 저장된 좌표가 화면 밖이면 끌어들임
    const panel=document.getElementById('focusSettingsPanel'); if(panel) panel.classList.remove('on');
  }
  function closeLog(){ overlay.classList.remove('on'); }
  /* ⎋ ESC 스택 — 이 창도 여태 ESC 로 닫히지 않았다.
     📌 참고로 openLog 는 **설정창을 닫는다**(위 한 줄). 그래서 [기록 열기]로 연 직후에는 둘이
       함께 열려 있지 않고, ⚙️ 를 다시 눌러야 둘 다 열린 상태가 된다 — 그때 ESC 두 번이면
       기록(나중에 연 것)부터 닫힌다. */
  escRegisterWindow({
    key:'focusLog', el:overlay,
    isOpen:()=>overlay.classList.contains('on'),
    close:closeLog,
  });
  if(openBtn) openBtn.onclick=openLog;
  if(closeBtn) closeBtn.onclick=closeLog;
  /* _ ↔ □ — **같은 자리를 번갈아 쓰는 버튼 하나**다(요청). 평소엔 _ 만 보이고, 최소화한 뒤에는
     그 자리에 □ 가 나타난다. 보이기/숨기기는 CSS 가 `.mini` 하나로 정하므로 여기서는 손대지 않는다
     — 두 곳에서 정하면 한쪽만 고쳐져서 둘 다 보이거나 둘 다 사라지는 상태가 생긴다. */
  if(minBtn) minBtn.onclick=e=>{ e.stopPropagation(); setMini(true); };
  if(maxBtn) maxBtn.onclick=e=>{ e.stopPropagation(); setMini(false); };
  if(toggleBtn) toggleBtn.onclick=()=>{ logMode = (logMode==='session') ? 'total' : 'session'; refreshTime(); };
  // 미니미엔 「누적기록」 버튼이 안 들어가므로 본문 클릭으로 대신 토글한다.
  if(bodyEl) bodyEl.addEventListener('click', ()=>{
    if(!win.classList.contains('mini')) return;
    logMode = (logMode==='session') ? 'total' : 'session'; refreshTime(); clampWin();
  });

  // 열려있는 동안 매초 실시간 갱신 (지금 보고 있는 모드 기준으로)
  setInterval(()=>{ if(overlay.classList.contains('on')) refreshTime(); }, 1000);

  // 타이틀바 드래그로 창 위치 이동 (첫 드래그 시 transform 기반 중앙정렬 → left/top 절대좌표로 전환)
  let dragging=false, startX=0, startY=0, baseX=0, baseY=0;
  title.addEventListener('mousedown', e=>{
    // _ □ ✕ 위에서 누른 건 드래그가 아니다 — 안 막으면 버튼 클릭만으로도 창이 중앙정렬에서 풀린다.
    if(e.target.closest && e.target.closest('.flt-x')) return;
    dragging=true; startX=e.clientX; startY=e.clientY;
    const r=win.getBoundingClientRect(); baseX=r.left; baseY=r.top;
    win.style.transform='none'; win.style.left=baseX+'px'; win.style.top=baseY+'px';
    e.preventDefault();
  });
  window.addEventListener('mousemove', e=>{
    if(!dragging) return;
    win.style.left=Math.max(0,Math.min(innerWidth-win.offsetWidth, baseX+e.clientX-startX))+'px';
    win.style.top =Math.max(0,Math.min(innerHeight-win.offsetHeight, baseY+e.clientY-startY))+'px';
  });
  window.addEventListener('mouseup', ()=>{ dragging=false; });
})();

return {};   // 밖에서 부르는 이름 없음 — 전부 만들 때 건다
}

const api = { createFocusLog };
if(typeof window !== 'undefined') window.TwFocusLog = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

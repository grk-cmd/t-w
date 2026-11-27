/* office-mode.js — 🏢 데스크탑 · 피규어 · 회사원 모드 깃발(앱 FSD · app.js 분리 M14)
   app.js 의 «데스크탑(Electron) 모드» 구역(desktopMode · 피규어 모드 · 회사원 모드 · 화면 숨김 · 미니 메뉴 ▾ 우클릭 · __officeDiag)을 글 그대로 옮긴 모듈이다.
   동작은 옛 자리와 같다(다시 대입되는 값을 읽는 함수 · 쓰는 함수로 받는 줄만 달라진다).
   ・책임: desktopMode(Electron 안인가) · figureMode · officeMode(저장 키 tw.figureMode · tw.officeMode 에서 읽은 깃발) · setOfficeHidden(화면 숨김 — body.office-hidden · ▾ 버튼 표시 · 칩 팝업 닫기) · refreshOfficeChipUI · ▾ 버튼 우클릭 연결 · window.__officeDiag(진단 — 상태를 고치지 않는다).
   ・내놓는 것: desktopMode · FIGURE_MODE_KEY · OFFICE_MODE_KEY · setOfficeHidden · refreshOfficeChipUI(값 · 함수) · figureMode · officeMode(읽는 함수) · setFigureMode · setOfficeMode(쓰는 함수) — app.js 는 값 · 함수를 같은 이름 const 로 받는다.
   ⚠️ 모듈을 만들 때(app.js 옛 자리) 깃발을 localStorage 에서 읽고 refreshOfficeChipUI() 를 한 번 부른다. 이 깃발을 최상위에서 읽는 app.js 코드(focusGateSleep 등)는 만드는 줄 아래에 있어야 한다 — 위에 두면 TDZ 로 앱이 죽는다(node checks/smoke.js 가 잡는다).
   검사: checks/sim-office-mode.js */
(function(){

function createOfficeMode(deps){
const chipPopupsMod = deps.chipPopupsMod;
const desktopMode = !!window.companion || /[?&]desktop=1/.test(location.search);
/* ★ 피규어 모드 — 켜져 있으면 포커싱 어플 등록 여부 · 입력 유무와 무관하게 항상 깨어 있다(seatState).
   대신 포커스 시간(레벨) · 👑 달성표 🎯집중은 쌓지 않는다(_applyActiveAppState) — 설정 화면 · 도움말이 그렇게 약속한다. */
const FIGURE_MODE_KEY = 'tw.figureMode';
let figureMode = (localStorage.getItem(FIGURE_MODE_KEY)==='1');
/* 🏢 회사원 모드 — 켜면 남의 마이홈이 안 열리고 말풍선이 잠기며, 미니 메뉴 ▾ 버튼 우클릭으로
   화면을 즉시 숨길 수 있다.
   ⚠️ 선언 자리를 figureMode 옆으로 잡은 이유 — app.js 는 최상위에서 값을 읽는 코드가 많아
     선언 순서(TDZ)가 실제로 앱을 죽인 적이 있다. 이 값을 읽는 최상위 코드는 반드시
     **이 줄 아래**에 있어야 한다(refreshOfficeModeUI 처럼 나중에 불리는 함수 안은 상관없다).
     `node smoke.js` 가 그걸 잡는다. */
const OFFICE_MODE_KEY = 'tw.officeMode';
let officeMode = (localStorage.getItem(OFFICE_MODE_KEY)==='1');
/* 화면 숨김 — **세션 한정이라 저장하지 않는다.**
   숨긴 채로 앱이 꺼졌다 켜지면 아무것도 없는 화면이 뜨는데, 그건 기능이 아니라 고장으로 읽힌다. */
let _officeHidden = false;
/* 숨길 대상을 JS 로 하나씩 지우지 않고 body 클래스 하나로 CSS 에 넘긴다 —
   이 코드베이스에서 "선택자를 하나씩 나열하다 빠뜨림"은 반복된 실패 양상이고
   (audit 검사 12·14·15 가 전부 그래서 생겼다), 새 요소가 생길 때마다 또 빠뜨린다. */
function setOfficeHidden(on){
  _officeHidden = !!on && officeMode;   // 회사원 모드가 꺼져 있으면 숨김 상태 자체가 성립 안 함
  document.body.classList.toggle('office-hidden', _officeHidden);
  const btn=document.getElementById('myStatusChipBtn');
  if(btn){
    /* ⚠️ .on 은 상태 메뉴가 열렸을 때 쓰는 눌린 표시다. 여기서 같이 쓰면 두 상태가 섞여
       메뉴를 닫는 순간 숨김 표시까지 지워진다 — 전용 클래스를 쓴다. */
    btn.classList.toggle('office-hiding', _officeHidden);
    btn.title = _officeHidden ? '우클릭: 화면 다시 보이기'
              : (officeMode ? '메뉴 (우클릭: 화면 숨기기)' : '메뉴');
  }
  /* 숨길 때 열려 있던 **칩 팝업**(상태·더보기·알림 등)은 닫는다 — 지나가는 것들이라 숨김을
     푼 뒤에도 떠 있으면 오히려 거슬린다.
     ⚠️ 창(설정·포커스 기록·마이홈 …)은 여기서 닫지 않는다. 그쪽은 CSS 의 body.office-hidden 이
       display 만 끄므로 상태를 쥔 채 사라졌다가 그대로 돌아온다 — 하던 일이 날아가면 안 된다.
       숨김 대상을 JS 로 나열하지 않는 이유는 CSS 쪽 주석 참고. */
  if(_officeHidden){
    /* force=true — 🎵 플레이리스트까지 닫는다. 이 창만은 예외로 남기면 안 된다:
       재생 중이면 _plSyncBgmBounds 가 패널 자리를 main 에 계속 알려서, 화면을 숨겨도
       유튜브 자식창이 그 자리에 그대로 떠 있게 된다(숨김이 안 된 것처럼 보인다). */
    try{ chipPopupsMod._closeChipPopups(null, true); }catch(_){}   // ▾ 메뉴(상태 목록 포함)도 이 목록에 있다
  }
}
function refreshOfficeChipUI(){
  if(!officeMode && _officeHidden) setOfficeHidden(false);   // 모드를 끄면 숨김도 반드시 풀린다
  else setOfficeHidden(_officeHidden);                       // 툴팁 문구를 모드에 맞춰 다시 씀
}
/* 숨기기 진입점 = **미니 메뉴 ▾ 버튼(#myStatusChipBtn) 우클릭** 하나다.
   ★ 숨기기 전용 버튼을 따로 두지 않는다 — 숨겼을 때 남는 것이 이 버튼이라 되돌리는 손짓도 같은 자리에 둔다.
   ⚠️ 이 버튼은 #myStatusChip 안에 있어 클릭 통과 화이트리스트에 자동 포함된다 —
     밖으로 옮기면 숨긴 순간 되돌릴 길이 사라진다(그때는 앱 재시작밖에 없다).
   ⚠️ preventDefault 를 빼면 Electron 에서 기본 컨텍스트 메뉴가 같이 뜬다. */
(function bindOfficeHideGesture(){
  const btn=document.getElementById('myStatusChipBtn'); if(!btn) return;
  btn.addEventListener('contextmenu', e=>{
    e.preventDefault(); e.stopPropagation();
    if(!officeMode) return;   // 회사원 모드가 꺼져 있으면 아무 일도 없다(토스트도 안 띄운다)
    setOfficeHidden(!_officeHidden);
  });
})();
refreshOfficeChipUI();   // ★ officeMode 선언 뒤에서만 부를 것 (위 TDZ 주석 참고)
/* 🔎 회사원 모드 진단 — **일부 사용자에게서만** "켜도 안 켜진다"는 제보가 있고, 코드만 봐서는
     어느 단계가 끊기는지 가릴 수가 없다(저장이 안 남는 것인지, 버튼이 안 붙은 것인지,
     켜지긴 하는데 눈에 보이는 변화가 없는 것인지). 세 가지를 한 번에 찍는다.
   ★ 런처/생성기 화면에서 F12 → `__officeDiag()`. 실행 화면은 창이 투명해 콘솔을 열기 어렵다
     (__mouseDiag 를 같은 이유로 같은 방식으로 두었다 — 그쪽 주석 참고).
   ⚠️ 진단만 한다. 여기서 상태를 고치지 말 것 — 고치면 그 다음 제보에서 원인이 또 지워진다. */
window.__officeDiag = function(){
  let 새키쓰기 = null;
  try{
    localStorage.setItem('tw.__probe', '1');
    새키쓰기 = (localStorage.getItem('tw.__probe') === '1');
    localStorage.removeItem('tw.__probe');
  }catch(e){ 새키쓰기 = '실패: ' + ((e && e.name) || e); }
  let used = 0;
  try{ for(const k in localStorage){ const v = localStorage.getItem(k); if(v != null) used += (k.length + v.length) * 2; } }catch(_){}
  return {
    저장값       : (()=>{ try{ return localStorage.getItem(OFFICE_MODE_KEY); }catch(e){ return '읽기실패'; } })(),
    메모리값     : officeMode,
    새키쓰기     : 새키쓰기,          // false 또는 '실패:…' 면 저장 공간이 원인이다
    저장사용량MB : (used / 1048576).toFixed(2),
    토글버튼     : !!document.getElementById('progOfficeModeToggle'),
    화면숨김중   : _officeHidden,
    숨김클래스   : document.body.classList.contains('office-hidden'),
  };
};

return {
  desktopMode,
  FIGURE_MODE_KEY,
  figureMode: ()=>figureMode,
  setFigureMode: (v)=>{ figureMode = v; },
  OFFICE_MODE_KEY,
  officeMode: ()=>officeMode,
  setOfficeMode: (v)=>{ officeMode = v; },
  _officeHidden: ()=>_officeHidden,
  refreshOfficeChipUI,
};
}

const api = { createOfficeMode };
if(typeof window !== 'undefined') window.TwOfficeMode = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

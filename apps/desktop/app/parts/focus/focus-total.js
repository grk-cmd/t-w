/* focus-total.js — ⏱️ 포커스 누적 — 전체 · 오늘 · 이번 실행 시간 저장(6시 날짜 경계 · 회차 상한)
   app.js «⏱️ 포커스 누적 — 전체 · 오늘 · 이번 실행 시간 저장(6시 날짜 경계 · 회차 상한)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 45번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 0줄 —
     바꾼 이름 없음.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 0개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: DAY_START_HOUR · FOCUS_CYCLE_CAP · FOCUS_CYCLE_SEC · FOCUS_LEVEL_CAP_HOURS · FOCUS_TODAY_DATE_KEY · FOCUS_TODAY_SEC_KEY · FOCUS_TOTAL_CAP_SEC · FOCUS_TOTAL_KEY · _dayShifted · _focusDayStr · _focusSessionSec · _focusTodaySec · _loadFocusTotalSec · _rolloverFocusToday · _todayStr — app.js 는 focusTotalMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwFocusTotal — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-focus-total.js */
(function(){

function createFocusTotal(deps){

const focusTotalStore = deps.focusTotalStore;   // 🗂️ 누적 세 칸은 계정별 칸(shared/account-store.js) — 계정을 바꾸면 다른 칸이 열린다
const FOCUS_TOTAL_KEY='tw.focusTotalSec', FOCUS_TODAY_SEC_KEY='tw.focusTodaySec', FOCUS_TODAY_DATE_KEY='tw.focusTodayDate';
const FOCUS_LEVEL_CAP_HOURS=999;
/* 🔁 누적 상한과 레벨 상한을 가른다 (2026-09-18) ────────────────────────────
   예전엔 `FOCUS_LEVEL_CAP_HOURS` 하나가 **두 몫**을 했다 — 레벨 999 에서 접는 것과,
   누적 초 자체를 999시간에서 멈추는 것. 그래서 회차(999 를 채우면 ★ 하나 + 레벨 1부터)를
   붙일 재료가 아예 안 쌓였다.
   ⇒ 그릇(누적)만 먼저 키운다. **레벨 표시는 지금 그대로 999 에서 접힌다** — 별을 붙이는 단계는
     다음이다(`handoff-level-tiers.md` §3).
   ⇒ [개정 70] 별을 붙였다 — 단 **getFocusLevel 은 그대로 999 에서 멈춘다**(해금 기준이라서).
     표시만 myFocusShow() 가 «이번 바퀴» 레벨 + 별로 바꾼다. 누적이 원천이라 표시를 나중에 붙여도
     그동안 쌓인 몫이 **소급해서** 회차로 보인다. 먼저 모듈로로 바꾸면 999 를 넘긴 사람이
     별 없이 Lv.1 로 떨어져 보인다 — 순서가 이쪽인 이유.
   ★ 회차는 저장하지 않는다. `floor(누적/FOCUS_CYCLE_SEC)` 로 **파생**시킨다 —
     서버 병합이 단조 증가라 저장하면 두 기기가 어긋날 자리가 생긴다(§3-1-b).
   ⚠️ 이 상한은 **세 곳에 같이 있다.** 하나만 올리면 조용히 안 맞는다:
       ① 여기(app.js)  ② `firebase-init.js` `syncFocusTotal` 의 CAP
       ③ 규칙 파일 `users/$userId/focus` 의 `.validate` — **게시해야 켜진다.**
     서버 쪽이 더 낮으면 잘리는 게 아니라 **쓰기가 통째로 거부**된다(permission_denied). */
const FOCUS_CYCLE_SEC     = FOCUS_LEVEL_CAP_HOURS*3600;        // 999시간 = 회차 한 바퀴
const FOCUS_CYCLE_CAP     = 100;                               // 열어 둔 회차 수
const FOCUS_TOTAL_CAP_SEC = FOCUS_CYCLE_SEC*FOCUS_CYCLE_CAP;   // 359,640,000초 = 99,900시간
function _todayStr(){ const d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
/* 🌅 하루의 시작을 **오전 6시**로 본다 ─────────────────────────────────────
   [왜] 새벽까지 일하는 사람에게 0시 리셋은 한 세션을 두 날로 갈라 놓는다. 02시에 아직 안 잤는데
     "오늘 기록"이 0이 되고, 달성표의 그 날은 실패로 닫힌다.
   [무엇이 쓰나] **포커스 오늘 기록과 달성표만** 이 기준을 쓴다. `_todayStr()`(자정 기준)은
     때리기 하루 10회처럼 성격이 다른 카운터가 그대로 쓴다 — 그쪽까지 옮기면 "하루"가 두 뜻이 된다.
   [왜 이 방식인가] 시각을 6시간 당겨 보기만 하면 **요일·주 경계가 저절로 따라온다.**
     달성표는 월요일 06:00 시작 ~ 토요일 06:00 마감이 되고, 금요일 밤 24시~토 06시는 금요일로 센다.
   ⚠️ 새 날짜 기준을 쓰는 자리를 늘릴 때는 반드시 `_focusDayStr()`·`_dayShifted()` 를 쓸 것.
     `new Date()` 를 직접 부르면 그 자리만 자정 기준으로 남아 하루가 어긋난다. */
const DAY_START_HOUR = 6;
function _dayShifted(when){
  const d = new Date(when == null ? Date.now() : when);
  d.setHours(d.getHours() - DAY_START_HOUR);
  return d;
}
function _focusDayStr(when){ const d=_dayShifted(when); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
/* 🚚 경계를 옮긴 판으로 처음 켤 때 — 0시~6시 사이라면 저장된 날짜가 '오늘(자정 기준)'이다.
   그 초는 새 기준으로 보면 **어제 것**이므로 키만 갈아 끼워 살린다. 안 하면 날짜가 안 맞아
   그때까지 쌓은 오늘치가 0으로 지워진다.
   ⚠️ 조건이 좁다 — 앞으로는 저장 날짜가 늘 새 기준이라 이 분기에 다시 들어오지 않는다. */
function _focusMigrateDayKey(){
  try{
    const saved = focusTotalStore.get(FOCUS_TODAY_DATE_KEY);
    if(!saved || saved === _focusDayStr()) return;
    if(new Date().getHours() < DAY_START_HOUR && saved === _todayStr()){
      focusTotalStore.set(FOCUS_TODAY_DATE_KEY, _focusDayStr());
    }
  }catch(_){}
}
function _loadFocusTotalSec(){ try{ return parseFloat(focusTotalStore.get(FOCUS_TOTAL_KEY))||0; }catch(e){ return 0; } }
function _loadFocusTodaySec(){
  try{
    if(focusTotalStore.get(FOCUS_TODAY_DATE_KEY)!==_focusDayStr()) return 0;   // 날짜 바뀌었으면 오늘치만 리셋
    return parseFloat(focusTotalStore.get(FOCUS_TODAY_SEC_KEY))||0;
  }catch(e){ return 0; }
}
let _focusTodaySec=0;   // 계정 확인 뒤 startFocusTotal 이 계정 칸에서 읽는다
let _focusSessionSec=0;   // "현재 기록" — 이번 앱 실행 동안만 누적. 메모리 전용이라 재시작하면 0부터 시작(의도된 동작).
/* ★ 하루치 기록의 날짜 경계 확인 — **오전 6시~다음날 05:59:59** 기준(DAY_START_HOUR).
   예전엔 addFocusSeconds 안에서만 날짜를 봤다. 앱을 켜둔 채 자정을 넘기고 활동이 없으면
   화면 숫자가 어제 값 그대로 남아 있었다. 표시할 때도 이걸 불러 경계를 확인한다. */
function _rolloverFocusToday(){
  try{
    if(focusTotalStore.get(FOCUS_TODAY_DATE_KEY)!==_focusDayStr()){
      _focusTodaySec=0;
      focusTotalStore.set(FOCUS_TODAY_SEC_KEY,'0');
      focusTotalStore.set(FOCUS_TODAY_DATE_KEY,_focusDayStr());
    }
  }catch(e){}
  return _focusTodaySec;
}

/* 🚀 계정 확인 · 옛 PC 값 옮기기 뒤 한 번(launcher/app-boot.js) — 계정 칸에서 오늘치를 읽는다. 전체 누적은 app.js 가 _loadFocusTotalSec 로 읽는다. */
function startFocusTotal(){
  _focusMigrateDayKey();   // 🚚 6시 경계로 처음 켠 사람의 오늘치를 살린다 (아래 로드보다 먼저)
  _focusTodaySec=_loadFocusTodaySec();
}

return {
  startFocusTotal,
  DAY_START_HOUR,
  FOCUS_CYCLE_CAP,
  FOCUS_CYCLE_SEC,
  FOCUS_LEVEL_CAP_HOURS,
  FOCUS_TODAY_DATE_KEY,
  FOCUS_TODAY_SEC_KEY,
  FOCUS_TOTAL_CAP_SEC,
  FOCUS_TOTAL_KEY,
  _dayShifted,
  _focusDayStr,
  _focusSessionSec: ()=>_focusSessionSec,   // 읽는 함수
  setFocusSessionSec: (v)=>{ _focusSessionSec = v; },   // 쓰는 함수 — app.js 가 비운다
  _focusTodaySec: ()=>_focusTodaySec,   // 읽는 함수
  setFocusTodaySec: (v)=>{ _focusTodaySec = v; },   // 쓰는 함수 — app.js 가 비운다
  _loadFocusTotalSec,
  _rolloverFocusToday,
  _todayStr,
};
}

const api = { createFocusTotal };
if(typeof window !== 'undefined') window.TwFocusTotal = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

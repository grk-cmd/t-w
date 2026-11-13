/* focus-total.js — ⏱️ 오늘 · 이번 실행 시간 — 오늘 시간의 날 경계는 서버 날(`today.day` · `dayEndsAt`)
   책임: 오늘 시간 · 이번 실행 시간 · 서버 «오늘» 들고 있기 · 하루가 바뀔 때 알리기(onDayEnd). 누적 · 레벨은 서버 값(focus-progress.js).
   ★ 밖에서 부르는 이름: DAY_START_HOUR · FOCUS_CYCLE_CAP · FOCUS_CYCLE_SEC · FOCUS_LEVEL_CAP_HOURS · FOCUS_TODAY_DATE_KEY · FOCUS_TODAY_SEC_KEY · FOCUS_TOTAL_CAP_SEC · _dayShifted · _focusDayStr · _focusSessionSec · _focusTodaySec · serverDay · setServerDay · addFocusToday · onDayEnd · _rolloverFocusToday · _todayStr — app.js 는 focusTotalMod.이름 으로 부른다.
   ⚠️ _dayShifted · _focusDayStr · DAY_START_HOUR 는 달성표가 아직 쓰는 앱 날짜 셈이다(D5-4 에서 걷음) — 오늘 시간에는 쓰지 않는다.
   ⚠️ 전역 이름은 TwFocusTotal — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-focus-total.js · sim-focus-day.js */
(function(){

function createFocusTotal(deps){

const focusTotalStore = deps.focusTotalStore;   // 🗂️ 오늘 두 칸은 계정별 칸(shared/account-store.js) — 계정을 바꾸면 다른 칸이 열린다
const FOCUS_TODAY_SEC_KEY='tw.focusTodaySec', FOCUS_TODAY_DATE_KEY='tw.focusTodayDate';
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
/* 달성표(weekly-challenge.js)가 아직 쓰는 앱 날짜 셈 — D5-4 에서 서버 날로 바꾸고 걷는다. 오늘 시간은 쓰지 않는다. */
const DAY_START_HOUR = 6;
function _dayShifted(when){
  const d = new Date(when == null ? Date.now() : when);
  d.setHours(d.getHours() - DAY_START_HOUR);
  return d;
}
function _focusDayStr(when){ const d=_dayShifted(when); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }

/* 오늘 시간의 날 — 서버가 준 날 글자(`today.day`)를 그대로 쓴다. 하루가 바뀌는 때도 서버가 준 `dayEndsAt` 이다(한국 06:00).
   앱이 날짜를 셈하지 않는다 — PC 시간대가 달라도 하루는 서버 날에 맞는다.
   · 서버 답 전: 계정 칸에 적어 둔 날 · 초를 그대로 보인다(날이 달라졌으면 답이 오는 순간 0 으로)
   · dayEndsAt 이 지남: 요청 없이 0 으로 돌리고 날 글자는 비운다 · 서버에 새 날을 한 번 묻는다(실패해도 되풀이하지 않는다 — 다음 올리기 답이 새 날을 준다) */
let _day = null;            // 오늘 시간이 속한 날 글자(서버 값) · 모르면 null
let _askedEnd = 0;          // 새 날을 물어본 dayEndsAt — 같은 경계에서 한 번만 묻는다
let _focusTodaySec=0;       // 계정 확인 뒤 startFocusTotal 이 계정 칸에서 읽는다
let _focusSessionSec=0;     // "현재 기록" — 이번 앱 실행 동안만 누적. 메모리 전용이라 재시작하면 0부터 시작(의도된 동작).
/* 계정 칸에 남은 날 글자 — 0.12 는 0 채움 없이('2026-11-4') 적었다. 서버 글자('2026-11-04')와 맞춘다 */
function _normDay(v){
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(v || ''));
  return m ? m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0') : null;
}
function _saveToday(){
  try{
    focusTotalStore.set(FOCUS_TODAY_SEC_KEY, String(_focusTodaySec));
    focusTotalStore.set(FOCUS_TODAY_DATE_KEY, _day || '');
  }catch(e){}
}
const dayEndFns = [];
/* 하루가 바뀐 때 알릴 곳 — focus-progress.js 가 새 날을 한 번 받는다(app.js 가 잇는다 · 서로 deps 로 부르면 순환이라 구독으로) */
function onDayEnd(fn){ dayEndFns.push(fn); }
/* 오늘 시간 — 경계가 지났으면 0 으로 넘기고 돌려준다. 보여 줄 때 · 더할 때마다 부른다 */
function _rolloverFocusToday(){
  if(!_focusTotalStarted) return _focusTodaySec;   // 계정 칸이 읽히기 전에는 읽지도 쓰지도 않는다(0 으로 덮지 않게)
  const t = _serverDay;
  if(t && Date.now() >= t.dayEndsAt && _askedEnd !== t.dayEndsAt){
    _askedEnd = t.dayEndsAt;
    _focusTodaySec = 0; _day = null; _saveToday();
    dayEndFns.forEach((fn) => { try{ fn(); }catch(e){ console.warn('[포커스] 하루 바뀜 알림 실패', e); } });
  }
  return _focusTodaySec;
}
/* 집중한 초를 오늘 시간에 더한다(focus-level.js addFocusSeconds) */
function addFocusToday(sec){
  if(!_focusTotalStarted || !(sec > 0)) return;
  _rolloverFocusToday();
  _focusTodaySec += sec;
  _saveToday();
}

/* 서버 «오늘» — 진척 · 올리기 답이 준다(focus-progress.js). { day, isoWeek, dayEndsAt(ms) } · 받기 전 · 계정을 놓은 뒤에는 null */
let _serverDay = null;
function setServerDay(t){
  _serverDay = t;
  if(!t || !_focusTotalStarted) return;
  if(_day && _day !== t.day){ _focusTodaySec = 0; }   // 날이 달라졌다 — 새 날 0 부터
  _day = t.day;
  _saveToday();
}

/* 🚀 계정 확인 · 옛 PC 값 옮기기 뒤 한 번(launcher/app-boot.js) — 계정 칸에서 오늘 시간을 읽는다. 전체 누적은 서버 값(focus-progress.js)이다. */
let _focusTotalStarted = false;   // startFocusTotal 이 계정 칸을 읽은 뒤 true — 포커스 모듈(누적 더하기 · 롤오버 · 레벨 올림)의 입구가 본다
function startFocusTotal(){
  _focusTotalStarted = true;
  _day = _normDay(focusTotalStore.get(FOCUS_TODAY_DATE_KEY));
  _focusTodaySec = _day ? (parseFloat(focusTotalStore.get(FOCUS_TODAY_SEC_KEY)) || 0) : 0;
  if(_serverDay) setServerDay(_serverDay);   // 서버 답이 먼저 왔으면 맞춘다
}

return {
  startFocusTotal,
  _focusTotalStarted: ()=>_focusTotalStarted,   // 읽는 함수
  DAY_START_HOUR,
  FOCUS_CYCLE_CAP,
  FOCUS_CYCLE_SEC,
  FOCUS_LEVEL_CAP_HOURS,
  FOCUS_TODAY_DATE_KEY,
  FOCUS_TODAY_SEC_KEY,
  FOCUS_TOTAL_CAP_SEC,
  _dayShifted,
  _focusDayStr,
  _focusSessionSec: ()=>_focusSessionSec,   // 읽는 함수
  setFocusSessionSec: (v)=>{ _focusSessionSec = v; },   // 쓰는 함수 — app.js 가 비운다
  _focusTodaySec: ()=>_focusTodaySec,   // 읽는 함수
  setFocusTodaySec: (v)=>{ _focusTodaySec = v; },   // 쓰는 함수 — app.js 가 비운다
  serverDay: ()=>_serverDay,   // 읽는 함수
  setServerDay,
  _rolloverFocusToday,
  addFocusToday,
  onDayEnd,
  _todayStr,
};
}

const api = { createFocusTotal };
if(typeof window !== 'undefined') window.TwFocusTotal = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

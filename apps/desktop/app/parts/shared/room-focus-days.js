/* room-focus-days.js — 📅 시크릿룸 집중 기록의 «날 키» 규칙 한 곳(순수 · 의존 없음)
   서버 칸 이름 YYYYMMDD(집중 하루 — 6시 경계는 focus-total.js _focusDayStr 가 정한다) 를 만들고 · 읽고 · 하루 더하고 · 주 시작(월요일)을 구한다.
   올리기(room-focus-sync.js)와 보여 주기(chat/chat-focus.js)가 같은 키를 쓰도록 이 파일만 부른다 — 한쪽만 고치면 올린 칸과 통계가 어긋난다.
   ⚠️ 규칙(firebase-database-rules.json `_focus/$uid/d/$day`)은 `^20[0-9]{6}$` — 여기 isDayKey 와 같은 모양.
   classic script(window.TwRoomFocusDays) — 쓰는 두 모듈보다 먼저 싣는다.
   검사: checks/sim-room-focus.js */
(function(){

/* '2026-11-13'(집중 하루 문자열) → '20261113'. 틀리면 ''. */
function dayKeyOf(str){
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(str || ''));
  if(!m) return '';
  return m[1] + m[2].padStart(2, '0') + m[3].padStart(2, '0');
}
const isDayKey = (k) => /^20\d{6}$/.test(String(k));
const dateOfKey = (k) => new Date(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8));
function keyOfDate(d){ return String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
function addDays(key, n){ const d = dateOfKey(key); d.setDate(d.getDate() + n); return keyOfDate(d); }
/* 이번 주의 월요일(달성표와 같은 «월요일 시작») */
function weekStartKey(todayKey){ const d = dateOfKey(todayKey); return addDays(todayKey, -((d.getDay() + 6) % 7)); }

const api = Object.freeze({ dayKeyOf, isDayKey, addDays, weekStartKey });
if(typeof window !== 'undefined') window.TwRoomFocusDays = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

/* focus-share.js — 📊 오늘 기록 전시 — 머리 위 «오늘 n시간» 을 방에 보내기 · 설정 켜기
   app.js «📊 오늘 기록 전시 — 머리 위 «오늘 n시간» 을 방에 보내기 · 설정 켜기» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 45번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 3줄 —
     officeMode · userStatus 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 3개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: _focusShowConf · _focusShowMarkSent · _focusShowMine · _focusShowPush — app.js 는 focusShareMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwFocusShare — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-focus-share.js */
(function(){

function createFocusShare(deps){
const Presence = deps.Presence;
const _lsSet = deps._lsSet;
const _rolloverFocusToday = deps._rolloverFocusToday;
const officeMode = deps.officeMode;   // 읽는 함수
const toast = deps.toast;
const userStatus = deps.userStatus;   // 읽는 함수
const FOCUS_SHOW_KEY = 'tw.focusShow';
const FOCUS_SHOW_MS  = 60 * 1000;       // 1분에 한 번(2026-09-23 요청 · 처음엔 5분이었다)
let focusShowOn = false;
try{ focusShowOn = (localStorage.getItem(FOCUS_SHOW_KEY) === '1'); }catch(_){}
let _focusShowSentAt = 0, _focusShowSent = null;   // 마지막으로 방에 보낸 값(내 화면 거울도 이것을 쓴다)
function _focusShowText(sec){
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return '오늘 ' + h + ':' + String(m).padStart(2, '0');   // hh:mm — 초 없음
}
function _focusShowConf(){
  if(!focusShowOn) return null;
  if(typeof officeMode() !== 'undefined' && officeMode()) return null;
  /* 이모지는 **비워 둔다**(2026-09-23 요청) — 커스텀 상태와 같은 배관이라 emo 를 넣으면 책상 위(캐릭터 앞)에도
     그 이모지가 뜬다. '' 이면 말풍선 문구만 뜬다(statusConfFor 의 커스텀 갈래 주석과 같은 처리). */
  /* 🍅 뽀모가 돌고 있으면 그 남은 시간을 대신 싣는다(«🍅 집중 18분» · 12자 안 · 분 단위). 배관 · 필드는 그대로. */
  const _pt = (typeof _pomoShowText === 'function') ? _pomoShowText() : '';
  if(_pt) return { emo: '', text: _pt };
  return { emo: '', text: _focusShowText(_rolloverFocusToday()) };
}
/* 방에 보낸다. force = 켜고 끈 순간 · 모드 전환 — 5분을 기다리지 않는다.
   거둘 때(null)는 언제나 바로 보낸다. 값이 있을 때는 5분이 지나야 새 값을 보낸다. */
function _focusShowPush(force){
  const conf = _focusShowConf();
  const now = Date.now();
  if(conf){
    if(!force && _focusShowSent && (now - _focusShowSentAt) < FOCUS_SHOW_MS) return;
    _focusShowSentAt = now;
  }else if(!_focusShowSent && !force){
    return;
  }
  _focusShowSent = conf;
  try{ if(typeof Presence !== 'undefined' && Presence.setFocusShow) Presence.setFocusShow(conf); }catch(_){}
}
function _focusShowMarkSent(conf){ _focusShowSent = conf || null; if(conf) _focusShowSentAt = Date.now(); }
/* 내 화면 거울 — 방에 보낸 값(혼자면 «보낼 값») 그대로. 함수 선언이라 TDZ 걱정이 없다.
   ⚠️ [2026-09-23 고침] 처음에는 «방에 있을 때만» 이었다. 그런데 🕒 를 누르는 자리는 대개 혼자 있는 화면이라,
     눌러도 아무 일이 없어 **고장으로 읽혔다**(제보). 보내는 것과 보여 주는 것은 다른 판정이다 —
     보내기는 방이 있어야 하지만(Presence 가 알아서 한다), 내 머리 위 확인은 혼자일 때가 오히려 필요하다. */
function _focusShowMine(){
  try{ return _focusShowSent || _focusShowConf(); }catch(_){ return null; }
}
function _focusShowRefreshUI(){
  const el = document.getElementById('focusLogShowClock'); if(!el) return;
  el.classList.toggle('on', !!focusShowOn);
  el.setAttribute('aria-pressed', focusShowOn ? 'true' : 'false');
  el.title = focusShowOn ? '방에 오늘 기록 보이는 중 — 눌러서 끄기' : '눌러서 방에 오늘 기록 보여주기';
}
(function bindFocusShow(){
  const el = document.getElementById('focusLogShowClock');
  if(el){
    el.addEventListener('click', e=>{
      e.stopPropagation();
      focusShowOn = !focusShowOn;
      _lsSet(FOCUS_SHOW_KEY, focusShowOn ? '1' : '0');
      _focusShowRefreshUI();
      _focusShowPush(true);
      /* 켰는데 안 보이는 두 경우를 그 자리에서 말해 준다 — 아무 설명이 없으면 고장으로 읽힌다. */
      if(focusShowOn && typeof officeMode() !== 'undefined' && officeMode()) toast('🏢 회사원 모드에서는 보내지 않아요 — 모드를 끄면 보여요');
      else if(focusShowOn && typeof userStatus() !== 'undefined' && userStatus()) toast('🕒 켰어요 — 지금은 상태 메시지가 먼저 보여요(상태를 끄면 기록이 보여요)');
      else toast(focusShowOn ? '🕒 오늘 기록을 보여줘요 — 내 머리 위와 방 사람들 화면에 (1분마다)' : '🕒 오늘 기록 보여주기를 껐어요');
    });
  }
  _focusShowRefreshUI();
})();
/* 🚀 계정 확인 뒤 한 번(launcher/app-boot.js) — 오늘 기록 전시를 처음 한 번 보내고 15초마다 본다(오늘치는 계정 칸이라 읽힌 뒤에). */
function startFocusShare(){
  _focusShowPush(true);
  setInterval(()=>_focusShowPush(false), 15000);   // 15초마다 보고, 실제 전송은 1분에 한 번
}

return {
  startFocusShare,
  _focusShowConf,
  _focusShowMarkSent,
  _focusShowMine,
  _focusShowPush,
};
}

const api = { createFocusShare };
if(typeof window !== 'undefined') window.TwFocusShare = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

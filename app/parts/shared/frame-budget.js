/* ═══ 🔋 프레임 예산 — 실행 화면(화면 전체 투명 캔버스)을 몇 fps · 몇 배 해상도로 그릴지 ══════════════
   [제보] RTX 3060 Ti · Windows — 앱을 켜 두면 크롬(트위터)이 많이 버벅인다.
   [원인] 실행 화면 캔버스는 모니터 전체 크기다. 내 창에 포커스가 있으면 상한이 아예 없어서, 캐릭터를
     한 번 누른 뒤 크롬 위에서 휠만 굴리면(휠은 커서 아래 창으로 가서 포커스는 그대로 우리 창) 모니터
     주사율(144/165Hz)로 그렸다. 한 장마다 안티앨리어싱 · 로그 깊이 버퍼 · 그림자까지 얹힌다.
   [해법] ① 어떤 경우에도 60fps 를 넘지 않는다. ② 포커스가 있어도 손을 안 댄 채 IDLE_AFTER_MS 가 지나면
     30fps. 누르기 · 키 · 휠이 오면 바로 60 으로. ③ 다른 창을 보는 중이면 20(예전 그대로).
     ④ 실행 화면 해상도 배율은 플랫폼 상관없이 RUN_MAX_PR 까지(도트 렌더면 1).
   ⚠️ 상한을 자주 오르내리면 뒤에서 재생 중인 영상이 깜빡인다(app.js _updateIgnore 의 🚫 주석).
     그래서 마우스 이동은 «손댐» 으로 세지 않는다 — 클릭 통과 중에도 mousemove 는 계속 들어온다.
     30 으로 내려가는 건 IDLE_AFTER_MS 동안 아무 입력이 없을 때 한 번뿐이다.
   DOM · THREE 를 안 본다 — 순수 계산만(검사 sim-frame-budget.js). */
(function(){
'use strict';

const FPS_ACTIVE = 60;          // 상한의 꼭대기 — 고주사율 모니터에서도 이 이상 그리지 않는다
const FPS_IDLE = 30;            // 포커스는 있지만 손을 안 댄 지 IDLE_AFTER_MS 가 지났을 때
const FPS_UNFOCUSED = 20;       // 다른 창을 보는 중(예전 app.js 의 값 그대로)
const IDLE_AFTER_MS = 8000;     // 이만큼 입력이 없어야 30 으로 — 짧으면 오르내림이 잦아진다
const FRAME_SLACK_MS = 4;       // rAF 가 예정보다 이만큼 일찍 와도 그린다(60Hz 모니터에서 한 장씩 빠지지 않게)
const RUN_MAX_PR = 1.5;         // 실행 화면 해상도 배율 상한(DPR 2 면 픽셀 56%)

/* 지금 상한 fps.
   hot  = 비행 · 끌기 · 방금 누름 — 포커스와 상관없이 60(예전엔 상한 없음)
   busy = 춤 · 입력칸 · 꾸미기/생성기 — 포커스가 있을 때 30 으로 내려가지 않게만 막는다 */
function pickFps(s){
  s = s || {};
  if(s.hot) return FPS_ACTIVE;
  if(!s.focused) return FPS_UNFOCUSED;
  if(s.runMode && !s.busy && s.idleMs >= IDLE_AFTER_MS) return FPS_IDLE;
  return FPS_ACTIVE;
}

/* 실행 화면 해상도 배율 — 도트 렌더면 1, 아니면 기기 배율을 RUN_MAX_PR 까지 */
function runPixelRatio(dpr, dot){
  if(dot) return 1;
  const d = (dpr > 0) ? dpr : 1;
  return Math.min(d, RUN_MAX_PR);
}

/* 진단 한 줄 — 1분마다 tw-mouse-diag.log 에 쌓이므로 짧게(그 파일은 256KB 에서 돌려 쓴다 · main.js DIAG_MAX_BYTES).
   예) [프레임] 60초 1800장 30fps · 포커스 40% · 상한 30 · 배율 1.5 · 2880x1620 */
function diagLine(m){
  const secs = Math.max(1, Math.round((m.ms || 0) / 1000));
  return '[프레임] ' + secs + '초 ' + (m.frames | 0) + '장 ' + Math.round((m.frames || 0) / secs) + 'fps'
    + ' · 포커스 ' + Math.round((m.focusedShare || 0) * 100) + '%'
    + ' · 상한 ' + m.cap + ' · 배율 ' + m.pr + ' · ' + m.w + 'x' + m.h;
}

function createFrameBudget(deps){
  const now0 = (deps && deps.now) ? deps.now() : 0;
  let lastInputAt = now0;
  let due = 0, dueFps = 0, lastDrawAt = 0;
  let frames = 0, winStart = now0, focusedMs = 0, focusSince = null;

  function poke(t){ if(t > lastInputAt) lastInputAt = t; }
  function idleMs(t){ return t - lastInputAt; }

  /* 이번 rAF 를 그릴까. 그리면 다음 예정 시각을 잡는다.
     ★ «직전 프레임과의 간격» 대신 예정 시각을 쌓는다 — 144Hz(6.9ms 간격)에서 간격만 보면 3칸마다
       한 장(48fps)이 되지만, 예정 시각을 쌓으면 2칸 · 3칸이 섞여 평균 60 이 된다. */
  function admit(t, fps){
    if(!(fps > 0)) return true;
    const gap = 1000 / fps;
    if(fps !== dueFps){ dueFps = fps; due = lastDrawAt + gap; }   // 상한이 바뀌면 마지막 장부터 새 간격으로 다시 잡는다
    if(t < due - FRAME_SLACK_MS) return false;
    due = (t - due > gap) ? t + gap : due + gap;   // 한 칸 넘게 늦었으면(멈춤 · 낮은 상한 뒤) 밀린 몫을 몰아 그리지 않는다
    lastDrawAt = t;
    frames++;
    return true;
  }

  /* 포커스 시간 — focus/blur 때와 진단 줄을 찍을 때만 부른다(매 프레임 아님) */
  function noteFocus(focused, t){
    if(focusSince != null) focusedMs += t - focusSince;
    focusSince = focused ? t : null;
  }
  function takeMinute(t){
    if(focusSince != null){ focusedMs += t - focusSince; focusSince = t; }
    const ms = t - winStart;
    const out = { frames, ms, focusedShare: ms > 0 ? Math.min(1, focusedMs / ms) : 0 };
    frames = 0; focusedMs = 0; winStart = t;
    return out;
  }

  return { poke, idleMs, admit, noteFocus, takeMinute };
}

const api = {
  FPS_ACTIVE, FPS_IDLE, FPS_UNFOCUSED, IDLE_AFTER_MS, FRAME_SLACK_MS, RUN_MAX_PR,
  pickFps, runPixelRatio, diagLine, createFrameBudget,
};
if(typeof window !== 'undefined') window.FrameBudget = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

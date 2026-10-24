/* hook-pause-policy.js — ⌨️ 우리 창 입력칸에 글자를 치는 동안 전역 키 · 클릭 훅을 쉬게 할지 판단하는 규칙 한 곳
   왜: mac 의 uiohook 은 키를 누를 때마다 우리 메인 스레드에 «무슨 글자냐» 를 물어 보고 기다린다(libuiohook darwin
     dispatch_sync → TIS). 우리 창이 앞에서 한글을 조합하는 동안 이 질문이 끼어들어 조합이 깨진다(글자가 먹히거나 지워짐).
     우리 창 안의 키는 렌더러 DOM 이 이미 받으니, 입력하는 동안만 훅을 내린다(Windows 는 sysinput-win 이 아무것도 안 한다).
   ⚠️ 키를 처리하는 도중에 내리면(stop) 훅 스레드는 메인을 기다리고 메인은 훅 스레드가 끝나길 기다려 앱이 멈춘다.
     그래서 키가 QUIET_MS 동안 없을 때만 내린다. 올리기(start)는 이 위험이 없다.
   받는 deps: 없음 — 순수 함수. main.js 가 require 로 받는다.
   내놓는 것: QUIET_MS · RESUME_DELAY_MS · step(f)
   검사: checks/sim-hook-pause.js */
(function(){
'use strict';

const QUIET_MS = 300;          // 마지막 키 뒤 이만큼 조용해야 내린다(위 ⚠️)
const RESUME_DELAY_MS = 1000;  // 입력칸에서 나와도 이만큼은 쉰 채로 — 칸 사이를 옮겨 다닐 때 내렸다 올렸다를 되풀이하지 않게

/* f: { typing — 렌더러가 알려 준 «입력칸에 있음» · focused — 우리 창이 앞 · paused — 지금 훅을 쉬는 중
        now · lastKeyAt — 훅이 마지막으로 키를 받은 때 · typingOffAt — 입력칸에서 나온 때 }
   돌려주는 것: 'pause'(지금 내림) · 'resume'(지금 올림) · 'wait'(조금 뒤 다시 물음) · 'keep'(할 일 없음) */
function step(f){
  const want = !!(f.typing && f.focused);
  if(f.paused){
    if(want) return 'keep';
    if(!f.focused) return 'resume';   // 다른 앱으로 넘어갔다 — 그 앱의 키 · 클릭을 바로 받아야 한다
    return (f.now - f.typingOffAt >= RESUME_DELAY_MS) ? 'resume' : 'wait';
  }
  if(!want) return 'keep';
  return (f.now - f.lastKeyAt >= QUIET_MS) ? 'pause' : 'wait';
}

const api = { QUIET_MS, RESUME_DELAY_MS, step };
if(typeof module !== 'undefined' && module.exports) module.exports = api;
if(typeof window !== 'undefined') window.TwHookPausePolicy = api;
})();

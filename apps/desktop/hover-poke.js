/* ═══ 🖱 호버 찌르기 — 일반 앱 앞에서 우리 UI 위로 올린 커서를 바로 알리기 (main 전용 · 제보 #5) ═══
   [증상] 오버레이 위에 마우스를 올려도 클릭이 바로 안 잡히고 몇 초 흔들어야 된다.
   [원인] 일부 전경 앱이 있으면 Windows 에서 forward mousemove 가 끊긴다(electron#30808/#33281).
     렌더러의 통과/해제 판정은 mousemove 에만 걸려 있어서, 남은 길은 500ms 유령 감시뿐이었다.
     50ms 커서 감시(_checkCursorNearChar)는 펜 앱일 때만 돈다.
   [대응] 일반 앱 · 통과 중 · 커서가 오버레이 창 위일 때만 가벼운 커서 폴링을 돌리고,
     커서가 우리 UI 사각형/원 안으로 **들어오는 순간 한 번** 렌더러에 재판정(penHitTest)을 시킨다.
     안에 머물며 움직이면(원 안의 빈 자리 → 몸 위) 150ms 에 한 번까지만 다시 묻는다.
   ★ 이 파일은 판단만 한다. 타이머 · 좌표 읽기 · IPC 는 main.js 가 한다(검사가 판단만 떼어 돌린다).
   ★ 찌르기만 한다. setIgnoreMouseEvents 를 다시 걸지 않는다(영상 깜빡임). 판단은 끝까지 렌더러가 한다. */
'use strict';

const HOVER_POLL_MS = 120;     // 폴링 간격 — 사람이 «바로» 로 느끼는 범위 · 50ms 펜 감시보다 가볍게
const HOVER_REPOKE_MS = 150;   // 안에서 움직일 때 다시 묻는 최소 간격(펜 앱 PEN_REPOKE_MS 와 같은 값)
const HOVER_MOVE_MIN_PX = 2;   // 이만큼 움직여야 «움직였다» — 가만히 있으면 같은 답이라 묻지 않는다

/* 폴링을 돌려도 되는가. 하나라도 아니면 타이머를 멈춘다.
   · win32     — forward 가 끊기는 상류 버그가 Windows 쪽이다. 맥은 새 타이머를 늘리지 않는다.
   · run       — 런처/생성기(작은 창)는 창 전체가 UI 라 대상 아님
   · ignoring  — 통과 중일 때만. 클릭을 받는 중이면 진짜 mousemove 가 오므로 필요 없다
   · !penApp   — 펜 앱은 _checkCursorNearChar(50ms)가 따로 맡는다(클립 스튜디오 보호 장치와 얽혀 있다)
   · visible   — 숨김 · 최소화면 누를 것이 없다
   · hasTargets — 창 좌표와 캐릭터 원 또는 창 사각형을 하나라도 받았다
   · onOverlay — 커서가 오버레이 창 위(다른 모니터면 클릭이 우리 창에 들어갈 수 없다) */
function shouldPoll(s){
  if(!s) return false;
  return !!(s.win32 && s.run && s.ignoring && !s.penApp && s.visible && s.hasTargets && s.onOverlay);
}

/* 들어오는 순간 · 안에서 움직임을 가르는 상태 기계.
   step({ onUI, x, y, now }) → 'enter' | 'repoke' | null  (null 이면 아무것도 보내지 않는다) */
function createHoverPoke(opts){
  const o = opts || {};
  const repokeMs = typeof o.repokeMs === 'number' ? o.repokeMs : HOVER_REPOKE_MS;
  const minPx = typeof o.minPx === 'number' ? o.minPx : HOVER_MOVE_MIN_PX;
  let known = false, wasOn = false, pokedAt = 0, pokedPt = null;
  function reset(){ known = false; wasOn = false; pokedAt = 0; pokedPt = null; }
  function step(inp){
    if(!inp) return null;
    const now = inp.now, pt = { x: inp.x, y: inp.y };
    /* ★ 감시를 새로 켠 첫 틱은 기준만 잡는다 — 이미 안에 있던 커서는 «들어옴» 이 아니다.
       통과로 넘어간 까닭이 렌더러 판정이든 main 안전장치(ⓖ 다른 앱 키 입력 회수 등)든, 세워 둔 커서로
       다시 물으면 그 판정을 0.1초 만에 뒤집는다. 세워 둔 커서는 유령 감시(포기 한도 있음)가 맡는다. */
    if(!known){ known = true; wasOn = !!inp.onUI; pokedAt = now; pokedPt = pt; return null; }
    if(!inp.onUI){ wasOn = false; pokedPt = null; return null; }   // 밖 — 다음에 들어오면 다시 «들어옴»
    if(!wasOn){
      wasOn = true; pokedAt = now; pokedPt = pt;
      return 'enter';
    }
    const moved = !pokedPt || Math.abs(pt.x - pokedPt.x) + Math.abs(pt.y - pokedPt.y) >= minPx;
    if(moved && now - pokedAt >= repokeMs){
      pokedAt = now; pokedPt = pt;
      return 'repoke';
    }
    return null;
  }
  return { step, reset, isOn: () => wasOn };
}

module.exports = { HOVER_POLL_MS, HOVER_REPOKE_MS, HOVER_MOVE_MIN_PX, shouldPoll, createHoverPoke };

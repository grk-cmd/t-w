/* click-through-policy.js — 클릭 통과(setIgnoreMouseEvents)로 바꿀지 판단하는 규칙 한 곳
   렌더러(desktop-run.js 의 mousemove · 재판정 · 고착 회복 사다리)와 main.js(안전장치 ⓔ·ⓕ·ⓖ)가 같은 파일을 쓴다.
   받는 deps: 없음 — 순수 함수다. 입력은 «무슨 일이 있었나» 사실, 출력은 결정(문자열 · 작은 객체). DOM · IPC · 타이머 · 로그는 부르는 쪽이 한다.
   내놓는 것: 상수(아래 묶음) · 렌더러 holdForDrag · moveStep · hitStep · pointerDownStep · pokeStep · clickMayKick · kickStep
              / main mainArmed · stallStep · staleCaptureStep · foreignInputStep · deferExpiredStep
   ★ main.js 는 require 로, 렌더러는 window.TwClickThroughPolicy 로 받는다 — 두 프로세스의 문턱이 갈라지지 않게.
   ⚠️ 같은 조건을 다른 파일에 다시 쓰지 않는다(검사 checks/sim-click-through-policy.js 가 빨강을 낸다). 규칙을 바꾸려면 여기만 고친다. */
(function(){
'use strict';

/* ── 렌더러 ── */
const MOVE_GAP_RECEIVING_MS = 40;  // 클릭받는 중 mousemove 판정 간격 — ~25Hz 로 충분
const MOVE_GAP_PASSING_MS = 10;    // 통과 중 판정 간격 — 캐릭터로 들어오는 첫 순간을 놓치면 클릭이 뒤로 샌다
const PASS_DEBOUNCE_MS = 150;      // 통과로 돌아갈 때만 늦춘다 — 받기로는 즉시(늦추면 펜 탭이 뒤 앱으로 샌다)
const KICK_GAP_MS = 1500;          // 사다리 연타 방지
const MOVE_ALIVE_MS = 3000;        // 이 안에 mousemove 가 왔으면 forward 가 살아 있다
const POKE_ALIVE_MS = 3000;        // 펜 앱 재판정(pen:true)이 이 안에 왔으면 정상 통로가 살아 있다
const KICK_REARM_STAGES = 2;       // 1·2단계는 통과를 유지한 채 forward 재무장만
const KICK_PROBE_MS = 800;         // 3단계 — 이만큼만 클릭을 받아 본다

/* ── main ── */
const RENDERER_STALL_MS = 12000;   // ⓔ 하트비트가 이만큼 끊기면 렌더러가 멈춘 것 — 몇 초짜리 딸꾹질(도트 렌더 · GLB 파싱)은 넘겨야 한다
const FWD_STALE_MS = 1200;         // ⓕ·ⓖ 이만큼 mousemove 가 없으면 판정이 굳은 것으로 본다
const FWD_MOVE_MIN_PX = 60;        // ⓕ 같은 동안 커서가 이만큼은 움직였어야 «움직이는데도 안 온다»
const FWD_REFIRE_MS = 2000;        // ⓕ·ⓖ 연속 발동 간격 하한 · ⓖ 재판정 유예 간격
const FGN_CHAR_MARGIN = 1.5;       // ⓖ 캐릭터 반경의 이 배율 밖이어야 «확실히 먼 곳»(경계에서 렌더러와 다투지 않게)
const FGN_BOUNDS_FRESH_MS = 3000;  // ⓖ 캐릭터 좌표가 이보다 오래됐으면 좌표 판정을 믿지 않는다
const FGN_TRUST_MS = 2000;         // ⓖ 렌더러의 «dom: 으로 켰다» 를 이 시간까지만 최신으로 친다
const FGN_DEFER_MS = 600;          // ⓖ 재판정을 기다리는 시간

/* ═══ 렌더러 ═══ */

/* 끄는 중이고 main 도 클릭을 받는 중이면 판정을 건너뛴다 — 캐릭터 밖으로 나가도 통과로 바꾸면 끌기가 끊긴다.
   ⚠️ main 이 이미 통과(ignoreSent!==false)면 끌기가 성립할 수 없으니 남은 drag 플래그로 보고 판정한다. */
function holdForDrag(f){ return !!f.dragging && f.ignoreSent === false; }

/* mousemove 한 번 — { act: 'receive'|'keep'|'judge', stamp: 판정 시각을 찍는가 }
   f: moveMode · ignoring(판정 캐시) · ignoreSent(main 에 보낸 값) · dragging · sinceCheck(직전 판정 뒤 ms)
   ★ 프로그램 이동 중엔 스로틀 없이 즉시 받기 — 위치 확정 클릭이 씹히면 안 된다. */
function moveStep(f){
  if(f.moveMode) return { act: f.ignoring !== false ? 'receive' : 'keep', stamp: false };
  const gap = (f.ignoring === false) ? MOVE_GAP_RECEIVING_MS : MOVE_GAP_PASSING_MS;
  if(f.sinceCheck < gap) return { act: 'keep', stamp: false };
  if(holdForDrag(f)) return { act: 'keep', stamp: true };
  return { act: 'judge', stamp: true };
}

/* 좌표 판정 결과 → 'receive'(즉시) | 'pass-later'(PASS_DEBOUNCE_MS 뒤 통과) | 'keep'(이미 통과 예약/통과) */
function hitStep(f){
  if(f.hit) return 'receive';
  return f.ignoring !== true ? 'pass-later' : 'keep';
}

/* 캔버스 pointerdown — 통과 판정 캐시면 받기로(대기 중인 통과 예약도 _sendIgnore 가 취소한다) */
function pointerDownStep(f){ return f.ignoring ? 'receive' : 'keep'; }

/* main 의 재판정(penHitTest) 한 번 — { resync, act: 'keep'|'judge', x, y }
   f: pt(받은 그대로) · ignoreSent · dragging
   ★ main 이 알려 준 실제 상태(pt.ig)가 내 캐시와 다르면 내 캐시가 틀린 것 — resync(캐시 버림) 뒤 처음부터 판정한다.
   ⚠️ ig 가 없는 구버전 main · 아직 보낸 적 없음(null)이면 정정하지 않는다. 끌기 보호는 정정 뒤 값으로 본다. */
function pokeStep(f){
  const pt = f.pt;
  const resync = !!(pt && typeof pt.ig === 'boolean' && f.ignoreSent !== null && pt.ig !== f.ignoreSent);
  const sent = resync ? null : f.ignoreSent;
  if(holdForDrag({ dragging: f.dragging, ignoreSent: sent })) return { resync, act: 'keep' };
  if(!pt || pt.left) return { resync, act: 'judge', x: -9999, y: -9999 };   // 구버전 main 은 null 을 보낸다
  return { resync, act: 'judge', x: pt.x, y: pt.y };
}

/* 전역 클릭 훅이 사다리를 불러도 되는가 — 휠은 마우스를 안 움직이므로 mousemove 가 없는 게 정상이다.
   ⚠️ 구버전 main 은 wheel 을 안 보낸다 — 그때는 예전처럼 부른다. */
function clickMayKick(state){ return !(state && state.wheel === true); }

/* 고착 회복 사다리 한 칸 — { act, stage }
   act: 'none'(할 일 없음) · 'skip-off'(다른 모니터) · 'skip-pen'(펜 앱) · 'rearm'(1·2단계) · 'probe'(3단계 — KICK_PROBE_MS 동안 받기)
   f: ignoreSent · offOverlay · penApp · now · lastKickAt · lastMoveSeen · lastPokePen · lastPokeAt · stage
   ★ 펜 앱이면 통째로 안 돈다 — 3단계가 그리는 도중 남의 창 포커스를 뺏는 유일한 자리다(펜 앱은 main 50ms 감시가 따로 있다).
   ★ 다른 모니터(offOverlay)면 안 돈다 — forward 는 창 안에서만 오므로 mousemove 없음이 정상이다.
   ⚠️ 재판정은 펜 앱(pen:true)일 때만 생존 신호다 — 일반 앱 재판정까지 치면 main 유령 찌르기가 사다리 시계를 되감는다. */
function kickStep(f){
  const NONE = { act: 'none', stage: f.stage };
  if(f.ignoreSent !== true) return NONE;   // 이미 클릭을 받는 중이면 고착이 아니다
  if(f.offOverlay === true) return { act: 'skip-off', stage: f.stage };
  if(f.penApp) return { act: 'skip-pen', stage: f.stage };
  if(f.now - f.lastKickAt < KICK_GAP_MS) return NONE;
  if(f.lastMoveSeen && f.now - f.lastMoveSeen < MOVE_ALIVE_MS) return NONE;
  if(f.lastPokePen && f.lastPokeAt && f.now - f.lastPokeAt < POKE_ALIVE_MS) return NONE;
  const stage = f.stage + 1;
  return { act: stage <= KICK_REARM_STAGES ? 'rearm' : 'probe', stage };
}

/* ═══ main ═══ */

/* ⓔ·ⓕ·ⓖ 공통 — run 모드이고 지금 클릭을 받는 중일 때만 회수할 것이 있다 */
function mainArmed(f){ return !f.configMode && !f.ignoreRequested; }

/* ⓔ 렌더러 무응답 — 'recall' | null.  f: configMode · ignoreRequested · focused · boundsAt · quietFor · forced(이미 강제 전환 중) */
function stallStep(f){
  const stuck = mainArmed(f) && !f.focused && f.boundsAt > 0 && f.quietFor > RENDERER_STALL_MS;
  return (stuck && !f.forced) ? 'recall' : null;
}

/* ⓕ forward 가 죽어 굳은 «클릭받기» — 'recall' | null
   f: configMode · ignoreRequested · focused · onOverlay · moveAge(-1 = 모름) · prev · pt · now · firedAt
   ★ 커서가 실제로 움직였어야 한다 — 가만히 있으면 mousemove 가 없는 게 정상이라, 누르려던 클릭을 뒤로 흘린다. */
function staleCaptureStep(f){
  if(!mainArmed(f)) return null;
  if(f.focused) return null;                                 // 우리 창을 쓰는 중
  if(!f.onOverlay) return null;                              // 다른 모니터 — mousemove 없음이 정상
  if(f.moveAge < 0 || f.moveAge < FWD_STALE_MS) return null;
  if(!f.prev || !f.pt) return null;
  const dx = f.pt.x - f.prev.x, dy = f.pt.y - f.prev.y;
  if((dx*dx + dy*dy) < (FWD_MOVE_MIN_PX*FWD_MOVE_MIN_PX)) return null;
  if(f.now - f.firedAt < FWD_REFIRE_MS) return null;
  return 'recall';
}

/* ⓖ 다른 앱 입력 — { act: null|'recall'|'defer'|'wait', why, poke }
   f: kind('key'|'click') · configMode · ignoreRequested · focused · cursor(못 읽으면 null) · onOverlay(cursor 없으면 null)
      · moveAge · haveBounds · boundsAge · onOurUI · cx · cy · charDx · charDy · regionCount · now · firedAt · hitWhyAt · lastHitWhy · deferAt
   ★ 렌더러가 방금 dom: 으로 켰다면 회수 대신 재판정을 묻는다('defer') — 사각형은 근사치, elementFromPoint 가 정확하다.
   ⚠️ 유예는 FWD_REFIRE_MS 에 한 번('wait' 는 아무것도 안 함) · FGN_TRUST_MS 가 지나면 저절로 닫힌다. */
function foreignInputStep(f){
  const NO = { act: null, why: null, poke: null };
  if(!mainArmed(f) || f.focused) return NO;
  let why, poke = null;
  if(f.kind === 'key'){
    if(f.onOverlay === false) return NO;                     // 다른 모니터 — moveAge 로 판단할 수 없다
    if(f.moveAge < 0 || f.moveAge < FWD_STALE_MS) return NO;  // mousemove 가 살아 있으면 렌더러가 스스로 고친다
    why = '다른 앱에 키 입력, mousemove ' + f.moveAge + 'ms 없음';
  } else {
    if(!f.haveBounds) return NO;                             // 좌표를 모르면 «밖» 이라 단정하지 않는다
    if(f.boundsAge > FGN_BOUNDS_FRESH_MS) return NO;
    if(!f.cursor || !f.onOverlay) return NO;
    if(f.onOurUI) return NO;                                 // 우리 UI 위 — 정상 동작
    why = '다른 앱에서 우리 UI 밖 클릭(캐릭터와 ' + Math.round(Math.sqrt(f.charDx*f.charDx + f.charDy*f.charDy))
        + 'px, 창 ' + f.regionCount + '개)';
    poke = { x: f.cx, y: f.cy };
  }
  if(f.now - f.firedAt < FWD_REFIRE_MS) return NO;
  if(poke && f.hitWhyAt && (f.now - f.hitWhyAt) < FGN_TRUST_MS && String(f.lastHitWhy).indexOf('dom:') === 0){
    return { act: (f.now - f.deferAt) > FWD_REFIRE_MS ? 'defer' : 'wait', why, poke };
  }
  return { act: 'recall', why, poke };
}

/* ⓖ 유예가 끝났을 때 — 'recall' | null.  렌더러가 스스로 통과로 갔거나 하트비트가 살아 있으면(그 판단을 믿고) 물러난다. */
function deferExpiredStep(f){
  if(f.ignoreRequested) return null;
  if(f.boundsAge <= FGN_BOUNDS_FRESH_MS) return null;
  return 'recall';
}

const api = {
  MOVE_GAP_RECEIVING_MS, MOVE_GAP_PASSING_MS, PASS_DEBOUNCE_MS, KICK_GAP_MS, MOVE_ALIVE_MS, POKE_ALIVE_MS,
  KICK_REARM_STAGES, KICK_PROBE_MS,
  RENDERER_STALL_MS, FWD_STALE_MS, FWD_MOVE_MIN_PX, FWD_REFIRE_MS, FGN_CHAR_MARGIN, FGN_BOUNDS_FRESH_MS, FGN_TRUST_MS, FGN_DEFER_MS,
  holdForDrag, moveStep, hitStep, pointerDownStep, pokeStep, clickMayKick, kickStep,
  mainArmed, stallStep, staleCaptureStep, foreignInputStep, deferExpiredStep,
};
if(typeof window !== 'undefined') window.TwClickThroughPolicy = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();

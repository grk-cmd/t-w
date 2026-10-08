/* ═══ 🪑 방 좌석 줄 배치 — 나는 오른쪽 아래, 나머지는 내 왼쪽으로 한 줄 ══════════════════════════
   [문제] 방에서는 줄 가운데를 화면 오른쪽(0.84)에 두고 나를 줄 오른쪽 끝에 세웠다. 인원이 많으면 줄 절반이
     오른쪽 화면 밖으로 나가고, 맨 오른쪽인 내 캐릭터도 같이 사라졌다.
   [해법] 방에서는 카메라 기준점을 «줄 가운데» 가 아니라 «내 자리» 로 바꾸고(내 자리는 혼자일 때와 같은 곳),
     다른 사람은 내 왼쪽으로 붙인다. 넘치는 줄은 줄 오프셋(rowOffset, 월드 단위)으로 좌우로 훑는다.
     ・오프셋 범위 = 줄 전체 폭 기준. A = (화면 왼쪽 끝) − (줄 왼쪽 끝).
        A < 0(화면에 다 들어감): [A, 0] — 화면 안에서만 움직이고 내 쪽으로는 안 겹친다.
        A > 0(넘침):            [0, A] — 왼쪽 끝 사람이 화면 왼쪽 끝에 올 때까지 훑을 수 있다.
     ・넘친 줄을 오른쪽으로 밀면 내 자리를 지나는 사람이 생긴다 — 그 사람은 내 몸을 가로지르지 않고
       내 오른쪽으로 건너간다(대부분 화면 밖). 그래서 숨기기(레이캐스트 · 이름표)를 새로 만들 필요가 없다.
   이 파일은 숫자만 다룬다(THREE · DOM 없음). 검사: checks/sim-seat-layout.js */
(function(){
'use strict';

const DRAG_THRESHOLD_PX = 5;     // 이름표를 이만큼 넘게 끌어야 «끌기» — 그 아래는 지금처럼 클릭 · 우클릭
const WHEEL_LINE_PX = 16;        // deltaMode 1(줄 단위) 한 줄
const WHEEL_PAGE_PX = 400;       // deltaMode 2(쪽 단위) 한 쪽
const PAN_BASE_X = -0.34;        // applyCameraAndCanvas 의 기본 좌우 위치(기준점이 화면 0.84 에 온다)
const PAN_MARGIN_FALLBACK = 0.02;

/* 기준 좌석(나 · 내가 탄 탑의 바닥)을 맨 앞에, 나머지는 원래 순서대로. */
function orderRow(list, anchor){
  if(!anchor || list.indexOf(anchor) < 0) return list.slice();
  return [anchor].concat(list.filter(s => s !== anchor));
}

/* 기준 좌석 x=0, 나머지는 왼쪽으로 «책상 반폭 + 여백 + 책상 반폭» 씩(layoutSeats 의 옛 식 그대로). */
function naturalRow(hws, spacing){
  const xs = [];
  for(let i = 0; i < hws.length; i++){
    if(i === 0){ xs.push(0); continue; }
    xs.push(xs[i - 1] - (hws[i - 1] + spacing + hws[i]));
  }
  return xs;
}

/* 줄 오프셋이 움직일 수 있는 범위. winLeft = 화면 왼쪽 끝(여백 포함)의 월드 x(기준 좌석 x=0 기준). */
function offsetRange(xs, hws, winLeft){
  if(xs.length < 2 || !isFinite(winLeft)) return { min: 0, max: 0 };
  let left = Infinity;
  for(let i = 1; i < xs.length; i++) left = Math.min(left, xs[i] - hws[i]);
  const a = winLeft - left;
  return { min: Math.min(0, a), max: Math.max(0, a) };
}

function clampOffset(s, range){
  if(!isFinite(s)) return 0;
  return Math.max(range.min, Math.min(range.max, s));
}

/* 오프셋을 적용한 실제 자리. 기준 좌석은 늘 0. 내 자리 영역(내 왼쪽 여백 끝)을 넘은 사람은 내 오른쪽으로 건너간다.
   side[i] = 'L'(내 왼쪽) | 'R'(건너감) | 'A'(기준). */
function placeRow(xs, hws, s, spacing){
  const n = xs.length, out = new Array(n), side = new Array(n);
  if(!n) return { xs: out, side };
  out[0] = 0; side[0] = 'A';
  const hw0 = hws[0];
  const winRight = -hw0 - spacing;                 // 내 왼쪽 여백 끝 — 여기까지가 줄의 자리
  const jump = 2 * hw0 + 2 * spacing;              // 내 자리를 건너뛰는 만큼(나 + 양쪽 여백)
  let k = 0;                                       // 건너간 사람 수 — 나와 가까운 쪽(1..k)부터 넘는다
  for(let i = 1; i < n; i++){
    const u = xs[i] + s;
    if(u + hws[i] > winRight + 1e-9){ k = i; out[i] = u; side[i] = 'R'; }
    else { out[i] = u; side[i] = 'L'; }
  }
  // 건너간 사람은 줄 순서 그대로 내 오른쪽에 — 가장 왼쪽이던 사람(k)이 나와 가장 가깝다
  let cursor = hw0 + spacing;
  for(let i = k; i >= 1; i--){
    if(side[i] !== 'R'){ side[i] = 'R'; }
    const left = Math.max(xs[i] + s - hws[i] + jump, cursor);
    out[i] = left + hws[i];
    cursor = left + 2 * hws[i] + spacing;
  }
  return { xs: out, side };
}

/* 휠 → «줄이 오른쪽으로 움직일 px». 아래로 굴리기 · 손가락 오른쪽 쓸기 = 줄이 오른쪽으로(왼쪽 사람들이 나온다). */
function wheelToRowPx(e){
  if(!e) return 0;
  const k = e.deltaMode === 1 ? WHEEL_LINE_PX : (e.deltaMode === 2 ? WHEEL_PAGE_PX : 1);
  const dy = +e.deltaY || 0, dx = +e.deltaX || 0;
  return (dy - dx) * k;
}

/* 이름표 끌기 — 5px 넘게 움직여야 끌기가 된다. 한 번 시작하면 끝날 때까지 끌기. */
function dragBegin(x, y, s0){ return { x0: x, y0: y, s0: s0, active: false }; }
function dragMove(st, x, y){
  if(!st) return null;
  const dx = x - st.x0, dy = y - st.y0;
  if(!st.active && Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) st.active = true;
  return st.active ? dx : null;
}

/* 프로그램 이동(상태칩)의 좌우 범위 — 기준점이 화면 [m, 1−m] 안. m = 내 좌석 반폭(화면 비율). */
function clampPanX(px, halfFrac, extra){
  const m = (isFinite(halfFrac) && halfFrac > 0 && halfFrac < 0.5) ? halfFrac : PAN_MARGIN_FALLBACK;
  const e = extra || 0;
  const lo = -0.5 + m - PAN_BASE_X - e, hi = 0.5 - m - PAN_BASE_X + e;
  if(!isFinite(px)) return 0;
  return Math.max(lo, Math.min(hi, px));
}

function createSeatLayout(){
  /* 줄 오프셋 상태 — 저장하지 않는다. 방이 바뀌면 사람도 바뀌어 옛 오프셋이 엉뚱한 사람을 가리키므로
     방에 들어갈 때마다 0(모두 내 왼쪽에 붙음)에서 시작한다. */
  let offset = 0, range = { min: 0, max: 0 };
  return {
    get offset(){ return offset; },
    get range(){ return range; },
    setRange(r){ range = r; offset = clampOffset(offset, range); return offset; },
    nudge(dWorld){ offset = clampOffset(offset + (+dWorld || 0), range); return offset; },
    set(v){ offset = clampOffset(v, range); return offset; },
    reset(){ offset = 0; return offset; },
  };
}

const api = { createSeatLayout, orderRow, naturalRow, offsetRange, clampOffset, placeRow,
  wheelToRowPx, dragBegin, dragMove, clampPanX,
  DRAG_THRESHOLD_PX, PAN_BASE_X, PAN_MARGIN_FALLBACK };
if(typeof window !== 'undefined') window.SeatLayout = api;
if(typeof module !== 'undefined' && module && module.exports) module.exports = api;
})();

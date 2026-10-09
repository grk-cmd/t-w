/* ═══ 🪑 방 좌석 줄 — «보이는 영역»(가로 띠) 안에 한 줄 ══════════════════════════════════════════
   [문제] 방에서는 줄 가운데를 화면 오른쪽(0.84)에 두고 줄 전체가 들어오게 카메라를 물렸다. 사람이 많거나
     캐릭터를 키우면 줄이 오른쪽 화면 밖으로 나가 맨 오른쪽인 내 캐릭터도 사라졌다.
   [해법] 줄은 띠 안에 선다. 띠 = 맨 오른쪽 좌석(카메라 기준점 · 프로그램 이동으로 같이 움직임) 오른쪽 끝 ~ 화면 왼쪽 끝.
     방에서는 «자동 맞춤» 이 모두가 한 줄로 화면에 들어오도록 보기 배율을 줄인다 — 내가 정한 크기보다
     커지지 않고, 가장 작은 캐릭터가 MIN_CHAR_PX 보다 작아지지 않는다. 그래도 넘치면 휠(오프셋)로 넘겨 본다.
     띠 밖은 앱이 그리지 않는다(가위 · 이름표 숨김). 자리 바꾸기는 책상 · 이름표 끌기.
     ・내 자리 «줄 안에 함께»(기본): 순서는 예전 그대로, 줄 전체를 넘긴다 — rowRange.
     ・내 자리 «맨 오른쪽 고정»: 나를 맨 앞(오른쪽)에 두고 나머지만 넘긴다 — offsetRange · placeRow
       (내 자리를 지나는 사람은 내 오른쪽 = 띠 밖으로 건너간다).
     넘길 때 범위는 단순하게 «처음 사람 ~ 끝 사람» 이다.
   이 파일은 숫자만 다룬다(THREE · DOM 없음). 검사: checks/sim-seat-layout.js */
(function(){
'use strict';

const DRAG_THRESHOLD_PX = 5;     // 이름표를 이만큼 넘게 끌어야 «끌기» — 그 아래는 지금처럼 클릭 · 우클릭
const WHEEL_LINE_PX = 16;        // deltaMode 1(줄 단위) 한 줄
const WHEEL_PAGE_PX = 400;       // deltaMode 2(쪽 단위) 한 쪽
const PAN_BASE_X = -0.34;        // applyCameraAndCanvas 의 기본 좌우 위치(기준점이 화면 0.84 에 온다)
const PAN_MARGIN_FALLBACK = 0.02;
const BAND_DEFAULT_FRAC = 0.6;     // 보이는 영역 기본 폭(화면 비율) — 예전 방 줄이 쓰던 오른쪽 아래 자리
const SEAT_MODE_ROW = 'row', SEAT_MODE_RIGHT = 'right';   // 내 자리: 줄 안에 함께(기본) · 맨 오른쪽 고정

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

/* «줄 안에 함께» 모드의 오프셋 범위 — 줄 전체(나 포함)를 띠 [bandL, bandR](월드) 안에서 넘겨 본다.
   줄이 띠보다 짧으면 띠 안에서만, 길면 오른쪽 끝 사람 ~ 왼쪽 끝 사람까지. 0 은 «처음 자리»(오른쪽 끝이 띠 오른쪽). */
function rowRange(xs, hws, bandL, bandR){
  if(!xs.length || !isFinite(bandL) || !isFinite(bandR)) return { min: 0, max: 0 };
  let left = Infinity, right = -Infinity;
  for(let i = 0; i < xs.length; i++){ left = Math.min(left, xs[i] - hws[i]); right = Math.max(right, xs[i] + hws[i]); }
  const a = bandR - right, b = bandL - left;
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

/* 탑 높이 — 머리 위에 올라탄 사람(탑쌓기)이 있으면 그 키만큼 위로. 바닥 좌석 키 + 올라탄 사람마다 (맨 위 − 맨 아래).
   자동 맞춤이 이 값으로 «탑 꼭대기가 화면 위로 나가지 않는가» 를 본다. */
function towerTop(ownTop, riders){
  let t = isFinite(ownTop) ? ownTop : 0;
  (riders || []).forEach(r=>{ const h = (r && isFinite(r.top) && isFinite(r.minY)) ? r.top - r.minY : 0; if(h > 0) t += h; });
  return t;
}
/* 🔍 자동 맞춤(방) — 모두가 한 줄로 화면에 들어오도록 방 줄 전체의 보기 배율 s 를 줄인다. 내 화면 전용(저장값 안 건드림).
   ★ 최소는 비율이 아니라 **화면 픽셀**이다: 방에서 가장 작은 캐릭터의 화면 키가 MIN_CHAR_PX(CSS px) 아래로 내려가지 않는다.
     카메라 투영으로 잰 px 라 해상도 · DPI · 화면 크기(줌)와 상관없이 «눈으로 보이는 크기» 가 같다.
     56px 은 얼굴 · 표정 · 상태 이모지가 알아볼 만한 가장 작은 키로 잡은 시작값(실기기에서 보고 조정).
   ★ 위로는 1(사용자가 정한 크기)을 넘지 않는다 — 줄일 때만 쓴다. */
const MIN_CHAR_PX = 56;
/* 가장 작은 캐릭터가 s=1 에서 px1 이면, 최소 배율 = MIN_CHAR_PX ÷ px1 (1 을 넘으면 1 — 이미 작으면 더 줄이지 않는다). */
function fitMinScale(px1, minPx){
  const m = isFinite(minPx) && minPx > 0 ? minPx : MIN_CHAR_PX;
  if(!(px1 > 0)) return 1;
  return Math.max(0.01, Math.min(1, m / px1));
}
/* fits(s) 가 참인 가장 큰 s ∈ [lo, hi] — fits 는 s 가 작을수록 참(단조). hi 에서 참이면 hi, lo 에서도 거짓이면 lo. */
function maxScaleFor(fits, lo, hi, iters){
  if(fits(hi)) return hi;
  if(!fits(lo)) return lo;
  for(let k = 0; k < (iters || 14); k++){ const m = (lo + hi) / 2; if(fits(m)) lo = m; else hi = m; }
  return lo;
}
/* 떨림 막기 — 줄여야 하면 바로 줄이고, 키울 때는 조금(gap) 넘게 커질 때만 키운다(숨쉬기 · 잰 값 흔들림으로 오르내리지 않게). */
function fitHysteresis(prev, next, gap){
  if(!isFinite(prev)) return next;
  if(next < prev) return next;
  return (next - prev) > (isFinite(gap) ? gap : 0.04) ? next : prev;
}

/* 보이는 영역(띠)의 화면 px. 오른쪽 끝 = 기준 좌석(맨 오른쪽 사람) 오른쪽 + 여백, 폭 = 화면 폭 × widthFrac.
   좌석 하나는 늘 들어가게(minPx), 화면 밖으로는 안 나가게. */
function bandRect(o){
  const W = Math.max(1, o.screenW || 1);
  const r = Math.max(1, Math.min(W, o.anchorPx + o.anchorHalfPx + (o.rightPad || 0)));
  const minPx = Math.min(r, Math.max(40, o.minPx || 0));
  const w = Math.max(minPx, Math.min(r, (isFinite(o.widthFrac) ? o.widthFrac : BAND_DEFAULT_FRAC) * W));
  return { l: r - w, r: r, w: w };
}
function inBand(px, band){ return !band || (px >= band.l && px <= band.r); }

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
  rowRange, bandRect, inBand, towerTop,
  fitMinScale, maxScaleFor, fitHysteresis,
  wheelToRowPx, dragBegin, dragMove, clampPanX,
  DRAG_THRESHOLD_PX, PAN_BASE_X, PAN_MARGIN_FALLBACK, BAND_DEFAULT_FRAC, MIN_CHAR_PX, SEAT_MODE_ROW, SEAT_MODE_RIGHT };
if(typeof window !== 'undefined') window.SeatLayout = api;
if(typeof module !== 'undefined' && module && module.exports) module.exports = api;
})();

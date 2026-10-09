/* ═══ 🪑 방 좌석 줄 — «보이는 영역»(가로 띠) 안에 한 줄 ══════════════════════════════════════════
   [문제] 방에서는 줄 가운데를 화면 오른쪽(0.84)에 두고 줄 전체가 들어오게 카메라를 물렸다. 사람이 많거나
     캐릭터를 키우면 줄이 오른쪽 화면 밖으로 나가 맨 오른쪽인 내 캐릭터도 사라졌다.
   [해법] 줄은 띠 안에 선다. 띠 오른쪽 끝 = 맨 오른쪽 좌석(카메라 기준점 · 프로그램 이동으로 같이 움직임),
     폭 = 화면 폭 × 비율(왼쪽 손잡이로 조절). 캐릭터 크기는 사용자가 정한 그대로고, 띠보다 긴 줄은
     오프셋(월드 단위)으로 휠 · 이름표 끌기로 넘겨 본다. 띠 밖은 앱이 그리지 않는다(가위 · 이름표 숨김).
     ・내 자리 «줄 안에 함께»(기본): 순서는 예전 그대로, 줄 전체를 넘긴다 — rowRange.
     ・내 자리 «맨 오른쪽 고정»: 나를 맨 앞(오른쪽)에 두고 나머지만 넘긴다 — offsetRange · placeRow
       (내 자리를 지나는 사람은 내 오른쪽 = 띠 밖으로 건너간다).
     범위는 단순하게 «처음 사람 ~ 끝 사람» 이다.
   이 파일은 숫자만 다룬다(THREE · DOM 없음). 검사: checks/sim-seat-layout.js */
(function(){
'use strict';

const DRAG_THRESHOLD_PX = 5;     // 이름표를 이만큼 넘게 끌어야 «끌기» — 그 아래는 지금처럼 클릭 · 우클릭
const WHEEL_LINE_PX = 16;        // deltaMode 1(줄 단위) 한 줄
const WHEEL_PAGE_PX = 400;       // deltaMode 2(쪽 단위) 한 쪽
const PAN_BASE_X = -0.34;        // applyCameraAndCanvas 의 기본 좌우 위치(기준점이 화면 0.84 에 온다)
const PAN_MARGIN_FALLBACK = 0.02;
const BAND_DEFAULT_FRAC = 0.6;     // 보이는 영역 기본 폭(화면 비율) — 예전 방 줄이 쓰던 오른쪽 아래 자리
const BAND_MIN_FRAC = 0.08;
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

const MAX_FLOORS = 3;

/* 층 나누기 — 줄 순서대로 1층을 띠 폭(월드)만큼 채우고, 넘치면 2층, 또 넘치면 3층 … floors 층까지.
   마지막 층은 남은 사람을 다 받는다(띠보다 길면 넘겨 본다). 한 층에는 적어도 한 사람.
   층마다 맨 오른쪽 좌석이 x=0 이고 왼쪽으로 «반폭 + 여백 + 반폭».
   돌려주는 값: floor[i](0부터) · xs[i](그 층 안의 자리) · count(실제로 쓴 층 수). */
function splitFloors(hws, spacing, bandW, floors){
  const n = hws.length, floor = new Array(n).fill(0), xs = new Array(n);
  const maxF = Math.max(1, Math.min(MAX_FLOORS, floors | 0));
  const fits = isFinite(bandW) && bandW > 0;
  let f = 0, x = 0, right = 0, prev = -1;
  for(let i = 0; i < n; i++){
    let nx = prev < 0 ? 0 : x - (hws[prev] + spacing + hws[i]);
    if(prev < 0) right = hws[i];
    if(fits && prev >= 0 && f < maxF - 1 && (right - (nx - hws[i])) > bandW + 1e-9){
      f++; nx = 0; right = hws[i];   // 이 층이 찼다 — 위층 맨 오른쪽에서 다시 시작
    }
    floor[i] = f; xs[i] = nx; x = nx; prev = i;
  }
  return { floor, xs, count: n ? f + 1 : 0 };
}
/* 층 수 고르기 — 원하는 층 수부터, 층 사이 여백을 보통 → 좁게 순서로 시도하고(tryFloors(n, gapLevel) 가 {ok, lifts}),
   안 되면 한 층씩 줄인다. 1층은 늘 된다. 돌려주는 값: {n, gapLevel, lifts}. */
function planFloors(want, gapLevels, tryFloors){
  const w = Math.max(1, Math.min(MAX_FLOORS, want | 0));
  for(let n = w; n >= 2; n--){
    for(let g = 0; g < gapLevels; g++){
      const r = tryFloors(n, g);
      if(r && r.ok) return { n: r.count || n, gapLevel: g, lifts: r.lifts };
    }
  }
  return { n: 1, gapLevel: 0, lifts: [0] };
}
/* 탑 높이 — 머리 위에 올라탄 사람(탑쌓기)이 있으면 그 키만큼 위로. 바닥 좌석 키 + 올라탄 사람마다 (맨 위 − 맨 아래).
   층 높이 계산이 이 값을 그 좌석의 키로 쓴다 — 위층 책상 · 이름표가 탑을 덮지 않게. */
function towerTop(ownTop, riders){
  let t = isFinite(ownTop) ? ownTop : 0;
  (riders || []).forEach(r=>{ const h = (r && isFinite(r.top) && isFinite(r.minY)) ? r.top - r.minY : 0; if(h > 0) t += h; });
  return t;
}
/* 🪑 좌석 크기 평준화 세 가지 — 'off'(끄기 · 기본) · 'char'(비율 맞추기 · 예전 «켜짐») · 'fit'(사이즈 맞추기).
   저장값(tw.seatEq): '1' = 예전 «켜짐» → 'char'(옛 앱도 '1' 을 켜짐으로 읽으므로 'char' 는 계속 '1' 로 쓴다) · 'fit' · 그 밖 = 꺼짐. */
function parseSeatEqMode(v){ return v === '1' || v === 'char' ? 'char' : (v === 'fit' ? 'fit' : 'off'); }
function seatEqStoreValue(mode){ return mode === 'char' ? '1' : (mode === 'fit' ? 'fit' : '0'); }
function nextSeatEqMode(mode){ return mode === 'off' ? 'char' : (mode === 'char' ? 'fit' : 'off'); }
/* 사이즈 맞추기 배율 — 좌석 상자(책상 폭) 반폭을 내 좌석과 같게: k = 내 반폭 ÷ 그 좌석 반폭(평준화 전 값).
   동물(40%)은 커지고, 긴 책상 · 큰 캐릭터는 작아진다. 너무 튀지 않게 [lo, hi] 로 묶는다. */
function fitScale(refHalf, rawHalf, lo, hi){
  if(!(refHalf > 0) || !(rawHalf > 0)) return 1;
  const k = refHalf / rawHalf;
  return isFinite(k) ? Math.max(lo || 0.25, Math.min(hi || 4, k)) : 1;
}
/* 단조 조건 ok(L) 를 처음 만족하는 L(작은 쪽) — 이분 탐색. lo 에서 이미 참이면 lo, hi 에서도 거짓이면 hi.
   층 높이를 화면 px 기준(원근 · 책상 앞면 포함)으로 맞출 때 쓴다. */
function minLiftFor(ok, lo, hi, iters){
  if(ok(lo)) return lo;
  if(!ok(hi)) return hi;
  for(let k = 0; k < (iters || 24); k++){ const m = (lo + hi) / 2; if(ok(m)) hi = m; else lo = m; }
  return hi;
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
/* 왼쪽 손잡이를 dx 만큼 끌었을 때 새 폭(화면 비율). 왼쪽으로 끌면 넓어진다. */
function bandFracFromDrag(startFrac, dxPx, screenW){
  const W = Math.max(1, screenW || 1);
  const f = (isFinite(startFrac) ? startFrac : BAND_DEFAULT_FRAC) - (+dxPx || 0) / W;
  return Math.max(BAND_MIN_FRAC, Math.min(1, f));
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
  rowRange, bandRect, bandFracFromDrag, inBand, splitFloors, planFloors, minLiftFor, towerTop, MAX_FLOORS,
  parseSeatEqMode, seatEqStoreValue, nextSeatEqMode, fitScale,
  wheelToRowPx, dragBegin, dragMove, clampPanX,
  DRAG_THRESHOLD_PX, PAN_BASE_X, PAN_MARGIN_FALLBACK, BAND_DEFAULT_FRAC, BAND_MIN_FRAC, SEAT_MODE_ROW, SEAT_MODE_RIGHT };
if(typeof window !== 'undefined') window.SeatLayout = api;
if(typeof module !== 'undefined' && module && module.exports) module.exports = api;
})();

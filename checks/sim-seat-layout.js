/* ═══ 🪑 sim-seat-layout.js — 방 좌석 줄: «보이는 영역»(띠) · 폭 손잡이 · 휠 · 이름표 끌기 · 내 자리 설정 (2026-10-09 신설) ═══
   제보: 방 인원이 많으면 줄이 오른쪽 화면 밖으로 나가고 내 캐릭터도 안 보인다 · 끌어도 되돌아온다.
   ・1절: 줄 순서 · 기본 자리(옛 식 그대로) — 1 · 4 · 10 · 20명
   ・2절: «맨 오른쪽 고정» 오프셋 범위 — 화면 · 비율 · 크기별
   ・3절: «맨 오른쪽 고정» 겹침 없음 · 건너가기
   ・4절: 휠 · 끌기 값(5px 문턱 · 줄 단위 휠) · 프로그램 이동 좌우 범위
   ・5절: 보이는 영역 — 띠 자리 · 폭 손잡이 · «줄 안에 함께» 범위(처음 사람 ~ 끝 사람)
   ・7절: 층(최대 3) — 아래층을 띠 폭만큼 채우고 넘치면 위 선반 · 층 수 고르기(여백 좁히기 → 층 줄이기)
   ・6절: app.js 배선 · html(로드 순서 · 손잡이 · 설정 버튼) · 클릭 통과 목록 · 창 위치 초기화 · 개발용 가짜 사람
   [실행] seat-layout.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['seat-layout.js', 'app.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const win = {};
new Function('window', 'module', SRC['seat-layout.js'])(win, undefined);
const L = win.SeatLayout;
const EPS = 1e-6;

/* 화면 모형 — 카메라 기준점(내 자리 x=0)이 화면 0.84 − panX 에 온다. 월드 폭 viewW 가 화면 폭 1. */
function screen(viewW, panX){
  const sx = 0.84 - (panX || 0);
  return { toFrac: (x) => sx + x / viewW, winLeft: (marginFrac) => (marginFrac - sx) * viewW };
}
function rowOf(n, hw, spacing){
  const hws = Array.from({ length: n }, (_, i) => hw * (i % 3 === 1 ? 1.3 : 1));   // 책상 폭이 섞여 있다
  return { hws, xs: L.naturalRow(hws, spacing) };
}

say('── 1. 줄 순서 · 기본 자리');
{
  const a = {}, b = {}, c = {};
  const o = L.orderRow([b, a, c], a);
  chk(o[0] === a && o[1] === b && o[2] === c, '기준(나)을 맨 앞에 · 나머지는 원래 순서');
  chk(L.orderRow([b, c], a).length === 2, '기준이 목록에 없으면 그대로');
  for(const n of [1, 4, 10, 20]){
    const r = rowOf(n, 0.85, 0.45);
    let ok = r.xs[0] === 0;
    for(let i = 1; i < n; i++) ok = ok && Math.abs((r.xs[i - 1] - r.xs[i]) - (r.hws[i - 1] + 0.45 + r.hws[i])) < EPS;
    chk(ok, `${n}명 — 나는 x=0, 나머지는 왼쪽으로 «반폭 + 여백 + 반폭» (layoutSeats 옛 식)`);
  }
}

say('── 2. 화면 · 오프셋 범위');
{
  const cases = [];
  for(const n of [1, 4, 10, 20]) for(const viewW of [6, 12, 25, 60]) for(const panX of [0, 0.3, -0.1]) cases.push({ n, viewW, panX });
  let okRange = true, okFit = true, okSweep = true, okSolo = true, bad = '';
  for(const c of cases){
    const r = rowOf(c.n, 0.85, 0.45), sc = screen(c.viewW, c.panX);
    const wl = sc.winLeft(12 / 1920);
    const rg = L.offsetRange(r.xs, r.hws, wl);
    if(!(rg.min <= 0 && rg.max >= 0)){ okRange = false; bad = JSON.stringify(c); }
    if(c.n === 1){ if(rg.min !== 0 || rg.max !== 0) okSolo = false; continue; }
    let left = Infinity; for(let i = 1; i < c.n; i++) left = Math.min(left, r.xs[i] - r.hws[i]);
    if(left >= wl){
      // 다 들어감 — 범위 양 끝에서 줄 왼쪽 끝이 화면 안
      if(left + rg.min < wl - EPS){ okFit = false; bad = JSON.stringify(c); }
      if(rg.max !== 0) okFit = false;
    } else {
      // 넘침 — 최대로 밀면 왼쪽 끝 사람이 화면 왼쪽 끝에 닿는다
      if(Math.abs(left + rg.max - wl) > EPS || rg.min !== 0){ okSweep = false; bad = JSON.stringify(c); }
    }
  }
  chk(okRange, '범위는 늘 0(모두 내 왼쪽에 붙은 자리)을 품는다 ' + (okRange ? '' : bad));
  chk(okSolo, '혼자면 범위 0 — 움직일 줄이 없다');
  chk(okFit, '다 들어가는 줄: 왼쪽으로만, 화면 왼쪽 끝까지 (내 쪽으로는 안 겹침)');
  chk(okSweep, '넘치는 줄: 오른쪽으로 «왼쪽 끝 사람이 화면 왼쪽 끝에 올 때까지» — 끝에서 끝까지 훑는다');
  const rg = { min: -2, max: 5 };
  chk(L.clampOffset(9, rg) === 5 && L.clampOffset(-9, rg) === -2 && L.clampOffset(1, rg) === 1 && L.clampOffset(NaN, rg) === 0, 'clampOffset — 범위 밖은 끝으로 · 망가진 값은 0');
  const st = L.createSeatLayout();
  st.setRange({ min: 0, max: 3 }); st.nudge(10);
  chk(st.offset === 3, '상태: 밀어도 범위 끝에서 멈춘다(되돌아가지 않음)');
  st.setRange({ min: 0, max: 1 });
  chk(st.offset === 1, '사람이 나가 범위가 줄면 오프셋도 그 안으로');
  st.reset();
  chk(st.offset === 0, 'reset — 방에 들어올 때 · 창 위치 초기화');
}

say('── 3. 겹침 없음 · 건너가기');
{
  let okNo = true, okMe = true, okOrder = true, okDefault = true, bad = '';
  for(const n of [1, 4, 10, 20]) for(const sp of [0.02, 0.45, 1.2]){
    const r = rowOf(n, 0.85, sp);
    for(let s = -30; s <= 60; s += 0.37){
      const p = L.placeRow(r.xs, r.hws, s, sp);
      if(p.xs[0] !== 0) okMe = false;
      const iv = p.xs.map((x, i) => [x - r.hws[i], x + r.hws[i]]).sort((a, b) => a[0] - b[0]);
      for(let i = 1; i < iv.length; i++) if(iv[i][0] < iv[i - 1][1] + sp - 1e-6){ okNo = false; bad = `n${n} sp${sp} s${s.toFixed(2)}`; }
      // 건너간 사람(R)은 내 오른쪽에 줄 순서대로: 인덱스가 클수록(원래 더 왼쪽) 나와 가깝다
      const R = []; for(let i = 1; i < n; i++) if(p.side[i] === 'R') R.push(i);
      for(let j = 1; j < R.length; j++) if(!(p.xs[R[j]] < p.xs[R[j - 1]])) okOrder = false;
      for(const i of R) if(p.xs[i] - r.hws[i] < r.hws[0] + sp - 1e-6) okOrder = false;
      if(s <= 0 && R.length) okDefault = false;
    }
  }
  chk(okMe, '나는 어떤 오프셋에서도 x=0 (줄을 움직여도 내 캐릭터는 그대로)');
  chk(okNo, '어떤 오프셋에서도 누구도 겹치지 않는다(여백 포함) ' + (okNo ? '' : bad));
  chk(okOrder, '내 자리를 지난 사람은 내 오른쪽에 · 줄 순서 그대로');
  chk(okDefault, '오프셋 ≤ 0 이면 아무도 건너가지 않는다(기본 자리 = 모두 내 왼쪽)');
  // 문턱에서 건너간 첫 사람은 내 바로 오른쪽(여백만큼) — 화면을 가로지르는 큰 점프가 없다
  const r = rowOf(4, 0.85, 0.45);
  const p = L.placeRow(r.xs, r.hws, 0.01, 0.45);
  chk(p.side[1] === 'R' && Math.abs((p.xs[1] - r.hws[1]) - (r.hws[0] + 0.45)) < 0.05, '살짝 밀면 맨 가까운 사람 하나만 내 오른쪽 바로 옆으로');
}

say('── 4. 휠 · 끌기 · 프로그램 이동');
{
  chk(L.wheelToRowPx({ deltaY: 100, deltaX: 0, deltaMode: 0 }) === 100, '아래로 굴리면 줄이 오른쪽으로(왼쪽 사람이 나온다)');
  chk(L.wheelToRowPx({ deltaY: 0, deltaX: -40, deltaMode: 0 }) === 40, '트랙패드 가로 쓸기(deltaX)도');
  chk(L.wheelToRowPx({ deltaY: 3, deltaX: 0, deltaMode: 1 }) === 48, '줄 단위 휠(deltaMode 1)은 px 로');
  chk(L.wheelToRowPx(null) === 0, '빈 값은 0');
  let st = L.dragBegin(100, 200, 1.5);
  chk(L.dragMove(st, 103, 201) === null && !st.active, '5px 미만은 끌기가 아니다(클릭 · 우클릭 그대로)');
  chk(L.dragMove(st, 106, 200) === 6 && st.active, '5px 넘으면 끌기 — 시작점부터의 가로 이동량');
  chk(L.dragMove(st, 101, 200) === 1 && st.s0 === 1.5, '한 번 시작하면 문턱 아래로 돌아와도 계속 끌기');
  // 프로그램 이동: 기준점(내 자리) 화면 위치 = 0.84 − panX 가 [m, 1−m] 안
  let ok = true;
  for(const m of [0.02, 0.05, 0.14, 0.3]) for(const px of [-3, -0.5, 0, 0.5, 0.9, 3]){
    const c = L.clampPanX(px, m);
    const sx = 0.84 - c;
    if(sx < m - EPS || sx > 1 - m + EPS) ok = false;
  }
  chk(ok, '프로그램 이동 좌우: 내 좌석 반폭만큼 안쪽 — 내 캐릭터가 화면 밖으로 못 나간다');
  chk(L.clampPanX(0, 0.1) === 0, '기본 자리(0)는 그대로 — 혼자일 때와 같은 오른쪽 아래');
  chk(L.clampPanX(5, NaN) === L.clampPanX(5, L.PAN_MARGIN_FALLBACK), '반폭을 모르면 예전 고정 여백(0.02)');
}

say('── 5. 보이는 영역(띠)');
{
  const W = 1800;
  const b0 = L.bandRect({ anchorPx: 1512, anchorHalfPx: 60, rightPad: 8, widthFrac: 0.6, screenW: W, minPx: 136 });
  chk(Math.abs(b0.r - 1580) < EPS && Math.abs(b0.w - 1080) < EPS && Math.abs(b0.l - 500) < EPS, '띠 오른쪽 = 맨 오른쪽 좌석 오른쪽 + 여백 · 폭 = 화면 × 비율');
  const b1 = L.bandRect({ anchorPx: 1780, anchorHalfPx: 60, rightPad: 8, widthFrac: 0.6, screenW: W, minPx: 136 });
  chk(b1.r === W, '화면 오른쪽 밖으로는 안 나간다');
  const b2 = L.bandRect({ anchorPx: 300, anchorHalfPx: 60, rightPad: 8, widthFrac: 0.9, screenW: W, minPx: 136 });
  chk(b2.l >= 0 && Math.abs(b2.w - b2.r) < EPS, '왼쪽도 화면 안(폭이 줄어든다)');
  const b3 = L.bandRect({ anchorPx: 1512, anchorHalfPx: 60, rightPad: 8, widthFrac: 0.01, screenW: W, minPx: 136 });
  chk(b3.w >= 136 - EPS, '아무리 좁혀도 좌석 하나는 들어간다');
  chk(Math.abs(L.bandFracFromDrag(0.6, -180, W) - 0.7) < EPS && Math.abs(L.bandFracFromDrag(0.6, 180, W) - 0.5) < EPS, '왼쪽 손잡이를 왼쪽으로 끌면 넓어지고 오른쪽으로 끌면 좁아진다');
  chk(L.bandFracFromDrag(0.6, -9999, W) === 1 && L.bandFracFromDrag(0.6, 9999, W) === L.BAND_MIN_FRAC, '폭 비율은 [최소, 1]');
  chk(L.inBand(600, b0) && !L.inBand(400, b0) && L.inBand(5, null), 'inBand — 띠가 없으면(혼자) 막지 않는다');
  // 줄 안에 함께 — 처음 사람 ~ 끝 사람
  let ok = true, okLong = true, okShort = true;
  for(const n of [1, 4, 10, 20]) for(const bw of [3, 8, 20, 60]){
    const r = rowOf(n, 0.85, 0.45);
    const bR = 0.85 + 0.05, bL = bR - bw;
    const rg = L.rowRange(r.xs, r.hws, bL, bR);
    if(!(rg.min <= rg.max)) ok = false;
    const left = Math.min(...r.xs.map((x, i) => x - r.hws[i])), right = Math.max(...r.xs.map((x, i) => x + r.hws[i]));
    if(right - left > bw){
      // 길면: 한쪽 끝 = 오른쪽 끝 사람이 띠 오른쪽, 다른 끝 = 왼쪽 끝 사람이 띠 왼쪽
      if(Math.abs(right + rg.min - bR) > EPS || Math.abs(left + rg.max - bL) > EPS) okLong = false;
    } else {
      // 짧으면: 어느 끝에서도 줄 전체가 띠 안
      for(const s0 of [rg.min, rg.max]) if(left + s0 < bL - EPS || right + s0 > bR + EPS) okShort = false;
    }
  }
  chk(ok, 'rowRange — 범위가 뒤집히지 않는다');
  chk(okLong, '띠보다 긴 줄: 오른쪽 끝 사람 ~ 왼쪽 끝 사람까지 넘겨 본다');
  chk(okShort, '띠보다 짧은 줄: 띠 안에서만 움직인다');
  const r = rowOf(10, 0.85, 0.45), rg = L.rowRange(r.xs, r.hws, -5, 0.9);
  chk(L.clampOffset(0, rg) >= rg.min && rg.max > 0, '처음 자리(0) 근처에서 시작해 휠 · 끌기로 양쪽 다 움직인다(10명 · 좁은 띠)');
}

say('── 7. 층(최대 3)');
{
  let okFit = true, okOrder = true, okOne = true, okNoOverlap = true, okMax = true, bad = '';
  for(const n of [1, 4, 10, 20]) for(const bw of [2, 5, 9, 25]) for(const sp of [0.02, 0.45]) for(const F of [1, 2, 3]){
    const r = rowOf(n, 0.85, sp);
    const f = L.splitFloors(r.hws, sp, bw, F);
    const by = [[], [], []];
    f.floor.forEach((x, i) => by[x].push(i));
    if(n && (!by[0].length || by[0][0] !== 0)) okOne = false;
    if(f.count > F || Math.max(...f.floor) !== f.count - 1) okMax = false;
    // 줄 순서대로 아래층부터 — 층 번호가 줄 순서에서 줄어들지 않는다
    for(let i = 1; i < n; i++) if(f.floor[i] < f.floor[i - 1] || f.floor[i] > f.floor[i - 1] + 1) okOrder = false;
    for(let k = 0; k < f.count; k++){
      const fl = by[k]; if(!fl.length) { okOne = false; continue; }
      // 맨 위층이 아니면 띠 폭 안 · 꽉 채움(다음 사람을 넣으면 넘침)
      if(k < f.count - 1){
        const Lk = Math.min(...fl.map(i => f.xs[i] - r.hws[i])), Rk = Math.max(...fl.map(i => f.xs[i] + r.hws[i]));
        if(fl.length > 1 && Rk - Lk > bw + 1e-9){ okFit = false; bad = `n${n} bw${bw} F${F}`; }
        const last = fl[fl.length - 1], nx = last + 1;
        const xk = f.xs[last] - (r.hws[last] + sp + r.hws[nx]);
        if(Rk - (xk - r.hws[nx]) <= bw) okFit = false;
      }
      for(let j = 1; j < fl.length; j++){ const a2 = fl[j - 1], b2 = fl[j]; if((f.xs[a2] - r.hws[a2]) - (f.xs[b2] + r.hws[b2]) < sp - 1e-9) okNoOverlap = false; }
    }
  }
  chk(okOne, '층마다 적어도 한 사람 · 맨 앞(기준 좌석)은 1층');
  chk(okMax, '설정한 층 수를 넘지 않는다(최대 3)');
  chk(okOrder, '아래층부터 채운다 — 줄 순서 그대로, 층을 건너뛰지 않는다');
  chk(okFit, '맨 위층이 아니면 띠 폭 안 · 한 명이라도 더 넣으면 넘칠 때만 위층으로 ' + bad);
  chk(okNoOverlap, '같은 층끼리 겹치지 않는다(여백 포함)');
  const one = L.splitFloors([0.85, 0.85, 0.85, 0.85], 0.45, 2, 1);
  chk(one.floor.every(x => x === 0) && one.xs[3] < -6 && one.count === 1, '1층 설정이면 모두 1층(예전 한 줄)');
  chk(L.splitFloors([0.85, 0.85, 0.85, 0.85, 0.85, 0.85], 0.45, 2, 9).count === 3, '층 수는 3 을 넘지 않는다');
  // 층 수 고르기 — 원하는 층 · 여백 보통 → 좁게 → 한 층 줄이기
  const log = [];
  const pick3 = L.planFloors(3, 2, (n, g) => { log.push(n + ':' + g); return { ok: n === 3 && g === 0, lifts: [0, 1, 2], count: n }; });
  chk(pick3.n === 3 && pick3.gapLevel === 0 && log.join() === '3:0', '들어가면 원하는 층 수 그대로(여백 보통)');
  log.length = 0;
  const pickG = L.planFloors(3, 2, (n, g) => { log.push(n + ':' + g); return { ok: n === 3 && g === 1, lifts: [0, 1, 2], count: n }; });
  chk(pickG.n === 3 && pickG.gapLevel === 1 && log.join() === '3:0,3:1', '안 들어가면 먼저 층 사이 여백을 좁혀 본다');
  log.length = 0;
  const pick2 = L.planFloors(3, 2, (n, g) => { log.push(n + ':' + g); return { ok: n === 2, lifts: [0, 1], count: n }; });
  chk(pick2.n === 2 && log.join() === '3:0,3:1,2:0', '그래도 안 되면 한 층 줄인다(3 → 2)');
  const pick1 = L.planFloors(3, 2, () => ({ ok: false }));
  chk(pick1.n === 1 && pick1.lifts.length === 1 && pick1.lifts[0] === 0, '끝까지 안 되면 1층');
  chk(L.planFloors(1, 2, () => { throw new Error('부르면 안 됨'); }).n === 1, '1층 설정이면 계산하지 않는다');
  chk(Math.abs(L.towerTop(1.2, [{ top: 0.5, minY: -0.05 }, { top: 0.4, minY: 0 }]) - 2.15) < EPS && L.towerTop(1.2, []) === 1.2 && L.towerTop(1.2, [{ top: NaN, minY: 0 }]) === 1.2, '탑 높이 = 바닥 좌석 키 + 올라탄 사람마다 키(망가진 값은 뺌)');
  { // 탑이 있으면 위층이 그만큼 올라가야 한다 — 같은 조건(위층 바닥 ≥ 아래층 꼭대기 + 이름표)으로 비교
    const need = (top1) => L.minLiftFor(Lf => Lf - 0.05 >= top1 + 0.2, 0, 10);
    chk(need(L.towerTop(1.2, [{ top: 0.5, minY: 0 }])) > need(1.2) + 0.49, '탑이 있는 층 위는 탑 키만큼 더 올라간다');
  }
  chk(/function _rowSeatBoxWithTower\(seat\)\{/.test(SRC['app.js']) && /seats\.filter\(r=>r !== seat && r\.ridingOn && _rideBottom\(r\) === seat\)/.test(SRC['app.js']) && /boxes: placed\.map\(_rowSeatBoxWithTower\)/.test(SRC['app.js']), '층 높이에 탑(올라탄 사람들) 키를 넣는다 — 올라타기 · 내리기 때 layoutSeats 가 다시 잰다');
  chk(L.minLiftFor(x => x >= 2.5, 0, 8) - 2.5 < 1e-4 && L.minLiftFor(x => x >= 0, 0, 8) === 0 && L.minLiftFor(x => false, 0, 8) === 8, 'minLiftFor — 조건을 처음 만족하는 높이');
}

say('── 6. app.js 배선');
{
  const A0 = SRC['app.js'];
  chk(/const plan = SeatLayout\.planFloors\(roomFloors, ROOM_FLOOR_GAPS\.length, \(n, g\)=>\{\n    const f = SeatLayout\.splitFloors\(c\.hws, c\.spacing, bandW, n\);/.test(A0) && /var ROOM_FLOORS_KEY = 'tw\.roomFloors';/.test(A0) && /roomFloors = \(roomFloors % SeatLayout\.MAX_FLOORS\) \+ 1;/.test(A0), '층 나누기: 띠 폭(월드)으로 · 설정 tw.roomFloors(1 → 2 → 3)');
  chk(/const bx = \(i\)=>\(c\.boxes && c\.boxes\[i\]\) \|\| _rowSeatBoxWithTower\(c\.seats\[i\]\);/.test(A0) && /const ROOM_FLOOR_GAPS = \[\{ labelsPx: 46, gapPx: 4 \}, \{ labelsPx: 38, gapPx: 0 \}\];/.test(A0), '층 높이: 실제 좌석 상자(캐릭터 크기 · 동물 40% · 책상) · 여백 보통 → 좁게');
  chk(/if\(seat\.group && !seat\.ridingOn && !seat\.seatedOn && \(floorChanged/.test(A0) && /s\._rowFloorY = 0;/.test(A0), '층 높이는 올라탄 · 벤치 좌석은 건드리지 않고 · 방을 나가면 0 으로');
  chk(/const cxChip = _chipNatDx \? /.test(A0) && /px0 = placeRight \? \(cxChip \+ CHAR_HALF_PX/.test(A0) && /_charBoundsLatest = \{ x: cx, y: cy/.test(A0), '상태칩은 줄을 넘겨도 처음 자리 — main 에 보내는 캐릭터 원은 실제 자리');
  chk(/if\(!_rowRoomMode \|\| !c \|\| c\.fixRight \|\| !c\.natX/.test(A0), '«맨 오른쪽 고정» 이면 칩은 원래대로');
  chk(/id="fsRoomFloorsToggle"/.test(SRC['desk-companion-prototype.html']), 'html: 캐릭터 탭 «방 줄 층 수»');
  chk(/'이 화면에서는 ' \+ c\.floorsShown \+ '층까지'/.test(A0) && /id="fsRoomFloorsNote"/.test(SRC['desk-companion-prototype.html']), '층 수를 줄였으면 설정 아래에 «이 화면에서는 N층까지»');
  chk(/Math\.max\(sy\(L \+ minY, maxZ\), sy\(L, 0\) \+ gap\.labelsPx\) <= headBelow - gap\.gapPx/.test(A0) && />= ROOM_FLOOR_TOP_MARGIN_PX;/.test(A0), '층 높이는 화면 px 로 — 위층 책상 앞 아래 모서리 · 위층 이름표가 아래층 머리 위 · 맨 위층 머리는 화면 안');
  chk(/const y = _rowBandYRange\(\);\n  const cy = y \? \(y\.top \+ y\.bottom\) \/ 2/.test(A0) && /if\(!SeatLayout\.inBand\(\(_rowSeatP\.x \* 0\.5 \+ 0\.5\) \* innerWidth, _rowBandPx\)\) continue;/.test(A0), '손잡이 세로 자리 = 띠 안 좌석이 화면에서 차지하는 높이의 가운데');
  const V = (A0.match(/const DEV_FAKE_VARIANTS = \[([\s\S]*?)\];/) || [])[1] || '';
  chk(/kind: 'human'/.test(V) && /kind: 'animal'/.test(V) && /rideOnPrev: true/.test(V) && (V.match(/\{ kind:/g) || []).length === 9 && /deskLenX: 2\.2/.test(V) && /items: false/.test(V), '가짜 사람 9 가지 — 사람 · 동물 · 몸 크기 · 책상 크기 · 넓은 책상 · 물건 없음 · 올라탄 동물');
  chk(/if\(opts\.same\)\{ def = clone\(me\.charDef\); \}/.test(A0), '__devFakeSeats(n, {same:true}) — 예전처럼 내 캐릭터 복제');
  chk(/<div id="roomBandHandle"[^>]*><span class="grip"><i><\/i><i><\/i><i><\/i><\/span><\/div>/.test(SRC['desk-companion-prototype.html']) && /#roomBandHandle \.grip\{[^}]*width:6px;height:28px;border-radius:3px/.test(SRC['desk-companion-prototype.html']) && /prefers-color-scheme: dark/.test(SRC['desk-companion-prototype.html']), '손잡이 모양: 짧은 알약(6×28) · 점 세 개(⋮) · 밝은/어두운 테마');
}
say('── 6. app.js 배선');
{
  const A = SRC['app.js'], H = SRC['desk-companion-prototype.html'];
  const iL = H.indexOf('<script src="parts/seat-layout.js">'), iA = H.indexOf('<script src="parts/app.js">');
  chk(iL > 0 && iL < iA, 'html: seat-layout.js 를 app.js 보다 먼저');
  chk(/<div id="roomBandHandle"/.test(H) && /#roomBandHandle\{[^}]*pointer-events:auto/.test(H) && /#roomBandHandle:hover/.test(H), 'html: 띠 손잡이 — 클릭을 받고 평소엔 흐리게(올리면 진하게)');
  chk(/id="fsRoomSeatModeToggle"/.test(H) && /fsTabSize[\s\S]*fsRoomSeatModeToggle/.test(H), 'html: 캐릭터 탭 «방에서 내 자리» 버튼');
  chk(/const _fixRight = _rowRoomMode && roomSeatMode === SeatLayout\.SEAT_MODE_RIGHT;\n  if\(_fixRight\) placed = SeatLayout\.orderRow\(placed, _meBase\);/.test(A), '«맨 오른쪽 고정» 일 때만 나를 맨 앞으로 — 기본(줄 안에 함께)은 순서 그대로');
  chk(/classList\.contains\('runmode'\)\);/.test(A) && /_rowRoomMode = !!\(hasRemote && _meBase/.test(A), '방(실행 화면 · 다른 사람 있음)일 때만 — 혼자일 때 예전 그대로');
  chk(/rowSpan = Math\.max\(1\.2, 2 \* halfWidthsForZoom\[0\]\);/.test(A), '방에서도 카메라 줌은 좌석 하나 기준 — 사람이 늘어도 캐릭터 크기 그대로');
  chk(/const camX = _rowRoomMode \? 0 : rowCenter;/.test(A) && /applyCameraAndCanvas\(camX, rowSpan\);\n  _applyRowOffset\(false\);/.test(A), '방에서는 카메라 기준점 = 맨 오른쪽 좌석 · 혼자는 줄 가운데(예전 그대로)');
  chk(/SeatLayout\.offsetRange\(xsAll, hwAll, bL\) : SeatLayout\.rowRange\(xsAll, hwAll, bL, bR\)/.test(A), '두 모드의 범위 — 줄 안에 함께: 띠 양 끝 · 맨 오른쪽 고정: 띠 왼쪽 끝');
  chk(/if\(_rowRoomMode && !_wasRoom\) _rowLayout\.reset\(\);/.test(A), '방에 들어올 때 오프셋 0');
  chk(/function updateCameraOnly\(\)\{\n  applyCameraAndCanvas\(_cachedRowCenter, _cachedRowSpan\);\n  _applyRowOffset\(false\);/.test(A), '캐릭터 크기만 바꿔도 띠 · 범위 다시 계산');
  chk(/const _sc = _rowScissorBegin\(\);[^\n]*\n[^\n]*renderer\.render\(scene,camera\);\n  _rowScissorEnd\(_sc\);/.test(A) && /_rowClipLabels\(\); _rowPlaceBandHandle\(\);/.test(A), '띠 밖은 안 그린다(가위) · 이름표 숨김 · 손잡이 자리 — 매 프레임');
  chk(/if\(_cvEl && seats\.length && !_rowBandBlocksPx\(cx\)\)/.test(A) && /if\(_rowBandBlocksPx\(e\.clientX\)\) return;/.test(A), '띠 밖(안 그려진) 좌석은 클릭 판정 · 잡기에서 빠진다');
  chk(/drag\.mode = \(drag\.targetType === 'char'\) \? 'shake' : 'slot';/.test(A) && /if\(drag\.roomSlot === undefined\) drag\.roomSlot = _rowSlotBegin\(drag\.seat, e\);\n      _rowSlotFollow\(drag\.seat, drag\.roomSlot, e\);/.test(A) && /let idx=Math\.round\(-wx\/_spacing\);/.test(A), '책상 끌기 = 자리 바꾸기는 방에서도 그대로(방은 화면에서 가장 가까운 좌석 · 혼자는 예전 식)');
  chk(/if\(!_rowRoomMode \|\| !seat \|\| !seat\.group \|\| seat\.ridingOn \|\| seat === _rowSlotFixedMe\(\)\) return null;/.test(A) && /if\(t === seat \|\| t === me \|\| t\.ridingOn \|\| !t\.group\) continue;/.test(A) && !/_rowLayout\./.test((A.match(/function _rowSlotFollow\(seat, st, e\)\{[\s\S]*?\n\}/) || ['_rowLayout.'])[0] + (A.match(/function _rowSlotDrop\(seat, st\)\{[\s\S]*?\n\}/) || ['_rowLayout.'])[0]), '«맨 오른쪽 고정» 이면 내 좌석은 끌리지도 놓일 자리도 안 됨 · 자리 바꾸기는 줄을 넘기지 않는다');
  chk(/const d = Math\.hypot\(x - e\.clientX, y - e\.clientY\);/.test(A) && /return _slotRay\.ray\.intersectPlane\(_slotZ0, _slotPt\) \? _slotPt : null;/.test(A) && /seat\.group\.position\.y = w\.y - st\.grabY;/.test(A), '층을 넘나든다 — 놓을 자리 = 커서에 화면(x · y)으로 가장 가까운 좌석(어느 층이든) · 끄는 좌석은 위아래로도 따라온다');
  chk(/if\(drag\.mode==='slot' && drag\.roomSlot\)\{ _rowSlotDrop\(seat, drag\.roomSlot\); drag\.roomSlot = null; \}/.test(A) && /if\(slot\) _rowSlotDrop\(seat, slot\);/.test(A) && !/_rowSlotMove|_rowSlotIndexAt/.test(A), '순서는 놓을 때 한 번만 바꾼다(끄는 중엔 안 바꿔서 줄이 튀지 않는다) — 책상 · 이름표 둘 다');
  chk(/seats\.splice\(cur, 1\); seats\.splice\(ti, 0, seat\);/.test(A) && /best\.namePlateEl\.classList\.add\('drop-target'\)/.test(A) && /\.seat-nameplate\.drop-target\{/.test(SRC['desk-companion-prototype.html']), '대상 자리로 옮긴다 · 놓일 자리 이름표에 표시');
  chk(/function worldX\(e, planeY\)\{/.test(A) && /slotY: seat\.group\.position\.y \+ 0\.4,/.test(A) && /if\(ray\.ray\.intersectPlane\(_wxZ0,_wxPt\)\) return _wxPt\.x;/.test(A), 'worldX — 좌석 층 높이의 평면 · 못 맞히면 세로면(2층 이상에서 x=0 으로 굳던 것)');
  chk(/if\(drag && drag\.roomSlot\)\{ const rs = drag\.roomSlot;/.test(A), '끌기가 끊기면(취소 · 창 바뀜) 표시를 걷고 줄을 되돌린다');
  chk(/el\.addEventListener\('pointerdown', e=>_rowDragStart\(e, seat\)\);/.test(A) && /_seatCtxMenu\(e, seat\);/.test(A), '이름표: 끌기 시작 + 우클릭 메뉴 그대로');
  chk(/_rowDrag\.seat = seat;\n  try\{ _rowDrag\.el\.setPointerCapture\(e\.pointerId\); \}catch\(_\)\{\}/.test(A) && !/e\.buttons === 0\)\{ _rowDragEnd/.test(A) && !/_rowLayout\.set\(_rowDrag\.s0/.test(A), '이름표 끌기 = 자리 바꾸기(줄 넘기기 아님) · 누르는 순간 포인터를 잡는다 · buttons 0 으로 끝내지 않는다');
  chk(/if\(_rowDrag\.slot && !drag\) drag = \{ seat, [^\n]*mode: 'slot', targetType: 'desk', fromPlate: true,/.test(A) && /if\(drag && drag\.fromPlate\) drag = null;/.test(A), '이름표로 끄는 동안 책상 끌기와 같은 drag 를 세웠다가 걷는다(좌석이 커서를 따라옴 · 클릭 받기 유지)');
  chk(/on\(prev, \+1\); on\(next, -1\);/.test(A) && /const over = !!\(c && c\.overflow\)/.test(A) && /id="roomBandPrev" class="room-band-arrow"/.test(SRC['desk-companion-prototype.html']) && /\.room-band-arrow\{/.test(SRC['desk-companion-prototype.html']), '◀ ▶ — 줄이 띠보다 길 때만 · 좌석 하나 폭쯤 넘기기 · 밝은/어두운 테마');
  chk(/window\.addEventListener\('lostpointercapture'/.test(A) && /window\.addEventListener\('blur', _rowDragEnd\)/.test(A), '끌기 끝: pointerup · cancel · lostpointercapture · blur');
  chk(/if\(\(\(_rowDrag && _rowDrag\.active\) \|\| _bandDrag\) && _ignoreSent === false\) return;/.test(A), '이름표 · 손잡이 끌기 중엔 클릭 받기 유지(캐릭터 끌기와 같은 조건)');
  chk(/window\.addEventListener\('wheel', e=>\{\n  if\(!_rowRoomMode \|\| e\.ctrlKey/.test(A), '휠: 방에서만 · Ctrl+휠(화면 크기)은 건드리지 않음');
  chk(/localStorage\.setItem\(ROOM_BAND_KEY, String\(roomBandFrac\)\)/.test(A) && /var ROOM_BAND_KEY = 'tw\.roomBandW';/.test(A) && /var ROOM_SEAT_MODE_KEY = 'tw\.roomSeatMode';/.test(A), '띠 폭 · 내 자리 설정 저장(tw. 접두사)');
  chk(/localStorage\.removeItem\(CHAR_POS_KEY\)/.test(A) && /localStorage\.removeItem\(ROOM_BAND_KEY\)/.test(A) && /roomBandFrac = SeatLayout\.BAND_DEFAULT_FRAC;/.test(A) && /if\(_rowLayout\) _rowLayout\.reset\(\);/.test(A), '창 위치 초기화: tw.deskPan · 띠 폭 · 메모리 값 · 줄 오프셋까지');
  chk(/if\(window\.companion && window\.companion\.firebaseEnv === 'dev'\)\{\n  window\.__devFakeSeats = /.test(A) && /Presence\.active\(\)\) return/.test(A), '가짜 사람은 dev 실행에서만 · 방 안에서는 막음');
  chk(/const UI_HIT_SEL = '[^']*#roomBandHandle, \.room-band-arrow, \.seat-nameplate'/.test(A), '클릭 통과 목록(UI_HIT_SEL)에 손잡이 · ◀ ▶ · 이름표');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

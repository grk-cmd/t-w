/* ═══ 🪑 sim-seat-layout.js — 방 좌석 줄: 나는 오른쪽 아래 · 나머지는 내 왼쪽 · 휠 · 이름표 끌기 (2026-10-09 신설) ═══
   제보: 방 인원이 많으면 줄이 오른쪽 화면 밖으로 나가고 내 캐릭터도 안 보인다 · 끌어도 되돌아온다.
   ・1절: 줄 순서 · 기본 자리(옛 식 그대로) — 1 · 4 · 10 · 20명
   ・2절: 화면 크기 · 비율 · 캐릭터 크기별로 — 나는 화면 안 · 오프셋 범위(다 들어가면 화면 안 · 넘치면 끝에서 끝까지)
   ・3절: 오프셋을 어디에 두어도 아무도 나와 안 겹치고 서로도 안 겹친다 · 건너간 사람은 내 오른쪽
   ・4절: 휠 · 끌기 값(5px 문턱 · 줄 단위 휠) · 프로그램 이동 좌우 범위
   ・5절: app.js 배선 · html 로드 순서 · 창 위치 초기화 · 개발용 가짜 사람
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

say('── 5. app.js 배선');
{
  const A = SRC['app.js'], H = SRC['desk-companion-prototype.html'];
  const iL = H.indexOf('<script src="parts/seat-layout.js">'), iA = H.indexOf('<script src="parts/app.js">');
  chk(iL > 0 && iL < iA, 'html: seat-layout.js 를 app.js 보다 먼저');
  chk(/_rowRoomMode = !!\(hasRemote && _anchor/.test(A) && /classList\.contains\('runmode'\)\);\n  if\(_rowRoomMode\) placed = SeatLayout\.orderRow\(placed, _anchor\);/.test(A), '방(실행 화면 · 다른 사람 있음)일 때만 나를 맨 앞으로 — 혼자일 때 순서 그대로');
  chk(/const camX = _rowRoomMode \? 0 : rowCenter;/.test(A) && /applyCameraAndCanvas\(camX, rowSpan\);\n  _applyRowOffset\(false\);/.test(A), '방에서는 카메라 기준점 = 내 자리 · 혼자는 줄 가운데(예전 그대로)');
  chk(/if\(_rowRoomMode && !_wasRoom\) _rowLayout\.reset\(\);/.test(A), '방에 들어올 때 오프셋 0');
  chk(/function updateCameraOnly\(\)\{\n  applyCameraAndCanvas\(_cachedRowCenter, _cachedRowSpan\);\n  _applyRowOffset\(false\);/.test(A), '캐릭터 크기만 바꿔도 줄 범위 다시 계산');
  chk(/_deskViewW = viewW;/.test(A) && !/_myPanHalfFrac\(\)/.test(A) && /const PAN_MARGIN   = _hfx != null \? _hfx : PAN_MARGIN_FALLBACK;/.test(A), '프로그램 이동 여백: 늘 null 이던 실측 대신 내 좌석 반폭(방) · 위아래는 그대로');
  chk(/el\.addEventListener\('pointerdown', e=>_rowDragStart\(e, seat\)\);/.test(A) && /_seatCtxMenu\(e, seat\);/.test(A), '이름표: 끌기 시작 + 우클릭 메뉴 그대로');
  chk(/if\(e\.button !== 0 \|\| !_rowRoomMode \|\| !_rowLayout \|\| !seat \|\| !seat\.remote\) return;/.test(A), '끌기는 방에서 · 남의 이름표 · 왼쪽 버튼만');
  chk(/if\(_rowDrag && _rowDrag\.active && _ignoreSent === false\) return;/.test(A), '끌기 중엔 클릭 받기 유지(캐릭터 끌기와 같은 조건)');
  chk(/window\.addEventListener\('wheel', e=>\{\n  if\(!_rowRoomMode \|\| e\.ctrlKey/.test(A), '휠: 방에서만 · Ctrl+휠(화면 크기)은 건드리지 않음');
  chk(/localStorage\.removeItem\(CHAR_POS_KEY\)/.test(A) && /deskPanX = 0; deskPanY = 0;\n    if\(_rowLayout\) _rowLayout\.reset\(\);/.test(A), '창 위치 초기화: tw.deskPan · 메모리 값 · 줄 오프셋까지');
  chk(/if\(window\.companion && window\.companion\.firebaseEnv === 'dev'\)\{\n  window\.__devFakeSeats = /.test(A) && /Presence\.active\(\)\) return/.test(A), '가짜 사람은 dev 실행에서만 · 방 안에서는 막음');
  chk(/const UI_HIT_SEL = '[^']*\.seat-nameplate'/.test(A), '클릭 통과 목록(UI_HIT_SEL)은 그대로');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

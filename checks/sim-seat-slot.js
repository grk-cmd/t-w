/* ═══ 🪑 sim-seat-slot.js — 좌석 크기 평준화 중 «책상 위» 파츠를 자기 자리 안으로 (2026-10-08 신설) ═══════════
   제보: 평준화를 켰을 때 바닥에 넓게 놓인 오브제 파츠가 다른 사람 자리를 침범한다.
   ・1절: clampShift 표 — 안쪽 · 왼쪽 넘침 · 오른쪽 넘침 · 자리보다 넓음(가운데) · 잘못된 값
   ・2절: clampParts 를 실제 three 로 — 배율 있는 부모 사슬(책상 그룹 · 앵커 · 핀) · 끄면 되돌림 ·
          밖에서 자리를 다시 잡으면(applyPartXf) 민 값을 두 번 빼지 않음 · 여러 번 돌려도 그대로
   ・3절: app.js 배선 — 평준화일 때만 · 자리 = 책상이 뻗은 거리 + 여백 절반 · 올라탄 좌석 제외 · 띄엄띄엄 · 저장값 안 건드림
   ・4절: html 로드
   ⚠️ 실제 좌석은 2026-10-08 헤드리스 크로미움에서 확인했다(넓은 파츠 -4~-2 → 평준화 켜면 자리 안 · 끄면 -4~-2 로 복귀).
   [실행] seat-slot.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. three 는 vendor/three/three.min.js. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['seat-slot.js', 'app.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const threePath = ['vendor/three/three.min.js', 'three.min.js'].find(p => fs.existsSync(p));
if(!threePath){ say('  ? 원본 못 찾음 — three.min.js'); process.exit(2); }
const THREE = require(require('path').resolve(threePath));
const win = {};
new Function('window', 'module', SRC['seat-slot.js'])(win, undefined);
const S = win.SeatSlot;
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-4);

say('── 1. clampShift');
chk(S.clampShift(-1, 1, -2, 2) === 0, '자리 안이면 그대로');
chk(near(S.clampShift(-3, -1, -2, 2), 1), '왼쪽으로 넘치면 오른쪽으로 민다');
chk(near(S.clampShift(1, 3, -2, 2), -1), '오른쪽으로 넘치면 왼쪽으로 민다');
chk(near(S.clampShift(-6, 0, -2, 2), 3), '자리보다 넓으면 가운데를 맞춘다');
chk(S.clampShift(NaN, 1, -2, 2) === 0 && S.clampShift(1, -1, -2, 2) === 0, '망가진 값이면 손대지 않는다');

say('── 2. clampParts (실제 three)');
const SL = S.createSeatSlot({ THREE });
/* 좌석 그룹(x=5) → 책상 그룹(배율 0.4) → 앵커(1/lx) → 핀(배율 1.2) → 파츠(폭 2 상자) */
function scene(px){
  const seat = new THREE.Group(); seat.position.x = 5;
  const desk = new THREE.Group(); desk.scale.set(0.4 * 1.5, 0.4, 0.4); seat.add(desk);
  const anchor = new THREE.Group(); anchor.scale.set(1 / 1.5, 1, 1); desk.add(anchor);
  const pin = new THREE.Group(); pin.scale.set(1.2, 1.2, 1.2); anchor.add(pin);
  const part = new THREE.Group(); part.add(new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 1), new THREE.MeshBasicMaterial()));
  part.position.x = px; pin.add(part);
  seat.updateMatrixWorld(true);
  return { seat, part };
}
const bx = (o) => { o.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(o); };
let sc = scene(-8);   // 월드 폭 = 2 × 0.4 × 1.2 = 0.96 · 중심 = 5 + (-8 × 0.48) = 1.16
const w0 = bx(sc.part);
chk(near(w0.max.x - w0.min.x, 0.96), '준비 — 파츠 월드 폭 0.96 (부모 배율 사슬)');
chk(SL.clampParts([sc.part], 5, 1.5, true) === 1, '자리 [3.5, 6.5] 밖이라 민다');
let w1 = bx(sc.part);
chk(near(w1.min.x, 3.5) && near(w1.max.x, 4.46), `왼쪽 끝이 자리 경계에 붙는다 (${w1.min.x.toFixed(3)} ~ ${w1.max.x.toFixed(3)})`);
SL.clampParts([sc.part], 5, 1.5, true); w1 = bx(sc.part);
chk(near(w1.min.x, 3.5), '여러 번 돌려도 같은 자리(민 값을 쌓지 않는다)');
SL.clampParts([sc.part], 5, 0, false);
chk(near(sc.part.position.x, -8), '끄면 원래 자리(저장값 위치)로 돌아간다');
SL.clampParts([sc.part], 5, 1.5, true);
sc.part.position.x = -7;   // 밖에서 다시 잡음(applyPartXf)
SL.clampParts([sc.part], 5, 0, false);
chk(near(sc.part.position.x, -7), '밖에서 자리를 다시 잡았으면 민 값을 빼지 않는다');
sc = scene(0);
chk(SL.clampParts([sc.part], 5, 1.5, true) === 0 && near(sc.part.position.x, 0), '자리 안 파츠는 안 건드린다');
sc = scene(-8);
SL.clampParts([sc.part], 5, 0.3, true); const w2 = bx(sc.part);
chk(near((w2.min.x + w2.max.x) / 2, 5), '자리보다 넓으면 좌석 가운데에 맞춘다');
const lone = new THREE.Group();
chk(SL.clampParts([lone, null], 5, 1, true) === 0, '부모 없는 파츠 · 빈 칸은 건너뛴다');

say('── 3. app.js 배선');
const APP = SRC['app.js'];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const A = strip(APP);
const grab = (src, name) => { const i = src.indexOf('function ' + name + '('); if(i < 0) return ''; let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };
const cp = grab(A, '_clampSeatDeskParts');
chk(/const on = !!\(seatEqualizeOn && !s\.ridingOn && s\.desk && s\.desk\.visible !== false\);/.test(cp), '평준화일 때만 · 올라탄 좌석(책상 숨음)은 제외');
chk(/const half = on \? seatDeskHalfWidth\(s\) \+ gap \/ 2 : 0;/.test(cp) && /const gap = seats\.some\(s=>s\.remote\) \? MULTIPLAYER_SPACING : SPACING;/.test(cp), '자리 = 책상이 뻗은 거리 + 좌석 사이 여백(layoutSeats 와 같은 값)의 절반');
chk(/getObjectByName\(DESK_PART_ANCHOR_NAME\)/.test(cp) && /o\.userData && o\.userData\.__twPartWrap/.test(cp), '대상은 «책상 위» 파츠 핀에 붙은 파츠 wrapper 만');
chk(/if\(t < _seatSlotNext\) return;/.test(cp) && /const SEAT_SLOT_EVERY_MS = 500;/.test(A), '띄엄띄엄(0.5초) — 박스 실측이라 매 프레임은 무겁다');
chk(/_clampSeatDeskParts\(now\);/.test(grab(A, 'frame')), '프레임 루프에서 부른다(평준화를 끄면 다음 차례에 되돌린다)');
chk(!/xf\.pos|setPartEntryInstanceXf|saveSlots/.test(cp), '저장값(xf) · 슬롯은 건드리지 않는다 — 내 화면에서만');
chk(/const seatSlot = \(typeof SeatSlot === 'undefined'\) \? null/.test(A) && /if\(!seatSlot\) return;/.test(cp), 'seat-slot.js 가 없어도 앱은 켜진다');

say('── 4. html');
const HTML = SRC['desk-companion-prototype.html'];
const iS = HTML.indexOf('<script src="parts/seat-slot.js">'), iA = HTML.indexOf('<script src="parts/app.js">');
chk(iS > 0 && iS < iA, 'seat-slot.js 를 app.js 앞에 싣는다');

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

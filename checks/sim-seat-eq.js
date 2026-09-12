/* sim-seat-eq.js — 🪑 좌석 크기 평준화 검증 (임시)
   smoke.js 의 스텁을 빌려 app.js 를 실제로 평가한 뒤, 평준화 배율이 캐릭터·책상에
   같은 값으로 걸리는지와 동물 40% 가 살아남는지를 본다. */
'use strict';
const fs = require('fs'), vm = require('vm');
let smokeSrc = fs.readFileSync('smoke.js', 'utf8');
smokeSrc = smokeSrc.slice(0, smokeSrc.indexOf('/* ── 실행'))
  .split('\n').filter(l => !/require\(|const FILE =|if \(!FILE\)|process\.exit/.test(l)).join('\n');
vm.runInThisContext(smokeSrc, { filename: 'smoke-stubs.js' });

const probe = `
;globalThis.__P = {
  seats, seatEqK, seatScale, setDeskScale, syncSeatEqualize,
  on: v => { seatEqualizeOn = v; },
  A: ANIMAL_RUN_SCALE,
};`;
const say = console.log; console.log = () => {}; console.warn = () => {};
try { vm.runInThisContext(fs.readFileSync('app.js', 'utf8') + probe, { filename: 'app.js' }); }
catch (e) { console.log = say; say('✗ app.js 평가 실패: ' + (e && e.stack || e)); process.exit(1); }
console.log = say;

const P = globalThis.__P;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const near = (a, b) => Math.abs(a - b) < 1e-9;

/* ⚠️ `position` 이 있어야 한다. `setDeskScale` 이 `syncSeatDeskZ` 를 부르고 그것이
     `deskGroup.position.z` 에 쓴다(㈏ 작업에서 생긴 경로) — 없으면 이 검사가 앱 문제가 아니라
     흉내 문제로 죽는다. `getObjectByName` 이 없으면 `syncDeskPartAnchor` 는 스스로 물러난다. */
function desk(animal){
  const d = {
    userData: { animCorr: animal ? P.A : 1 },
    position: { x:0, y:0, z:0, set(x,y,z){ d.position.x=x; d.position.y=y; d.position.z=z; } },
    scale: { x:1, y:1, z:1, set(x,y,z){ d._s = y; d.scale.x=x; d.scale.y=y; d.scale.z=z; } },
  };
  return d;
}
function seat(o){ return Object.assign({ userScale:1, desk:desk(!!o.animal), charDef:{ animal:!!o.animal } }, o); }

P.seats.length = 0;
const me     = seat({ isMe:true, userScale:1.0 });
const big    = seat({ userScale:1.5 });                 // 캐릭터 1.5 + 책상 1.5 (짝을 맞춰둔 사람)
const beast  = seat({ userScale:1.5, animal:true });     // 같은 크기의 동물
P.seats.push(me, big, beast);

say('=== 🪑 좌석 크기 평준화 ===');
P.on(false);
chk(P.seatEqK(big) === 1 && P.seatScale(big) === 1.5, '꺼져 있으면 아무 것도 안 바뀐다');

/* 실제 순서대로 — 좌석에 def 를 얹을 때 책상 크기가 한 번 걸리고(deskScaleBase 기억),
   그 뒤 layoutSeats 도입부의 syncSeatEqualize 가 배율을 심어 다시 건다. */
P.seats.forEach(s2 => P.setDeskScale(s2.desk, s2.userScale, 1));
P.on(true); P.seats.forEach(s2 => { s2._eqK = undefined; }); P.syncSeatEqualize();
chk(near(P.seatEqK(me), 1), '내 좌석에는 안 걸린다');
chk(near(P.seatEqK(big), 1 / 1.5), '남의 배율 k = 내 크기 ÷ 그 좌석 크기 (' + P.seatEqK(big).toFixed(3) + ')');
chk(near(P.seatScale(big), P.seatScale(me)), '캐릭터 크기가 내 것과 같아진다');

chk(near(big.desk._s, 1.0), '책상도 같은 k — 캐릭터:책상 비율 유지 (1.5→' + big.desk._s.toFixed(3) + ')');

chk(near(P.seatScale(beast), P.seatScale(me)), '동물도 캐릭터 크기는 평준화된다');
chk(near(beast.desk._s, 1.0 * P.A), '동물 책상은 40% 가 그대로 남는다 (' + beast.desk._s.toFixed(3) + ')');

/* 40% 는 fitModel 의 baseScale 에 있으므로, 같은 seatScale 이라도 화면 키는 40% 다 */
chk(near(P.seatScale(beast) * P.A, P.seatScale(me) * 0.4), '평준화 뒤에도 동물 몸높이 = 사람의 40%');

const small = seat({ userScale: 0.5 });
P.seats.push(small); P.setDeskScale(small.desk, 0.5, 1); P.syncSeatEqualize();
chk(near(P.seatScale(small), 1.0), '작게 맞춰둔 좌석은 커진다');
chk(near(small.desk._s, 1.0), '그 사람의 작은 책상도 같이 커진다');

/* 되돌리기 — 껐을 때 원래 크기로 정확히 돌아와야 한다(값이 누적되면 켤 때마다 커진다) */
P.on(false); P.syncSeatEqualize();
chk(near(P.seatScale(big), 1.5) && near(big.desk._s, 1.5), '끄면 원래 크기로 정확히 돌아온다 (' + big.desk._s.toFixed(3) + ')');
P.on(true); P.syncSeatEqualize(); P.on(false); P.syncSeatEqualize();
chk(near(big.desk._s, 1.5), '켰다 껐다를 반복해도 값이 누적되지 않는다 (' + big.desk._s.toFixed(3) + ')');

say('');
if (fail) { say('문제 ' + fail + '건'); process.exit(1); }
say('평준화 배율 전부 통과 ✅');

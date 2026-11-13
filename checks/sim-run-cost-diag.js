/* sim-run-cost-diag.js — 🩺 그리기 밖 시간(run-cost-diag.js · 1분 [비용] 줄 배선)
   실행:  node sim-run-cost-diag.js   (run-cost-diag.js · app.js · desk-companion-prototype.html 이 있는 폴더에서)
   ★ 왜 — «실행 화면 렌더러가 frame() 밖에서 초당 수백 ms CPU 를 쓴다(창을 내려도)» 를 진단 기록으로 가르려면
     하트비트 · 통과 판정 · patch · 좌석 맞춤 · 한 장 쪼갬이 맞게 모여야 한다. 숫자가 틀리면(비우지 않음 · 이상한 값 섞음 ·
     나머지가 음수 · 줄이 잘림) 판단이 틀린다.
   ・1절: createRunCostDiag(가짜 시계) — 더하기 · 세기 · since · timed(던져도 잼 · 돌려준 값 그대로) · take 뒤 비움 · 이상한 값 버림
   ・2절: countSeats · roomKind — 빈 값 · 숨긴 몸 · 자리비움 · 반짝임(.lvx · .np-star) · 숨긴 꾸밈은 안 셈 · 방 종류
   ・3절: line — 0 · 나머지 = 한 장 − 좌석 − 그리기(음수면 0) · 밖 초당 · 큰 값에도 200자 안 · [프레임] 줄로 안 읽힘
   ・4절: 깨 보기 — 갈래를 하나씩 바꾼 모듈로 1~3절을 다시 돌려 빨강이 나는지
   ・5절: 배선 — html 이 app.js 앞에 싣는다(firebase-init.js 는 module 이라 늦게 돈다) · smoke PRELOAD · 재는 자리 · 1분 줄 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'parts/shared/' + f, 'parts/room/' + f, 'parts/launcher/' + f, 'app/' + f, 'app/parts/' + f, 'app/parts/shared/' + f, 'app/parts/room/' + f, 'app/parts/launcher/' + f, 'checks/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('run-cost-diag.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
const RUN = read('desktop-run.js'), ENTRY = read('room-entry.js'), NET = read('room-server-net.js'), FBI = read('firebase-init.js');
if (!MOD || !APP || !HTML || !SMOKE || !RUN || !ENTRY || !NET || !FBI) { say('  ? 원본 못 찾음 — run-cost-diag.js · app.js · html · smoke.js · desktop-run.js · room-entry.js · room-server-net.js · firebase-init.js'); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', 'performance', src)(w, undefined, { now: () => 0 }); return w.TwRunCostDiag; };
const near = (a, b) => Math.abs(a - b) < 1e-9;

function runCore(T){
  const r = [];
  let t = 1000;
  const c = T.createRunCostDiag({ now: () => t });
  c.add('hb', 2); c.add('hb', 6); c.count('patch'); c.count('patch'); c.count('patch');
  t = 1010; c.since('seat', 1004);
  const a = c.take();
  r[0] = a.hb.n === 2 && near(a.hb.sum, 8) && a.hb.max === 6 && a.patch.n === 3 && a.seat.n === 1 && near(a.seat.sum, 6);
  t = 61010;
  const b = c.take();
  r[1] = b.hb.n === 0 && b.hb.sum === 0 && b.hb.max === 0 && b.patch.n === 0 && near(b.sec, 60);
  c.add('hb', NaN); c.add('hb', -1); c.add('hb', Infinity); c.add('hb', undefined);
  r[2] = c.take().hb.n === 0;
  // timed — 걸린 시간 · 돌려준 값 · this · 인자 · 던져도 잰다
  const f = c.timed('sync', function(x){ t += 5; return this.k + x; });
  const got = f.call({ k: 10 }, 3);
  let threw = false;
  const g = c.timed('sync', () => { t += 7; throw new Error('x'); });
  try { g(); } catch (_) { threw = true; }
  const s = c.take().sync;
  r[3] = got === 13 && threw && s.n === 2 && near(s.sum, 12) && s.max === 7;
  // 처음 take 도 sec 가 0 이 아니다(나눗셈)
  const c2 = T.createRunCostDiag({ now: () => 5 });
  r[4] = c2.take().sec > 0;
  return r;
}

function fakeEl(display, className, star){
  return { style: { display }, className, querySelector: (q) => (q === '.np-star' && star) ? {} : null };
}
function runSeats(T){
  const r = [];
  const z = T.countSeats([]), n = T.countSeats(null);
  r[0] = z.all === 0 && z.body === 0 && z.shiny === 0 && n.all === 0;
  const seats = [
    { rig: { visible: true }, _lastOp: 1, expBarEl: fakeEl('block', 'seat-exp t7 lvx'), namePlateEl: fakeEl('block', '', false) },   // 몸 · 반짝(바)
    { rig: { visible: false }, _lastOp: 1 },                                                                                          // 숨김
    { rig: { visible: true }, _lastOp: 0, namePlateEl: fakeEl('block', '', true) },                                                 // 자리비움 · 반짝(별)
    { rig: { visible: true }, expBarEl: fakeEl('none', 'seat-exp lvx'), namePlateEl: fakeEl('none', '', true) },                     // 몸 · 꾸밈 숨김
    { rig: { visible: true }, expBarEl: fakeEl('block', 'seat-exp t6 lvxx') },                                                      // 몸 · lvx 아님
    null,
  ];
  const c = T.countSeats(seats);
  r[1] = c.all === 5;
  r[2] = c.body === 3;
  r[3] = c.shiny === 2;
  r[4] = T.roomKind(null, 2) === '혼자' && T.roomKind('', 1) === '혼자' && T.roomKind('PLAY-AB12', 2) === '투게더룸' && T.roomKind('WORK-AB12', 1) === '워킹룸';
  return r;
}

function runLine(T){
  const r = [];
  const zero = T.line(T.createRunCostDiag({ now: () => 0 }).take(), T.countSeats([]), T.roomKind(null, 1));
  r[0] = zero.indexOf(T.TAG + ' ') === 0 && /하트비트 0회 0\.00\/0\.00ms/.test(zero) && /patch 0/.test(zero) && /· 혼자$/.test(zero);
  const S = (n, sum, max) => ({ n, sum, max });
  const rr = { sec: 60, hb: S(600, 120, 3), hit: S(1200, 60, 1.5), sync: S(30, 60, 9), patch: S(40, 0, 0),
    frame: S(1000, 3000, 20), seat: S(1000, 1000, 5), render: S(1000, 1500, 8) };
  const l = T.line(rr, { all: 8, body: 6, shiny: 2 }, '워킹룸');
  // 밖 초당 = (120 + 60 + 60) / 60 = 4 · 한 장 3 = 좌석 1 + 그리기 1.5 + 나머지 0.5
  r[1] = /밖 초당 4\.00ms/.test(l) && /한 장 1000 좌석 1\.00 그리기 1\.50 나머지 0\.50ms/.test(l);
  r[2] = /하트비트 600회 0\.20\/3\.00ms/.test(l) && /통과 1200회 0\.05\/1\.50ms/.test(l) && /patch 40/.test(l)
    && /맞춤 30회 합 60\.0 최대 9\.00ms/.test(l) && /좌석 8 몸 6 반짝 2 · 워킹룸$/.test(l);
  // 나머지가 음수로 안 간다(재는 틈 — 좌석 + 그리기가 한 장보다 조금 클 수 있다)
  const neg = T.line({ sec: 60, frame: S(10, 10, 1), seat: S(10, 8, 1), render: S(10, 5, 1) }, null, '혼자');
  r[3] = /나머지 0\.00ms/.test(neg);
  const big = S(999999, 99999, 9999);
  const huge = T.line({ sec: 60, hb: big, hit: big, sync: big, patch: big, frame: big, seat: big, render: big }, { all: 99, body: 99, shiny: 99 }, '투게더룸');
  r[4] = huge.length <= T.LINE_MAX && /투게더룸$/.test(huge);
  r[5] = zero.indexOf('[프레임]') !== 0;   // main 은 [프레임] 로 시작하는 줄에만 앞 창 꼬리를 붙인다
  return r;
}

const T = load(MOD);
say('── 1. createRunCostDiag(가짜 시계)');
const s1 = runCore(T);
chk(s1[0], '더하기 · 세기 · since — 횟수 · 합 · 최대');
chk(s1[1], 'take 뒤 비움 · 지난 take 부터의 초');
chk(s1[2], 'NaN · 음수 · 무한대 · 빈 값은 버림');
chk(s1[3], 'timed — 걸린 시간 · 돌려준 값 · this · 인자 그대로, 던져도 잰다');
chk(s1[4], '처음 take 도 초가 0 이 아니다');
say('── 2. countSeats · roomKind');
const s2 = runSeats(T);
chk(s2[0], '빈 목록 · null 은 0');
chk(s2[1], '전체 좌석(빈 칸은 안 셈)');
chk(s2[2], '보이는 몸 — 숨긴 rig · 자리비움(투명)은 빼고');
chk(s2[3], '반짝임 — .lvx 바 · .np-star 이름표, 숨긴 꾸밈 · lvx 비슷한 이름은 안 셈');
chk(s2[4], '방 종류 — 코드 없으면 혼자 · 채널 2 투게더룸 · 아니면 워킹룸');
say('── 3. line');
const s3 = runLine(T);
chk(s3[0], '0 이면 0 으로 적는다 · 태그로 시작 · 방 종류로 끝');
chk(s3[1], '밖 초당 · 한 장 = 좌석 + 그리기 + 나머지');
chk(s3[2], '하트비트 · 통과 평균/최대 · patch · 맞춤 합 · 좌석 수');
chk(s3[3], '나머지는 음수로 안 간다');
chk(s3[4], '큰 값에도 ' + T.LINE_MAX + '자 안(main 이 자르는 길이)');
chk(s3[5], '[프레임] 줄로 안 읽힌다');

say('── 4. 깨 보기');
const BREAKS = [
  ['take 뒤 안 비움', 'reset(); since = t;', 'since = t;', () => !runCore(load(brk))[1]],
  ['이상한 값도 받음', 'if(!(ms >= 0) || !isFinite(ms)) return;', '', () => !runCore(load(brk))[2]],
  ['던지면 안 잼', 'try{ return fn.apply(this, arguments); }\n      finally{ add(key, now() - t0); }', 'const v = fn.apply(this, arguments); add(key, now() - t0); return v;', () => !runCore(load(brk))[3]],
  ['자리비움도 몸으로', ' && !(s._lastOp < 0.001)', '', () => !runSeats(load(brk))[2]],
  ['숨긴 꾸밈도 셈', "return !!el && !(el.style && el.style.display === 'none');", 'return !!el;', () => !runSeats(load(brk))[3]],
  ['채널 무시', 'return channel === 2 ? ROOM.play : ROOM.work;', 'return ROOM.work;', () => !runSeats(load(brk))[4]],
  ['나머지 음수 허용', 'const rest = Math.max(0, per(fr) - per(r.seat) - per(r.render));', 'const rest = per(fr) - per(r.seat) - per(r.render);', () => !runLine(load(brk))[3]],
  ['밖에 맞춤 빠짐', 'const outside = (out(hb) + out(hit) + out(sync)) / sec;', 'const outside = (out(hb) + out(hit)) / sec;', () => !runLine(load(brk))[1]],
  ['길이 안 자름', 'return s.length > LINE_MAX ? s.slice(0, LINE_MAX) : s;', "return s + ' '.repeat(LINE_MAX);", () => !runLine(load(brk))[4]],
];
let brk = '';
for (const [name, from, to, red] of BREAKS){
  if (!MOD.includes(from)){ chk(false, '깨 보기 «' + name + '» — 바꿀 글을 못 찾음'); continue; }
  brk = MOD.replace(from, to);
  let ok = false; try { ok = red(); } catch (_) { ok = true; }
  chk(ok, '깨 보기 «' + name + '» → 빨강');
}

say('── 5. 배선');
const iM = HTML.indexOf('<script src="parts/shared/run-cost-diag.js">'), iA = HTML.indexOf('<script src="parts/app.js">');
chk(iM > 0 && iA > iM && HTML.includes('<script type="module" src="parts/firebase-init.js">'), 'html 이 run-cost-diag.js 를 app.js 보다 먼저 싣는다(firebase-init.js 는 module 이라 classic 뒤에 돈다)');
chk(/PRELOAD\.push\('run-cost-diag\.js'\)/.test(SMOKE), 'smoke PRELOAD 에 run-cost-diag.js');
chk(/const runCost = TwRunCostDiag\.page;/.test(APP) && /setInterval\(runCost\.timed\('hb', \(\)=>\{[\s\S]{0,2500}?companion\.setCharBounds\([\s\S]{0,1500}?\}\), 100\);/.test(APP), '하트비트(100ms)를 통째로 잰다');
chk(/const _tSeat = performance\.now\(\);\s*seats\.forEach\(/.test(APP) && /runCost\.since\('seat', _tSeat\)/.test(APP), '좌석 반복을 잰다');
chk(/const _tDraw = performance\.now\(\);\s*if\(!_officeHidden[^\n]*renderer\.render\(scene,camera\)[^\n]*\n\s*runCost\.since\('render', _tDraw\);/.test(APP), '그리기를 잰다');
chk(/runCost\.since\('frame', _frameT0\)/.test(APP), '한 장 전체를 잰다');
const iTake = APP.indexOf('run = runCost.take()'), iRun = APP.indexOf("if(!document.body.classList.contains('runmode')) return;", APP.indexOf('takeMinute(t)'));
const iLine = APP.indexOf('companion.diagNote(TwRunCostDiag.line(run, TwRunCostDiag.countSeats(seats), TwRunCostDiag.roomKind(Presence.roomCode(), window._activeChannel)))');
chk(iTake > 0 && iRun > iTake, '1분 몫은 실행 화면이 아니어도 비운다(실행 화면 확인보다 먼저 take)');
const iFrame = APP.indexOf('companion.diagNote(_FB.diagLine(m) + TwGpuTimer.suffix(cost));');
chk(iLine > iRun && iFrame > iLine && iFrame - iLine < 400, '[비용] 줄은 [프레임] 줄과 같은 조건(실행 화면 — 창을 내려도 runmode 그대로)에서 바로 앞에 적는다');
chk(/const runCost = deps\.runCost;/.test(RUN) && /_hitPerf\.maxMs = d;\s*runCost\.add\('hit', d\);/.test(RUN), '통과 판정 — 기존 _hitPerf 자리에서 더한다');
chk(/const syncFriendSeatsTimed = runCost\.timed\('sync', syncFriendSeats\);/.test(ENTRY) && /syncFriendSeatsTimed\(friends\)/.test(ENTRY) && /syncFriendSeats: syncFriendSeatsTimed,/.test(ENTRY), '좌석 맞춤 — 부르는 곳 둘(provider 변경 · app.js 복원)이 잰 것을 부른다');
chk(/case 'patch': \{\s*notePatch\(\);/.test(NET) && /notePatch: \(\) => TwRunCostDiag\.page\.count\('patch'\)/.test(FBI), 'patch — 방 서버가 받을 때마다 센다');
chk(/runCost: runCost,/.test(APP.slice(APP.indexOf('TwRoomEntry.createRoomEntry({'), APP.indexOf('});', APP.indexOf('TwRoomEntry.createRoomEntry({')))) && /runCost: runCost,/.test(APP.slice(APP.indexOf('TwDesktopRun.createDesktopRun({'), APP.indexOf('});', APP.indexOf('TwDesktopRun.createDesktopRun({')))), 'room-entry · desktop-run 에 deps 로 넘긴다');

say('');
say(fail ? '✗ ' + fail + '개 실패 · ' + pass + '개 통과' : '✓ ' + pass + '개 모두 통과');
process.exit(fail ? 1 : 0);

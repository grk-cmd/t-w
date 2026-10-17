/* ═══ 🗼 sim-ride-bench.js — 🗼 올라타기(탑) · 벤치 좌석 자리 잡기 · 🪑 멀티좌석 책상(2·3인승 벤치 모듈 구조 (2026-10-14 신설 · 앱 FSD 30번) ═══════════════
   app.js 의 «🗼 올라타기» · «🪑 멀티좌석 책상» 두 구역 본문 을 parts/room/ride-bench.js 로 옮겼다(글자 그대로 · 바뀐 줄 6 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(올라타기 · 벤치를 보던 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(_checkCircusBalance · _remeasureRideHeadTop · _resetIdeskRestore · _rideBottom · _rideDepth · _rideIsAbove · _rideLeaveTower · _rideRiders · _updateRideChains · attachBenchToSeat · findBenchSlot · mountBench · mountRide · restoreInteractionDesk · toggleIdeskInventory · unmountBench · unmountRide)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 68줄 그대로(몸 재기 measureBodyBox · isPartByRigOrName 더함) · 부르는 곳은 rideBenchMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · ride-bench.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["ride-bench.js","parts/room/ride-bench.js","app/parts/room/ride-bench.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — ride-bench.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_collapseRideTower","_deskDefById","_measureAnimalArmH","_measureCircusFootOff","_rideBottom","_rideHostSpinY","broadcastRide","charLiftWorld","getActiveInteractionDeskId","isDeskUnlocked","isPartByRigOrName","layoutSeats","measureBodyBox","measureHeadBoxNoParts","seatScale","seatState","setActiveInteractionDeskId","toast"];
const VAL_DEPS = ["ANIMAL_RUN_SCALE","CIRCUS_FOOT_CENTER","CIRCUS_FOOT_SINK","CIRCUS_FOOT_Z","CIRCUS_FOOT_Z_FROM_TOP","CIRCUS_MIN_DEPTH","CIRCUS_PANIC_MS","CIRCUS_PANIC_SLEEPERS","CIRCUS_SWAY_CALM","CIRCUS_SWAY_PANIC","CIRCUS_SWAY_SPEED","CIRCUS_TOP_SLAB","CIRCUS_TREMOR_AMP","CIRCUS_TREMOR_AT","CIRCUS_TREMOR_CALMDOWN","CIRCUS_TREMOR_SPD","CIRCUS_YAW_MAX","CIRCUS_YAW_MIN","CIRCUS_YAW_RANDOM","CIRCUS_Z_DEPTH_K_ON_ANIMAL","RIDE_ARM_SINK","RIDE_ARM_SINK_ON_ANIMAL","RIDE_ARM_SIZE_FOLLOW","RIDE_FOLLOW_HEAD_TILT","RIDE_HEAD_OFFSET_Y","RIDE_HEAD_OFFSET_Z","RIDE_HEAD_OFFSET_Z_ON_ANIMAL","RIDE_MAX_STACK","RIDE_PART_CENTER_MARGIN","RIDE_Z_DEPTH_K_ON_ANIMAL","_rideAwayP","_rideAwayS","_rideAxisY","_rideFootOff","_rideOff","_rideQC","_rideQD","_rideQP","_rideQR","_rideQSpin","_rideQY","_rideTmp","_rideWP","matWood","matWoodD","seats"];
const GET_DEPS = ["IDESK_ENABLED","INTERACTION_DESKS","Presence","savedParts"];
const SET_DEPS = [];
const EXPORTS = ["_checkCircusBalance","_remeasureRideHeadTop","_resetIdeskRestore","_rideBottom","_rideDepth","_rideIsAbove","_rideLeaveTower","_rideRiders","_updateRideChains","attachBenchToSeat","findBenchSlot","mountBench","mountRide","restoreInteractionDesk","toggleIdeskInventory","unmountBench","unmountRide"];
const MOVED = ["_checkCircusBalance","_updateRideChains","_benchWP","_benchQ","_benchGP","_positionBenchSeat","_positionRideSeat","_rideDepth","_rideIsAbove","_rideRiders","_rideBottom","_partAllowsRideTop","_measureRideablePartTop","_measureHostHeadTop","_remeasureRideHeadTop","mountRide","_rideQuietToast","_rideLeaveTower","unmountRide","BENCH_SNAP_DIST","buildPrimitiveBench","_readBenchSlots","attachBenchToSeat","equipInteractionDesk","unequipInteractionDesk","findBenchSlot","mountBench","unmountBench","removeMyBench","_ideskRestored","restoreInteractionDesk","_resetIdeskRestore","_ideskInRoom","renderIdeskInventory","openIdeskInventory","closeIdeskInventory","_ideskOpen","toggleIdeskInventory","IDESK_POS_KEY","_saveIdeskPos","_restoreIdeskPos"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  ANIMAL_RUN_SCALE: ANIMAL_RUN_SCALE,","  CIRCUS_FOOT_CENTER: CIRCUS_FOOT_CENTER,","  CIRCUS_FOOT_SINK: CIRCUS_FOOT_SINK,","  CIRCUS_FOOT_Z: CIRCUS_FOOT_Z,","  CIRCUS_FOOT_Z_FROM_TOP: CIRCUS_FOOT_Z_FROM_TOP,","  CIRCUS_MIN_DEPTH: CIRCUS_MIN_DEPTH,","  CIRCUS_PANIC_MS: CIRCUS_PANIC_MS,","  CIRCUS_PANIC_SLEEPERS: CIRCUS_PANIC_SLEEPERS,","  CIRCUS_SWAY_CALM: CIRCUS_SWAY_CALM,","  CIRCUS_SWAY_PANIC: CIRCUS_SWAY_PANIC,","  CIRCUS_SWAY_SPEED: CIRCUS_SWAY_SPEED,","  CIRCUS_TOP_SLAB: CIRCUS_TOP_SLAB,","  CIRCUS_TREMOR_AMP: CIRCUS_TREMOR_AMP,","  CIRCUS_TREMOR_AT: CIRCUS_TREMOR_AT,","  CIRCUS_TREMOR_CALMDOWN: CIRCUS_TREMOR_CALMDOWN,","  CIRCUS_TREMOR_SPD: CIRCUS_TREMOR_SPD,","  CIRCUS_YAW_MAX: CIRCUS_YAW_MAX,","  CIRCUS_YAW_MIN: CIRCUS_YAW_MIN,","  CIRCUS_YAW_RANDOM: CIRCUS_YAW_RANDOM,","  CIRCUS_Z_DEPTH_K_ON_ANIMAL: CIRCUS_Z_DEPTH_K_ON_ANIMAL,","  IDESK_ENABLED: ()=>IDESK_ENABLED,","  INTERACTION_DESKS: ()=>INTERACTION_DESKS,","  Presence: ()=>Presence,","  RIDE_ARM_SINK: RIDE_ARM_SINK,","  RIDE_ARM_SINK_ON_ANIMAL: RIDE_ARM_SINK_ON_ANIMAL,","  RIDE_ARM_SIZE_FOLLOW: RIDE_ARM_SIZE_FOLLOW,","  RIDE_FOLLOW_HEAD_TILT: RIDE_FOLLOW_HEAD_TILT,","  RIDE_HEAD_OFFSET_Y: RIDE_HEAD_OFFSET_Y,","  RIDE_HEAD_OFFSET_Z: RIDE_HEAD_OFFSET_Z,","  RIDE_HEAD_OFFSET_Z_ON_ANIMAL: RIDE_HEAD_OFFSET_Z_ON_ANIMAL,","  RIDE_MAX_STACK: RIDE_MAX_STACK,","  RIDE_PART_CENTER_MARGIN: RIDE_PART_CENTER_MARGIN,","  RIDE_Z_DEPTH_K_ON_ANIMAL: RIDE_Z_DEPTH_K_ON_ANIMAL,","  _collapseRideTower: (...a)=>_collapseRideTower(...a),","  _deskDefById: (...a)=>_deskDefById(...a),","  _measureAnimalArmH: (...a)=>_measureAnimalArmH(...a),","  _measureCircusFootOff: (...a)=>_measureCircusFootOff(...a),","  _rideAwayP: _rideAwayP,","  _rideAwayS: _rideAwayS,","  _rideAxisY: _rideAxisY,","  _rideBottom: (...a)=>_rideBottom(...a),","  _rideFootOff: _rideFootOff,","  _rideHostSpinY: (...a)=>_rideHostSpinY(...a),","  _rideOff: _rideOff,","  _rideQC: _rideQC,","  _rideQD: _rideQD,","  _rideQP: _rideQP,","  _rideQR: _rideQR,","  _rideQSpin: _rideQSpin,","  _rideQY: _rideQY,","  _rideTmp: _rideTmp,","  _rideWP: _rideWP,","  broadcastRide: (...a)=>broadcastRide(...a),","  charLiftWorld: (...a)=>charLiftWorld(...a),","  getActiveInteractionDeskId: (...a)=>getActiveInteractionDeskId(...a),","  isDeskUnlocked: (...a)=>isDeskUnlocked(...a),","  isPartByRigOrName: (...a)=>bodyMeasureMod.isPartByRigOrName(...a),","  layoutSeats: (...a)=>layoutSeats(...a),","  matWood: matWood,","  matWoodD: matWoodD,","  measureBodyBox: (...a)=>bodyMeasureMod.measureBodyBox(...a),","  measureHeadBoxNoParts: (...a)=>measureHeadBoxNoParts(...a),","  savedParts: ()=>savedParts,","  seatScale: (...a)=>seatScale(...a),","  seatState: (...a)=>seatState(...a),","  seats: seats,","  setActiveInteractionDeskId: (...a)=>setActiveInteractionDeskId(...a),","  toast: (...a)=>toast(...a),"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다.
   then 도 받는다 — 만들 때 부르는 서버 요청(.then 잇기)이 던지지 않게(풀리지는 않는다) */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
function build(src){
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'module',
    src + '\nreturn window.TwRideBench;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, undefined);
  return api.createRideBench(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwRideBench = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwRideBench(Tw 접두사)');
  const A = strip(app);
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("RIDE_BENCH_MOD_OFF") && app.includes("const rideBenchMod = TwRideBench.createRideBench({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const rideBenchMod = TwRideBench\\.createRideBench\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = mk.split('\n').map(kindOf);
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  const bare = EXPORTS.filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const rideBenchMod = [\s\S]*?\n\}\);/, '')));
  t(!bare.length, '부르는 곳은 rideBenchMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/room/ride-bench.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/room/ride-bench.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/room/ride-bench.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  ['deps 하나 빠짐', null, a => { const i = a.indexOf("const rideBenchMod = TwRideBench.createRideBench({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }, null],
  ['전역 이름 안 걺', m => m.replace('window.TwRideBench = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* app.js 에 남은 부르는 자리 하나를 옛 이름으로 되돌린다 — 첫 이름을 부르던 곳이 다른 모듈로 옮겨 갔을 수 있어 남은 이름 중에서 고른다 */
  ['부르는 곳이 옛 이름', null, a => { const n = EXPORTS.find(x => a.includes('rideBenchMod.' + x)); return n ? a.replace('rideBenchMod.' + n, n) : a; }, null],
  ['만들 때 던짐', m => m.replace('function createRideBench(deps){', 'function createRideBench(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

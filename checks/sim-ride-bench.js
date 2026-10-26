/* ═══ 🗼 sim-ride-bench.js — 🗼 올라타기(탑) · 벤치 좌석 자리 잡기 · 🪑 멀티좌석 책상(2·3인승 벤치 모듈 구조 (2026-10-14 신설 · 앱 FSD 30번) ═══════════════
   app.js 의 «🗼 올라타기» · «🪑 멀티좌석 책상» 두 구역 본문 을 parts/room/ride-bench.js 로 옮겼다(글자 그대로 · 바뀐 줄 6 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(올라타기 · 벤치를 보던 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(_checkCircusBalance · _remeasureRideArm · _remeasureRideHeadTop · _resetIdeskRestore · _rideBottom · _rideDepth · _rideIsAbove · _rideLeaveTower · _rideRiders · _updateRideChains · attachBenchToSeat · findBenchSlot · mountBench · mountRide · restoreInteractionDesk · toggleIdeskInventory · unmountBench · unmountRide)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 69줄 그대로(진단 기록 diagNote · 몸 재기 measureBodyBox · isPartByRigOrName 더함) · 부르는 곳은 rideBenchMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   ・4절: 올라탄 높이 다시 재기 — 실패하면 옛 높이 그대로 · 진단 기록 한 줄 / 성공하면 탄 좌석 모두 새 값 · 다음 프레임 검증 줄(작은 가짜 THREE · 깨 보기)
   ・6절: 탑 맨 아래 사람이 나가면 위층도 바닥으로 — 높이 0 · 묘기 자세 풀림 · 내 좌석이면 «내렸다» 방송(깨 보기)
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

const FN_DEPS = ["_collapseRideTower","_deskDefById","_measureAnimalArmH","_measureCircusFootOff","_rideBottom","_rideHostSpinY","broadcastRide","charLiftWorld","diagNote","getActiveInteractionDeskId","isDeskUnlocked","isPartByRigOrName","layoutSeats","measureBodyBox","measureHeadBoxNoParts","seatScale","seatState","setActiveInteractionDeskId","toast"];
const VAL_DEPS = ["ANIMAL_RUN_SCALE","CIRCUS_FOOT_CENTER","CIRCUS_FOOT_SINK","CIRCUS_FOOT_Z","CIRCUS_FOOT_Z_FROM_TOP","CIRCUS_MIN_DEPTH","CIRCUS_PANIC_MS","CIRCUS_PANIC_SLEEPERS","CIRCUS_SWAY_CALM","CIRCUS_SWAY_PANIC","CIRCUS_SWAY_SPEED","CIRCUS_TOP_SLAB","CIRCUS_TREMOR_AMP","CIRCUS_TREMOR_AT","CIRCUS_TREMOR_CALMDOWN","CIRCUS_TREMOR_SPD","CIRCUS_YAW_MAX","CIRCUS_YAW_MIN","CIRCUS_YAW_RANDOM","CIRCUS_Z_DEPTH_K_ON_ANIMAL","RIDE_ARM_SINK","RIDE_ARM_SINK_ON_ANIMAL","RIDE_ARM_SIZE_FOLLOW","RIDE_FOLLOW_HEAD_TILT","RIDE_HEAD_OFFSET_Y","RIDE_HEAD_OFFSET_Z","RIDE_HEAD_OFFSET_Z_ON_ANIMAL","RIDE_MAX_STACK","RIDE_PART_CENTER_MARGIN","RIDE_Z_DEPTH_K_ON_ANIMAL","_rideAwayP","_rideAwayS","_rideAxisY","_rideFootOff","_rideOff","_rideQC","_rideQD","_rideQP","_rideQR","_rideQSpin","_rideQY","_rideTmp","_rideWP","matWood","matWoodD","seats"];
const GET_DEPS = ["IDESK_ENABLED","INTERACTION_DESKS","Presence","savedParts"];
const SET_DEPS = [];
const EXPORTS = ["_checkCircusBalance","_remeasureRideArm","_remeasureRideHeadTop","_resetIdeskRestore","_rideBottom","_rideDepth","_rideIsAbove","_rideLeaveTower","_rideRiders","_updateRideChains","attachBenchToSeat","findBenchSlot","mountBench","mountRide","restoreInteractionDesk","toggleIdeskInventory","unmountBench","unmountRide"];
const MOVED = ["_checkCircusBalance","_updateRideChains","_benchWP","_benchQ","_benchGP","_positionBenchSeat","_positionRideSeat","_rideDepth","_rideIsAbove","_rideRiders","_rideBottom","_partAllowsRideTop","_measureRideablePartTop","_measureHostHeadTop","_remeasureRideArm","_remeasureRideHeadTop","mountRide","_rideQuietToast","_rideLeaveTower","unmountRide","BENCH_SNAP_DIST","buildPrimitiveBench","_readBenchSlots","attachBenchToSeat","equipInteractionDesk","unequipInteractionDesk","findBenchSlot","mountBench","unmountBench","removeMyBench","_ideskRestored","restoreInteractionDesk","_resetIdeskRestore","_ideskInRoom","renderIdeskInventory","openIdeskInventory","closeIdeskInventory","_ideskOpen","toggleIdeskInventory","IDESK_POS_KEY","_saveIdeskPos","_restoreIdeskPos"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  ANIMAL_RUN_SCALE: ANIMAL_RUN_SCALE,","  CIRCUS_FOOT_CENTER: CIRCUS_FOOT_CENTER,","  CIRCUS_FOOT_SINK: CIRCUS_FOOT_SINK,","  CIRCUS_FOOT_Z: CIRCUS_FOOT_Z,","  CIRCUS_FOOT_Z_FROM_TOP: CIRCUS_FOOT_Z_FROM_TOP,","  CIRCUS_MIN_DEPTH: CIRCUS_MIN_DEPTH,","  CIRCUS_PANIC_MS: CIRCUS_PANIC_MS,","  CIRCUS_PANIC_SLEEPERS: CIRCUS_PANIC_SLEEPERS,","  CIRCUS_SWAY_CALM: CIRCUS_SWAY_CALM,","  CIRCUS_SWAY_PANIC: CIRCUS_SWAY_PANIC,","  CIRCUS_SWAY_SPEED: CIRCUS_SWAY_SPEED,","  CIRCUS_TOP_SLAB: CIRCUS_TOP_SLAB,","  CIRCUS_TREMOR_AMP: CIRCUS_TREMOR_AMP,","  CIRCUS_TREMOR_AT: CIRCUS_TREMOR_AT,","  CIRCUS_TREMOR_CALMDOWN: CIRCUS_TREMOR_CALMDOWN,","  CIRCUS_TREMOR_SPD: CIRCUS_TREMOR_SPD,","  CIRCUS_YAW_MAX: CIRCUS_YAW_MAX,","  CIRCUS_YAW_MIN: CIRCUS_YAW_MIN,","  CIRCUS_YAW_RANDOM: CIRCUS_YAW_RANDOM,","  CIRCUS_Z_DEPTH_K_ON_ANIMAL: CIRCUS_Z_DEPTH_K_ON_ANIMAL,","  IDESK_ENABLED: ()=>IDESK_ENABLED,","  INTERACTION_DESKS: ()=>INTERACTION_DESKS,","  Presence: ()=>Presence,","  RIDE_ARM_SINK: RIDE_ARM_SINK,","  RIDE_ARM_SINK_ON_ANIMAL: RIDE_ARM_SINK_ON_ANIMAL,","  RIDE_ARM_SIZE_FOLLOW: RIDE_ARM_SIZE_FOLLOW,","  RIDE_FOLLOW_HEAD_TILT: RIDE_FOLLOW_HEAD_TILT,","  RIDE_HEAD_OFFSET_Y: RIDE_HEAD_OFFSET_Y,","  RIDE_HEAD_OFFSET_Z: RIDE_HEAD_OFFSET_Z,","  RIDE_HEAD_OFFSET_Z_ON_ANIMAL: RIDE_HEAD_OFFSET_Z_ON_ANIMAL,","  RIDE_MAX_STACK: RIDE_MAX_STACK,","  RIDE_PART_CENTER_MARGIN: RIDE_PART_CENTER_MARGIN,","  RIDE_Z_DEPTH_K_ON_ANIMAL: RIDE_Z_DEPTH_K_ON_ANIMAL,","  _collapseRideTower: (...a)=>_collapseRideTower(...a),","  _deskDefById: (...a)=>_deskDefById(...a),","  _measureAnimalArmH: (...a)=>_measureAnimalArmH(...a),","  _measureCircusFootOff: (...a)=>_measureCircusFootOff(...a),","  _rideAwayP: _rideAwayP,","  _rideAwayS: _rideAwayS,","  _rideAxisY: _rideAxisY,","  _rideBottom: (...a)=>_rideBottom(...a),","  _rideFootOff: _rideFootOff,","  _rideHostSpinY: (...a)=>_rideHostSpinY(...a),","  _rideOff: _rideOff,","  _rideQC: _rideQC,","  _rideQD: _rideQD,","  _rideQP: _rideQP,","  _rideQR: _rideQR,","  _rideQSpin: _rideQSpin,","  _rideQY: _rideQY,","  _rideTmp: _rideTmp,","  _rideWP: _rideWP,","  broadcastRide: (...a)=>broadcastRide(...a),","  charLiftWorld: (...a)=>charLiftWorld(...a),","  diagNote: (...a)=>diagNote(...a),","  getActiveInteractionDeskId: (...a)=>getActiveInteractionDeskId(...a),","  isDeskUnlocked: (...a)=>isDeskUnlocked(...a),","  isPartByRigOrName: (...a)=>bodyMeasureMod.isPartByRigOrName(...a),","  layoutSeats: (...a)=>layoutSeats(...a),","  matWood: matWood,","  matWoodD: matWoodD,","  measureBodyBox: (...a)=>bodyMeasureMod.measureBodyBox(...a),","  measureHeadBoxNoParts: (...a)=>measureHeadBoxNoParts(...a),","  savedParts: ()=>savedParts,","  seatScale: (...a)=>seatScale(...a),","  seatState: (...a)=>seatState(...a),","  seats: seats,","  setActiveInteractionDeskId: (...a)=>setActiveInteractionDeskId(...a),","  toast: (...a)=>toast(...a),"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다.
   then 도 받는다 — 만들 때 부르는 서버 요청(.then 잇기)이 던지지 않게(풀리지는 않는다) */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
function build(src, over, three){
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
    src + '\nreturn window.TwRideBench;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, three || any, undefined);
  return api.createRideBench(Object.assign(deps, over || {}));
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
say('── 4. 올라탄 높이 다시 재기가 실패하면 진단 기록에 남긴다(설치본은 콘솔을 못 본다)');
/* 대상 머리 박스가 비면 _measureHostHeadTop 이 null — 옛 값은 그대로 두고 진단 한 줄 */
function judgeRemeasure(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  try{
    const notes = [];
    const host = { gltfRoot: { traverse(){} }, bones: { head: {} }, group: { quaternion: { clone(){ return { }; }, identity(){} }, updateMatrixWorld(){} } };
    const rider = { ridingOn: host, _rideHeadTop: 0.5, _rideHeadTopPart: 0.9 };
    const mod = build(src, { seats: [host, rider], diagNote: (m) => notes.push(m), measureHeadBoxNoParts: () => ({ isEmpty: () => true }) });
    mod._remeasureRideHeadTop(host);
    t(notes.some(m => /다시 재기 실패/.test(m)) && rider._rideHeadTop === 0.5 && rider._rideHeadTopPart === 0.9, '재기 실패 — 옛 높이 그대로 · 진단 기록 «다시 재기 실패» 한 줄');
    const n0 = notes.length;
    build(src, { seats: [host], diagNote: (m) => notes.push(m) })._remeasureRideHeadTop(host);
    t(notes.length === n0, '  아무도 안 타고 있으면 재지도 · 기록하지도 않는다');
    /* 성공 길 — 작은 가짜 THREE 위에서 머리 박스(y 1.0~1.4 · 머리 본 y 1.0)를 재 탄 좌석 모두에 새 값 + 다음 프레임 검증 줄 */
    class V3 { constructor(x = 0, y = 0, z = 0){ this.x = x; this.y = y; this.z = z; } set(x, y, z){ this.x = x; this.y = y; this.z = z; return this; } copy(v){ return this.set(v.x, v.y, v.z); } clone(){ return new V3(this.x, this.y, this.z); } }
    class Box3 { constructor(){ this.min = new V3(Infinity, Infinity, Infinity); this.max = new V3(-Infinity, -Infinity, -Infinity); }
      isEmpty(){ return this.max.y < this.min.y; } union(b){ if(b && !b.isEmpty()){ ['x','y','z'].forEach(k => { this.min[k] = Math.min(this.min[k], b.min[k]); this.max[k] = Math.max(this.max[k], b.max[k]); }); } return this; } setFromObject(){ return this; } }
    const head = new Box3(); head.min.set(-0.1, 1.0, -0.1); head.max.set(0.1, 1.4, 0.1);
    const q = { clone(){ return { }; }, identity(){}, copy(){} };
    const host2 = { charDef: {}, gltfRoot: { traverse(){} }, bones: { head: { getWorldPosition(v){ return v.set(0, 1.0, 0); } } }, group: { quaternion: q, updateMatrixWorld(){} } };
    const r1 = { ridingOn: host2, _rideHeadTop: 0.9, _rideHeadTopPart: 0.9 }, r2 = { ridingOn: host2, _rideHeadTop: 0.9 };
    const notes2 = [];
    const mod2 = build(src, { seats: [host2, r1, r2], diagNote: (m) => notes2.push(m), measureHeadBoxNoParts: () => head, measureBodyBox: () => new Box3(), savedParts: () => [] }, new Proxy({ Box3, Vector3: V3 }, { get: (o, k) => (k in o ? o[k] : anything()) }));   // 재기에 쓰는 둘만 진짜 — 모듈 머리의 나머지는 받아 주기만
    mod2._remeasureRideHeadTop(host2);
    const near = (a, b) => typeof a === 'number' && Math.abs(a - b) < 1e-9;
    t(near(r1._rideHeadTop, 0.4) && near(r2._rideHeadTop, 0.4) && r1._rideDbgOnce === true && r2._rideDbgOnce === true && r1._rideHeadTopPart === null && !notes2.length,
      '★ 다시 재기 성공 — 탄 좌석 모두 새 머리 높이(0.4) · 파츠 꼭대기 걷음 · 다음 프레임 검증 줄 켬 · 실패 기록 없음');
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 80)); }
  return r;
}
judgeRemeasure(MOD).forEach(([ok, msg]) => chk(ok, msg));
{
  const m2 = MOD.replace(/if\(v == null\)\{ diagNote\([^)]*\); return; \}/, 'if(v == null) return;');
  let rows2; try{ rows2 = judgeRemeasure(m2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(m2 !== MOD && rows2.some(([ok]) => !ok), '깨 보기 — 실패 기록 줄을 빼면 빨강' + (m2 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
}
say('── 4-2. 다시 재기에서 파츠 꼭대기를 못 잡아도 같은 «얹을 수 있음» 파츠가 그대로면 옛 높이를 둔다(모자 위 동물이 파묻히던 것)');
/* 대상 머리 박스 y 1.0~1.4 · 머리 본 y 1.0. 모자 wrapper 하나(id hat · 얹을 수 있음) — 박스가 머리 중심을 덮으면 꼭대기 1.6(→ 0.6), 옆으로 비켜 있으면 못 잡음 */
function judgeKeep(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  try{
    class V3 { constructor(x = 0, y = 0, z = 0){ this.x = x; this.y = y; this.z = z; } set(x, y, z){ this.x = x; this.y = y; this.z = z; return this; } copy(v){ return this.set(v.x, v.y, v.z); } clone(){ return new V3(this.x, this.y, this.z); } }
    class Box3 { constructor(){ this.min = new V3(Infinity, Infinity, Infinity); this.max = new V3(-Infinity, -Infinity, -Infinity); }
      isEmpty(){ return this.max.y < this.min.y; } clone(){ const b = new Box3(); b.min = this.min.clone(); b.max = this.max.clone(); return b; }
      union(b){ if(b && !b.isEmpty()){ ['x','y','z'].forEach(k => { this.min[k] = Math.min(this.min[k], b.min[k]); this.max[k] = Math.max(this.max[k], b.max[k]); }); } return this; } setFromObject(){ return this; } }
    const box = (x0, x1, y0, y1, z0, z1) => { const b = new Box3(); b.min.set(x0, y0, z0); b.max.set(x1, y1, z1); return b; };
    const mkHost = (wraps) => ({ charDef: {}, bones: { head: { getWorldPosition(v){ return v.set(0, 1.0, 0); } } }, group: { quaternion: { clone(){ return {}; }, identity(){}, copy(){} }, updateMatrixWorld(){} },
      gltfRoot: { traverse(cb){ wraps.forEach(w => cb(w)); } } });
    const mkMod = (seats, notes) => {
      const head = box(-0.1, 0.1, 1.0, 1.4, -0.1, 0.1);
      return build(src, { seats, diagNote: (m) => notes.push(m),
        measureHeadBoxNoParts: (root, out) => { if(out) out.push(head); return head.clone(); },
        measureBodyBox: (o) => o._box ? o._box.clone() : new Box3(),
        savedParts: () => [{ id: 'hat', rideTop: true }, { id: 'cap', rideTop: true }],
        _rideBottom: (x) => { let b = x, g = 0; while(b && b.ridingOn && g++ < 16) b = b.ridingOn; return b; }, RIDE_MAX_STACK: 5,
        _measureAnimalArmH: () => 0.3, seatScale: () => 1, layoutSeats: () => {} },
        new Proxy({ Box3, Vector3: V3 }, { get: (o, k) => (k in o ? o[k] : anything()) }));
    };
    const run = ({ wraps, riderPart, riderKey }) => {
      const notes = [];
      const host = mkHost(wraps);
      const rider = { ridingOn: host, _rideHeadTop: 0.4, _rideHeadTopPart: riderPart, _rideHeadTopPartKey: riderKey };
      mkMod([host, rider], notes)._remeasureRideHeadTop(host);
      return { rider, notes };
    };
    const hatOn  = { visible: true, userData: { __twPartWrap: true, partId: 'hat' }, _box: box(-0.2, 0.2, 1.3, 1.6, -0.2, 0.2) };
    const hatOff = { visible: true, userData: { __twPartWrap: true, partId: 'hat' }, _box: box(0.05, 0.4, 1.3, 1.6, -0.2, 0.2) };   // 그 순간 판정에서 빗나감
    const near = (a, b) => typeof a === 'number' && Math.abs(a - b) < 1e-9;
    const a = run({ wraps: [hatOn], riderPart: null, riderKey: '' });
    t(near(a.rider._rideHeadTopPart, 0.6) && a.rider._rideHeadTopPartKey === 'hat', '모자를 잡으면 — 파츠 꼭대기(0.6) · 붙은 파츠 묶음(hat) 기억');
    const b = run({ wraps: [hatOff], riderPart: 0.6, riderKey: 'hat' });
    t(near(b.rider._rideHeadTopPart, 0.6) && b.notes.some(m => /옛 높이 유지/.test(m)), '★ 같은 모자가 그대로인데 이번에 못 잡음 — 옛 높이(0.6) 유지 · 진단 기록 한 줄');
    const c = run({ wraps: [], riderPart: 0.6, riderKey: 'hat' });
    t(c.rider._rideHeadTopPart === null && c.rider._rideHeadTopPartKey === '', '  모자를 뺐으면 — 걷는다(머리 위로)');
    const d = run({ wraps: [Object.assign({}, hatOff, { visible: false })], riderPart: 0.6, riderKey: 'hat' });
    t(d.rider._rideHeadTopPart === null, '  모자를 숨겼으면(꾸미기 파츠 끄기) — 걷는다');
    const e = run({ wraps: [{ visible: true, userData: { __twPartWrap: true, partId: 'cap' }, _box: box(0.05, 0.4, 1.3, 1.6, -0.2, 0.2) }], riderPart: 0.6, riderKey: 'hat' });
    t(e.rider._rideHeadTopPart === null && e.rider._rideHeadTopPartKey === 'cap', '  다른 파츠로 바꿨는데 못 잡음 — 걷는다(옛 모자 높이를 새 파츠에 쓰지 않는다)');
    const f = run({ wraps: [hatOff], riderPart: null, riderKey: 'hat' });
    t(f.rider._rideHeadTopPart === null, '  처음부터 파츠 위가 아니었으면 — 그대로 null');
    /* 실제 길 — 모자가 머리 중심을 덮을 때 mountRide 로 얹고, 이어서 판정이 빗나가는 순간에 다시 잰다 */
    {
      const notes = [], wraps = [hatOn];
      const host = mkHost(wraps);
      const animal = { charDef: { animal: true }, remote: true, desk: null, group: { quaternion: { identity(){} } } };
      const mod = mkMod([host, animal], notes);
      const ok = mod.mountRide(animal, host);
      const atMount = animal._rideHeadTopPart;
      wraps[0] = hatOff;
      mod._remeasureRideHeadTop(host);
      t(ok === true && near(atMount, 0.6) && animal._rideHeadTopPartKey === 'hat' && near(animal._rideHeadTopPart, 0.6),
        '★ mountRide 로 모자 위(0.6)에 얹고 · 다음 다시 재기가 빗나가도 얹을 때 높이 그대로');
    }
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 100)); }
  return r;
}
judgeKeep(MOD).forEach(([ok, msg]) => chk(ok, msg));
for(const [name, a, b] of [
  ['못 잡으면 늘 걷음(예전)', '      r._rideHeadTopPart = _keepRidePartTop(r, vp, key);', '      r._rideHeadTopPart = vp;'],
  ['파츠 묶음을 안 봄', '  if(old == null || !key || rider._rideHeadTopPartKey !== key) return null;', '  if(old == null) return null;'],
  ['mountRide 가 묶음을 안 적음', '  animalSeat._rideHeadTopPartKey = _rideTopPartKey(hostSeat);\n', ''],
]){
  const m2 = MOD.replace(a, b);
  let rows2; try{ rows2 = judgeKeep(m2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(m2 !== MOD && rows2.some(([ok]) => !ok), '깨 보기 — ' + name + (m2 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
}
say('── 5. 탄 동물이 다시 맞춰지면 팔 높이도 다시 잰다(파츠 붙음 · 뗌 · 동물 바꿈 — mountRide 의 1회 실측은 파츠 전 값일 수 있다)');
function judgeArm(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  try{
    const notes = []; let arm = 0.7;
    const host = {};
    const mod = build(src, { seats: [host], diagNote: (m) => notes.push(m), _measureAnimalArmH: () => arm });
    const a = { ridingOn: host, _rideArmH: 0.3 };
    mod._remeasureRideArm(a);
    t(a._rideArmH === 0.7 && a._rideDbgOnce === true, '★ 탄 동물 — 새 팔 높이(0.3 → 0.7) · 다음 프레임 검증 줄');
    const c = { ridingOn: host, _rideArmH: 0.3, _circusOn: true }; mod._remeasureRideArm(c);
    const n = { _rideArmH: null }; mod._remeasureRideArm(n);
    t(c._rideArmH === 0.3 && n._rideArmH === null && !notes.length, '  묘기(2층+) 자세 · 안 탄 좌석은 재지 않는다');
    arm = null; const f = { ridingOn: host, _rideArmH: 0.3 }; mod._remeasureRideArm(f);
    t(f._rideArmH === 0.3 && notes.some(m => /팔 높이 다시 재기 실패/.test(m)), '  재기 실패 — 옛 값 그대로 · 진단 기록 한 줄');
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 80)); }
  return r;
}
judgeArm(MOD).forEach(([ok, msg]) => chk(ok, msg));
for(const [name, a, b] of [
  ['새 값을 안 심음', '  seat._rideArmH = h;\n', ''],
  ['묘기 자세에서도 잼', 'if(!seat || !seat.ridingOn || seat._circusOn) return;', 'if(!seat || !seat.ridingOn) return;'],
]){
  const m2 = MOD.replace(a, b);
  let rows2; try{ rows2 = judgeArm(m2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(m2 !== MOD && rows2.some(([ok]) => !ok), '깨 보기 — ' + name + (m2 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
}
{
  const m3 = MOD.replace(' r._rideDbgOnce = true;', '');
  let rows3; try{ rows3 = judgeRemeasure(m3); }catch(_){ rows3 = [[false, '던짐']]; }
  chk(m3 !== MOD && rows3.some(([ok]) => !ok), '깨 보기 — 다시 잰 뒤 검증 줄을 안 켜면 빨강' + (m3 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
}
say('── 6. 탑 맨 아래 사람이 나가면 위층도 바닥으로(내려앉힐 곳이 없을 때의 하차)');
/* 나 → X → B 에서 B 가 방을 나가면 프레임 루프가 unmountRide(X) 를 부른다(app.js «태운 대상이 방을 나감»).
   X 위의 «나» 는 내려앉힐 B 가 없으니 하차해야 한다 — 높이 0 · 묘기 자세 풀림 · 내 좌석이면 «내렸다» 방송. */
function judgeTowerDrop(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  /* 올라타기는 동물만 된다 — 위층을 다시 얹는 갈래(mountRide)까지 타게 동물 좌석으로 만든다. 사람(동물 아님)은 그 갈래에서 거절돼 바닥으로 */
  const mk = (o) => Object.assign({ charDef: { animal: true }, group: { position: { x: 0, y: 1, z: 0 }, quaternion: { identity(){} }, rotation: { set(){} } }, desk: null }, o);
  const run = (make) => {
    const calls = { cast: 0 }, seats = [];
    const S = make(seats);
    const bottom = (x) => { let p = x, g = 0; while(p && p.ridingOn && g++ < 16) p = p.ridingOn; return p; };
    build(src, { seats, RIDE_MAX_STACK: 5, broadcastRide: () => { calls.cast++; }, layoutSeats: () => {}, toast: () => {}, _rideBottom: bottom, _measureAnimalArmH: () => 0.5, seatScale: () => 1 }).unmountRide(S.X);
    return Object.assign(S, { cast: calls.cast });
  };
  const floor = (s) => s.ridingOn === null && s.group.position.y === 0 && s._circusOn === false;
  try{
    /* ① 나 → X → B, 내 위에 남의 동물 top. B 가 나가서 seats 에 없다 */
    const a = run(seats => { const B = mk({ remote: true }), X = mk({ remote: true, ridingOn: B }), me = mk({ ridingOn: X, _circusOn: true }), top = mk({ remote: true, ridingOn: me });
      seats.push(X, me, top); return { X, me, top }; });
    t(a.X.ridingOn === null && a.X.group.position.y === 0, 'X(아래 대상이 나감) — 내려와 높이 0');
    t(floor(a.me), '★ X 위의 나 — 탄 상태 풀림 · 높이 0 · 묘기 자세 풀림(공중에 안 남는다)');
    t(a.cast === 1, '★ 내 좌석이 내려왔으니 «내렸다» 를 한 번 방송한다(남의 화면에서도 내려온다)');
    t(a.top.ridingOn === a.X, '  내 위에 있던 동물은 «내가 있던 자리» 의 아래(X — 이제 바닥)로 내려앉는다');
    /* ② 나 → Y → X → B — 나는 맨 위(4층) */
    const b = run(seats => { const B = mk({ remote: true }), X = mk({ remote: true, ridingOn: B }), Y = mk({ remote: true, ridingOn: X, _circusOn: true }), me = mk({ ridingOn: Y, _circusOn: true });
      seats.push(X, Y, me); return { X, Y, me }; });
    t(floor(b.Y) && b.me.ridingOn === b.X && b.cast === 1, '  맨 위의 나 — 가운데 Y 는 바닥 · 나는 X 위로 내려앉고 «탔다» 를 한 번 방송');
    /* ③ 위층이 사람(동물 아님) — 다시 얹기가 거절돼도 공중에 안 남는다 */
    const c = run(seats => { const B = mk({ remote: true }), X = mk({ remote: true, ridingOn: B }), me = mk({ ridingOn: X, charDef: {}, _circusOn: true }), Y = mk({ remote: true, ridingOn: me, charDef: {} });
      seats.push(X, me, Y); return { X, me, Y }; });
    t(floor(c.me) && floor(c.Y), '  다시 얹기가 거절되는 위층(사람)도 바닥으로 — 공중에 안 남는다');
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 80)); }
  return r;
}
judgeTowerDrop(MOD).forEach(([ok, msg]) => chk(ok, msg));
{
  const m2 = MOD.replace('      up.ridingOn = animalSeat;\n      unmountRide(up);', '      up.ridingOn = null;\n      unmountRide(up);');
  let rows2; try{ rows2 = judgeTowerDrop(m2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(m2 !== MOD && rows2.some(([ok]) => !ok), '깨 보기 — 탄 대상을 비운 채 하차를 부르면(옛 모양) 빨강' + (m2 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

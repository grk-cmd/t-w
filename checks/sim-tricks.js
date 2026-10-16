/* ═══ 💃 sim-tricks.js — 💃 깜짝쇼(날아가기 · 어지러움 · 연속) · 🪄 때리기(말풍선 · 재생 · 방 전파 · 조준 모드) 모듈 구조 (2026-10-14 신설 · 앱 FSD 25번) ═══════════════
   app.js 의 «💃 깜짝쇼» · «🪄 때리기» 세 구역 본문 을 parts/room/tricks.js 로 옮겼다(글자 그대로 · 바뀐 줄 26 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(sim-fly-* · 때리기 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(BONK_BUBBLE_IMG · BONK_BUBBLE_MARK · BONK_BUBBLE_PX · BONK_CURSOR_IMG · BONK_DAILY_MAX · BONK_DAY_KEY · _bonkAimClick · _bonkAiming · _bonkFrame · _bonkLeft · _eggCountCmd · _eggFire · _eggReadyFor · _flyAimClick · _flyAiming · _flyChatLog · _myFlyCoolUntil · _updateFlyingSeats · applyRemoteBonk · applyRemoteFly · bonkSeat · setBonkAiming · setFlyAiming)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 42줄 그대로 · 부르는 곳은 tricksMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · tricks.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["tricks.js","parts/room/tricks.js","app/parts/room/tricks.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — tricks.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_hitsSkipHidden","_premiumOn","_rideIsAbove","_rideLeaveTower","_seatLabelName","_skipHiddenDesk","_todayStr","canFly","flySeed","getDisplayName","getMyUserId","seatCharZ","seatFromObject","seatScale","showChatBubble","spawnFloater","startFlight","toast"];
const VAL_DEPS = ["ANIMAL_RUN_SCALE","CHAR_Z","FLY_COOL_MS","FLY_DIZZY_MS","FLY_DROP","FLY_EDGE_TOP","FLY_EDGE_X","FLY_MS","FLY_RETURN_MS","FLY_STREAK","FLY_STREAK_MS","camera","canvas","seats"];
const GET_DEPS = ["FLOATER_BURST","Presence","_bonkSnd","_flyActive","creatorOpen","ndc","officeMode","purikuraUi","ray"];
const SET_DEPS = ["_flyActive"];
const EXPORTS = ["BONK_BUBBLE_IMG","BONK_BUBBLE_MARK","BONK_BUBBLE_PX","BONK_CURSOR_IMG","BONK_DAILY_MAX","BONK_DAY_KEY","_bonkAimClick","_bonkAiming","_bonkFrame","_bonkLeft","_eggCountCmd","_eggFire","_eggReadyFor","_flyAimClick","_flyAiming","_flyChatLog","_myFlyCoolUntil","_updateFlyingSeats","applyRemoteBonk","applyRemoteFly","bonkSeat","setBonkAiming","setFlyAiming"];
const MOVED = ["EGG_WINDOW_MS","EGG_DANCE_N","_eggCmdAt","_eggCountCmd","_eggReadyFor","_eggReady","_eggFire","_myFlyCoolUntil","canTargetFly","_flyAiming","setFlyAiming","_flyAimClick","throwFlyAt","_flyChatLog","applyRemoteFly","registerFlyHit","_myFlyHits","_myFlyLastHit","_flyV","_flyBox","_flyW","FLY_PROBE_FALLBACK","_flyProbeY","_flyNdc","_updateFlyingSeats","endFlight","BONK_FLAT_MS","BONK_SPRING_MS","BONK_FLAT_Q","BONK_DIZZY_MS","BONK_DAILY_MAX","BONK_DAY_KEY","_bonkDayRec","_bonkLeft","_bonkUse","_bonkQ","_bonkFrame","_bonkPlaySound","BONK_BUBBLE_MARK","BONK_BUBBLE_PX","BONK_BUBBLE_IMG","_bonkHitterSeat","_bonkPlay","canBonk","bonkSeat","applyRemoteBonk","BONK_CURSOR_IMG","BONK_CURSOR","_bonkAiming","setBonkAiming","_bonkAimClick"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  ANIMAL_RUN_SCALE: ANIMAL_RUN_SCALE,","  CHAR_Z: CHAR_Z,","  FLOATER_BURST: ()=>FLOATER_BURST,","  FLY_COOL_MS: FLY_COOL_MS,","  FLY_DIZZY_MS: FLY_DIZZY_MS,","  FLY_DROP: FLY_DROP,","  FLY_EDGE_TOP: FLY_EDGE_TOP,","  FLY_EDGE_X: FLY_EDGE_X,","  FLY_MS: FLY_MS,","  FLY_RETURN_MS: FLY_RETURN_MS,","  FLY_STREAK: FLY_STREAK,","  FLY_STREAK_MS: FLY_STREAK_MS,","  Presence: ()=>Presence,","  _bonkSnd: ()=>_bonkSnd,","  _flyActive: ()=>_flyActive,","  _hitsSkipHidden: (...a)=>_hitsSkipHidden(...a),","  _premiumOn: (...a)=>_premiumOn(...a),","  _rideIsAbove: (...a)=>_rideIsAbove(...a),","  _rideLeaveTower: (...a)=>_rideLeaveTower(...a),","  _seatLabelName: (...a)=>_seatLabelName(...a),","  _skipHiddenDesk: (...a)=>_skipHiddenDesk(...a),","  _todayStr: (...a)=>_todayStr(...a),","  camera: camera,","  canFly: (...a)=>canFly(...a),","  canvas: canvas,","  creatorOpen: ()=>creatorOpen,","  flySeed: (...a)=>flySeed(...a),","  getDisplayName: (...a)=>getDisplayName(...a),","  getMyUserId: (...a)=>getMyUserId(...a),","  ndc: ()=>ndc,","  officeMode: ()=>officeMode,","  purikuraUi: ()=>purikuraUi,","  ray: ()=>ray,","  seatCharZ: (...a)=>seatCharZ(...a),","  seatFromObject: (...a)=>seatFromObject(...a),","  seatScale: (...a)=>seatScale(...a),","  seats: seats,","  showChatBubble: (...a)=>showChatBubble(...a),","  spawnFloater: (...a)=>spawnFloater(...a),","  startFlight: (...a)=>startFlight(...a),","  toast: (...a)=>toast(...a),","  setFlyActive: (v)=>{ _flyActive = v; },"];

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
    src + '\nreturn window.TwTricks;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, undefined);
  return api.createTricks(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwTricks = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwTricks(Tw 접두사)');
  const A = strip(app);
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("TRICKS_MOD_OFF") && app.includes("const tricksMod = TwTricks.createTricks({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const tricksMod = TwTricks\\.createTricks\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = mk.split('\n').map(kindOf);
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  const bare = EXPORTS.filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const tricksMod = [\s\S]*?\n\}\);/, '')));
  t(!bare.length, '부르는 곳은 tricksMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/room/tricks.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/room/tricks.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/room/tricks.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  ['deps 하나 빠짐', null, a => { const i = a.indexOf("const tricksMod = TwTricks.createTricks({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }, null],
  ['전역 이름 안 걺', m => m.replace('window.TwTricks = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* app.js 에 남은 부르는 자리 하나를 옛 이름으로 되돌린다 — 첫 이름을 부르던 곳이 다른 모듈로 옮겨 갔을 수 있어 남은 이름 중에서 고른다 */
  ['부르는 곳이 옛 이름', null, a => { const n = EXPORTS.find(x => a.includes('tricksMod.' + x)); return n ? a.replace('tricksMod.' + n, n) : a; }, null],
  ['만들 때 던짐', m => m.replace('function createTricks(deps){', 'function createTricks(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

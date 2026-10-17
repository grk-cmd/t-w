/* ═══ 🎛️ sim-ride-tuning.js — 🎛️ 올라타기 · 묘기 튜닝 값 모듈 구조 (2026-10-16 신설 · 구역 떼기 C · w1) ═══════════════
   app.js 의 올라타기 · 묘기 튜닝 값 을 parts/room/ride-tuning.js 로 옮겼다(글자 그대로 · 바뀐 줄 0 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(4절 — 값 표 50개가 옮기기 전과 같다).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(CIRCUS_ARM_DROP · CIRCUS_ARM_SPREAD · CIRCUS_DIZZY_MS · CIRCUS_FOOT_CENTER · CIRCUS_FOOT_SINK · CIRCUS_FOOT_Z · CIRCUS_FOOT_Z_FROM_TOP · CIRCUS_LEG_LIFT · CIRCUS_LEG_STAND · CIRCUS_LEG_WAG · CIRCUS_LEG_WAG_SPD · CIRCUS_MIN_DEPTH · CIRCUS_PANIC_MS · CIRCUS_PANIC_SLEEPERS · CIRCUS_SWAY_CALM · CIRCUS_SWAY_PANIC · CIRCUS_SWAY_SPEED · CIRCUS_TOP_SLAB · CIRCUS_TREMOR_AMP · CIRCUS_TREMOR_AT · CIRCUS_TREMOR_CALMDOWN · CIRCUS_TREMOR_SPD · CIRCUS_YAW_MAX · CIRCUS_YAW_MIN · CIRCUS_YAW_RANDOM · CIRCUS_Z_DEPTH_K_ON_ANIMAL · RIDE_ARM_SINK · RIDE_ARM_SINK_ON_ANIMAL · RIDE_ARM_SIZE_FOLLOW · RIDE_FOLLOW_HEAD_TILT · RIDE_HEAD_OFFSET_Y · RIDE_HEAD_OFFSET_Z · RIDE_HEAD_OFFSET_Z_ON_ANIMAL · RIDE_MAX_STACK · RIDE_PART_CENTER_MARGIN · RIDE_SNAP_DIST · RIDE_Z_DEPTH_K_ON_ANIMAL · _rideAwayP · _rideAwayS · _rideAxisY · _rideFootOff · _rideOff · _rideQC · _rideQD · _rideQP · _rideQR · _rideQSpin · _rideQY · _rideTmp · _rideWP)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 0줄 그대로 · 부르는 곳은 rideTuneMod.이름 · html(app.js 앞)
   ・4절: 동작 — 순수 판정 · 가짜 객체로 입력 → 출력 · 경계값(옮기기 전 app.js 글로도 같은 판정이 돈다)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · ride-tuning.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["ride-tuning.js","parts/room/ride-tuning.js","app/parts/room/ride-tuning.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — ride-tuning.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = [];
const VAL_DEPS = [];
const GET_DEPS = [];
const SET_DEPS = [];
const EXPORTS = ["CIRCUS_ARM_DROP","CIRCUS_ARM_SPREAD","CIRCUS_DIZZY_MS","CIRCUS_FOOT_CENTER","CIRCUS_FOOT_SINK","CIRCUS_FOOT_Z","CIRCUS_FOOT_Z_FROM_TOP","CIRCUS_LEG_LIFT","CIRCUS_LEG_STAND","CIRCUS_LEG_WAG","CIRCUS_LEG_WAG_SPD","CIRCUS_MIN_DEPTH","CIRCUS_PANIC_MS","CIRCUS_PANIC_SLEEPERS","CIRCUS_SWAY_CALM","CIRCUS_SWAY_PANIC","CIRCUS_SWAY_SPEED","CIRCUS_TOP_SLAB","CIRCUS_TREMOR_AMP","CIRCUS_TREMOR_AT","CIRCUS_TREMOR_CALMDOWN","CIRCUS_TREMOR_SPD","CIRCUS_YAW_MAX","CIRCUS_YAW_MIN","CIRCUS_YAW_RANDOM","CIRCUS_Z_DEPTH_K_ON_ANIMAL","RIDE_ARM_SINK","RIDE_ARM_SINK_ON_ANIMAL","RIDE_ARM_SIZE_FOLLOW","RIDE_FOLLOW_HEAD_TILT","RIDE_HEAD_OFFSET_Y","RIDE_HEAD_OFFSET_Z","RIDE_HEAD_OFFSET_Z_ON_ANIMAL","RIDE_MAX_STACK","RIDE_PART_CENTER_MARGIN","RIDE_SNAP_DIST","RIDE_Z_DEPTH_K_ON_ANIMAL","_rideAwayP","_rideAwayS","_rideAxisY","_rideFootOff","_rideOff","_rideQC","_rideQD","_rideQP","_rideQR","_rideQSpin","_rideQY","_rideTmp","_rideWP"];
const MOVED = ["RIDE_ARM_SIZE_FOLLOW","RIDE_ARM_SINK","RIDE_ARM_SINK_ON_ANIMAL","CIRCUS_MIN_DEPTH","CIRCUS_FOOT_SINK","CIRCUS_ARM_SPREAD","CIRCUS_ARM_DROP","CIRCUS_SWAY_CALM","CIRCUS_SWAY_PANIC","CIRCUS_SWAY_SPEED","CIRCUS_PANIC_SLEEPERS","CIRCUS_PANIC_MS","CIRCUS_TREMOR_AT","CIRCUS_TREMOR_CALMDOWN","CIRCUS_TREMOR_AMP","CIRCUS_TREMOR_SPD","CIRCUS_DIZZY_MS","CIRCUS_YAW_MIN","CIRCUS_YAW_MAX","CIRCUS_YAW_RANDOM","CIRCUS_FOOT_Z","CIRCUS_TOP_SLAB","RIDE_PART_CENTER_MARGIN","CIRCUS_FOOT_Z_FROM_TOP","CIRCUS_FOOT_CENTER","_rideFootOff","CIRCUS_LEG_STAND","CIRCUS_LEG_LIFT","CIRCUS_LEG_WAG","CIRCUS_LEG_WAG_SPD","RIDE_HEAD_OFFSET_Z","RIDE_HEAD_OFFSET_Z_ON_ANIMAL","RIDE_Z_DEPTH_K_ON_ANIMAL","CIRCUS_Z_DEPTH_K_ON_ANIMAL","RIDE_HEAD_OFFSET_Y","RIDE_FOLLOW_HEAD_TILT","RIDE_SNAP_DIST","_rideWP","_rideTmp","_rideOff","_rideAwayP","_rideAwayS","_rideQD","_rideQP","_rideQR","_rideQC","_rideQY","_rideAxisY","_rideQSpin","RIDE_MAX_STACK"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = [];

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
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module', 'MutationObserver', 'ResizeObserver',
    src + '\nreturn window.TwRideTuning;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createRideTuning(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwRideTuning = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwRideTuning(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("RIDE_TUNE_MOD_OFF") && app.includes("const rideTuneMod = TwRideTuning.createRideTuning({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const rideTuneMod = TwRideTuning\\.createRideTuning\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:]|\\(\\)\\{\\})').test(A.replace(/const rideTuneMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 rideTuneMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/room/ride-tuning.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/room/ride-tuning.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/room/ride-tuning.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const rideTuneMod = TwRideTuning.createRideTuning({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const rideTuneMod = TwRideTuning.createRideTuning({", "const rideTuneMod = TwRideTuning.createRideTuning({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwRideTuning = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const rideTuneMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('rideTuneMod.' + x)); if(n){ ls[i] = ls[i].replace('rideTuneMod.' + n, n); return ls.join('\n'); } } return a + '\n' + EXPORTS[0] + '(true);'; }, null],   // app.js 에 부르는 자리가 없으면(다른 모듈만 부른다) 옛 이름 부름을 끼워 본다
  ['만들 때 던짐', m => m.replace('function createRideTuning(deps){', 'function createRideTuning(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
/* ── 4. 동작 — 튜닝 값 표가 옮기기 전과 같다 · 임시 벡터는 따로따로 새 것 · (옮기기 전 app.js 글로도 같은 판정) */
say('── 4. 동작 — 튜닝 값 표 50개');
{
  const tp = ['vendor/three/three.min.js', 'three.min.js', 'app/vendor/three/three.min.js'].find(p => fs.existsSync(p));
  const THREE = require(require('path').resolve(tp));
  const SNAP = {"RIDE_ARM_SIZE_FOLLOW":1,"RIDE_ARM_SINK":0.09,"RIDE_ARM_SINK_ON_ANIMAL":0.04,"CIRCUS_MIN_DEPTH":2,"CIRCUS_FOOT_SINK":0.02,"CIRCUS_ARM_SPREAD":1.15,"CIRCUS_ARM_DROP":0.45,"CIRCUS_SWAY_CALM":0.035,"CIRCUS_SWAY_PANIC":0.22,"CIRCUS_SWAY_SPEED":1.6,"CIRCUS_PANIC_SLEEPERS":1,"CIRCUS_PANIC_MS":40000,"CIRCUS_TREMOR_AT":0.75,"CIRCUS_TREMOR_CALMDOWN":0.85,"CIRCUS_TREMOR_AMP":0.014,"CIRCUS_TREMOR_SPD":34,"CIRCUS_DIZZY_MS":2500,"CIRCUS_YAW_MIN":0.2617993877991494,"CIRCUS_YAW_MAX":0.7853981633974483,"CIRCUS_YAW_RANDOM":false,"CIRCUS_FOOT_Z":0,"CIRCUS_TOP_SLAB":0.25,"RIDE_PART_CENTER_MARGIN":0.15,"CIRCUS_FOOT_Z_FROM_TOP":true,"CIRCUS_FOOT_CENTER":1,"_rideFootOff":["V3",0,0,0],"CIRCUS_LEG_STAND":0.05,"CIRCUS_LEG_LIFT":0.75,"CIRCUS_LEG_WAG":0.18,"CIRCUS_LEG_WAG_SPD":3.2,"RIDE_HEAD_OFFSET_Z":-0.3,"RIDE_HEAD_OFFSET_Z_ON_ANIMAL":-0.07,"RIDE_Z_DEPTH_K_ON_ANIMAL":0.345,"CIRCUS_Z_DEPTH_K_ON_ANIMAL":0.28,"RIDE_HEAD_OFFSET_Y":0.35,"RIDE_FOLLOW_HEAD_TILT":true,"RIDE_SNAP_DIST":1.1,"_rideWP":["V3",0,0,0],"_rideTmp":["V3",0,0,0],"_rideOff":["V3",0,0,0],"_rideAwayP":["V3",0,0,0],"_rideAwayS":["V3",0,0,0],"_rideQD":["Q",0,0,0,1],"_rideQP":["Q",0,0,0,1],"_rideQR":["Q",0,0,0,1],"_rideQC":["Q",0,0,0,1],"_rideQY":["Q",0,0,0,1],"_rideAxisY":["V3",0,1,0],"_rideQSpin":["Q",0,0,0,1],"RIDE_MAX_STACK":4};
  const NAMES = Object.keys(SNAP);
  function load(win){
    if(typeof MOD === 'string' && MOD){
      const w = win; new Function('window', 'module', 'THREE', MOD)(w, undefined, THREE);
      return w.TwRideTuning.createRideTuning({});
    }
    const parts = [["/* 🐾 올라타기 오프셋 — 기준점은","const _rideFootOff = new THREE.Vector3();"],["const CIRCUS_LEG_STAND","const _rideQSpin = new THREE.Quaternion();"],["const RIDE_MAX_STACK = 4;","정원에 맞춰 올리고 싶으면 이 값만 5로 바꾸면 된다. */"]];
    const text = parts.map(([a, b]) => { const i = SRC.indexOf(a); const j = SRC.indexOf('\n', SRC.indexOf(b, i)); return SRC.slice(i, j); }).join('\n');
    return new Function('THREE', 'window', text + '\nreturn {' + NAMES.join(',') + '};')(THREE, win);
  }
  const win = {}; const T = load(win);
  const enc = (v) => (v && v.isVector3) ? ['V3', v.x, v.y, v.z] : (v && v.isQuaternion) ? ['Q', v.x, v.y, v.z, v.w] : v;
  const diff = NAMES.filter(n => JSON.stringify(enc(T[n])) !== JSON.stringify(SNAP[n]));
  chk(!diff.length, '값 50개가 옮기기 전과 같다' + (diff.length ? ' — ' + diff.slice(0, 5).join(' · ') : ''));
  const vecs = NAMES.filter(n => Array.isArray(SNAP[n]));
  chk(vecs.every(n => T[n] && (T[n].isVector3 || T[n].isQuaternion)) && new Set(vecs.map(n => T[n])).size === vecs.length, '  임시 벡터 · 쿼터니언 ' + vecs.length + '개는 모두 따로 만든 three 객체(서로 안 겹친다)');
  chk(T.RIDE_MAX_STACK >= 1 && T.CIRCUS_FOOT_CENTER >= 0 && T.CIRCUS_FOOT_CENTER <= 1 && T.CIRCUS_YAW_MIN < T.CIRCUS_YAW_MAX && T.CIRCUS_TREMOR_AT < 1, '  값 범위 — 탑 1층 이상 · 접지 보정 0~1 · 묘기 각 최소 < 최대 · 잔떨림 시작 < 1');
  const T2 = load({});
  chk(T2._rideWP !== T._rideWP, '  만들 때마다 새 임시 벡터');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

/* ═══ 📐 sim-char-measure.js — 📐 캐릭터 실측 모듈 구조 (2026-10-16 신설 · 구역 떼기 C · w1) ═══════════════
   app.js 의 캐릭터 실측 도우미 본문 을 parts/character/char-measure.js 로 옮겼다(글자 그대로 · 바뀐 줄 0 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(4절 — 실제 three 로 박스 · 깊이 · 보정).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(charFootFix · floorClampWrapper · headDecorMeshSet · measureCharBox · measureHeadBoxNoParts · measureUnderfootDepth)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 0줄 그대로 · 부르는 곳은 charMeasureMod.이름 · html(app.js 앞)
   ・4절: 동작 — 순수 판정 · 가짜 객체로 입력 → 출력 · 경계값(옮기기 전 app.js 글로도 같은 판정이 돈다)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · char-measure.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["char-measure.js","parts/character/char-measure.js","app/parts/character/char-measure.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — char-measure.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = [];
const VAL_DEPS = [];
const GET_DEPS = [];
const SET_DEPS = [];
const EXPORTS = ["charFootFix","floorClampWrapper","headDecorMeshSet","measureCharBox","measureHeadBoxNoParts","measureUnderfootDepth"];
const MOVED = ["HEAD_DECOR_MESH_KEYS","_EMPTY_MESH_SET","headDecorMeshSet","measureHeadBoxNoParts","measureCharBox","FLOOR_SNAP_MAX","FLOOR_SNAP_MIN","measureUnderfootDepth","FOOT_FIX_MAX_RATIO","charFootFix","_boxExcluding","floorClampWrapper"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
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
    src + '\nreturn window.TwCharMeasure;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createCharMeasure(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwCharMeasure = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwCharMeasure(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("CHAR_MEASURE_MOD_OFF") && app.includes("const charMeasureMod = TwCharMeasure.createCharMeasure({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const charMeasureMod = TwCharMeasure\\.createCharMeasure\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:]|\\(\\)\\{\\})').test(A.replace(/const charMeasureMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 charMeasureMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/character/char-measure.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/character/char-measure.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/char-measure.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const charMeasureMod = TwCharMeasure.createCharMeasure({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const charMeasureMod = TwCharMeasure.createCharMeasure({", "const charMeasureMod = TwCharMeasure.createCharMeasure({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwCharMeasure = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const charMeasureMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('charMeasureMod.' + x)); if(n){ ls[i] = ls[i].replace('charMeasureMod.' + n, n); return ls.join('\n'); } } return a + '\n' + EXPORTS[0] + '(true);'; }, null],   // app.js 에 부르는 자리가 없으면(다른 모듈만 부른다) 옛 이름 부름을 끼워 본다
  ['만들 때 던짐', m => m.replace('function createCharMeasure(deps){', 'function createCharMeasure(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
/* ── 4. 동작 — 실제 three 로 맨 몸 · 맨 머리 박스 · 발밑 깊이 · 피봇 보정 · 바닥 맞춤(옮기기 전 app.js 글로도 같은 판정) */
say('── 4. 동작 — 박스 · 깊이 · 보정 · 바닥 맞춤');
{
  const tp = ['vendor/three/three.min.js', 'three.min.js', 'app/vendor/three/three.min.js'].find(p => fs.existsSync(p));
  const THREE = require(require('path').resolve(tp));
  const warns = []; const con = { warn: (...a) => warns.push(a.join(' ')), log(){} };
  function load(){
    if(typeof MOD === 'string' && MOD){
      const win = {}; new Function('window', 'module', 'THREE', 'console', MOD)(win, undefined, THREE, con);
      return win.TwCharMeasure.createCharMeasure({ findMySeat: () => null, wardrobeMod: () => ({}) });
    }
    const a = SRC.indexOf("/* 🎩 '머리가 아니라 머리에 얹힌 것'"), b = SRC.indexOf('/* 🩺 바닥 맞춤 진단');
    return new Function('THREE', 'console', SRC.slice(a, b) + '\nreturn { headDecorMeshSet, measureHeadBoxNoParts, measureCharBox, measureUnderfootDepth, charFootFix, floorClampWrapper, HEAD_DECOR_MESH_KEYS, FLOOR_SNAP_MAX, FLOOR_SNAP_MIN };')(THREE, con);
  }
  const C = load();
  const SNAP_MAX = 1.2;   // FLOOR_SNAP_MAX — 저작이 어긋난 파츠로 캐릭터가 하늘로 뜨지 않게 하는 상한
  const near = (x, y) => Math.abs(x - y) < 1e-6;
  const mesh = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d)); m.position.set(x || 0, y || 0, z || 0); return m; };
  /* 맨 몸 박스 — 리깅 · 꾸미기 파츠 wrapper 는 뺀다 */
  const root = new THREE.Group();
  const body = mesh(0.6, 1.45, 0.4, 0, 0.725, 0); root.add(body);
  const skinned = mesh(5, 5, 5); skinned.userData._origBind = true; root.add(skinned);
  const rig = new THREE.Group(); rig.userData.rigged = true; rig.add(mesh(4, 4, 4)); root.add(rig);
  const wrap1 = new THREE.Group(); wrap1.name = '__partWrap_tub'; wrap1.add(mesh(3, 1, 3, 0, -0.5, 0)); root.add(wrap1);
  const wrap2 = new THREE.Group(); wrap2.userData.__twPartWrap = true; wrap2.add(mesh(2, 2, 2, 0, 3, 0)); root.add(wrap2);
  let bx = C.measureCharBox(root);
  chk(near(bx.min.y, 0) && near(bx.max.y, 1.45) && near(bx.max.x, 0.3) && near(bx.max.z, 0.2), '맨 몸 박스 — 몸만(스킨드 · 리깅 · 꾸미기 wrapper(이름 · 표식) 빼고) 키 1.45');
  /* 맨 머리 박스 — 숨은 메쉬 · 장식 메쉬도 뺀다 */
  const head = new THREE.Group(); const skull = mesh(0.4, 0.4, 0.4, 0, 1.2, 0); head.add(skull);
  const hat = mesh(1, 1, 1, 0, 2, 0); head.add(hat);
  const hidden = mesh(1, 1, 1, 0, 3, 0); hidden.visible = false; head.add(hidden);
  const hidG = new THREE.Group(); hidG.visible = false; hidG.add(mesh(1, 1, 1, 0, 4, 0)); head.add(hidG);
  const w3 = new THREE.Group(); w3.name = '__partWrap_horn'; w3.add(mesh(0.1, 1, 0.1, 0, 2, 0)); head.add(w3);
  const out = [];
  bx = C.measureHeadBoxNoParts(head, out, { hatMesh: hat });
  chk(near(bx.max.y, 1.4) && out.length === 1, '맨 머리 박스 — 장식(hatMesh) · 숨은 메쉬 · 숨은 조상 · 꾸미기 wrapper 빼고 · 통과한 메쉬 박스를 담아 준다');
  chk(near(C.measureHeadBoxNoParts(head).max.y, 2.5), '  좌석을 안 주면 장식 메쉬는 센다(예전 그대로)');
  chk(C.headDecorMeshSet(null) === C.headDecorMeshSet({}) && C.headDecorMeshSet(null).size === 0 && C.headDecorMeshSet({ hatMesh: 1, wingMesh: 2, x: 3 }).size === 2, '장식 메쉬 표 — 없으면 같은 빈 Set · 네 칸(hatMesh · maskMesh · glassesMesh · wingMesh)만');
  /* 발밑 깊이 */
  const feet = (y, opt) => { const g = new THREE.Group(); g.add(mesh(1, 1, 1, 0, 0.5, 0)); const m = mesh(1, 0.1, 1, 0, y, 0); if(opt === 'hidden') m.visible = false; if(opt === 'rig'){ const r = new THREE.Group(); r.userData.rigged = true; r.add(m); g.add(r); } else g.add(m); return g; };
  chk(near(C.measureUnderfootDepth(feet(-0.25)), 0.3), '발밑 깊이 — 가장 아래 메쉬가 바닥 밑으로 내려간 만큼(0.3)');
  chk(C.measureUnderfootDepth(feet(0.05)) === 0 && C.measureUnderfootDepth(feet(0.048)) === 0, '  오차(0.005 이하)면 0');
  warns.length = 0;
  chk(C.measureUnderfootDepth(feet(-3)) === SNAP_MAX && warns.length === 1, '  비정상으로 깊으면 상한 ' + SNAP_MAX + ' · 경고');
  chk(C.measureUnderfootDepth(feet(-0.5, 'hidden')) === 0 && C.measureUnderfootDepth(feet(-0.5, 'rig')) === 0, '  숨은 메쉬 · 리깅 파츠는 안 센다');
  chk(C.measureUnderfootDepth({ updateWorldMatrix(){ throw new Error('x'); } }) === 0, '  던지면 0');
  /* 피봇 보정 */
  const B = (a, b) => new THREE.Box3(new THREE.Vector3(0, a, 0), new THREE.Vector3(1, b, 1));
  chk(C.charFootFix(null) === 0 && C.charFootFix(new THREE.Box3()) === 0 && C.charFootFix(B(0, 1.45)) === 0, '피봇 보정 — 빈 값 · 빈 박스 · 이미 발바닥이면 0');
  chk(near(C.charFootFix(B(-0.05, 1.4)), 0.05) && near(C.charFootFix(B(0.05, 1.5)), -0.05), '  발바닥이 피봇 아래 · 위로 어긋난 만큼(±0.05)');
  warns.length = 0;
  chk(C.charFootFix(B(-0.5, 1)) === 0 && warns.length === 1, '  키의 12% 를 넘으면 보정 안 함 · 경고');
  /* 바닥 맞춤 */
  const parent = new THREE.Group(); parent.scale.set(0.5, 0.5, 0.5);
  const w = new THREE.Group(); parent.add(w); w.add(mesh(1, 1, 1, 0, -0.2, 0));   // 월드 min.y = (-0.2 - 0.5) × 0.5 = -0.35
  let dy = C.floorClampWrapper(w, 't');
  chk(near(dy, 0.7) && near(w.position.y, 0.7), '바닥 맞춤 — 월드 깊이(0.35)를 부모 배율(0.5)로 환산해 로컬 y 에 더한다');
  chk(C.floorClampWrapper(w, 't') === 0, '  이미 바닥 위면 0(무동작)');
  const deep = () => { const p = new THREE.Group(); const x = new THREE.Group(); p.add(x); x.add(mesh(1, 1, 1, 0, -3, 0)); return x; };
  warns.length = 0;
  let w4 = deep(); chk(near(C.floorClampWrapper(w4, 't'), SNAP_MAX) && warns.length === 1, '  자동 경로는 상한 ' + SNAP_MAX + ' 까지만 · 경고');
  w4 = deep(); chk(near(C.floorClampWrapper(w4, 't', true), 3.5), '  hard(기즈모 드래그)면 끝까지(3.5)');
  const w5 = new THREE.Group(); const keep = mesh(1, 1, 1, 0, 0.5, 0); const sub = mesh(1, 1, 1, 0, -2, 0); w5.add(keep); w5.add(sub); new THREE.Group().add(w5);
  chk(C.floorClampWrapper(w5, 't', false, (o) => o === sub) === 0, '  skipSub 로 뺀 가지는 안 센다');
  chk(C.floorClampWrapper(null) === 0 && C.floorClampWrapper(new THREE.Group()) === 0, '  빈 값 · 빈 박스는 0');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

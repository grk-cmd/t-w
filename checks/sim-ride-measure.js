/* ═══ 📏 sim-ride-measure.js — 📏 올라타기 실측 모듈 구조 (2026-10-16 신설 · 구역 떼기 C · w1) ═══════════════
   app.js 의 올라타기 실측 함수 본문 을 parts/room/ride-measure.js 로 옮겼다(글자 그대로 · 바뀐 줄 0 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(4절 — 실제 three 로).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(_measureAnimalArmH · _measureCircusFootOff · _rideHostSpinY)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 1줄 그대로 · 부르는 곳은 rideMeasureMod.이름 · html(app.js 앞)
   ・4절: 동작 — 순수 판정 · 가짜 객체로 입력 → 출력 · 경계값(옮기기 전 app.js 글로도 같은 판정이 돈다)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · ride-measure.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["ride-measure.js","parts/room/ride-measure.js","app/parts/room/ride-measure.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — ride-measure.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = [];
const VAL_DEPS = ["seatEqMod"];
const GET_DEPS = [];
const SET_DEPS = [];
const EXPORTS = ["_measureAnimalArmH","_measureCircusFootOff","_rideHostSpinY"];
const MOVED = ["_rideFootTmpV","_rideFootGrp","_rideFootTmpQ","CIRCUS_FOOT_OFF_MAX","_measureCircusFootOff","_rideHostSpinY","_measureAnimalArmH"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  seatEqMod: seatEqMod,"];

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
    src + '\nreturn window.TwRideMeasure;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createRideMeasure(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwRideMeasure = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwRideMeasure(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("RIDE_MEASURE_MOD_OFF") && app.includes("const rideMeasureMod = TwRideMeasure.createRideMeasure({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const rideMeasureMod = TwRideMeasure\\.createRideMeasure\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:]|\\(\\)\\{\\})').test(A.replace(/const rideMeasureMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 rideMeasureMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/room/ride-measure.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/room/ride-measure.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/room/ride-measure.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const rideMeasureMod = TwRideMeasure.createRideMeasure({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const rideMeasureMod = TwRideMeasure.createRideMeasure({", "const rideMeasureMod = TwRideMeasure.createRideMeasure({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwRideMeasure = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const rideMeasureMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('rideMeasureMod.' + x)); if(n){ ls[i] = ls[i].replace('rideMeasureMod.' + n, n); return ls.join('\n'); } } return a + '\n' + EXPORTS[0] + '(true);'; }, null],   // app.js 에 부르는 자리가 없으면(다른 모듈만 부른다) 옛 이름 부름을 끼워 본다
  ['만들 때 던짐', m => m.replace('function createRideMeasure(deps){', 'function createRideMeasure(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
/* ── 4. 동작 — 실제 three 로 접지점 오프셋 · 회전 춤 각 · 동물 팔 높이(옮기기 전 app.js 글로도 같은 판정) */
say('── 4. 동작 — 접지점 · 회전 춤 · 팔 높이');
{
  const tp = ['vendor/three/three.min.js', 'three.min.js', 'app/vendor/three/three.min.js'].find(p => fs.existsSync(p));
  const THREE = require(require('path').resolve(tp));
  const warns = [];
  const con = { warn: (...a) => warns.push(a.join(' ')), log(){} };
  function load(eq){
    if(typeof MOD === 'string' && MOD){
      const win = {};
      new Function('window', 'module', 'THREE', 'console', MOD)(win, undefined, THREE, con);
      return win.TwRideMeasure.createRideMeasure({ seatEqMod: eq });
    }
    const a = SRC.indexOf('const _rideFootTmpV = new THREE.Vector3()'), a2 = SRC.indexOf('\n}\n', SRC.indexOf('function _measureCircusFootOff(')) + 3;
    const b = SRC.indexOf('/* 🌀 대상이 제자리 회전 춤'), b2 = SRC.indexOf('\n}\n', SRC.indexOf('function _measureAnimalArmH(')) + 3;
    return new Function('THREE', 'console', 'seatEqMod', SRC.slice(a, a2) + SRC.slice(b, b2) + '\nreturn { _measureCircusFootOff, _rideHostSpinY, _measureAnimalArmH };')(THREE, con, eq);
  }
  const near = (x, y) => Math.abs(x - y) < 1e-6;
  const M = load({ seatScale: () => 2, charLiftWorld: () => 0.1 });
  /* 회전 춤 */
  chk(M._rideHostSpinY(null) === 0 && M._rideHostSpinY({ rig: { rotation: { y: 1 } } }) === 0, '회전 춤 — 빈 값 · 춤이 아니면 0');
  chk(near(M._rideHostSpinY({ _danceSpin: true, rig: { rotation: { y: 1.2 } }, pose: { turnY: 0.04 } }), 1.16) && near(M._rideHostSpinY({ _danceSpin: true, rig: { rotation: { y: 1.2 } } }), 1.2), '  춤 중 — rig 회전 − 기준선(pose.turnY)');
  /* 접지점 */
  const mkSeat = (lx, ly, lz) => {
    const g = new THREE.Group(); g.position.set(3, 1, -2); g.rotation.y = Math.PI / 2;
    const legL = new THREE.Object3D(); legL.position.set(lx, ly, lz); g.add(legL);
    const legR = new THREE.Object3D(); legR.position.set(-lx, ly, lz); g.add(legR);
    return { group: g, bones: { legL, legR } };
  };
  const s1 = mkSeat(0.1, 0.5, 0.05);
  const o1 = M._measureCircusFootOff(s1, true), o2 = M._measureCircusFootOff(s1, false);
  chk(o1 && near(o1.x, 0.1) && o1.y === 0 && near(o1.z, 0.05) && o2 && near(o2.x, -0.1), '접지점 — 딛는 다리의 좌석 로컬 오프셋(회전 · 위치를 빼고 · 높이 0) · 왼발/오른발');
  chk(o1 !== M._measureCircusFootOff(s1, true), '  매번 새 벡터(clone)를 돌려준다');
  warns.length = 0;
  chk(M._measureCircusFootOff(mkSeat(0.25, 0, 0.25), true) === null && warns.length === 1, '  0.3 넘게 떨어지면 측정 실패 — null · 경고 한 줄');
  chk(near(M._measureCircusFootOff(mkSeat(0.3, 0, 0), true).x, 0.3), '  경계 — 딱 0.3 은 받는다');
  chk(M._measureCircusFootOff(null) === null && M._measureCircusFootOff({ bones: {} , group: new THREE.Group() }, true) === null && M._measureCircusFootOff({ bones: { legL: 1 } }, true) === null, '  좌석 · 다리 · group 이 없으면 null');
  /* 팔 높이 */
  const mkAnimal = (hy) => {
    const g = new THREE.Group(); g.position.set(0, 2, 0);
    const rig = new THREE.Group(); rig.position.set(0, 0.7, 0); g.add(rig);   // 드래그로 들린 높이 — 상쇄돼야 한다
    const bw = new THREE.Group(); rig.add(bw);
    const hand = new THREE.Object3D(); hand.position.set(0, hy, 0); bw.add(hand);
    return { group: g, bodyWrap: bw, bones: { handL: hand } };
  };
  chk(near(M._measureAnimalArmH(mkAnimal(0.3)), (0.3 - 0.1) / 2), '팔 높이 — (손 − bodyWrap − 캐릭터 들림) ÷ 실효 크기 · rig 가 들려 있어도 같다');
  chk(M._measureAnimalArmH(mkAnimal(0.05)) === null, '  0 이하면 null');
  chk(M._measureAnimalArmH(null) === null && M._measureAnimalArmH({ bones: {} }) === null && M._measureAnimalArmH({ bones: { handR: {} } }) === null, '  손 · bodyWrap 이 없으면 null');
  const M0 = load({ seatScale: () => 0, charLiftWorld: () => 0 });
  chk(near(M0._measureAnimalArmH(mkAnimal(0.3)), 0.3), '  경계 — 실효 크기 0 이면 1 로 나눈다');
  /* 탄 채로 다시 잴 때 — 좌석이 대상 고개를 따라 기울어 있어도 얹을 때(곧은 자세) 잰 값과 같아야 한다 */
  const tiltCase = (Mx) => {
    const a = mkAnimal(0.3); a.bones.handL.position.z = 0.2;   // 손이 앞으로 나와 있으면 기울임에 높이가 흔들린다
    const straight = Mx._measureAnimalArmH(a);
    a.group.rotation.set(0.6, 0, 0.3); a.group.updateMatrixWorld(true);
    const q0 = a.group.quaternion.clone();
    const tilted = Mx._measureAnimalArmH(a);
    return { straight, tilted, restored: a.group.quaternion.equals(q0) };
  };
  const tc = tiltCase(M);
  chk(near(tc.tilted, tc.straight) && tc.restored, '★ 기울어진 채로 재도 곧은 자세 값과 같다 · 재고 나면 기울임 되돌림');
  /* 재는 도중 던져도 기울임은 원래대로 — 실패는 null(옛 값 유지는 부르는 쪽) */
  const throwCase = (Mx) => {
    const a = mkAnimal(0.3); a.group.rotation.set(0.6, 0, 0.3); a.group.updateMatrixWorld(true);
    const q0 = a.group.quaternion.clone();
    a.bones.handL.getWorldPosition = () => { throw new Error('깨 봄'); };
    const v = Mx._measureAnimalArmH(a);
    return v === null && a.group.quaternion.equals(q0);
  };
  chk(throwCase(M), '★ 재는 도중 던져도 — null · 기울임은 원래대로');
  if(typeof MOD === 'string' && MOD){
    const MODc = MOD.replace('    }finally{\n      _g.quaternion.copy(_savedQ);\n      _g.updateMatrixWorld(true);\n    }', '    }catch(e){ throw e; }\n    _g.quaternion.copy(_savedQ);\n    _g.updateMatrixWorld(true);');
    let red = MODc === MOD;
    if(!red){
      const win = {}; new Function('window', 'module', 'THREE', 'console', MODc)(win, undefined, THREE, con);
      red = !throwCase(win.TwRideMeasure.createRideMeasure({ seatEqMod: { seatScale: () => 2, charLiftWorld: () => 0.1 } }));
    }
    chk(red && MODc !== MOD, '  깨 보기 — 되돌리기를 finally 밖에 두면 빨강');
  }
  if(typeof MOD === 'string' && MOD){
    const MODb = MOD.replace('      _g.quaternion.identity();\n', '');
    let red = MODb === MOD;
    if(!red){
      const win = {}; new Function('window', 'module', 'THREE', 'console', MODb)(win, undefined, THREE, con);
      const tb = tiltCase(win.TwRideMeasure.createRideMeasure({ seatEqMod: { seatScale: () => 2, charLiftWorld: () => 0.1 } }));
      red = !near(tb.tilted, tb.straight);
    }
    chk(red && MODb !== MOD, '  깨 보기 — 기울임을 안 지우고 재면 빨강');
  }
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

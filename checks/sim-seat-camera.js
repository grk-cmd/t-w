/* ═══ 🎥 sim-seat-camera.js — 🎥 좌석 줄 카메라 · 캔버스 맞춤 모듈 구조 (2026-10-16 신설 · 구역 떼기 C · w1) ═══════════════
   app.js 의 카메라 · 캔버스 맞춤 본문 을 parts/room/seat-camera.js 로 옮겼다(글자 그대로 · 바뀐 줄 12 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(4절 — 가짜 카메라 · 렌더러로 두 갈래 값).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(applyCameraAndCanvas · updateCameraOnly)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 15줄 그대로 · 부르는 곳은 seatCameraMod.이름 · html(app.js 앞)
   ・4절: 동작 — 순수 판정 · 가짜 객체로 입력 → 출력 · 경계값(옮기기 전 app.js 글로도 같은 판정이 돈다)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · seat-camera.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["seat-camera.js","parts/room/seat-camera.js","app/parts/room/seat-camera.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — seat-camera.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = [];
const VAL_DEPS = ["BASE_PXW","DOT_RENDER_SCALE","camera","canvas","renderer"];
const GET_DEPS = ["_cachedRowCenter","_cachedRowSpan","deskPanX","deskPanY","dotRenderEnabled","dotRenderMod","focusCharScale","sizeFactor"];
const SET_DEPS = ["_deskCanvasH","_deskViewH"];
const EXPORTS = ["applyCameraAndCanvas","updateCameraOnly"];
const MOVED = ["updateCameraOnly","applyCameraAndCanvas"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  BASE_PXW: BASE_PXW,","  DOT_RENDER_SCALE: DOT_RENDER_SCALE,","  _cachedRowCenter: ()=>_cachedRowCenter,","  _cachedRowSpan: ()=>_cachedRowSpan,","  camera: camera,","  canvas: canvas,","  deskPanX: ()=>deskPanX,","  deskPanY: ()=>deskPanY,","  dotRenderEnabled: ()=>dotRenderEnabled,","  dotRenderMod: ()=>dotRenderMod,","  focusCharScale: ()=>focusCharScale,","  renderer: renderer,","  sizeFactor: ()=>sizeFactor,","  setDeskCanvasH: (v)=>{ _deskCanvasH = v; },","  setDeskViewH: (v)=>{ _deskViewH = v; },"];

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
    src + '\nreturn window.TwSeatCamera;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createSeatCamera(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwSeatCamera = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwSeatCamera(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("SEAT_CAMERA_MOD_OFF") && app.includes("const seatCameraMod = TwSeatCamera.createSeatCamera({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const seatCameraMod = TwSeatCamera\\.createSeatCamera\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:]|\\(\\)\\{\\})').test(A.replace(/const seatCameraMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 seatCameraMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/room/seat-camera.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/room/seat-camera.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/room/seat-camera.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const seatCameraMod = TwSeatCamera.createSeatCamera({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const seatCameraMod = TwSeatCamera.createSeatCamera({", "const seatCameraMod = TwSeatCamera.createSeatCamera({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwSeatCamera = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const seatCameraMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('seatCameraMod.' + x)); if(n){ ls[i] = ls[i].replace('seatCameraMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createSeatCamera(deps){', 'function createSeatCamera(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
/* ── 4. 동작 — 가짜 카메라 · 렌더러 · 캔버스로 두 갈래(런처 미리보기 · 실행 화면)를 굴려 옮기기 전 값과 맞춘다 */
say('── 4. 동작 — 카메라 거리 · 각도 · 화면 밀기 · 캔버스 크기');
{
  class V3 { constructor(x, y, z){ this.x = x; this.y = y; this.z = z; } }
  const r6 = (v) => Math.round(v * 1e6) / 1e6;
  /* 한 판 굴리기 — o: { run, dot, sizeFactor, focusCharScale, panX, panY, iw, ih, dpr, rowCenter, rowSpan, viewSet } */
  function runCam(o, useCache){
    const log = [];
    const camera = { fov: 0, aspect: 0, view: o.viewSet ? {} : null, position: { x: 0, y: 0, z: 0, set(a, b, c){ this.x = a; this.y = b; this.z = c; } },
      setViewOffset(...a){ this.view = { a }; log.push(['view', ...a.map(r6)]); }, clearViewOffset(){ this.view = null; log.push(['clearView']); },
      lookAt(x, y, z){ log.push(['look', r6(x), r6(y), r6(z)]); }, updateProjectionMatrix(){ log.push(['upm']); } };
    const renderer = { pr: 2, getPixelRatio(){ return this.pr; }, setPixelRatio(p){ this.pr = p; log.push(['pr', p]); }, setSize(w, h, u){ log.push(['size', w, h, u]); } };
    const canvas = { style: {} };
    const cls = new Set(o.run ? ['desktop', 'runmode'] : []);
    const document_ = { body: { classList: { contains: (c) => cls.has(c) } } };
    const FB = { runPixelRatio: (dpr, dot) => dot ? 1 : Math.min(dpr, 1.5) };
    const dotRenderMod = { applyDotTextureFilter: (on) => log.push(['dotTex', on]), applyPS1Shader: (on) => log.push(['ps1', on]) };
    const st = { vh: 0, ch: 1 };
    const V = { BASE_PXW: 190, DOT_RENDER_SCALE: 0.45, camera, canvas, renderer, _cachedRowCenter: o.rowCenter, _cachedRowSpan: o.rowSpan, _deskCanvasH: 1, _deskViewH: 0,
      deskPanX: o.panX || 0, deskPanY: o.panY || 0, dotRenderEnabled: !!o.dot, dotRenderMod, focusCharScale: o.focusCharScale || 1, sizeFactor: o.sizeFactor || 1 };
    const G = { THREE: { Vector3: V3 }, document: document_, innerWidth: o.iw, innerHeight: o.ih, devicePixelRatio: o.dpr || 2, FrameBudget: FB };
    let api;
    if(typeof MOD === 'string' && MOD){
      const deps = {};
      for(const k of ['BASE_PXW', 'DOT_RENDER_SCALE', 'camera', 'canvas', 'renderer']) deps[k] = V[k];
      for(const k of ['_cachedRowCenter', '_cachedRowSpan', '_deskCanvasH', '_deskViewH', 'deskPanX', 'deskPanY', 'dotRenderEnabled', 'dotRenderMod', 'focusCharScale', 'sizeFactor']) deps[k] = () => V[k];
      deps.setDeskViewH = (v) => { st.vh = v; }; deps.setDeskCanvasH = (v) => { st.ch = v; };
      const win = {};
      new Function('window', 'module', ...Object.keys(G), MOD)(win, undefined, ...Object.values(G));
      api = win.TwSeatCamera.createSeatCamera(deps);
    } else {
      const a = SRC.indexOf('// ★ 캐릭터 크기 슬라이더처럼'), b = SRC.indexOf('\n}\n', SRC.indexOf('function applyCameraAndCanvas(')) + 3;
      const names = Object.keys(V).concat(Object.keys(G));
      const f = new Function(...names, '__st', SRC.slice(a, b) + '\nreturn { applyCameraAndCanvas, updateCameraOnly, done(){ __st.vh = _deskViewH; __st.ch = _deskCanvasH; } };');
      api = f(...names.map(n => n in V ? V[n] : G[n]), st);
    }
    if(useCache) api.updateCameraOnly(); else api.applyCameraAndCanvas(o.rowCenter, o.rowSpan);
    if(api.done) api.done();
    return { log, fov: camera.fov, aspect: r6(camera.aspect), pos: [r6(camera.position.x), r6(camera.position.y), r6(camera.position.z)], w: canvas.style.width, h: canvas.style.height, ir: canvas.style.imageRendering, vh: r6(st.vh), ch: st.ch };
  }
  const J = (x) => JSON.stringify(x);
  const CASES = [["런처 미리보기 — 두 자리 · 기본 배율",{"run":false,"iw":1000,"ih":800,"rowCenter":-1.2,"rowSpan":3.1},{"log":[["look",-1.2,0.5,0],["upm"],["size",703,361,false]],"fov":34,"aspect":1.947368,"pos":[-1.049514,0.655818,1.720068],"w":"703px","h":"361px","vh":0,"ch":1}],["실행 화면 — 도트 끔 · 오프셋 · 캐릭터 크기 1.3",{"run":true,"iw":1920,"ih":1080,"dpr":2,"rowCenter":0,"rowSpan":1.7,"panX":0.1,"panY":-0.05,"focusCharScale":1.3},{"log":[["pr",1.5],["view",1920,1080,-276.48,-248.4,1920,1080],["look",-0.437379,0.5,0.038266],["upm"],["size",1920,1080,false],["dotTex",false],["ps1",false]],"fov":50,"aspect":1.777778,"pos":[-0.197939,0.747924,2.775079],"w":"1920px","h":"1080px","ir":"auto","vh":2.572556,"ch":1080}],["실행 화면 — 도트 켬(버퍼 0.45배 · 텍스처 · PS1 켬)",{"run":true,"dot":true,"iw":1280,"ih":720,"dpr":1,"rowCenter":-2.5,"rowSpan":6.4},{"log":[["pr",1],["view",1280,720,-261.12,-201.6,1280,720],["look",-3.526392,0.5,0.089798],["upm"],["size",576,324,false],["dotTex",true],["ps1",true]],"fov":50,"aspect":1.777778,"pos":[-3.129763,0.910683,4.623293],"w":"1280px","h":"720px","ir":"pixelated","vh":4.261404,"ch":720}],["런처 — 화면이 작으면 캔버스는 화면-여백까지 · 남은 화면 밀기는 지운다",{"run":false,"iw":300,"ih":200,"rowCenter":0,"rowSpan":1.2,"sizeFactor":2,"viewSet":true},{"log":[["clearView"],["look",0,0.5,0],["upm"],["size",264,160,false]],"fov":34,"aspect":1.65,"pos":[0.150486,0.655818,1.720068],"w":"264px","h":"160px","vh":0,"ch":1}],["실행 화면 — 캐릭터 크기 0(하한 0.1 로 나눈다) · 좁은 화면",{"run":true,"iw":2,"ih":2,"dpr":3,"rowCenter":0,"rowSpan":0,"focusCharScale":0},{"log":[["pr",1.5],["view",2,2,-0.408,-0.56,2,2],["look",-0.302904,0.5,0.026501],["upm"],["size",2,2,false],["dotTex",false],["ps1",false]],"fov":50,"aspect":1,"pos":[-0.094813,0.715464,2.404994],"w":"2px","h":"2px","ir":"auto","vh":2.235742,"ch":2}]];
  for(const [name, o, want] of CASES){
    const got = runCam(o, false);
    chk(J(got) === J(want), name + (J(got) === J(want) ? '' : ' — ' + J(got).slice(0, 300)));
  }
  const o0 = CASES[0][1], o1 = CASES[1][1];
  chk(J(runCam(o0, true)) === J(runCam(o0, false)) && J(runCam(o1, true)) === J(runCam(o1, false)), 'updateCameraOnly 는 캐시된 줄 가운데 · 폭으로 같은 값을 낸다');
  const far = runCam(Object.assign({}, o1, { panX: 5 }), false), near = runCam(Object.assign({}, o1, { panX: 1 }), false);
  chk(Math.abs(far.pos[0] - near.pos[0]) < 1e-6 && J(far.log.find(l => l[0] === 'view')) !== J(near.log.find(l => l[0] === 'view')), '★ 이동 오프셋을 멀리 밀어도 카메라가 옆으로 가는 양은 상한(SIDE_PERSP_CAP)에서 멈춘다 — 나머지는 화면 밀기');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

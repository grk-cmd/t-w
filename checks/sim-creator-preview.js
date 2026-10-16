/* ═══ 🧍 sim-creator-preview.js — 🧍 생성기 미리보기 모듈 (2026-10-16 신설 · C 구역 떼기 · w3) ═══════════════
   app.js 의 생성기 미리보기 3D 쪽 · 생성기 조명 을 parts/creator/creator-preview.js 로 옮겼다(글자 그대로 · 바뀐 줄 111 — 읽는 · 쓰는 함수로 바꾼 자리).
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(RIG_TURN · applyCreatorXform · applyStaticHandRest · clearCreatorItems · clearCreatorParts · clearHolderDeskItems · crFlatView · creatorLoop · ensureCreatorPreview · fitCreator · frameDeskCam · swapCreatorBaseToAnimal · swapCreatorBaseToCommission · swapCreatorBaseToDefault · updateCreatorCam · updateCreatorLights)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 만드는 줄 · deps 81줄 그대로 · 부르는 곳은 creatorPrevMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   ・4절: 동작 — 가짜 DOM · deps 로 모듈을 만들어 입력 → 결과(경계값 포함)를 본다
   [실행] app.js · desk-companion-prototype.html · creator-preview.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["creator-preview.js","parts/creator/creator-preview.js","app/parts/creator/creator-preview.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — creator-preview.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_setDeskMatColor","_sweepOrphanPartWrappers","allDeskItems","bindPaint","boneSide","buildCreatorBase","buildDesk","charFootFix","clampCharY","compositeFace","equipDeskItem","extractBonesInto","getCommissionScene","instantiateBase","isAnimalEditing","isCommissionEditing","measureCharBox","measureUnderfootDepth","mkFaceTex","normalizeModel","sizeFloorTo","skinColorFor","toast"];
const VAL_DEPS = ["ANIMAL_HAND_REST","CHAR_Z","COMMISSION_SCALE_CORRECTION","FLAT_EMISSIVE","LIGHT_PRESET","M","_FILL_LIGHT_MUL","_KEY_LIGHT_MUL","cBodyCenter","cFaceCenter","camTarget","deskItemOrigin","dispTex","matToneMod"];
const GET_DEPS = ["BASE_SCENE","FOCUS_ARM_LIFT","HAND_REST","cAmb","cBase","cBodyDist","cBotColor","cCam","cDesk","cDeskColor","cDeskMat","cFaceDist","cFill","cFloor","cKey","cRenderer","cScene","cTopColor","cXform","camDist","camPitch","camYaw","crStep","creatorOpen","deskCamSaved","faceCamSaved","skinIndex"];
const SET_DEPS = ["cAmb","cBase","cBodyDist","cCam","cDesk","cDeskMat","cFaceDist","cFill","cFloor","cKey","cRenderer","cScene","camDist","camPitch","camYaw","deskCamSaved","faceCamSaved"];
const EXPORTS = ["RIG_TURN","applyCreatorXform","applyStaticHandRest","clearCreatorItems","clearCreatorParts","clearHolderDeskItems","crFlatView","creatorLoop","ensureCreatorPreview","fitCreator","frameDeskCam","swapCreatorBaseToAnimal","swapCreatorBaseToCommission","swapCreatorBaseToDefault","updateCreatorCam","updateCreatorLights"];
const MOVED = ["crFlatView","updateCreatorLights","updateCreatorCam","applyStaticHandRest","ensureCreatorPreview","creatorLoop","RIG_TURN","fitCreator","applyCreatorXform","frameDeskCam","swapCreatorBaseToCommission","swapCreatorBaseToAnimal","swapCreatorBaseToDefault","clearHolderDeskItems","clearCreatorItems","clearCreatorParts"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  ANIMAL_HAND_REST: ANIMAL_HAND_REST,","  BASE_SCENE: ()=>BASE_SCENE,","  CHAR_Z: CHAR_Z,","  COMMISSION_SCALE_CORRECTION: COMMISSION_SCALE_CORRECTION,","  FLAT_EMISSIVE: FLAT_EMISSIVE,","  FOCUS_ARM_LIFT: ()=>FOCUS_ARM_LIFT,","  HAND_REST: ()=>HAND_REST,","  LIGHT_PRESET: LIGHT_PRESET,","  M: M,","  _FILL_LIGHT_MUL: _FILL_LIGHT_MUL,","  _KEY_LIGHT_MUL: _KEY_LIGHT_MUL,","  _setDeskMatColor: (...a)=>_setDeskMatColor(...a),","  _sweepOrphanPartWrappers: (...a)=>_sweepOrphanPartWrappers(...a),","  allDeskItems: (...a)=>allDeskItems(...a),","  bindPaint: (...a)=>bindPaint(...a),","  boneSide: (...a)=>boneSide(...a),","  buildCreatorBase: (...a)=>buildCreatorBase(...a),","  buildDesk: (...a)=>buildDesk(...a),","  cAmb: ()=>cAmb,","  cBase: ()=>cBase,","  cBodyCenter: cBodyCenter,","  cBodyDist: ()=>cBodyDist,","  cBotColor: ()=>cBotColor,","  cCam: ()=>cCam,","  cDesk: ()=>cDesk,","  cDeskColor: ()=>cDeskColor,","  cDeskMat: ()=>cDeskMat,","  cFaceCenter: cFaceCenter,","  cFaceDist: ()=>cFaceDist,","  cFill: ()=>cFill,","  cFloor: ()=>cFloor,","  cKey: ()=>cKey,","  cRenderer: ()=>cRenderer,","  cScene: ()=>cScene,","  cTopColor: ()=>cTopColor,","  cXform: ()=>cXform,","  camDist: ()=>camDist,","  camPitch: ()=>camPitch,","  camTarget: camTarget,","  camYaw: ()=>camYaw,","  charFootFix: (...a)=>charFootFix(...a),","  clampCharY: (...a)=>clampCharY(...a),","  compositeFace: (...a)=>compositeFace(...a),","  crStep: ()=>crStep,","  creatorOpen: ()=>creatorOpen,","  deskCamSaved: ()=>deskCamSaved,","  deskItemOrigin: deskItemOrigin,","  dispTex: dispTex,","  equipDeskItem: (...a)=>equipDeskItem(...a),","  extractBonesInto: (...a)=>extractBonesInto(...a),","  faceCamSaved: ()=>faceCamSaved,","  getCommissionScene: (...a)=>getCommissionScene(...a),","  instantiateBase: (...a)=>instantiateBase(...a),","  isAnimalEditing: (...a)=>isAnimalEditing(...a),","  isCommissionEditing: (...a)=>isCommissionEditing(...a),","  matToneMod: matToneMod,","  measureCharBox: (...a)=>measureCharBox(...a),","  measureUnderfootDepth: (...a)=>measureUnderfootDepth(...a),","  mkFaceTex: (...a)=>mkFaceTex(...a),","  normalizeModel: (...a)=>normalizeModel(...a),","  sizeFloorTo: (...a)=>sizeFloorTo(...a),","  skinColorFor: (...a)=>skinColorFor(...a),","  skinIndex: ()=>skinIndex,","  toast: (...a)=>toast(...a),","  setCAmb: (v)=>{ cAmb = v; },","  setCBase: (v)=>{ cBase = v; },","  setCBodyDist: (v)=>{ cBodyDist = v; },","  setCCam: (v)=>{ cCam = v; },","  setCDesk: (v)=>{ cDesk = v; },","  setCDeskMat: (v)=>{ cDeskMat = v; },","  setCFaceDist: (v)=>{ cFaceDist = v; },","  setCFill: (v)=>{ cFill = v; },","  setCFloor: (v)=>{ cFloor = v; },","  setCKey: (v)=>{ cKey = v; },","  setCRenderer: (v)=>{ cRenderer = v; },","  setCScene: (v)=>{ cScene = v; },","  setCamDist: (v)=>{ camDist = v; },","  setCamPitch: (v)=>{ camPitch = v; },","  setCamYaw: (v)=>{ camYaw = v; },","  setDeskCamSaved: (v)=>{ deskCamSaved = v; },","  setFaceCamSaved: (v)=>{ faceCamSaved = v; },"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다. */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
/* over: deps 덮어쓰기 · env: 전역 덮어쓰기(document · window · THREE …) */
function build(src, over, env){
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  Object.assign(deps, over || {});
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const E = Object.assign({ window: win, document: any, localStorage: ls, navigator: any, firebaseAPI: any, companion: any, setTimeout: () => 0, setInterval: () => 0, clearTimeout: () => {}, clearInterval: () => {},
    requestAnimationFrame: () => 0, THREE: any, addEventListener: () => {}, removeEventListener: () => {}, module: undefined, MutationObserver: class { observe(){} disconnect(){} }, ResizeObserver: class { observe(){} disconnect(){} },
    performance: { now: () => 0 }, console: { log(){}, warn(){}, error(){} }, Image: any, confirm: () => true, devicePixelRatio: 1 }, env || {});
  const keys = Object.keys(E);
  const api = new Function(...keys, src + '\nreturn window.TwCreatorPreview;')(...keys.map(k => E[k]));
  return api.createCreatorPreview(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwCreatorPreview = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwCreatorPreview(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(app.includes("const creatorPrevMod = TwCreatorPreview.createCreatorPreview({"), '만드는 줄(가드 없이 — 모듈은 늘 싣는다)');
  const mk = (app.match(new RegExp("const creatorPrevMod = TwCreatorPreview\\.createCreatorPreview\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);")) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(new RegExp("const creatorPrevMod = [\\s\\S]*?\\n\\}\\);"), '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));
  t(!bare.length, '부르는 곳은 creatorPrevMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/creator/creator-preview.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/creator/creator-preview.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/creator/creator-preview.js"></script>', '')],
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const creatorPrevMod = TwCreatorPreview.createCreatorPreview({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const creatorPrevMod = TwCreatorPreview.createCreatorPreview({", "const creatorPrevMod = TwCreatorPreview.createCreatorPreview({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwCreatorPreview = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith("const creatorPrevMod =")) continue; const n = EXPORTS.filter(x => ![].includes(x)).find(x => ls[i].includes("creatorPrevMod." + x)); if(n){ ls[i] = ls[i].replace("creatorPrevMod." + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createCreatorPreview(deps){', 'function createCreatorPreview(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [nm, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), nm + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say('── 4. 동작');
/* 동작 검사용 작은 가짜 DOM — id 로 찾은 요소를 기억하고 style · classList · onclick · 이벤트를 받는다. */
function fakeDom(absent){   // absent: 처음엔 없는(코드가 만들어 붙이는) id 목록
  const gone = new Set(absent || []);
  const els = {};
  const mkEl = (id, tag) => {
    const cls = new Set();
    const ev = {};
    const el = {
      id: id || '', tagName: (tag || 'div').toUpperCase(), style: {}, dataset: {}, textContent: '', innerHTML: '', value: '', title: '', disabled: false, children: [], parentElement: null,
      classList: { add: (...c) => c.forEach(x => cls.add(x)), remove: (...c) => c.forEach(x => cls.delete(x)), contains: (c) => cls.has(c), toggle: (c, on) => { const v = on === undefined ? !cls.has(c) : !!on; v ? cls.add(c) : cls.delete(c); return v; } },
      addEventListener: (t, f) => { (ev[t] = ev[t] || []).push(f); }, removeEventListener: () => {},
      appendChild: (c) => { el.children.push(c); c.parentElement = el; if(c.id) els[c.id] = c; return c; },
      getContext: () => new Proxy({}, { get: () => () => {} }), querySelector: () => null, querySelectorAll: () => [],
      fire: (t, e) => { (ev[t] || []).forEach(f => f(Object.assign({ stopPropagation(){}, preventDefault(){}, currentTarget: el }, e || {}))); },
      click: () => { if(typeof el.onclick === 'function') el.onclick({ stopPropagation(){}, preventDefault(){}, currentTarget: el }); el.fire('click'); },
    };
    return el;
  };
  const docEv = {};
  const document = {
    getElementById: (id) => els[id] || (gone.has(id) ? null : (els[id] = mkEl(id))),
    createElement: (tag) => mkEl('', tag),
    querySelector: (s) => els['q:' + s] || (els['q:' + s] = mkEl('q:' + s)),
    querySelectorAll: () => [],
    addEventListener: (t, f) => { (docEv[t] = docEv[t] || []).push(f); },
    removeEventListener: () => {},
    body: mkEl('body'),
    fire: (t) => (docEv[t] || []).forEach(f => f({})),
  };
  return { document, els, mkEl };
}

/* 생성기 미리보기 — 조명 세기 · 색, 카메라 궤도 위치와 단계별 각도 기억, 팔 각도, 책상 아이템 · 파츠 걷기를 가짜 객체로 본다 */
function colr(){ return { r: 0, g: 0, b: 0, h: null, setHSL(h, s, l){ this.h = [h, s, l]; return this; }, copy(c){ this.r = c.r; this.g = c.g; this.b = c.b; this.h = c.h; return this; }, setRGB(r, g, b){ this.r = r; this.g = g; this.b = b; return this; }, setScalar(v){ this.r = this.g = this.b = v; return this; }, multiplyScalar(k){ this.r *= k; this.g *= k; this.b *= k; return this; } }; }
const light = () => ({ intensity: -1, color: colr() });
function v3(x, y, z){ return { x: x || 0, y: y || 0, z: z || 0, set(a, b, c){ this.x = a; this.y = b; this.z = c; return this; }, clone(){ return v3(this.x, this.y, this.z); }, copy(o){ this.x = o.x; this.y = o.y; this.z = o.z; return this; } }; }
const FAKE3 = { Color: function(){ return colr(); }, Euler: function(x){ this.x = x; }, Quaternion: function(){ this.setFromEuler = (e) => { this.x = e.x; return this; }; } };
function rigC(o){
  o = o || {};
  const st = Object.assign({ amb: light(), key: light(), fill: light(), base: null, step: 2, dist: 2, yaw: 0, pitch: 0, face: null, desk: null, cam: null }, o);
  const calls = [];
  const target = v3(0, 1, 0);
  const over = { LIGHT_PRESET: { b: 0.8, h: 0.1, e: 0.5 }, _KEY_LIGHT_MUL: 1.5, _FILL_LIGHT_MUL: 0.4, FLAT_EMISSIVE: 0.35,
    HAND_REST: () => -1.0, ANIMAL_HAND_REST: -0.3, FOCUS_ARM_LIFT: () => 0.25,
    cAmb: () => st.amb, cKey: () => st.key, cFill: () => st.fill, cBase: () => st.base, cCam: () => st.cam, crStep: () => st.step,
    camTarget: target, camDist: () => st.dist, camYaw: () => st.yaw, camPitch: () => st.pitch,
    setFaceCamSaved: (v) => { st.face = v; }, setDeskCamSaved: (v) => { st.desk = v; },
    boneSide: (n) => n.includes('_l') ? 'l' : n.includes('_r') ? 'r' : '',
    allDeskItems: () => [{ id: 'cup' }, { id: 'pen' }], equipDeskItem: (h, d, on) => { calls.push(['equip', d.id, on]); h.deskItems[d.id] = null; },
    _sweepOrphanPartWrappers: (b) => calls.push(['sweep', Object.keys(b.equippedPartObjs).length, Object.keys(b.stackedPartObjs).length]),
    deskItemOrigin: { clear: () => calls.push(['originClear']) } };
  const api = build(MOD, Object.assign(over, o.over || {}), { THREE: FAKE3, CreatorFlatView: undefined });
  return { st, api, calls, target };
}
{ const r = rigC();
  chk(r.api.crFlatView === null, '원색 보기 모듈이 없으면 crFlatView 는 null(생성기는 그대로 돈다)');
  chk(r.api.RIG_TURN === -0.28, 'RIG_TURN — 앱 좌석과 같은 기본 바라보는 각도 -0.28'); }
{ const r = rigC(); r.api.updateCreatorLights();
  const b = 0.8, e = 0.5;
  chk(Math.abs(r.st.amb.intensity - 0.95 * b * e) < 1e-9 && Math.abs(r.st.key.intensity - b * e * 1.5) < 1e-9 && Math.abs(r.st.fill.intensity - b * e * 0.4) < 1e-9, '조명 세기 — 앰비언트 0.95×밝기×노출 · 키는 정수리 배율 · 정면 필은 필 배율');
  chk(JSON.stringify(r.st.key.color.h) === '[0.1,0.45,0.85]' && JSON.stringify(r.st.amb.color.h) === '[0.1,0.45,0.85]' && r.st.fill.color.h, '조명 색 — HSL(색상, 0.45, 0.85) 를 세 빛에 같이'); }
{ const r = rigC({ amb: null }); let threw = false; try{ r.api.updateCreatorLights(); }catch(_){ threw = true; }
  chk(!threw && r.st.key.intensity === -1, '렌더러를 아직 안 만들었으면(앰비언트 없음) 아무것도 안 한다'); }
{ const r = rigC({ fill: null }); r.api.updateCreatorLights();
  chk(r.st.key.intensity > 0, '정면 필이 없어도 앰비언트 · 키는 맞춘다'); }
{ const faceMat = { map: { id: 'f' }, emissiveMap: null, emissive: colr(), needsUpdate: false };
  const up = { map: null, emissiveMap: null, color: { r: 1, g: 0.5, b: 0 }, emissive: colr() };
  const r = rigC({ base: { faceMat, upMat: up } }); r.api.updateCreatorLights();
  chk(faceMat.emissiveMap === faceMat.map && faceMat.needsUpdate && faceMat.emissive.r === 0.35, '미리보기 캐릭터 얼굴 — emissiveMap = map · emissive FLAT');
  chk(Math.abs(up.emissive.g - 0.5 * 0.35) < 1e-9 && up.emissiveMap === null, '옷 — 색 × FLAT · 맵이 없으면 emissiveMap 그대로'); }
/* 카메라 궤도 — 위치 = 중심 + 거리 × (sin yaw cos pitch, sin pitch, cos yaw cos pitch) */
{ const cam = { position: v3(), lookAt(t){ this.look = t; } };
  const r = rigC({ cam, dist: 2, yaw: Math.PI / 2, pitch: 0, step: 2 }); r.api.updateCreatorCam();
  chk(Math.abs(cam.position.x - 2) < 1e-9 && Math.abs(cam.position.y - 1) < 1e-9 && Math.abs(cam.position.z) < 1e-9 && cam.look === r.target, '궤도 — 옆(yaw 90°)에서 거리 2 · 중심을 본다');
  chk(r.st.face && r.st.face.dist === 2 && r.st.face.yaw === Math.PI / 2 && r.st.face.target !== r.target && r.st.desk === null, '1~3단계 — 얼굴 각도를 기억(중심은 복사본) · 책상 각도는 그대로'); }
{ const cam = { position: v3(), lookAt(){} };
  const r = rigC({ cam, dist: 3, pitch: Math.PI / 2, step: 4 }); r.api.updateCreatorCam();
  chk(Math.abs(cam.position.y - 4) < 1e-9 && r.st.face === null && r.st.desk === null, '4단계(색) — 위에서(pitch 90°) · 각도는 기억하지 않는다');
  r.st.step = 6; r.api.updateCreatorCam(); chk(r.st.desk && r.st.desk.dist === 3 && r.st.face === null, '5~6단계 — 책상 각도를 기억'); }
{ const r = rigC({ cam: null }); let threw = false; try{ r.api.updateCreatorCam(); }catch(_){ threw = true; }
  chk(!threw && r.st.face === null, '카메라가 없으면 아무것도 안 한다'); }
/* 팔 각도 — 왼 · 오른 팔 본 첫 개씩만 · 사람 / 동물 / 타이핑 */
function skel(){ const mk = (name) => ({ isBone: true, name, quaternion: { got: [], multiply(q){ this.got.push(q.x); } } });
  const bones = [mk('Arm_L'), mk('Hand_L'), mk('arm_r'), mk('Spine'), mk('Leg_L')];
  return { bones, root: { traverse(f){ bones.forEach(f); } } }; }
{ const r = rigC(); const s = skel(); r.api.applyStaticHandRest(s.root);
  chk(JSON.stringify(s.bones.map(b => b.quaternion.got)) === '[[-1],[],[-1],[],[]]', '사람 — 왼 · 오른 팔(hand/arm) 첫 본에만 HAND_REST(-1.0) · 다른 본은 그대로');
  const s2 = skel(); r.api.applyStaticHandRest(s2.root, true); chk(s2.bones[0].quaternion.got[0] === -0.3, '동물 — ANIMAL_HAND_REST(-0.3)');
  const s3 = skel(); r.api.applyStaticHandRest(s3.root, true, true); chk(Math.abs(s3.bones[2].quaternion.got[0] - (-0.3 + 0.25)) < 1e-9, '타이핑 — 쉬는 각도 + FOCUS_ARM_LIFT');
  let threw = false; try{ r.api.applyStaticHandRest(null); }catch(_){ threw = true; } chk(!threw, '모델이 없으면 아무것도 안 한다'); }
/* 책상 아이템 · 파츠 걷기 */
{ const r = rigC(); const removed = [];
  const stray = { parent: { remove: (o) => removed.push(o) } };
  const holder = { deskItems: { cup: { id: 'c' }, gone: stray }, activeDeskItem: 'cup' };
  r.api.clearHolderDeskItems(holder);
  chk(r.calls.some(c => c[0] === 'equip' && c[1] === 'cup' && c[2] === false) && !r.calls.some(c => c[1] === 'pen'), '목록에 있는 아이템은 장착 해제로 뗀다(붙은 것만)');
  chk(removed[0] === stray && holder.deskItems.gone === null && holder.activeDeskItem === null, '목록에 없어도 남은 아이템은 강제로 뗀다 · 활성 아이템 비움');
  let threw = false; try{ r.api.clearHolderDeskItems(null); r.api.clearHolderDeskItems({}); }catch(_){ threw = true; } chk(!threw, '빈 holder 는 건너뛴다'); }
{ const base = { deskItems: {}, equippedPartObjs: { hat: 1 }, stackedPartObjs: { pin: { a: 1 } }, _equipSeq: { hat: 7 } };
  const r = rigC({ base }); r.api.clearCreatorParts();
  chk(JSON.stringify(r.calls.find(c => c[0] === 'sweep')) === '["sweep",0,0]', '파츠 걷기 — 등록부를 먼저 비우고 청소를 돌린다');
  chk(base._equipSeq.hat === 7, '_equipSeq 는 일부러 안 지운다(파싱 중인 옛 장착이 다시 붙지 않게)');
  r.api.clearCreatorItems(); chk(r.calls.some(c => c[0] === 'originClear'), '책상 아이템 걷기 — 처음 자리 기록도 비운다');
  const r2 = rigC({ base: null }); r2.api.clearCreatorParts(); chk(!r2.calls.length, '미리보기가 없으면 아무것도 안 한다'); }

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

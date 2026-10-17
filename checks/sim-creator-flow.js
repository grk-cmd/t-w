/* ═══ 🧍 sim-creator-flow.js — 🧍 생성기 단계 · 닫기 모듈 (2026-10-16 신설 · C 구역 떼기 · w3) ═══════════════
   app.js 의 생성기 단계 이동 · 닫기 을 parts/creator/creator-flow.js 로 옮겼다(글자 그대로 · 바뀐 줄 15 — 읽는 · 쓰는 함수로 바꾼 자리).
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(closeCreator · gotoStep)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 만드는 줄 · deps 47줄 그대로 · 부르는 곳은 creatorFlowMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   ・4절: 동작 — 가짜 DOM · deps 로 모듈을 만들어 입력 → 결과(경계값 포함)를 본다
   [실행] app.js · desk-companion-prototype.html · creator-flow.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["creator-flow.js","parts/creator/creator-flow.js","app/parts/creator/creator-flow.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — creator-flow.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_syncCrColorSwatches","applyDesktopRunClass","blit","clampCharY","clearStampState","detachItemGizmo","isAnimalEditing","isCommissionEditing","isDeskSeatOnly","isDrawStep","renderLauncher","reopenAnimalFromCreator","setStampMode","showEl","toast"];
const VAL_DEPS = ["CANVAS_SZ","_editRoute","blinkC","cBodyCenter","cFaceCenter","camTarget","creatorPrevMod","deskItemOrigin","faceC","histB","redoB"];
const GET_DEPS = ["blinkEdited","cBodyDist","cDesk","cFaceDist","cXform","camDist","camPitch","camYaw","crStep","creatorMode","creatorOpen","currentCreatorDef","deskCamSaved","faceCamSaved","stampMode"];
const SET_DEPS = ["camDist","camPitch","camYaw","crStep","creatorOpen"];
const EXPORTS = ["closeCreator","gotoStep","onItemsStep"];
const MOVED = ["gotoStep","closeCreator"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  CANVAS_SZ: CANVAS_SZ,","  _editRoute: _editRoute,","  _syncCrColorSwatches: (...a)=>_syncCrColorSwatches(...a),","  applyDesktopRunClass: (...a)=>applyDesktopRunClass(...a),","  blinkC: blinkC,","  blinkEdited: ()=>blinkEdited,","  blit: (...a)=>blit(...a),","  cBodyCenter: cBodyCenter,","  cBodyDist: ()=>cBodyDist,","  cDesk: ()=>cDesk,","  cFaceCenter: cFaceCenter,","  cFaceDist: ()=>cFaceDist,","  cXform: ()=>cXform,","  camDist: ()=>camDist,","  camPitch: ()=>camPitch,","  camTarget: camTarget,","  camYaw: ()=>camYaw,","  clampCharY: (...a)=>clampCharY(...a),","  clearStampState: (...a)=>clearStampState(...a),","  crStep: ()=>crStep,","  creatorMode: ()=>creatorMode,","  creatorOpen: ()=>creatorOpen,","  creatorPrevMod: creatorPrevMod,","  currentCreatorDef: ()=>currentCreatorDef,","  deskCamSaved: ()=>deskCamSaved,","  deskItemOrigin: deskItemOrigin,","  detachItemGizmo: (...a)=>detachItemGizmo(...a),","  faceC: faceC,","  faceCamSaved: ()=>faceCamSaved,","  histB: histB,","  isAnimalEditing: (...a)=>isAnimalEditing(...a),","  isCommissionEditing: (...a)=>isCommissionEditing(...a),","  isDeskSeatOnly: (...a)=>isDeskSeatOnly(...a),","  isDrawStep: (...a)=>isDrawStep(...a),","  redoB: redoB,","  renderLauncher: (...a)=>renderLauncher(...a),","  reopenAnimalFromCreator: (...a)=>reopenAnimalFromCreator(...a),","  setStampMode: (...a)=>setStampMode(...a),","  showEl: (...a)=>showEl(...a),","  stampMode: ()=>stampMode,","  toast: (...a)=>toast(...a),","  setCamDist: (v)=>{ camDist = v; },","  setCamPitch: (v)=>{ camPitch = v; },","  setCamYaw: (v)=>{ camYaw = v; },","  setCrStep: (v)=>{ crStep = v; },","  setCreatorOpen: (v)=>{ creatorOpen = v; },"];

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
  const api = new Function(...keys, src + '\nreturn window.TwCreatorFlow;')(...keys.map(k => E[k]));
  return api.createCreatorFlow(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwCreatorFlow = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwCreatorFlow(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(app.includes("const creatorFlowMod = TwCreatorFlow.createCreatorFlow({"), '만드는 줄(가드 없이 — 모듈은 늘 싣는다)');
  t(/\n\}\);\ncreatorFlowMod\.onItemsStep\(\(\)=>deskSetupMod\.renderCrItems\(\)\);/.test(app), '만드는 줄 바로 뒤에서 5단계 아이템 목록을 구독으로 잇는다(creator-flow ↔ desk-setup 순환 없게)');
  const mk = (app.match(new RegExp("const creatorFlowMod = TwCreatorFlow\\.createCreatorFlow\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);")) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(new RegExp("const creatorFlowMod = [\\s\\S]*?\\n\\}\\);"), '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));
  t(!bare.length, '부르는 곳은 creatorFlowMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/creator/creator-flow.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/creator/creator-flow.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/creator/creator-flow.js"></script>', '')],
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const creatorFlowMod = TwCreatorFlow.createCreatorFlow({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const creatorFlowMod = TwCreatorFlow.createCreatorFlow({", "const creatorFlowMod = TwCreatorFlow.createCreatorFlow({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwCreatorFlow = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith("const creatorFlowMod =")) continue; const n = EXPORTS.filter(x => ![].includes(x)).find(x => ls[i].includes("creatorFlowMod." + x)); if(n){ ls[i] = ls[i].replace("creatorFlowMod." + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createCreatorFlow(deps){', 'function createCreatorFlow(deps){ throw new Error("깨 봄");'), null, null],
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

/* 생성기 단계 · 닫기 — 단계마다 보이는 것 · 잠금 · 카메라 각도 복원 · 닫을 때 런처 복귀를 가짜 DOM 으로 본다 */
function v3(x, y, z){ return { x: x || 0, y: y || 0, z: z || 0, copy(o){ this.x = o.x; this.y = o.y; this.z = o.z; return this; } }; }
function rigF(o){
  o = o || {};
  const D = fakeDom();
  ['crSteps', 'crStages'].forEach((id, k) => { const el = D.document.getElementById(id); for(let i = 0; i < (k ? 3 : 6); i++) el.appendChild(D.mkEl('')); });
  const st = Object.assign({ step: 1, open: true, blinkEdited: true, dist: 0, yaw: 9, pitch: 9, face: null, desk: null, deskOnly: false, comm: false, mode: { kind: 'slot', cameFromLauncher: false } }, o);
  const calls = [];
  const log = (n) => (...a) => calls.push([n, ...a]);
  const target = v3();
  const shown = {};
  const over = { _editRoute: o.route || null, CANVAS_SZ: 64, blinkC: { getContext: () => ({ clearRect: log('blinkClear'), drawImage: log('blinkDraw') }) }, faceC: {}, histB: [1, 2], redoB: [3],
    crStep: () => st.step, setCrStep: (v) => { st.step = v; }, creatorOpen: () => st.open, setCreatorOpen: (v) => { st.open = v; },
    blinkEdited: () => st.blinkEdited, stampMode: () => !!st.stamp, setStampMode: log('stamp'),
    isDrawStep: () => st.step === 2 || st.step === 3, isDeskSeatOnly: () => st.deskOnly, isCommissionEditing: () => st.comm, isAnimalEditing: () => false,
    showEl: (id, on) => { shown[id] = on; }, toast: log('toast'), blit: log('blit'), _syncCrColorSwatches: log('swatch'),
    cXform: () => ({ s: 0.7, y: 0.1, rot: 0.2 }), clampCharY: (y) => y, cDesk: () => st.deskObj || null,
    camTarget: target, cFaceCenter: v3(0, 1.3, 0), cBodyCenter: v3(0, 0.8, 0), cFaceDist: () => 1.1, cBodyDist: () => 3.5,
    setCamDist: (v) => { st.dist = v; }, setCamYaw: (v) => { st.yaw = v; }, setCamPitch: (v) => { st.pitch = v; },
    faceCamSaved: () => st.face, deskCamSaved: () => st.desk,
    creatorPrevMod: { crFlatView: null, fitCreator: log('fit'), frameDeskCam: log('frameDesk'), updateCreatorCam: log('cam') },
    creatorMode: () => st.mode, deskItemOrigin: { clear: log('originClear') }, detachItemGizmo: log('gizmo'), clearStampState: log('stampClear'),
    renderLauncher: log('renderLauncher'), applyDesktopRunClass: log('runClass') };
  const api = build(MOD, Object.assign(over, o.over || {}), { document: D.document });
  api.onItemsStep(log('items'));   // app.js 가 구독으로 잇는 아이템 목록 다시 그리기
  return { D, st, api, calls, el: (id) => D.document.getElementById(id), shown, target, n: (k) => calls.filter(c => c[0] === k).length, last: (k) => (calls.filter(c => c[0] === k).pop() || [])[1] };
}
{ const r = rigF(); r.api.gotoStep(1);
  chk(r.st.step === 1 && r.el('skinRow').style.display === 'flex' && r.el('crTools').style.display === 'none' && r.el('crPrev').style.display === 'none' && r.el('crNext').style.display === 'block' && r.el('crDone').style.display === 'none', '1단계 — 피부색 줄 · 그리기 도구 숨김 · [이전] 없음 · [다음] 있음');
  chk(r.shown.charStage === true && r.shown.deskStage === false && r.shown.seatStage === false, '1~4단계는 캐릭터 무대');
  const steps = r.el('crSteps').children; chk(steps[0].classList.contains('on') && !steps[1].classList.contains('on'), '단계 탭 — 지금 단계만 on');
  chk(r.st.dist === 1.1 && r.st.yaw === 0 && r.st.pitch === 0 && r.target.y === 1.3, '얼굴 단계 · 기억한 각도 없음 — 얼굴 중심 · 얼굴 거리 · 정면');
  chk(r.last('fit') === 'edit' && r.n('swatch') === 1 && r.n('blit') === 1, '편집 자세로 맞추고 · 색 스와치 안전망 · 다시 그림'); }
{ const r = rigF(); r.api.gotoStep(2);
  chk(r.el('crTools').style.display === 'flex' && r.el('penHint').style.display === 'block' && r.el('faceCopyBlinkBtn').style.display === 'inline-block', '2단계 — 그리기 도구 · 붓 안내 · [감은눈 복사]');
  r.st.blinkEdited = false; r.api.gotoStep(2); chk(r.el('faceCopyBlinkBtn').disabled === true && /3단계/.test(r.el('faceCopyBlinkBtn').title), '감은눈을 안 그렸으면 [감은눈 복사] 잠금 · 왜 잠겼는지 툴팁'); }
{ const r = rigF({ blinkEdited: false }); r.api.gotoStep(3);
  chk(r.n('blinkClear') === 1 && r.n('blinkDraw') === 1, '3단계 · 감은눈을 아직 안 고쳤으면 — 최신 표정을 감은눈에 복사해 시작');
  const r2 = rigF({ blinkEdited: true }); r2.api.gotoStep(3); chk(r2.n('blinkDraw') === 0, '3단계 · 이미 고쳤으면 복사하지 않는다'); }
{ const r = rigF({ stamp: true }); r.api.gotoStep(4); chk(r.last('stamp') === false && r.el('crColors').style.display === 'flex', '그리기 단계를 벗어나면 도장 모드 끔 · 4단계는 색 고르기');
  r.st.face = { target: v3(1, 2, 3), dist: 9, yaw: 1, pitch: 2 }; r.api.gotoStep(4); chk(r.st.dist === 3.5 && r.st.pitch === 0.04 && r.target.y === 0.8, '4단계 — 몸 전체 정면(얼굴 각도 기억과 무관)'); }
{ const deskObj = { visible: false }; const r = rigF({ deskObj }); r.api.gotoStep(5);
  chk(deskObj.visible === true && r.last('fit') === 'app' && r.n('items') === 1 && r.n('frameDesk') === 1, '5단계 — 책상 보이기 · 앱 자세 · 아이템 목록 · 기억한 각도 없으면 책상 프레이밍');
  r.st.desk = { target: v3(5, 5, 5), dist: 7, yaw: 0.5, pitch: 0.3 }; r.api.gotoStep(6);
  chk(r.st.dist === 7 && r.st.yaw === 0.5 && r.target.x === 5 && r.n('frameDesk') === 1, '6단계 — 5·6 사이 기억한 책상 각도로');
  chk(r.el('crDone').style.display === 'block' && r.el('crNext').style.display === 'none' && r.el('crScale').value === 0.7 && r.el('crZ').value === 0.1, '6단계 — [완료] · 크기 · 높이 슬라이더를 지금 값으로');
  chk(r.el('crStages').children[2].classList.contains('on') && r.el('crStages').children[1].classList.contains('done'), '큰 단계 탭 — 좌석 on · 책상 done'); }
{ const r = rigF({ deskOnly: true, comm: true }); r.api.gotoStep(2);
  chk(r.st.step === 5 && r.last('toast') === '커미션 캐릭터는 수정할 수 없어요.', '커미션 — 1~4단계로 못 간다(5단계에 머묾 · 안내)');
  chk(r.el('crSteps').children[0].style.opacity === '0.35' && r.el('crSteps').children[4].style.opacity === '', '커미션 — 1~4단계 탭은 흐리게 · 줄 긋기'); }
{ const route = { stepRoute: (def, n) => ({ step: 5, toast: '동물은 책상부터' }) };
  const r = rigF({ route, over: { reopenAnimalFromCreator: () => false, currentCreatorDef: () => ({ animal: true }) } }); r.api.gotoStep(1);
  chk(r.st.step === 5 && r.last('toast') === '동물은 책상부터', '편집 길(_editRoute)이 정한 단계 · 안내를 따른다'); }
{ const route = { stepRoute: () => ({ animal: true }) }; let reopened = 0;
  const r = rigF({ route, over: { reopenAnimalFromCreator: () => { reopened++; return true; } } }); r.st.step = 5; r.api.gotoStep(2);
  chk(reopened === 1 && r.st.step === 5 && r.n('blit') === 0, '동물 얼굴 단계 — 동물 생성기로 넘기고 여기선 아무것도 안 바꾼다'); }
/* 닫기 */
{ const r = rigF({ mode: { kind: 'seat', cameFromLauncher: true } }); r.el('creatorOverlay').classList.add('on'); r.el('wardrobePanel').classList.add('on');
  r.api.closeCreator();
  chk(r.st.open === false && !r.el('creatorOverlay').classList.contains('on') && !r.el('wardrobePanel').classList.contains('on'), '닫기 — 창 끄기 · 꾸미기 창도 닫기');
  chk(['originClear', 'gizmo', 'stampClear', 'runClass'].every(k => r.n(k) === 1), '닫기 — 처음 자리 · 기즈모 · 도장 정리 · 화면 모드 다시 계산');
  chk(r.el('launcher').classList.contains('on') && r.n('renderLauncher') === 1, '런처에서 들어왔으면(우클릭 수정도) 런처로 돌아간다'); }
{ const r = rigF({ mode: { kind: 'slot', cameFromLauncher: true, afterApp: true } }); r.api.closeCreator();
  chk(!r.el('launcher').classList.contains('on') && r.n('renderLauncher') === 0, '실행 중 [＋자리] 흐름(afterApp)은 런처로 안 간다'); }
{ const r = rigF(); r.el('creatorClose').fire('click'); chk(r.st.open === false, '[✕] 버튼이 closeCreator 에 걸려 있다'); }

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

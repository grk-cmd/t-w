/* sim-stroke-pointer.js — 🖊 그림판 획이 이어지나 · 끊겼나(parts/shared/stroke-pointer.js)를 실제로 돌려 본다
   실행: node checks/run.js sim-stroke-pointer
   ・1절 판정 — isDown(주 버튼 비트) · onLost(pointercancel · lostpointercapture 둘 다)
   ・2절 사람 만들기 그림판(creator-canvas.js) — 가짜 캔버스에 포인터 이벤트를 넣어 본다: 뗀 펜은 안 그림 · 끊기면 획 끝 · 마우스 획은 그대로
   ・3절 배선 — 동물 만들기(animal.js) · CSS touch-action · html · smoke 순서 · app.js deps
   ・4절 mutation test */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('shared/stroke-pointer.js'), CC = read('creator/creator-canvas.js'), AN = read('character/animal.js');
const HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js'), APP = read('app.js');
if(!SRC || !CC || !AN || !HTML || !SMOKE || !APP){ say('  ? 원본 못 찾음'); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwStrokePointer; };

/* 사람 만들기 그림판을 가짜 문서 위에 세운다 — 캔버스에 건 처리기를 L 로 받아 직접 부른다 */
function canvasWorld(spSrc, ccSrc){
  const L = {}, log = [];
  const el = (id) => new Proxy({ id, parentNode: { insertBefore(){}, appendChild(){}, removeChild(){} }, insertBefore(){}, children: [], value: '#000000', appendChild(c){ return c; }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 10, height: 10 }), style: {}, classList: { add(){}, remove(){}, toggle(){}, contains: () => false }, dataset: {},
    addEventListener(ev, fn){ L[id + ':' + ev] = fn; }, setPointerCapture(){ log.push('capture'); }, querySelectorAll: () => [] },
    { get: (x, k) => (k in x ? x[k] : () => undefined), set: (x, k, v) => { x[k] = v; return true; } });
  const els = {}; const doc = { getElementById: (id) => (els[id] = els[id] || el(id)), createElement: () => el('new'), addEventListener(){}, body: el('body') };
  const ctx = { clearRect(){}, drawImage(){}, getImageData: () => ({}), putImageData(){} };
  const cv = () => ({ getContext: () => ctx });
  const crState = { crStep: 2, skinIndex: 0, stampMode: false, crPaintTool: null, painting: false, camYaw: 0, camPitch: 0 };
  const deps = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({})) });
  Object.assign(deps, { bindHold(){}, blinkC: cv(), faceC: cv(), dispC: cv(), dispTex: {}, CANVAS_SZ: 512, crState, creatorOpen: () => true,
    creatorPrevMod: () => ({ updateCreatorCam(){ log.push('cam'); } }), crStampMod: { bindStampOverlay(){} }, skinCanvases: [cv()], skinCanvasFor: () => cv(), SKIN_COLORS: [],
    paintStrokeMod: { _paintBreak(){}, paintFromEvent: () => log.push('paint'), bucketFromEvent(){}, eyedropFromEvent: () => log.push('eyedrop') },
    wardrobeMod: { ORBIT_DRAG_DIR: 1 }, strokePointer: load(spSrc), toast(){}, newCanvas: cv });
  const win = {};
  const g = { window: win, document: doc, TwSafeHtml: { cssColor: (c) => c }, Image: class {}, console: { log(){}, warn(){}, error(){} }, setTimeout, module: undefined, THREE: {},
    requestAnimationFrame: () => 0, navigator: {}, localStorage: {}, addEventListener(){}, removeEventListener(){}, innerWidth: 100, innerHeight: 100 };
  const names = Object.keys(g);
  new Function(...names, ccSrc)(...names.map(n => g[n]));
  win.TwCreatorCanvas.createCreatorCanvas(deps).bindPaint();
  const fire = (type, e) => L['creatorPreview:' + type](Object.assign({ clientX: 5, clientY: 5, pointerId: 1, button: 0, buttons: 1, preventDefault(){} }, e));
  const paints = () => log.filter(x => x === 'paint').length;
  return { L, log, crState, fire, paints };
}

function judge(spSrc, ccSrc){
  const r = []; const t = (ok, msg) => r.push([!!ok, msg]);
  const S = load(spSrc);
  /* 1절 */
  t(S.isDown({ buttons: 1 }) === true && S.isDown({ buttons: 0 }) === false, 'isDown — 주 버튼이 눌렸으면 true · 뗀 펜(떠 있음 buttons 0)은 false');
  t(S.isDown({ buttons: 3 }) === true && S.isDown({ buttons: 33 }) === true, '  ↳ 다른 버튼(옆 버튼 2 · 지우개 32)이 같이 눌려도 주 버튼 비트만 본다');
  t(S.isDown({ buttons: 2 }) === false && S.isDown({ buttons: 32 }) === false && S.isDown({ buttons: 4 }) === false, '  ↳ 주 버튼 없이 다른 버튼만이면 false');
  t(S.isDown({}) === false && S.isDown(null) === false && S.isDown({ buttons: undefined }) === false, '  ↳ 값이 없으면 false(던지지 않는다)');
  { const got = []; let n = 0; S.onLost({ addEventListener: (ty, fn) => got.push([ty, fn]) }, () => { n++; });
    got.forEach(([, fn]) => fn({}));
    t(got.map(x => x[0]).sort().join() === 'lostpointercapture,pointercancel' && n === 2, 'onLost — pointercancel · lostpointercapture 둘 다에 건다'); }
  t(Object.isFrozen(S), '내놓는 묶음은 얼려 있다');

  /* 2절 */
  let w = canvasWorld(spSrc, ccSrc);
  w.fire('pointerdown', {}); w.fire('pointermove', { clientX: 6 }); w.fire('pointermove', { clientX: 7 });
  t(w.crState.painting === true && w.paints() === 3, '마우스 · 닿은 펜 — 누르고 끌면 예전처럼 그린다(누를 때 1 + 움직임 2)');
  w.fire('pointerup', {}); const n0 = w.paints(); w.fire('pointermove', { clientX: 8, buttons: 0 });
  t(w.crState.painting === false && w.paints() === n0, '  ↳ 떼면 끝 — 뒤 움직임은 안 그린다');
  w = canvasWorld(spSrc, ccSrc);
  w.fire('pointerdown', {}); const n1 = w.paints();
  w.fire('pointermove', { clientX: 9, buttons: 0 }); w.fire('pointermove', { clientX: 12, buttons: 0 });
  t(w.paints() === n1 && w.crState.painting === false, '★ pointerup 없이 펜이 떠서 움직이면(buttons 0) 안 그리고 획을 끝낸다');
  w.fire('pointermove', { clientX: 14, buttons: 1 });
  t(w.paints() === n1, '  ↳ 끝난 뒤엔 다시 눌러야(pointerdown) 그린다');
  for(const ev of ['pointercancel', 'lostpointercapture']){
    w = canvasWorld(spSrc, ccSrc);
    w.fire('pointerdown', {}); const n2 = w.paints();
    const has = typeof w.L['creatorPreview:' + ev] === 'function';
    if(has) w.fire(ev, {});
    w.fire('pointermove', { clientX: 20, buttons: 1 });
    t(has && w.crState.painting === false && w.crState.lastPX === null && w.paints() === n2, '★ ' + ev + ' — 획이 끊기면 끝낸다(뒤 움직임을 안 그림 · 이어 그릴 앞 점도 비움)');
  }
  w = canvasWorld(spSrc, ccSrc);
  w.fire('pointerdown', { button: 2, buttons: 2 });
  const hadOrbit = !!w.crState._rcOrbit;
  if(w.L['creatorPreview:pointercancel']) w.fire('pointercancel', {});
  w.fire('pointermove', { clientX: 60, buttons: 0 });
  t(hadOrbit && w.crState._rcOrbit === null && !w.log.includes('cam'), '우클릭 회전 중 끊겨도 회전이 붙어 있지 않는다');
  /* 정상 흐름 — pointerup 뒤에 lostpointercapture 가 온다(캡처 암묵 해제). 스포이드는 한 번 · 상태는 깨끗 */
  w = canvasWorld(spSrc, ccSrc);
  w.fire('pointerdown', { button: 2, buttons: 2 }); w.fire('pointerup', { button: 2, buttons: 0 });
  if(w.L['creatorPreview:lostpointercapture']) w.fire('lostpointercapture', {});
  t(w.log.filter(x => x === 'eyedrop').length === 1 && w.crState._rcOrbit === null && w.crState.painting === false, '우클릭 콕(안 움직이고 뗌) → 스포이드 한 번 · 뒤따르는 lostpointercapture 가 다시 부르거나 상태를 깨지 않는다');
  return r;
}

say('── 1 · 2. 판정 · 사람 만들기 그림판');
judge(SRC, CC).forEach(([ok, msg]) => chk(ok, msg));

say('── 3. 배선');
{
  /* 스타일시트 규칙이어야 한다 — 같은 캔버스에 붙는 TransformControls 가 pointerup 마다 inline style.touchAction 을 '' 로 비운다(규칙은 남는다) */
  const css = [...HTML.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (sel) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].some(m => m[1].split(',').map(x => x.trim()).includes(sel) && /touch-action:\s*none/.test(m[2]));
  chk(rule('#anpCv') && rule('#creatorPreview'), '그림판 캔버스 둘(동물 #anpCv · 사람 #creatorPreview) — 스타일시트 규칙으로 touch-action:none');
  chk(!/id="anpCv"[^>]*touch-action/.test(AN) && !/touchAction\s*=/.test(AN) && !/touchAction\s*=/.test(CC), '  ↳ inline 으로 걸지 않는다(기즈모가 지운다)');
  chk(/domElement\.style\.touchAction = ''/.test(read('vendor/three/TransformControls.js') || read('three/TransformControls.js') || ''), '  (전제 확인) TransformControls 가 pointerup 에서 inline touchAction 을 비운다 — 이 줄이 없어지면 위 함정 주석을 다시 본다');
  chk(/const strokePointer = deps\.strokePointer;/.test(AN) && /if\(pPainting\)\{ if\(!strokePointer\.isDown\(e\)\)\{ pEndStroke\(\); return; \} pPaintEvent\(e,false\); return; \}/.test(AN), '동물 만들기 — 뗀 펜은 그리지 않고 획을 끝낸다');
  chk(/strokePointer\.onLost\(cv, \(\)=>\{ pEndStroke\(\); _rcDown=null; dragging=false; \}\);/.test(AN) && /const pEndStroke=\(\)=>\{ pPainting=false; pLastX=pLastY=null; pLastSX=pLastSY=null; \};/.test(AN), '동물 만들기 — 끊기면 획 · 우클릭 회전을 끝낸다');
  chk((AN.match(/pPainting=false;/g) || []).length === 1 && (CC.match(/crState\.painting=false/g) || []).length === 1, '획 끝내기는 그림판마다 한 곳(pEndStroke · endStroke)');
  const iS = HTML.indexOf('parts/shared/stroke-pointer.js'), iA = HTML.indexOf('src="parts/app.js"'), iC = HTML.indexOf('parts/creator/creator-canvas.js'), iN = HTML.indexOf('parts/character/animal.js');
  chk(iS > 0 && iS < iA && iS < iC && iS < iN, 'html — stroke-pointer.js 를 쓰는 모듈 · app.js 보다 먼저 싣는다');
  const pS = SMOKE.indexOf("PRELOAD.push('stroke-pointer.js')"), pA = SMOKE.indexOf("PRELOAD.push('animal.js')"), pC = SMOKE.indexOf("PRELOAD.push('creator-canvas.js')");
  chk(pS > 0 && (pA < 0 || pS < pA) && (pC < 0 || pS < pC), 'smoke — PRELOAD 에도 먼저');
  chk(/^const strokePointer = TwStrokePointer;/m.test(APP) && (APP.match(/^  strokePointer: strokePointer,$/gm) || []).length === 2, 'app.js — 사람 · 동물 만들기 두 곳에 deps 로 넘긴다');
}

say('── 4. mutation test');
{
  const reds = (sp, cc) => { try{ return judge(sp, cc).filter(([ok]) => !ok).length; }catch(_){ return 99; } };
  chk(reds(SRC, CC) === 0, '원본은 빨강 0');
  const M = [
    ['뗀 펜도 눌린 것으로', SRC.replace('=== PRIMARY; }', '=== PRIMARY || true; }'), CC],
    ['아무 버튼이나 눌림으로', SRC.replace('((e.buttons | 0) & PRIMARY) === PRIMARY', '(e.buttons | 0) !== 0'), CC],
    ['pointercancel 을 안 건다', SRC.replace("el.addEventListener('pointercancel', fn);", ''), CC],
    ['lostpointercapture 를 안 건다', SRC.replace("el.addEventListener('lostpointercapture', fn);", ''), CC],
    ['그림판이 눌림을 안 본다', SRC, CC.replace('if(!strokePointer.isDown(e)){ endStroke(); return; }', '')],
    ['그림판이 끊김을 안 듣는다', SRC, CC.replace('strokePointer.onLost(cv, ()=>{ crState._rcOrbit=null; endStroke(); });', '')],
    ['끊겨도 회전이 남는다', SRC, CC.replace('()=>{ crState._rcOrbit=null; endStroke(); }', '()=>{ endStroke(); }')],
  ];
  for(const [name, sp, cc] of M) chk((sp !== SRC || cc !== CC) && reds(sp, cc) > 0, name + ' → 빨강');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

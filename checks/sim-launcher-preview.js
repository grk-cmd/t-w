/* ═══ 🖼️ sim-launcher-preview.js — 🖼️ 런처 미리보기 · 슬롯 섬네일 모듈 (2026-10-16 신설 · C 구역 떼기 · w3) ═══════════════
   app.js 의 런처 미리보기 · 슬롯 섬네일 구역 본문 을 parts/launcher/launcher-preview.js 로 옮겼다(글자 그대로 · 바뀐 줄 3 — 읽는 · 쓰는 함수로 바꾼 자리).
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(ensureLauncherPreview · lHolder · lRenderer · launcherLoop · setLauncherChar · sizeLauncherPreview)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 만드는 줄 · deps 36줄 그대로(몸 재기 measureBodyBox · 외모 지문 _quickHash 더함) · 부르는 곳은 launcherPrevMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   ・4절: 런처 부하 — 미리보기는 FrameBudget.FPS_LAUNCHER 까지만 그린다(120Hz 에서 1초 30장) · 깜빡임은 좌석과 같은 시간표(blink-timing.js · 실제 시각 · 주사율과 무관) · 후원 반짝임은 steps(초당 20번 칠하기)
   [실행] app.js · desk-companion-prototype.html · launcher-preview.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
const FB_SRC = ["frame-budget.js","parts/shared/frame-budget.js","app/parts/shared/frame-budget.js"].map(read).find(Boolean);
const BT_SRC = ["blink-timing.js","parts/shared/blink-timing.js","app/parts/shared/blink-timing.js"].map(read).find(Boolean);
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["launcher-preview.js","parts/launcher/launcher-preview.js","app/parts/launcher/launcher-preview.js"].map(read).find(Boolean);
const GATE_SRC = ["idle-gate.js","parts/shared/idle-gate.js","app/parts/shared/idle-gate.js"].map(read).find(Boolean);
if(!MOD || !FB_SRC || !BT_SRC || !GATE_SRC){ say('  ? 원본 못 찾음 — launcher-preview.js · frame-budget.js · blink-timing.js · idle-gate.js'); process.exit(2); }
/* 😴 shared/idle-gate.js 진짜 파일 — MO 는 부르는 쪽 가짜(없으면 아무것도 안 하는 것) */
const loadGate = (MO) => { const w = { MutationObserver: MO || class { observe(){} disconnect(){} } }; new Function('window', 'module', GATE_SRC)(w, undefined); return w.TwIdleGate; };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_quickHash","_mkFrontFill","_setDeskMatColor","allDeskItems","applyDeskColorToCustom","applyDeskItemsTo","applyEquippedPartsToSeat","applyStaticHandRest","b64ToBuf","buildDesk","clampCharY","clearHolderDeskItems","defToBase","equipDeskItem","extractBonesInto","getCommissionScene","measureBodyBox","registerCustomItem","setDeskPos","setDeskScale","setFaceMap","swapDeskVisual"];
const VAL_DEPS = ["CHAR_Z","FrameBudget","blinkTiming","RIG_TURN","_FILL_LIGHT_MUL","_KEY_LIGHT_MUL","_MAIN_LIGHT_COL","_MAIN_LIGHT_INT","commSceneCache","scene","slots"];
const GET_DEPS = ["assetCodeMod","customItems","slotSaveMod"];
const SET_DEPS = [];
const EXPORTS = ["ensureLauncherPreview","lHolder","lRenderer","launcherLoop","setLauncherChar","sizeLauncherPreview","startLauncherLoop"];
const MOVED = ["lRenderer","lScene","lCam","lChar","lBlinkT","lBlinkOn","lHolder","lDeskMat","lScaleHint","lCharBaseY","lFrameH","lFrameZ","LAUNCHER_CHAR_Y","PS1_PIXEL_SCALE","ensureLauncherPreview","_lcBodyBox","sizeLauncherPreview","LC_THUMB_SETTLE_MS","LC_THUMB_MAX","_lcThumbJob","_lcThumbArm","_lcThumbTake","setLauncherChar","launcherLoop"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  CHAR_Z: CHAR_Z,","  FrameBudget: FrameBudget,","  blinkTiming: TwBlinkTiming,","  RIG_TURN: RIG_TURN,","  _FILL_LIGHT_MUL: _FILL_LIGHT_MUL,","  _KEY_LIGHT_MUL: _KEY_LIGHT_MUL,","  _MAIN_LIGHT_COL: _MAIN_LIGHT_COL,","  _MAIN_LIGHT_INT: _MAIN_LIGHT_INT,","  _quickHash: (...a)=>roomSyncMod._quickHash(...a),","  _mkFrontFill: (...a)=>_mkFrontFill(...a),","  _setDeskMatColor: (...a)=>_setDeskMatColor(...a),","  allDeskItems: (...a)=>allDeskItems(...a),","  applyDeskColorToCustom: (...a)=>applyDeskColorToCustom(...a),","  applyDeskItemsTo: (...a)=>applyDeskItemsTo(...a),","  applyEquippedPartsToSeat: (...a)=>applyEquippedPartsToSeat(...a),","  applyStaticHandRest: (...a)=>applyStaticHandRest(...a),","  assetCodeMod: ()=>assetCodeMod,","  b64ToBuf: (...a)=>b64ToBuf(...a),","  buildDesk: (...a)=>buildDesk(...a),","  clampCharY: (...a)=>clampCharY(...a),","  clearHolderDeskItems: (...a)=>clearHolderDeskItems(...a),","  commSceneCache: commSceneCache,","  customItems: ()=>customItems,","  defToBase: (...a)=>defToBase(...a),","  equipDeskItem: (...a)=>equipDeskItem(...a),","  extractBonesInto: (...a)=>extractBonesInto(...a),","  getCommissionScene: (...a)=>getCommissionScene(...a),","  measureBodyBox: (...a)=>bodyMeasureMod.measureBodyBox(...a),","  registerCustomItem: (...a)=>registerCustomItem(...a),","  scene: scene,","  setDeskPos: (...a)=>setDeskPos(...a),","  setDeskScale: (...a)=>setDeskScale(...a),","  setFaceMap: (...a)=>setFaceMap(...a),","  slotSaveMod: ()=>slotSaveMod,","  slots: slots,","  swapDeskVisual: (...a)=>swapDeskVisual(...a),"];

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
    performance: { now: () => 0 }, console: { log(){}, warn(){}, error(){} }, Image: any, confirm: () => true, devicePixelRatio: 1, TwIdleGate: loadGate() }, env || {});
  const keys = Object.keys(E);
  const api = new Function(...keys, src + '\nreturn window.TwLauncherPreview;')(...keys.map(k => E[k]));
  return api.createLauncherPreview(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwLauncherPreview = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwLauncherPreview(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(app.includes("const launcherPrevMod = TwLauncherPreview.createLauncherPreview({"), '만드는 줄(가드 없이 — 모듈은 늘 싣는다)');
  const mk = (app.match(new RegExp("const launcherPrevMod = TwLauncherPreview\\.createLauncherPreview\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);")) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(new RegExp("const launcherPrevMod = [\\s\\S]*?\\n\\}\\);"), '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));
  t(!bare.length, '부르는 곳은 launcherPrevMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/launcher/launcher-preview.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/launcher/launcher-preview.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/launcher/launcher-preview.js"></script>', '')],
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const launcherPrevMod = TwLauncherPreview.createLauncherPreview({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const launcherPrevMod = TwLauncherPreview.createLauncherPreview({", "const launcherPrevMod = TwLauncherPreview.createLauncherPreview({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwLauncherPreview = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith("const launcherPrevMod =")) continue; const n = EXPORTS.filter(x => ![].includes(x)).find(x => ls[i].includes("launcherPrevMod." + x)); if(n){ ls[i] = ls[i].replace("launcherPrevMod." + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createLauncherPreview(deps){', 'function createLauncherPreview(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [nm, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), nm + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}

say('── 4. 런처 부하 — 프레임 상한 · 깜빡임 시간 · 후원 반짝임');
function judgeLoad(mod, fbSrc, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const fbWin = {}; new Function('window', 'module', fbSrc)(fbWin, undefined);
  const FB = fbWin.FrameBudget;
  const btWin = {}; new Function('window', 'module', BT_SRC)(btWin, undefined);
  const BT = btWin.TwBlinkTiming;
  /* 같은 씨앗이면 같은 난수 — 앱의 Math.random 자리에 꽂는다 */
  const seeded = (seed) => { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; };
  /* 미리보기 하나를 가짜로 띄운다 — render 횟수 · 얼굴 바꾸기 · 시간표 부름을 센다 */
  function rig(seed){
    const st = { renders: 0, faces: [], made: 0, scheduled: 0, vis: true };
    const any = anything();
    const THREE3 = new Proxy({}, { get: (o, k) => k === 'WebGLRenderer' ? function(){ return new Proxy({ render(){ st.renders++; } }, { get: (x, kk) => kk in x ? x[kk] : any }); } : any });
    const launcherEl = { classList: { contains: (c) => c === 'on' && st.vis } };
    const doc = new Proxy({}, { get: (o, k) => k === 'getElementById' ? ((id) => id === 'launcher' ? launcherEl : any) : any });
    const rand = seeded(seed);
    const bt = { SHUT_AT: BT.SHUT_AT, createBlink: (now) => { st.made++; return BT.createBlink(now, rand); }, scheduleBlinks: (bl, now) => { st.scheduled++; return BT.scheduleBlinks(bl, now, rand); }, eyeClose: (bl, now) => BT.eyeClose(bl, now) };
    const base = { group: any, faceMat: { id: 'face' }, fT: 'OPEN', bT: 'SHUT' };
    const api = build(mod, { FrameBudget: FB, blinkTiming: bt, defToBase: () => base, setFaceMap: (m, tex) => st.faces.push(tex) }, { THREE: THREE3, document: doc, performance: { now: () => 0 } });
    api.ensureLauncherPreview(); api.setLauncherChar({});
    st.renders = 0;
    return { st, api };
  }
  let g = null;
  try{ g = rig(5); }catch(e){ t(false, '가짜 미리보기 만들기 — ' + String(e.message || e).slice(0, 80)); return r; }
  for(let i = 1; i <= 120; i++) g.api.launcherLoop(i * 1000 / 120);
  t(FB.FPS_LAUNCHER > 0 && Math.abs(g.st.renders - FB.FPS_LAUNCHER) <= 1, '120Hz 로 1초 — 미리보기를 ' + g.st.renders + '번 그린다(상한 ' + FB.FPS_LAUNCHER + ' · 주사율만큼 그리지 않는다)');
  /* 깜빡임 — 좌석과 같은 시간표를 부르고, 주사율이 달라도 1분에 감는 횟수가 같다 */
  const shuts = (hz) => { const x = rig(9); for(let i = 1; i <= hz * 60; i++) x.api.launcherLoop(i * 1000 / hz); return x; };
  const h120 = shuts(120), h60 = shuts(60), h144 = shuts(144);
  const nShut = (x) => x.st.faces.filter(f => f === 'SHUT').length;
  t(h120.st.made === 1 && h120.st.scheduled > 0, '깜빡임은 blink-timing.js(좌석과 같은 시간표)를 부른다 — 처음 값 한 번 · 예약은 그릴 때마다');
  t(h120.st.faces.every((f, i) => f === (i % 2 ? 'OPEN' : 'SHUT')), '감은 눈 · 뜬 눈 그림이 번갈아 바뀐다(같은 그림을 두 번 안 넣음)');
  /* 기준 — 시간표를 1ms 마다 직접 돌린 1분(같은 씨앗) */
  const ref = (() => { const rd = seeded(9); const bl = BT.createBlink(1000 / 120, rd); let n = 0, sh = false; for(let ms = 1; ms <= 60000; ms++){ BT.scheduleBlinks(bl, ms, rd); const x = BT.eyeClose(bl, ms) > BT.SHUT_AT; if(x && !sh) n++; sh = x; } return n; })();
  t(nShut(h120) > 10 && [h60, h120, h144].every(x => Math.abs(nShut(x) - ref) <= 1), '1분에 눈 감는 횟수 — 60 · 120 · 144Hz 모두 ' + nShut(h60) + ' · ' + nShut(h120) + ' · ' + nShut(h144) + ' · 실제 시각 기준 ' + ref + '(주사율 · 프레임 상한과 무관)');
  t(!/lBlinkT|LC_BLINK_|_lcBlinkStep/.test(mod), '런처만의 깜빡임 셈(lBlinkT · 따로 둔 박자)이 남지 않았다 — 좌석과 같은 시간표 하나');
  const css = (html.match(/\.donate-shine\{[^}]*\}/) || [''])[0];
  t(/animation:donateShine [\d.]+s steps\(\d+\) infinite/.test(css), '후원 반짝임은 steps — 주사율만큼 글자를 다시 칠하지 않는다');
  return r;
}
const rows4 = judgeLoad(MOD, FB_SRC, HTML);
rows4.forEach(([ok, msg]) => chk(ok, msg));
const breaks4 = [
  ['상한 없이 그림', m => m.replace('_lBudget.admit(now, FrameBudget.FPS_LAUNCHER)', 'true'), null],
  ['깜빡임을 프레임 수로 셈', m => m.replace('blinkTiming.scheduleBlinks(lBlink, now);', 'lBlink.f = (lBlink.f || 0) + 16; blinkTiming.scheduleBlinks(lBlink, lBlink.f);').replace('blinkTiming.eyeClose(lBlink, now)', 'blinkTiming.eyeClose(lBlink, lBlink.f)'), null],
  ['반짝임 linear', null, h => h.replace(/(animation:donateShine [\d.]+s )steps\(\d+\)/, '$1linear')],
];
for(const [nm, fm, fh] of breaks4){
  const m2 = fm ? fm(MOD) : MOD, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || h2 !== HTML;
  let r2; try{ r2 = judgeLoad(m2, FB_SRC, h2); }catch(_){ r2 = [[false, '던짐']]; }
  chk(changed && r2.some(([ok]) => !ok), '깨 보기: ' + nm + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}

say('── 5. 닫힌 런처는 rAF 를 걸지 않는다 — 열리면 다음 rAF 에 다시(가짜 rAF · 가짜 MutationObserver)');
/* 가짜 무대: rAF 줄 · class 바꾸면 감시자를 부르는 #launcher · render 를 세는 렌더러 */
function judgeSleep(mod){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const fbWin = {}; new Function('window', 'module', FB_SRC)(fbWin, undefined);
  const btWin = {}; new Function('window', 'module', BT_SRC)(btWin, undefined);
  const st = { renders: 0, q: [], obs: [], cls: new Set(['on']), now: 0, made: 0 };
  const BT = btWin.TwBlinkTiming;
  const bt = { SHUT_AT: BT.SHUT_AT, createBlink: (now) => { st.made++; return BT.createBlink(now); }, scheduleBlinks: (b, now) => BT.scheduleBlinks(b, now), eyeClose: (b, now) => BT.eyeClose(b, now) };
  const any = anything();
  const MO = class { constructor(fn){ this.fn = fn; } observe(el, o){ if(o && o.attributeFilter && o.attributeFilter.includes('class')) st.obs.push(this.fn); } disconnect(){} };
  const flip = (on) => { on ? st.cls.add('on') : st.cls.delete('on'); st.obs.forEach(f => f([])); };
  const launcherEl = { classList: { contains: (c) => st.cls.has(c) } };
  const doc = new Proxy({}, { get: (o, k) => k === 'getElementById' ? ((id) => id === 'launcher' ? launcherEl : any) : any });
  const THREE3 = new Proxy({}, { get: (o, k) => k === 'WebGLRenderer' ? function(){ return new Proxy({ render(){ st.renders++; } }, { get: (x, kk) => kk in x ? x[kk] : any }); } : any });
  const raf = (fn) => { st.q.push(fn); return st.q.length; };
  const step = (n) => { for(let i = 0; i < n; i++){ st.now += 1000 / 60; const q = st.q; st.q = []; q.forEach(f => f(st.now)); } };
  let api;
  try{ api = build(mod, { FrameBudget: fbWin.FrameBudget, blinkTiming: bt, defToBase: () => ({ group: any, faceMat: {}, fT: 1, bT: 2 }) },
    { THREE: THREE3, document: doc, requestAnimationFrame: raf, TwIdleGate: loadGate(MO), performance: { now: () => st.now } }); }
  catch(e){ t(false, '가짜 런처 만들기 — ' + String(e.message || e).slice(0, 80)); return r; }
  api.ensureLauncherPreview(); api.setLauncherChar({});
  t(st.q.length === 0, '만들기만 해서는 rAF 를 안 건다(시작은 app.js 의 startLauncherLoop 한 줄)');
  api.startLauncherLoop(); api.startLauncherLoop();
  t(st.q.length === 1, '열린 채 시작 — rAF 하나(두 번 불러도 하나)');
  step(60);
  const r1 = st.renders;
  t(r1 > 0 && st.q.length === 1, '열려 있으면 매 rAF 마다 다시 건다 · 그린다(' + r1 + '장 / 1초)');
  t(st.made === 1, '  열린 동안 깜빡임 시간표는 처음 한 번만 만든다');
  flip(false); step(1);
  t(st.q.length === 0, '★ 닫히면 그 다음 rAF 에서 멈춘다 — 더 걸지 않는다');
  const r2 = st.renders; step(600);
  t(st.renders === r2 && st.q.length === 0, '  닫힌 10초 동안 깨어나지도 · 그리지도 않는다');
  flip(true);
  t(st.q.length === 1, '★ 다시 열면(class 변화) 그 자리에서 rAF 를 하나 건다');
  step(1);
  t(st.renders === r2 + 1, '  다음 rAF 에 바로 한 장 — 첫 장이 늦지 않다');
  t(st.made === 2, '★ 숨겼다 다시 열면 깜빡임 시간표를 새로 만든다(밀린 예약이 바로 터지지 않게 — 멈출 때 비운다)');
  flip(true); flip(false); flip(true);
  t(st.q.length === 1, '  돌고 있는 중에 여닫아도 반복은 한 벌');
  flip(false); flip(true);
  t(st.q.length === 1, '  닫힌 것을 보기 전에 다시 열면 이미 걸린 rAF 가 이어 간다(두 벌 안 됨)');
  return r;
}
const rows5 = judgeSleep(MOD);
rows5.forEach(([ok, msg]) => chk(ok, msg));
const breaks5 = [
  ['닫혀도 계속 rAF', m => m.replace("isOn: ()=>el.classList.contains('on'),", 'isOn: ()=>true,')],
  ['열려도 안 깨움', m => m.replace("TwIdleGate.onClassChange(el, ()=>_lLoop.wake());", '')],
  ['숨겨도 시간표를 안 비움', m => m.replace("sleep: ()=>{ lBlink=null; },", 'sleep: ()=>{},')],
];
for(const [nm, fm] of breaks5){
  const m2 = fm(MOD);
  let r2; try{ r2 = judgeSleep(m2); }catch(_){ r2 = [[false, '던짐']]; }
  chk(m2 !== MOD && r2.some(([ok]) => !ok), '깨 보기: ' + nm + (m2 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

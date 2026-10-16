/* ═══ 🖼️ sim-launcher-preview.js — 🖼️ 런처 미리보기 · 슬롯 섬네일 모듈 (2026-10-16 신설 · C 구역 떼기 · w3) ═══════════════
   app.js 의 런처 미리보기 · 슬롯 섬네일 구역 본문 을 parts/launcher/launcher-preview.js 로 옮겼다(글자 그대로 · 바뀐 줄 3 — 읽는 · 쓰는 함수로 바꾼 자리).
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(ensureLauncherPreview · lHolder · lRenderer · launcherLoop · setLauncherChar · sizeLauncherPreview)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 만드는 줄 · deps 32줄 그대로 · 부르는 곳은 launcherPrevMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · launcher-preview.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["launcher-preview.js","parts/launcher/launcher-preview.js","app/parts/launcher/launcher-preview.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — launcher-preview.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_mkFrontFill","_setDeskMatColor","allDeskItems","applyDeskColorToCustom","applyDeskItemsTo","applyEquippedPartsToSeat","applyStaticHandRest","b64ToBuf","buildDesk","clampCharY","clearHolderDeskItems","defToBase","equipDeskItem","extractBonesInto","getCommissionScene","registerCustomItem","setDeskPos","setDeskScale","setFaceMap","swapDeskVisual"];
const VAL_DEPS = ["CHAR_Z","RIG_TURN","_FILL_LIGHT_MUL","_KEY_LIGHT_MUL","_MAIN_LIGHT_COL","_MAIN_LIGHT_INT","commSceneCache","scene","slots"];
const GET_DEPS = ["assetCodeMod","customItems","slotSaveMod"];
const SET_DEPS = [];
const EXPORTS = ["ensureLauncherPreview","lHolder","lRenderer","launcherLoop","setLauncherChar","sizeLauncherPreview"];
const MOVED = ["lRenderer","lScene","lCam","lChar","lBlinkT","lBlinkOn","lHolder","lDeskMat","lScaleHint","lCharBaseY","lFrameH","lFrameZ","LAUNCHER_CHAR_Y","PS1_PIXEL_SCALE","ensureLauncherPreview","_lcBodyBox","sizeLauncherPreview","LC_THUMB_SETTLE_MS","LC_THUMB_MAX","_lcThumbJob","_lcThumbArm","_lcThumbTake","setLauncherChar","launcherLoop"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  CHAR_Z: CHAR_Z,","  RIG_TURN: RIG_TURN,","  _FILL_LIGHT_MUL: _FILL_LIGHT_MUL,","  _KEY_LIGHT_MUL: _KEY_LIGHT_MUL,","  _MAIN_LIGHT_COL: _MAIN_LIGHT_COL,","  _MAIN_LIGHT_INT: _MAIN_LIGHT_INT,","  _mkFrontFill: (...a)=>_mkFrontFill(...a),","  _setDeskMatColor: (...a)=>_setDeskMatColor(...a),","  allDeskItems: (...a)=>allDeskItems(...a),","  applyDeskColorToCustom: (...a)=>applyDeskColorToCustom(...a),","  applyDeskItemsTo: (...a)=>applyDeskItemsTo(...a),","  applyEquippedPartsToSeat: (...a)=>applyEquippedPartsToSeat(...a),","  applyStaticHandRest: (...a)=>applyStaticHandRest(...a),","  assetCodeMod: ()=>assetCodeMod,","  b64ToBuf: (...a)=>b64ToBuf(...a),","  buildDesk: (...a)=>buildDesk(...a),","  clampCharY: (...a)=>clampCharY(...a),","  clearHolderDeskItems: (...a)=>clearHolderDeskItems(...a),","  commSceneCache: commSceneCache,","  customItems: ()=>customItems,","  defToBase: (...a)=>defToBase(...a),","  equipDeskItem: (...a)=>equipDeskItem(...a),","  extractBonesInto: (...a)=>extractBonesInto(...a),","  getCommissionScene: (...a)=>getCommissionScene(...a),","  registerCustomItem: (...a)=>registerCustomItem(...a),","  scene: scene,","  setDeskPos: (...a)=>setDeskPos(...a),","  setDeskScale: (...a)=>setDeskScale(...a),","  setFaceMap: (...a)=>setFaceMap(...a),","  slotSaveMod: ()=>slotSaveMod,","  slots: slots,","  swapDeskVisual: (...a)=>swapDeskVisual(...a),"];

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

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

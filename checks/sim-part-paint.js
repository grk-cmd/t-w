/* ═══ 🖍️ sim-part-paint.js — 🖍️ 파츠에 직접 그리기 · 파츠 그림칸(_pic) · UV 구제 · 그림 올리기 모듈 구조 (2026-10-14 신설 · 앱 FSD 21번) ═══════════════
   app.js 의 «🖍️ 파츠에 직접 그리기» · «🖍️ 파츠 그림칸» 두 구역 본문 을 parts/character/part-paint.js 로 옮겼다(글자 그대로 · 바뀐 줄 24 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(파츠 칠하기 · UV 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(_picIntersect · _picRepairUV · _stampWrapCenter · _stampWrapFill · _wdActivePartRef · setWdActivePartRef · _wdPic · _wdPicUvScale · applyPartPic · enterWdPicMode · exitWdPicMode · g_uvLooksBroken · meshIsPic · refreshWdPicUI · wrapperHasPic)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 29줄 그대로 · 부르는 곳은 partPaintMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · part-paint.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["part-paint.js","parts/character/part-paint.js","app/parts/character/part-paint.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — part-paint.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_applyPartMatTone","_loadImgCors","_quickHash","_roomFaceCacheLoad","_roomFaceCacheSave","buildFreeColorPicker","catEquippedIds","findEntryById","getMyUserId","mirrorUVOn","newCanvas","partEntryId","partEntryInstances","partEntryXf","refreshWdPreviewColorSection","sizeWdPreview","strokeSeg","toast","updateWdCam","updateWdGizmoForActivePanel"];
const VAL_DEPS = ["humanEar"];
const GET_DEPS = ["CANVAS_SZ","activeWdAdj","currentWdTab","savedParts","wdCam","wdEar","wdGizmo","wdPreviewBase"];
const SET_DEPS = [];
const EXPORTS = ["_picIntersect","_picRepairUV","_stampWrapCenter","_stampWrapFill","_wdActivePartRef","setWdActivePartRef","_wdPic","_wdPicUvScale","applyPartPic","enterWdPicMode","exitWdPicMode","g_uvLooksBroken","meshIsPic","refreshWdPicUI","wrapperHasPic"];
const MOVED = ["_wdActivePartRef","_wdPic","wdPaintTool","WD_PIC_HIST_MAX","_wdPicSection","_wdWrapperForPartId","_wdResolvePicTarget","_wdPicTarget","refreshWdPicUI","enterWdPicMode","exitWdPicMode","_wdPicIsBlank","_wdPicSnap","_wdPicRestore","_wdPicPush","_wdPicUndo","_wdPicRedo","_wdPicClear","_wdPicTgtOf","_wdPicSetEraser","_wdPicSetFill","_wdPicFillMesh","_wdPicFillHit","_wdPicSetSym","_buildWdPicSection","_wdPicRay","_wdPicNdc","_picCastRay","_pskVec","_pskBase","_pskMat","_pskAcc","_pskSi","_pskSw","_pskA","_pskB","_pskC","_pskP","_pskUvA","_pskUvB","_pskUvC","_pskBary","_pskInv","_pskN","_pskLA","_pskLB","_pskLC","_pskT","_picIsSkinned","_picSkinnedPositions","_picSkinnedIntersect","_picIntersect","STAMP_WRAP_RINGS","STAMP_WRAP_MAX_STEP","STAMP_WRAP_DOWN","STAMP_WRAP_MAX_R","_stampWrapCenter","_stampWrapFill","_wdPicHit","_wdPicUvScale","_wdPicPaint","_wdPicMirrorOff","_wdPicMirrorCx","_wdPicEyedrop","_wdPicBreak","WD_PIC_STEP_PX","WD_PIC_MAX_STEPS","_wdPicStrokeTo","_wdPicKey","PART_PIC_RE","_uvSpread","g_uvLooksBroken","_picRepairUV","meshIsPic","wrapperHasPic","PIC_BASE_MAX","_picSetup","_picBlit","_picLoad","applyPartPic","uploadPartPic"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  CANVAS_SZ: ()=>CANVAS_SZ,","  _applyPartMatTone: (...a)=>_applyPartMatTone(...a),","  _loadImgCors: (...a)=>_loadImgCors(...a),","  _quickHash: (...a)=>_quickHash(...a),","  _roomFaceCacheLoad: (...a)=>_roomFaceCacheLoad(...a),","  _roomFaceCacheSave: (...a)=>_roomFaceCacheSave(...a),","  activeWdAdj: ()=>activeWdAdj,","  buildFreeColorPicker: (...a)=>buildFreeColorPicker(...a),","  catEquippedIds: (...a)=>catEquippedIds(...a),","  currentWdTab: ()=>currentWdTab,","  findEntryById: (...a)=>findEntryById(...a),","  getMyUserId: (...a)=>getMyUserId(...a),","  humanEar: humanEar,","  mirrorUVOn: (...a)=>mirrorUVOn(...a),","  newCanvas: (...a)=>newCanvas(...a),","  partEntryId: (...a)=>partEntryId(...a),","  partEntryInstances: (...a)=>partEntryInstances(...a),","  partEntryXf: (...a)=>partEntryXf(...a),","  refreshWdPreviewColorSection: (...a)=>refreshWdPreviewColorSection(...a),","  savedParts: ()=>savedParts,","  sizeWdPreview: (...a)=>sizeWdPreview(...a),","  strokeSeg: (...a)=>strokeSeg(...a),","  toast: (...a)=>toast(...a),","  updateWdCam: (...a)=>updateWdCam(...a),","  updateWdGizmoForActivePanel: (...a)=>updateWdGizmoForActivePanel(...a),","  wdCam: ()=>wdCam,","  wdEar: ()=>wdEar,","  wdGizmo: ()=>wdGizmo,","  wdPreviewBase: ()=>wdPreviewBase,"];

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
    src + '\nreturn window.TwPartPaint;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, undefined);
  return api.createPartPaint(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwPartPaint = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwPartPaint(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(app.includes("const PART_PAINT_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기") && app.includes("const partPaintMod = (typeof TwPartPaint === 'undefined') ? PART_PAINT_MOD_OFF : TwPartPaint.createPartPaint({"), '모듈이 없으면 빈 껍데기 · 만드는 줄');
  const mk = (app.match(new RegExp('const partPaintMod = \\(typeof TwPartPaint === \'undefined\'\\) \\? PART_PAINT_MOD_OFF : TwPartPaint\\.createPartPaint\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = mk.split('\n').map(kindOf);
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  const bare = EXPORTS.filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const partPaintMod = [\s\S]*?\n\}\);/, '')));
  t(!bare.length, '부르는 곳은 partPaintMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/character/part-paint.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/character/part-paint.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/part-paint.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  ['deps 하나 빠짐', null, a => { const i = a.indexOf("const partPaintMod = (typeof TwPartPaint === 'undefined') ? PART_PAINT_MOD_OFF : TwPartPaint.createPartPaint({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }, null],
  ['전역 이름 안 걺', m => m.replace('window.TwPartPaint = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const partPaintMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('partPaintMod.' + x)); if(n){ ls[i] = ls[i].replace('partPaintMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createPartPaint(deps){', 'function createPartPaint(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

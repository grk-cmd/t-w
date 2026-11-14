/* ═══ 🎨 sim-wardrobe.js — 🎨 꾸미기 창 모듈 구조 (2026-10-14 신설 · 앱 FSD 29번) ═══════════════
   app.js 의 꾸미기 다섯 구역 본문 을 parts/character/wardrobe.js 로 옮겼다(글자 그대로 · 바뀐 줄 70 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(꾸미기 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(ORBIT_DRAG_DIR · _clearMultiPanelRef · _wdAfterMainSwap · activeWdAdj · setActiveWdAdj · buildFreeColorPicker · clampWdPreviewIntoView · commitWdDraft · createWardrobeAdjPanel · currentWdTab · detachWdGizmo · ensureWdDraft · ensureWdGizmo · placeWdPreview · refreshWdPreviewChar · refreshWdPreviewColorSection · renderWardrobe · setWdGizmoMode · sizeWdPreview · syncWdGizmoToXf · syncWdPreviewOwner · toggleEquip · updateWdCam · updateWdGizmoForActivePanel · wdCam · wdDraftDef · wdGizmo · wdGizmoMode · wdPreviewBase · wdPreviewSavedPos · wdScene)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 71줄(LIGHT_PRESET 빼고 baseFlatOf 더함) · 부르는 곳은 wardrobeMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · wardrobe.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["wardrobe.js","parts/character/wardrobe.js","app/parts/character/wardrobe.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — wardrobe.js'); process.exit(2); }
/* 😴 닫힌 창 반복 재우기(shared/idle-gate.js) — 모듈이 만들 때 미리보기 반복을 건다. 진짜 파일을 가짜 MutationObserver 위에 싣는다. */
const GATE_SRC = ["idle-gate.js","parts/shared/idle-gate.js","app/parts/shared/idle-gate.js"].map(read).find(Boolean);
if(!GATE_SRC){ say('  ? 원본 못 찾음 — idle-gate.js'); process.exit(2); }
const GATE = (() => { const w = { MutationObserver: class { observe(){} disconnect(){} } }; new Function('window', 'module', GATE_SRC)(w, undefined); return w.TwIdleGate; })();
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["layoutSeats","_attachHumanEars","_disposeWrapperFromSeat","_hsvToHex","_invalidatePendingEquip","_rgbHexToHsv","_sweepOrphanPartWrappers","_wdLicenseDesks","addEntryToCat","addPartEntryInstance","applyClothVisibility","applyEquippedPartsToSeat","applyHueTint","applyPartXf","baseFlatOf","bindReorderHandle","boneSide","charFootFix","clampCharY","defToBase","defaultPartXf","entriesForCat","equipPartOnSeat","escHtml","findEntryById","findMySeat","firstEntryForCat","floorClampWrapper","getCommissionScene","groupOfCat","isDeskPartCat","isHueTintMesh","measureCharBox","openAssetImport","partCatInfo","partEntryId","partEntryInstanceCount","partEntryInstances","partEntryXf","partsInCat","partsInCatFor","partsInGroup","pruneSeatPartsAgainstDef","refitSeatAfterParts","removeEntryFromCat","removePartEntryInstance","reorderSavedPart","saveSlots","setPartEntryInstanceXf","toast","unequipStackablePart","_humanEarMat","_humanEarPic","applyDeskCatalogRefToSeat","applyDeskColorToCustom","applyDeskDotThumb","clampDeskScale","resolveCatalogGlb","setDeskScale","swThumb","addRunLights"];
const VAL_DEPS = ["NO_DESK_ID","ANIMAL_RUN_SCALE","CHAR_Z","seats","DEFAULT_DESK_OVERRIDE_ID","humanEar"];
const GET_DEPS = ["PART_CATS","PART_DEFAULT_OFFSET","PART_GROUPS","Presence","WD_DESK_TAB","gachaMod","isAdmin","partPaintMod","savedParts","slots","DESK_LICENSE_HOLD","DESK_SCALE_DEFAULT","DESK_SCALE_MAX","DESK_SCALE_MIN"];
const SET_DEPS = [];
const EXPORTS = ["ORBIT_DRAG_DIR","_clearMultiPanelRef","_wdAfterMainSwap","activeWdAdj","setActiveWdAdj","buildFreeColorPicker","clampWdPreviewIntoView","commitWdDraft","createWardrobeAdjPanel","currentWdTab","detachWdGizmo","ensureWdDraft","ensureWdGizmo","placeWdPreview","refreshWdPreviewChar","refreshWdPreviewColorSection","renderWardrobe","setWdGizmoMode","sizeWdPreview","syncWdGizmoToXf","syncWdPreviewOwner","toggleEquip","updateWdCam","updateWdGizmoForActivePanel","wdCam","wdDraftDef","wdEar","setAdminPartActions","relinkDraftSrc","wdGizmo","wdGizmoMode","wdPreviewBase","wdPreviewSavedPos","wdScene"];
const MOVED = ["wdRenderer","wdScene","wdCam","wdPreviewBase","WD_PREVIEW_DESK_Y","WD_PREVIEW_DESK_Z","WD_PREVIEW_DESK_NUDGE","ensureWdPreview","wdGizmo","wdGizmoMode","wdGizmoCat","ensureWdGizmo","wdGizmoInstanceIdx","wdGizmoPartId","_wdGetActiveWrapperAndXf","syncWdGizmoToXf","attachWdGizmo","detachWdGizmo","setWdGizmoMode","updateWdGizmoForActivePanel","WD_PREVIEW_POS_KEY","wdPreviewSavedPos","placeWdPreview","clampWdPreviewIntoView","syncWdPreviewOwner","sizeWdPreview","wdYaw","wdPitch","wdHeightOffset","wdZoomMul","ORBIT_DRAG_DIR","wdCamCenter","wdCamLookY","wdCamBaseDist","WD_EAR_CAM_LIFT","WD_EAR_CAM_ZOOM","_wdEarCamOn","updateWdCam","wdDraftDef","ensureWdDraft","refreshWdPreviewChar","wdPreviewLoop","_wdCommitChain","commitWdDraft","_commitWdDraftNow","_commitWdDraftToOwner","_wdAfterMainSwap","refreshWdPreviewColorSection","activeWdAdj","_wdMultiActiveIdx","_wdGetSavedInstanceIdx","_wdSetSavedInstanceIdx","_clearMultiPanelRef","wdAdjAxis","_holdRepeat","hsvToHex","hexToHsv","buildFreeColorPicker","openCharColorPicker","createWardrobeAdjPanel","buildColorRows","currentWdTab","currentWdGroup","renderWardrobe","toggleEquip"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  NO_DESK_ID: NO_DESK_ID,","  layoutSeats: (...a)=>layoutSeats(...a),","  ANIMAL_RUN_SCALE: ANIMAL_RUN_SCALE,","  CHAR_Z: CHAR_Z,","  PART_CATS: ()=>premiumMod.PART_CATS(),","  PART_DEFAULT_OFFSET: ()=>PART_DEFAULT_OFFSET,","  PART_GROUPS: ()=>premiumMod.PART_GROUPS,","  Presence: ()=>Presence,","  WD_DESK_TAB: ()=>premiumMod.WD_DESK_TAB,","  _attachHumanEars: (...a)=>_attachHumanEars(...a),","  _disposeWrapperFromSeat: (...a)=>_disposeWrapperFromSeat(...a),","  _hsvToHex: (...a)=>_hsvToHex(...a),","  _invalidatePendingEquip: (...a)=>_invalidatePendingEquip(...a),","  _rgbHexToHsv: (...a)=>_rgbHexToHsv(...a),","  _sweepOrphanPartWrappers: (...a)=>_sweepOrphanPartWrappers(...a),","  _wdLicenseDesks: (...a)=>premiumMod._wdLicenseDesks(...a),","  addRunLights: (...a)=>lightToneMod.addRunLights(...a),","  addEntryToCat: (...a)=>premiumMod.addEntryToCat(...a),","  addPartEntryInstance: (...a)=>premiumMod.addPartEntryInstance(...a),","  applyClothVisibility: (...a)=>applyClothVisibility(...a),","  applyEquippedPartsToSeat: (...a)=>applyEquippedPartsToSeat(...a),","  applyHueTint: (...a)=>applyHueTint(...a),","  applyPartXf: (...a)=>applyPartXf(...a),","  baseFlatOf: (...a)=>lightToneMod.baseFlatOf(...a),","  bindReorderHandle: (...a)=>bindReorderHandle(...a),","  boneSide: (...a)=>boneSide(...a),","  charFootFix: (...a)=>charMeasureMod.charFootFix(...a),","  clampCharY: (...a)=>clampCharY(...a),","  defToBase: (...a)=>defToBase(...a),","  defaultPartXf: (...a)=>premiumMod.defaultPartXf(...a),","  entriesForCat: (...a)=>premiumMod.entriesForCat(...a),","  equipPartOnSeat: (...a)=>equipPartOnSeat(...a),","  escHtml: (...a)=>escHtml(...a),","  findEntryById: (...a)=>premiumMod.findEntryById(...a),","  findMySeat: (...a)=>findMySeat(...a),","  firstEntryForCat: (...a)=>premiumMod.firstEntryForCat(...a),","  floorClampWrapper: (...a)=>charMeasureMod.floorClampWrapper(...a),","  gachaMod: ()=>gachaMod,","  getCommissionScene: (...a)=>getCommissionScene(...a),","  groupOfCat: (...a)=>premiumMod.groupOfCat(...a),","  isAdmin: ()=>isAdmin,","  isDeskPartCat: (...a)=>premiumMod.isDeskPartCat(...a),","  isHueTintMesh: (...a)=>isHueTintMesh(...a),","  measureCharBox: (...a)=>charMeasureMod.measureCharBox(...a),","  openAssetImport: (...a)=>openAssetImport(...a),","  partCatInfo: (...a)=>premiumMod.partCatInfo(...a),","  partEntryId: (...a)=>premiumMod.partEntryId(...a),","  partEntryInstanceCount: (...a)=>premiumMod.partEntryInstanceCount(...a),","  partEntryInstances: (...a)=>premiumMod.partEntryInstances(...a),","  partEntryXf: (...a)=>premiumMod.partEntryXf(...a),","  partPaintMod: ()=>partPaintMod,","  partsInCat: (...a)=>premiumMod.partsInCat(...a),","  partsInCatFor: (...a)=>premiumMod.partsInCatFor(...a),","  partsInGroup: (...a)=>premiumMod.partsInGroup(...a),","  pruneSeatPartsAgainstDef: (...a)=>pruneSeatPartsAgainstDef(...a),","  refitSeatAfterParts: (...a)=>seatRefitMod.refitSeatAfterParts(...a),","  removeEntryFromCat: (...a)=>premiumMod.removeEntryFromCat(...a),","  removePartEntryInstance: (...a)=>premiumMod.removePartEntryInstance(...a),","  reorderSavedPart: (...a)=>premiumMod.reorderSavedPart(...a),","  saveSlots: (...a)=>slotSaveMod.saveSlots(...a),","  savedParts: ()=>premiumMod.savedParts(),","  seats: seats,","  setPartEntryInstanceXf: (...a)=>premiumMod.setPartEntryInstanceXf(...a),","  slots: ()=>slots,","  toast: (...a)=>toast(...a),","  unequipStackablePart: (...a)=>unequipStackablePart(...a),","  DEFAULT_DESK_OVERRIDE_ID: DEFAULT_DESK_OVERRIDE_ID,","  DESK_LICENSE_HOLD: ()=>premiumMod.DESK_LICENSE_HOLD,","  DESK_SCALE_DEFAULT: ()=>DESK_SCALE_DEFAULT,","  DESK_SCALE_MAX: ()=>DESK_SCALE_MAX,","  DESK_SCALE_MIN: ()=>DESK_SCALE_MIN,","  _humanEarMat: (...a)=>_humanEarMat(...a),","  _humanEarPic: (...a)=>_humanEarPic(...a),","  applyDeskCatalogRefToSeat: (...a)=>deskVisualMod.applyDeskCatalogRefToSeat(...a),","  applyDeskColorToCustom: (...a)=>deskVisualMod.applyDeskColorToCustom(...a),","  applyDeskDotThumb: (...a)=>applyDeskDotThumb(...a),","  clampDeskScale: (...a)=>clampDeskScale(...a),","  humanEar: humanEar,","  resolveCatalogGlb: (...a)=>catalogGlbMod.resolveCatalogGlb(...a),","  setDeskScale: (...a)=>setDeskScale(...a),","  swThumb: (...a)=>swThumb(...a),"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다.
   then 도 받는다 — 만들 때 부르는 서버 요청(.then 잇기)이 던지지 않게(풀리지는 않는다) */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
function build(src, env){
  env = env || {};
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module', 'TwIdleGate',
    src + '\nreturn window.TwWardrobe;')(win, env.document || any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, env.requestAnimationFrame || (() => 0), any, () => {}, () => {}, undefined, env.TwIdleGate || GATE);
  return api.createWardrobe(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwWardrobe = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwWardrobe(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("WARDROBE_MOD_OFF") && app.includes("const wardrobeMod = TwWardrobe.createWardrobe({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const wardrobeMod = TwWardrobe\\.createWardrobe\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = mk.split('\n').map(kindOf);
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const wardrobeMod = [\s\S]*?\n\}\);/, '')));
  t(!bare.length, '부르는 곳은 wardrobeMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/character/wardrobe.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/character/wardrobe.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/wardrobe.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  ['deps 하나 빠짐', null, a => { const i = a.indexOf("const wardrobeMod = TwWardrobe.createWardrobe({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }, null],
  ['전역 이름 안 걺', m => m.replace('window.TwWardrobe = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const wardrobeMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('wardrobeMod.' + x)); if(n){ ls[i] = ls[i].replace('wardrobeMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createWardrobe(deps){', 'function createWardrobe(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}

/* ── 4. 동작 — 🪑 꾸미기 › 책상 탭의 «🚫 책상 없음» 칸(책상 탭 두 함수만 떼어 가짜 위에서 누른다)
   책상 그리기(applyDeskCatalogRefToSeat)는 GLB 를 풀어야 끝나는 일이라 가짜도 «나중에 끝나는» Promise — 좌석 줄은 그 뒤에 잡아야 한다 */
say('── 4. 동작 — 책상 탭 «책상 없음» · 좌석 줄 다시 잡기');
const tick = () => new Promise((r) => setImmediate(r));
function deskTab(mod){
  const a = mod.indexOf('function _wdApplyDeskChange('), b = mod.indexOf('let wdRenderer=null', a);
  if(a < 0 || b < 0) return null;
  const log = { apply: [], layout: 0, save: 0, render: 0, pending: [] };
  const seat = { isMe: true, desk: {}, charDef: { deskCatalogId: 'd1', deskGlb: 'G' } };
  const el = () => ({ style: {}, classList: { add(){} }, children: [], appendChild(c){ this.children.push(c); return c; }, set innerHTML(v){}, textContent: '' });
  const cards = [];
  const env = {
    NO_DESK_ID: '__no_desk__', DEFAULT_DESK_OVERRIDE_ID: '__default_desk__', DESK_LICENSE_HOLD: () => 'hold', DESK_SCALE_DEFAULT: () => 0.2, DESK_SCALE_MIN: () => 0.05, DESK_SCALE_MAX: () => 0.3,
    findMySeat: () => seat, wdDraftDef: null, _wdLicenseDesks: () => [{ id: 'L1', name: '전용', glb: 'LG' }],
    swThumb: (label, on, icon) => { const c = el(); c.label = label; c.on = on; c.icon = icon; cards.push(c); return c; },
    applyDeskCatalogRefToSeat: (s, d) => { log.apply.push(d.deskCatalogId); return new Promise((r) => log.pending.push(r)); },
    setDeskScale: () => {}, applyDeskColorToCustom: () => {}, clampDeskScale: (v) => v,
    saveSlots: () => { log.save++; }, Presence: () => ({ active: () => false }), refreshWdPreviewChar: () => {}, layoutSeats: () => { log.layout++; }, renderWardrobe: () => { log.render++; },
    openAssetImport: () => {}, applyDeskDotThumb: () => {}, resolveCatalogGlb: async () => {}, TwErrorCodes: { notify(){} }, document: { createElement: el },
  };
  const names = Object.keys(env);
  const f = new Function(...names, mod.slice(a, b) + '\nreturn renderWdDeskSection;');
  const render = f(...names.map(n => env[n]));
  const settle = async () => { log.pending.splice(0).forEach((r) => r()); await tick(); await tick(); };
  return { render, seat, log, cards, el, settle, again(){ cards.length = 0; render(el()); } };
}
(async () => {
  const T = deskTab(MOD);
  chk(!!T, '책상 탭 함수를 떼어 냈다(_wdApplyDeskChange · renderWdDeskSection)');
  if(T){
    T.render(T.el());
    const nd = T.cards.find(c => c.label === '책상 없음');
    chk(nd && T.cards[0].label === '기본 책상' && T.cards[1] === nd && nd.on === false && nd.icon === '🚫', '«기본 책상» 바로 뒤에 «책상 없음» 칸 · 다른 책상을 쓰면 꺼짐');
    nd.onclick(); await tick();
    chk(T.seat.charDef.deskCatalogId === '__no_desk__' && T.seat.charDef.deskGlb === null && T.log.apply[0] === '__no_desk__' && T.log.save === 1 && T.log.render === 1 && T.log.layout === 0,
      '  누르면 — def 에 예약 id · GLB 비움 · 좌석 책상 다시 그림 · 저장 · 창 다시 그림 · 그리기가 끝나기 전엔 좌석 줄을 안 잡는다');
    await T.settle();
    chk(T.log.layout === 1, '  책상을 다 그린 뒤 좌석 줄을 한 번 다시 잡는다');
    T.again();
    const nd2 = T.cards.find(c => c.label === '책상 없음');
    chk(nd2.on === true && T.cards[0].on === false, '  다시 그리면 «책상 없음» 만 켜짐');
    nd2.onclick(); await T.settle();
    chk(T.log.apply.length === 1 && T.log.layout === 1, '  이미 책상 없음이면 다시 눌러도 아무 일 없음');
    T.cards[0].onclick(); await tick();
    chk(T.seat.charDef.deskCatalogId === null && T.log.apply[1] === '__default_desk__' && T.log.layout === 1, '  «기본 책상» — 교체본 GLB 를 푸는 동안은 좌석 줄을 안 잡고');
    await T.settle();
    chk(T.log.layout === 2, '    다 그린 뒤 한 번 잡는다');
    T.again(); await T.cards.find(c => c.label === '전용').onclick(); await tick();
    chk(T.seat.charDef.deskCatalogId === 'L1' && T.log.layout === 2, '  전용 책상 카드도 그리기가 끝나기 전엔 안 잡고');
    await T.settle();
    chk(T.log.layout === 3, '    다 그린 뒤 한 번 잡는다(책상 없음 → 진짜 책상의 큰 폭 차이)');
  }
  /* 깨 보기 — 그리기를 안 기다리고 바로 잡으면(옛 순서) · 전용 책상 카드가 안 잡으면 위 판정이 빨강 */
  const early = deskTab(MOD.replace('if(relayout) Promise.resolve(drawn).catch(()=>{}).then(()=>layoutSeats());', 'if(relayout) layoutSeats();'));
  let caught = false;
  if(early){ early.render(early.el()); early.cards.find(c => c.label === '책상 없음').onclick(); await tick(); caught = early.log.layout === 1; }
  chk(caught, '  깨 보기 — 그리기가 끝나기 전에 좌석 줄을 잡으면 잡힌다');
  const noLic = deskTab(MOD.replace('_wdApplyDeskChange(d=>{ d.deskCatalogId=rec.id; d.deskGlb=null; }, true);', '_wdApplyDeskChange(d=>{ d.deskCatalogId=rec.id; d.deskGlb=null; });'));
  caught = false;
  if(noLic){ noLic.render(noLic.el()); await noLic.cards.find(c => c.label === '전용').onclick(); await noLic.settle(); caught = noLic.log.layout === 0; }
  chk(caught, '  깨 보기 — 전용 책상 카드가 좌석 줄을 안 잡으면 잡힌다');
  say('── 5. 닫힌 미리보기 창은 rAF 를 걸지 않는다 — 열리면 다음 rAF 에 다시(가짜 rAF · 가짜 MutationObserver)');
  const sleepRows = (mod) => {
    const r = [], t = (ok, msg) => r.push([!!ok, msg]);
    const st = { q: [], obs: [], cls: new Set() };
    const MO = class { constructor(fn){ this.fn = fn; } observe(el, o){ if(el === panel && o && o.attributeFilter && o.attributeFilter.includes('class')) st.obs.push(this.fn); } disconnect(){} };
    const any = anything();
    const panelCls = { contains: (c) => st.cls.has(c), add(){}, remove(){}, toggle(){} };
    const panel = new Proxy({}, { get: (o, k) => k === 'classList' ? panelCls : any, set: () => true });
    const doc = new Proxy({}, { get: (o, k) => k === 'getElementById' ? ((id) => id === 'wdPreviewPanel' ? panel : any) : any });
    const flip = (on) => { on ? st.cls.add('on') : st.cls.delete('on'); st.obs.forEach(f => f([])); };
    const step = (n) => { for(let i = 0; i < n; i++){ const q = st.q; st.q = []; q.forEach(f => f(i)); } };
    const G = (() => { const w = { MutationObserver: MO }; new Function('window', 'module', GATE_SRC)(w, undefined); return w.TwIdleGate; })();
    try{ build(mod, { document: doc, requestAnimationFrame: (f) => { st.q.push(f); return st.q.length; }, TwIdleGate: G }); }
    catch(e){ t(false, '가짜 미리보기 만들기 — ' + String(e.message || e).slice(0, 80)); return r; }
    t(st.q.length === 0, '★ 닫힌 채 만들면 rAF 를 걸지 않는다(예전: 주사율마다 깨어나 클래스만 봄)');
    step(600);
    t(st.q.length === 0, '  닫힌 10초 동안 그대로');
    flip(true);
    t(st.q.length === 1, '★ 열리면(class 변화) 그 자리에서 rAF 하나 — 다음 장에 바로 그린다');
    step(60);
    t(st.q.length === 1, '  열려 있는 동안은 매 rAF 다시 건다');
    flip(false); step(1);
    t(st.q.length === 0, '★ 닫히면 다음 rAF 에서 멈춘다');
    flip(true); flip(true);
    t(st.q.length === 1, '  다시 열어도 반복은 한 벌');
    return r;
  };
  sleepRows(MOD).forEach(([ok, msg]) => chk(ok, msg));
  for(const [nm, m2] of [
    ['닫혀도 계속 rAF', MOD.replace("isOn: ()=>p.classList.contains('on'),", 'isOn: ()=>true,')],
    ['열려도 안 깨움', MOD.replace('TwIdleGate.onClassChange(p, ()=>loop.wake());', '')],
  ]){
    let r2; try{ r2 = sleepRows(m2); }catch(_){ r2 = [[false, '던짐']]; }
    chk(m2 !== MOD && r2.some(([ok]) => !ok), '  깨 보기: ' + nm + (m2 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();

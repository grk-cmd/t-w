/* ═══ 🎨 sim-wardrobe.js — 🎨 꾸미기 창 모듈 구조 (2026-10-14 신설 · 앱 FSD 29번) ═══════════════
   app.js 의 꾸미기 다섯 구역 본문 을 parts/character/wardrobe.js 로 옮겼다(글자 그대로 · 바뀐 줄 70 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(꾸미기 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(ORBIT_DRAG_DIR · _clearMultiPanelRef · _wdAfterMainSwap · activeWdAdj · setActiveWdAdj · buildFreeColorPicker · commitWdDraft · createWardrobeAdjPanel · currentWdTab · detachWdGizmo · ensureWdDraft · ensureWdGizmo · placeWdWindows · refreshWdPreviewChar · refreshWdPreviewColorSection · renderWardrobe · setWdGizmoMode · sizeWdPreview · syncWdGizmoToXf · syncWdPreviewOwner · toggleEquip · updateWdCam · updateWdGizmoForActivePanel · wdCam · wdDraftDef · wdGizmo · wdGizmoMode · wdPreviewBase · wdWinSavedPos · wdScene)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 71줄(LIGHT_PRESET 빼고 baseFlatOf 더함) · 부르는 곳은 wardrobeMod.이름 · html(app.js 앞)
   ・3절: mutation test — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
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

const FN_DEPS = ["setDeskPos", "layoutSeats", "_attachHumanEars", "_disposeWrapperFromSeat", "_hsvToHex", "_invalidatePendingEquip", "_rgbHexToHsv", "_sweepOrphanPartWrappers", "_wdLicenseDesks", "addEntryToCat", "addPartEntryInstance", "applyClothVisibility", "applyEquippedPartsToSeat", "applyHueTint", "applyPartXf", "baseFlatOf", "bindReorderHandle", "boneSide", "charFootFix", "clampCharY", "defToBase", "defaultPartXf", "entriesForCat", "equipPartOnSeat", "escHtml", "findEntryById", "findMySeat", "firstEntryForCat", "floorClampWrapper", "getCommissionScene", "groupOfCat", "isDeskPartCat", "isHueTintMesh", "measureCharBox", "measurePreviewBox", "openAssetImport", "partCatInfo", "partEntryId", "partEntryInstanceCount", "partEntryInstances", "partEntryXf", "partsInCat", "partsInCatFor", "partsInGroup", "pruneSeatPartsAgainstDef", "refitSeatAfterParts", "removeEntryFromCat", "removePartEntryInstance", "reorderSavedPart", "saveSlots", "setPartEntryInstanceXf", "toast", "unequipStackablePart", "_humanEarMat", "_humanEarPic", "applyDeskCatalogRefToSeat", "applyDeskColor", "deskColorMats", "applyDeskDotThumb", "clampDeskScale", "resolveCatalogGlb", "glbFailWhy", "setDeskScale", "swThumb", "addRunLights", "hueShiftHex", "tintPartMesh"];
const VAL_DEPS = ["deskPreview", "accountStore", "NO_DESK_ID", "ANIMAL_RUN_SCALE", "CHAR_Z", "seats", "DEFAULT_DESK_OVERRIDE_ID", "humanEar", "twNav"];
const GET_DEPS = ["PART_CATS", "PART_DEFAULT_OFFSET", "PART_GROUPS", "Presence", "WD_DESK_TAB", "gachaMod", "isAdmin", "isPremium", "partPaintMod", "savedParts", "slots", "DESK_LICENSE_HOLD", "DESK_SCALE_DEFAULT", "DESK_SCALE_MAX", "DESK_SCALE_MIN"];
const SET_DEPS = [];
const EXPORTS = ["ORBIT_DRAG_DIR", "_clearMultiPanelRef", "_wdAfterMainSwap", "ALBUM_TAB", "selectWdTab", "isAlbumTab", "activeWdAdj", "setActiveWdAdj", "buildFreeColorPicker", "commitWdDraft", "createWardrobeAdjPanel", "currentWdTab", "detachWdGizmo", "ensureWdDraft", "ensureWdGizmo", "placeWdWindows", "refreshWdPreviewChar", "refreshWdPreviewColorSection", "renderWardrobe", "setWdGizmoMode", "sizeWdPreview", "syncWdGizmoToXf", "syncWdPreviewOwner", "toggleEquip", "updateWdCam", "updateWdGizmoForActivePanel", "wdCam", "wdDraftDef", "wdEar", "setAdminPartActions", "relinkDraftSrc", "wdGizmo", "wdGizmoMode", "wdPreviewBase", "wdWinSavedPos", "wdScene"];
const MOVED = ["wdRenderer", "wdScene", "wdCam", "wdPreviewBase", "WD_PREVIEW_DESK_Y", "WD_PREVIEW_DESK_Z", "WD_PREVIEW_DESK_NUDGE", "ensureWdPreview", "wdGizmo", "wdGizmoMode", "wdGizmoCat", "ensureWdGizmo", "wdGizmoInstanceIdx", "wdGizmoPartId", "_wdGetActiveWrapperAndXf", "syncWdGizmoToXf", "attachWdGizmo", "detachWdGizmo", "setWdGizmoMode", "updateWdGizmoForActivePanel", "WD_PREVIEW_POS_KEY", "wdPreviewSavedPos", "placeWdPreview", "clampWdPreviewIntoView", "syncWdPreviewOwner", "sizeWdPreview", "wdYaw", "wdPitch", "wdHeightOffset", "wdZoomMul", "ORBIT_DRAG_DIR", "wdCamCenter", "wdCamLookY", "wdCamBaseDist", "WD_EAR_CAM_LIFT", "WD_EAR_CAM_ZOOM", "_wdEarCamOn", "updateWdCam", "wdDraftDef", "ensureWdDraft", "refreshWdPreviewChar", "wdPreviewLoop", "_wdCommitChain", "commitWdDraft", "_commitWdDraftNow", "_commitWdDraftToOwner", "_wdAfterMainSwap", "refreshWdPreviewColorSection", "activeWdAdj", "_wdMultiActiveIdx", "_wdGetSavedInstanceIdx", "_wdSetSavedInstanceIdx", "_clearMultiPanelRef", "wdAdjAxis", "_holdRepeat", "hsvToHex", "hexToHsv", "buildFreeColorPicker", "openCharColorPicker", "createWardrobeAdjPanel", "buildColorRows", "currentWdTab", "currentWdGroup", "renderWardrobe", "toggleEquip", "WD_WIN_POS_KEY", "wdWinSavedPos", "placeWdWindows"];
const GLUE = ["  deskPreview: wdDeskPreview,", "  setDeskPos: (...a)=>setDeskPos(...a),", "  accountStore: accountStoreMod,", "  NO_DESK_ID: NO_DESK_ID,", "  layoutSeats: (...a)=>layoutSeats(...a),", "  ANIMAL_RUN_SCALE: ANIMAL_RUN_SCALE,", "  CHAR_Z: CHAR_Z,", "  PART_CATS: ()=>premiumMod.PART_CATS(),", "  PART_DEFAULT_OFFSET: ()=>PART_DEFAULT_OFFSET,", "  PART_GROUPS: ()=>premiumMod.PART_GROUPS,", "  Presence: ()=>Presence,", "  WD_DESK_TAB: ()=>premiumMod.WD_DESK_TAB,", "  _attachHumanEars: (...a)=>_attachHumanEars(...a),", "  _disposeWrapperFromSeat: (...a)=>_disposeWrapperFromSeat(...a),", "  _hsvToHex: (...a)=>_hsvToHex(...a),", "  _invalidatePendingEquip: (...a)=>_invalidatePendingEquip(...a),", "  _rgbHexToHsv: (...a)=>_rgbHexToHsv(...a),", "  _sweepOrphanPartWrappers: (...a)=>_sweepOrphanPartWrappers(...a),", "  _wdLicenseDesks: (...a)=>premiumMod._wdLicenseDesks(...a),", "  addRunLights: (...a)=>lightToneMod.addRunLights(...a),", "  addEntryToCat: (...a)=>premiumMod.addEntryToCat(...a),", "  addPartEntryInstance: (...a)=>premiumMod.addPartEntryInstance(...a),", "  applyClothVisibility: (...a)=>applyClothVisibility(...a),", "  applyEquippedPartsToSeat: (...a)=>applyEquippedPartsToSeat(...a),", "  applyHueTint: (...a)=>applyHueTint(...a),", "  applyPartXf: (...a)=>applyPartXf(...a),", "  baseFlatOf: (...a)=>lightToneMod.baseFlatOf(...a),", "  bindReorderHandle: (...a)=>bindReorderHandle(...a),", "  boneSide: (...a)=>boneSide(...a),", "  charFootFix: (...a)=>charMeasureMod.charFootFix(...a),", "  clampCharY: (...a)=>clampCharY(...a),", "  defToBase: (...a)=>defToBase(...a),", "  defaultPartXf: (...a)=>premiumMod.defaultPartXf(...a),", "  entriesForCat: (...a)=>premiumMod.entriesForCat(...a),", "  equipPartOnSeat: (...a)=>equipPartOnSeat(...a),", "  escHtml: (...a)=>escHtml(...a),", "  findEntryById: (...a)=>premiumMod.findEntryById(...a),", "  findMySeat: (...a)=>findMySeat(...a),", "  firstEntryForCat: (...a)=>premiumMod.firstEntryForCat(...a),", "  floorClampWrapper: (...a)=>charMeasureMod.floorClampWrapper(...a),", "  gachaMod: ()=>gachaMod,", "  getCommissionScene: (...a)=>getCommissionScene(...a),", "  groupOfCat: (...a)=>premiumMod.groupOfCat(...a),", "  hueShiftHex: (...a)=>lightToneMod.toneCore.hueShiftHex(...a),", "  isAdmin: ()=>isAdmin,", "  isPremium: ()=>isPremium,", "  twNav: twNav,", "  isDeskPartCat: (...a)=>premiumMod.isDeskPartCat(...a),", "  isHueTintMesh: (...a)=>isHueTintMesh(...a),", "  measureCharBox: (...a)=>charMeasureMod.measureCharBox(...a),", "  measurePreviewBox: (...a)=>charMeasureMod.measurePreviewBox(...a),", "  openAssetImport: (...a)=>openAssetImport(...a),", "  partCatInfo: (...a)=>premiumMod.partCatInfo(...a),", "  partEntryId: (...a)=>premiumMod.partEntryId(...a),", "  partEntryInstanceCount: (...a)=>premiumMod.partEntryInstanceCount(...a),", "  partEntryInstances: (...a)=>premiumMod.partEntryInstances(...a),", "  partEntryXf: (...a)=>premiumMod.partEntryXf(...a),", "  partPaintMod: ()=>partPaintMod,", "  partsInCat: (...a)=>premiumMod.partsInCat(...a),", "  partsInCatFor: (...a)=>premiumMod.partsInCatFor(...a),", "  partsInGroup: (...a)=>premiumMod.partsInGroup(...a),", "  pruneSeatPartsAgainstDef: (...a)=>pruneSeatPartsAgainstDef(...a),", "  refitSeatAfterParts: (...a)=>seatRefitMod.refitSeatAfterParts(...a),", "  removeEntryFromCat: (...a)=>premiumMod.removeEntryFromCat(...a),", "  removePartEntryInstance: (...a)=>premiumMod.removePartEntryInstance(...a),", "  reorderSavedPart: (...a)=>premiumMod.reorderSavedPart(...a),", "  saveSlots: (...a)=>slotSaveMod.saveSlots(...a),", "  savedParts: ()=>premiumMod.savedParts(),", "  seats: seats,", "  setPartEntryInstanceXf: (...a)=>premiumMod.setPartEntryInstanceXf(...a),", "  slots: ()=>slots,", "  tintPartMesh: (...a)=>lightToneMod.toneCore.tintPartMesh(...a),", "  toast: (...a)=>toast(...a),", "  unequipStackablePart: (...a)=>unequipStackablePart(...a),", "  DEFAULT_DESK_OVERRIDE_ID: DEFAULT_DESK_OVERRIDE_ID,", "  DESK_LICENSE_HOLD: ()=>premiumMod.DESK_LICENSE_HOLD,", "  DESK_SCALE_DEFAULT: ()=>DESK_SCALE_DEFAULT,", "  DESK_SCALE_MAX: ()=>DESK_SCALE_MAX,", "  DESK_SCALE_MIN: ()=>DESK_SCALE_MIN,", "  _humanEarMat: (...a)=>_humanEarMat(...a),", "  _humanEarPic: (...a)=>_humanEarPic(...a),", "  applyDeskCatalogRefToSeat: (...a)=>deskVisualMod.applyDeskCatalogRefToSeat(...a),", "  applyDeskColor: (...a)=>deskVisualMod.applyDeskColor(...a),", "  deskColorMats: (...a)=>deskVisualMod.deskColorMats(...a),", "  applyDeskDotThumb: (...a)=>applyDeskDotThumb(...a),", "  clampDeskScale: (...a)=>clampDeskScale(...a),", "  humanEar: humanEar,", "  resolveCatalogGlb: (...a)=>catalogGlbMod.resolveCatalogGlb(...a),", "  glbFailWhy: (...a)=>catalogGlbMod.glbFailWhy(...a),", "  setDeskScale: (...a)=>setDeskScale(...a),", "  swThumb: (...a)=>swThumb(...a),"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다.
   then 도 받는다 — 만들 때 부르는 서버 요청(.then 잇기)이 던지지 않게(풀리지는 않는다) */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
/* 꾸미기 창 · 미리보기 자리 맞추기가 창 크기 변화를 본다 — 가짜 DOM 에서는 아무 일도 안 하는 관찰자 */
class FakeResizeObserver{ observe(){} disconnect(){} }

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
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module', 'TwIdleGate', 'ResizeObserver',
    src + '\nreturn window.TwWardrobe;')(win, env.document || any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, env.requestAnimationFrame || (() => 0), any, () => {}, () => {}, undefined, env.TwIdleGate || GATE, FakeResizeObserver);
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

/* 📚 «도감» 탭 · 🔒 라이선스 · 🎰 뽑은 가챠 — 가짜 DOM 위에서 renderWardrobe 를 실제로 돌려 본다(#540 P2) */
function behave(src, opt){
  opt = opt || {};
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const any = anything();
  const mkEl = (tag, id) => { const cls = new Set(); const el = { tagName: String(tag || 'div').toUpperCase(), id: id || '', children: [], style: {}, dataset: {}, hidden: false, _html: '', _text: '', title: '',
    get innerHTML(){ return el._html; }, set innerHTML(v){ el._html = String(v); el.children = []; },
    get textContent(){ return el._text + el._html.replace(/<[^>]+>/g, '') + el.children.map(c => c.textContent).join(''); }, set textContent(v){ el._text = String(v); el.children = []; },
    get className(){ return [...cls].join(' '); }, set className(v){ cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => cls.add(c)); },
    classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c), toggle: (c, f) => { const v = f === undefined ? !cls.has(c) : !!f; v ? cls.add(c) : cls.delete(c); return v; } },
    appendChild(c){ el.children.push(c); return c; }, addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] }; return el; };
  const els = { wardrobeContent: mkEl('div', 'wardrobeContent'), wardrobeTabs: mkEl('div', 'wardrobeTabs'), wardrobePanel: mkEl('div', 'wardrobePanel') };
  const document = { getElementById: id => els[id] || null, createElement: tag => mkEl(tag), querySelector: () => null, querySelectorAll: () => [], addEventListener(){}, body: mkEl('body') };
  const log = [];
  const parts = [{ id: 'h1', cat: 'hat', name: '밀짚' }, { id: 'g1', cat: 'hat', name: '별 모자', gacha: true, stackable: true }, { id: 'g2', cat: 'hat', name: '눈사람', gacha: true, stackable: true }];
  const owned = { g1: 1 };
  const st = { premium: !!opt.premium, admin: false };
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  const HAT = { cat: 'hat', label: '모자', icon: '🎩' };
  Object.assign(deps, {
    PART_CATS: () => [HAT], PART_GROUPS: () => [{ group: 'head', label: '머리', icon: '👤' }, { group: 'desk', label: '책상', icon: '🪑' }], WD_DESK_TAB: () => '__desk__',
    partsInGroup: g => g === 'head' ? [HAT] : [], groupOfCat: () => 'head', partsInCat: c => parts.filter(p => p.cat === c), partsInCatFor: (c, g) => parts.filter(p => p.cat === c && !!p.gacha === !!g),
    savedParts: () => parts, isAdmin: () => st.admin, isPremium: () => st.premium, _wdLicenseDesks: () => [], findMySeat: () => null,
    escHtml: x => String(x), entriesForCat: () => [], partEntryId: e => e && e.id, toast: m => log.push('toast:' + m),
    gachaMod: () => ({ isGachaPart: p => !!(p && p.gacha), gachaCount: id => owned[id] | 0, onAlbumShow: () => log.push('albumShow'), renderGachaInv: () => log.push('renderAlbum'), isInvOpen: () => false }),
    twNav: { NAV: { PROGRAM_SETTINGS: 'programSettings' }, go: (n, tab) => log.push('nav:' + n + ':' + tab) },
  });
  let M;
  try{
    M = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module', 'ResizeObserver',
      src + '\nreturn window.TwWardrobe;')({ TwSafeHtml: { safeUrl: () => '' } }, document, { getItem: () => null, setItem(){} }, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, FakeResizeObserver).createWardrobe(deps);
  }catch(e){ t(false, '가짜 DOM 위에서 만들기 — ' + String(e.message || e).slice(0, 80)); return r; }
  const wrap = els.wardrobeContent, tabs = els.wardrobeTabs;
  const groupBtns = () => tabs.children[0].children;
  try{
    /* 라이선스 없음 — 처음 열면 «도감». 부팅 때처럼 카탈로그 도착이 창이 닫힌 채 먼저 한 번 그린다(기본 탭을 채운다) */
    M.renderWardrobe(); log.length = 0;
    M.selectWdTab(); M.renderWardrobe();
    t(M.isAlbumTab() && log.join() === 'albumShow,renderAlbum' && wrap.children[0] && wrap.children[0].id === 'gachaInvHost', '★ 라이선스 없이 처음 열면 «도감» 탭 — 가챠가 서버와 맞추고(onAlbumShow) 자리(#gachaInvHost)에 그린다');
    t(els.wardrobePanel.classList.contains('wd-album') && tabs.children[1].hidden, '  도감 탭이면 창에 wd-album(아래 줄 보이기) · 하위 카테고리 줄은 숨김');
    const labels = [...groupBtns()].map(b => b.textContent);
    t(labels.join() === '👤 머리,🪑 책상,📚 도감' && /\bon\b/.test(groupBtns()[2].className), '탭 줄 — 그룹 뒤에 «📚 도감» · 지금 탭 표시');
    log.length = 0; groupBtns()[0].onclick();
    t(!M.isAlbumTab() && /라이선스를 등록하면/.test(wrap.textContent) && !els.wardrobePanel.classList.contains('wd-album') && tabs.children[1].hidden, '🔒 라이선스 없이 다른 탭 — 잠금 안내 · 하위 줄 숨김(파츠 칸 없음)');
    const go = wrap.children[0].children.find(c => c.className === 'wd-locked-go');
    go.onclick();
    t(log.includes('nav:programSettings:license'), '  [라이선스 등록하러 가기] — 설정 › 정보(license)');
    log.length = 0; groupBtns()[2].onclick();
    t(M.isAlbumTab() && log.join() === 'albumShow,renderAlbum', '«도감» 탭 버튼 — 다시 보이면 서버와 한 번 맞춘다');
    log.length = 0; groupBtns()[2].onclick();
    t(!log.length, '  지금 탭을 또 누르면 아무것도 안 한다(서버 읽기 늘지 않게)');
    /* 라이선스 있음 — 카테고리 칸 */
    st.premium = true; M.selectWdTab('hat'); M.renderWardrobe();
    const grid = (wrap.children[0].children.find(c => c.className === 'wd-grid') || { children: [] }).children;
    const names = grid.map(c => c.textContent);
    t(names.some(n => /밀짚/.test(n)) && names.some(n => /별 모자/.test(n)) && !names.some(n => /눈사람/.test(n)), '★ 카테고리 칸 — 꾸미기 파츠 + 뽑은 가챠 파츠(안 뽑은 것은 도감에만)');
    const g1 = grid.find(c => /별 모자/.test(c.textContent));
    t(g1 && g1.children.some(c => /wd-card-gacha/.test(c.className) && c.textContent === '🎰'), '  뽑은 가챠 칸에 🎰');
    st.admin = true; M.renderWardrobe();
    const grid2 = wrap.children[0].children.filter(c => c.className === 'wd-grid').flatMap(g => g.children);
    const ga = grid2.find(c => /별 모자/.test(c.textContent)), h1 = grid2.find(c => /밀짚/.test(c.textContent));
    t(ga && h1 && !ga.children.some(c => c.className === 'wd-card-x') && h1.children.some(c => c.className === 'wd-card-x'), '  관리자 삭제 · 수정은 꾸미기 파츠만(가챠는 도감 탭에서)');
    t(/도감/.test(wrap.textContent) && /2개/.test(wrap.textContent), '  관리자 안내 — 가챠 파츠 수 · 도감 탭에서 관리');
  }catch(e){ t(false, '동작 판정 중 던짐 — ' + String(e.message || e).slice(0, 120)); }
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 2-2. 도감 탭 · 라이선스 · 뽑은 가챠');
behave(MOD).forEach(([ok, msg]) => chk(ok, msg));
say('── 3. mutation test — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/wardrobe.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  ['deps 하나 빠짐', null, a => { const i = a.indexOf("const wardrobeMod = TwWardrobe.createWardrobe({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }, null],
  ['전역 이름 안 걺', m => m.replace('window.TwWardrobe = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const wardrobeMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('wardrobeMod.' + x)); if(n){ ls[i] = ls[i].replace('wardrobeMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createWardrobe(deps){', 'function createWardrobe(deps){ throw new Error("mutation");'), null, null],
];
/* mutation test — 동작을 일부러 바꾸면 2-2절이 빨갛게 되어야 한다 */
const behaveBreaks = [
  ['라이선스 없어도 처음 탭이 모자', m => m.replace("else if(!tab && !_wdOpened && !wdLicensed()) currentWdTab = WD_ALBUM_TAB;", '')],
  ['«처음» 을 빈 탭으로 판정(부팅 때 닫힌 채 그린 모자에 막힘)', m => m.replace("else if(!tab && !_wdOpened && !wdLicensed())", "else if(!currentWdTab && !wdLicensed())")],
  ['잠금 안내 없이 칸을 그림', m => m.replace("  if(!wdLicensed()){\n    if(currentWdTab === wdEar.TAB)", "  if(false){\n    if(currentWdTab === wdEar.TAB)")],
  ['안 뽑은 가챠도 칸에', m => m.replace("!gachaMod().isGachaPart(p) || gachaMod().gachaCount(p.id)>0", '!0')],
  ['도감 탭에서 서버를 안 맞춤', m => m.replace('if(currentWdTab === WD_ALBUM_TAB) gachaMod().onAlbumShow(opts);', '')],
  ['가챠 칸에도 관리자 ×', m => m.replace('if(isAdmin() && !isGacha){', 'if(isAdmin()){')],
];
for(const [name, fm] of behaveBreaks){
  const m2 = fm(MOD);
  chk(m2 !== MOD && behave(m2).some(([ok]) => !ok), '동작 mutation test — ' + name + (m2 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
}
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
/* ── 4. 꾸미기 책상 카드 — 못 받으면 E-CHAR-13 진단 줄에 받기 실패 이유(catalog-glb.js glbFailWhy) */
say('── 4. 책상 카드 E-CHAR-13 진단 줄');
const deskClickOf = (src) => {
  const i = src.indexOf('card.onclick=async()=>{\n      if(def.deskCatalogId===rec.id) return;'), j = src.indexOf('\n    };', i);
  return i < 0 || j < 0 ? null : src.slice(i + 'card.onclick='.length, j + 6);
};
const runDeskClick = async (body, o) => {
  const calls = [];
  const fn = new Function('def', 'rec', 'resolveCatalogGlb', 'glbFailWhy', 'TwErrorCodes', '_wdApplyDeskChange', 'renderWardrobe', 'return ' + body)(
    { deskCatalogId: null }, o.rec, async (r) => { if(o.throwE) throw o.throwE; if(o.ok) r.glb = 'G'; }, () => o.why || '',
    { notify: (...a) => calls.push(a) }, () => calls.push(['apply']), () => calls.push(['render']));
  await fn();
  return calls;
};
const _part4 = (async () => {
  const body = deskClickOf(MOD);
  chk(!!body, '책상 카드 누름 처리기를 모듈 글에서 떼어 왔다');
  if(body){
    const c1 = await runDeskClick(body, { rec: { id: 'a', glbUrl: 'u' }, why: 'net-fail Failed to fetch 12ms' });
    chk(JSON.stringify(c1) === '[["E-CHAR-13","net-fail Failed to fetch 12ms"]]', '못 받음 — 받기 실패 이유(glbFailWhy)를 진단 줄에 싣는다');
    const c2 = await runDeskClick(body, { rec: { id: 'a', glbUrl: 'u' } });
    const c3 = await runDeskClick(body, { rec: { id: 'a' } });
    chk(JSON.stringify(c2) === '[["E-CHAR-13","no-glb"]]' && JSON.stringify(c3) === '[["E-CHAR-13","no-url"]]', '  이유를 모르면 no-glb · 주소가 없으면 no-url');
    const c4 = await runDeskClick(body, { rec: { id: 'a', glbUrl: 'u' }, ok: true });
    chk(JSON.stringify(c4) === '[["apply"],["render"]]', '  받으면 알림 없이 적용 · 다시 그림');
    const bb = deskClickOf(MOD.replace("(glbFailWhy(rec.glbUrl) || 'no-glb')", "'no-glb'"));
    const cb = bb ? await runDeskClick(bb, { rec: { id: 'a', glbUrl: 'u' }, why: 'net-fail X 1ms' }) : [];
    chk(bb && JSON.stringify(cb) !== JSON.stringify([['E-CHAR-13', 'net-fail X 1ms']]), 'mutation test — 이유를 안 실으면 위 판정이 빨강');
  }
})();

/* ── 5. 동작 — 🪑 꾸미기 › 책상 탭의 «🚫 책상 없음» 칸(책상 탭 두 함수만 떼어 가짜 위에서 누른다)
   책상 그리기(applyDeskCatalogRefToSeat)는 GLB 를 풀어야 끝나는 일이라 가짜도 «나중에 끝나는» Promise — 좌석 줄은 그 뒤에 잡아야 한다 */
say('── 5. 동작 — 책상 탭 «책상 없음» · 좌석 줄 다시 잡기');
const tick = () => new Promise((r) => setImmediate(r));
/* 색 받는 재질 판정 · 칠하기는 책상 모양 모듈(desk-visual.js)의 진짜 함수를 쓴다 — 꾸미기 창이 따로 정하지 않는다 */
const DV_SRC = ["desk-visual.js","parts/character/desk-visual.js","app/parts/character/desk-visual.js"].map(read).find(Boolean) || '';
function deskColorFns(log, dv){
  const src = dv || DV_SRC, a = src.indexOf('function deskColorMats(seat){'), b = src.indexOf('\nreturn {', a);
  if(a < 0 || b < 0) return null;
  return new Function('_setDeskMatColor', src.slice(a, b) + '\nreturn { deskColorMats, applyDeskColor };')((m, c) => { log.color.push([m, c]); });
}
function deskTab(mod, dv){
  const a = mod.indexOf('function _wdApplyDeskChange('), b = mod.indexOf('let wdRenderer=null', a);
  if(a < 0 || b < 0) return null;
  const log = { apply: [], layout: 0, save: 0, render: 0, pending: [], refresh: 0, scale: [], color: [], tune: 0, pos: [], gizmo: 0 };
  const prev = { next: null, isZero: (p) => !p || (!p.x && !p.y && !p.z), readPos: () => prev.next, resetPos: () => ({ x: 0, y: 0, z: 0 }), tune: () => { log.tune++; } };
  const dvf = deskColorFns(log, dv); if(!dvf) return null;
  const seat = { isMe: true, desk: { userData: {} }, charDef: { deskCatalogId: 'd1', deskGlb: 'G' } };
  const made = [];
  const el = () => { const e = { style: {}, classList: { add(){} }, children: [], appendChild(c){ this.children.push(c); return c; }, set innerHTML(v){}, textContent: '' }; made.push(e); return e; };
  const byId = (id) => made.filter(e => e.id === id).pop() || null;
  const cards = [];
  const env = {
    NO_DESK_ID: '__no_desk__', DEFAULT_DESK_OVERRIDE_ID: '__default_desk__', DESK_LICENSE_HOLD: () => 'hold', DESK_SCALE_DEFAULT: () => 0.2, DESK_SCALE_MIN: () => 0.05, DESK_SCALE_MAX: () => 0.3,
    findMySeat: () => seat, wdDraftDef: null, _wdLicenseDesks: () => [{ id: 'L1', name: '전용', glb: 'LG' }],
    swThumb: (label, on, icon) => { const c = el(); c.label = label; c.on = on; c.icon = icon; cards.push(c); return c; },
    applyDeskCatalogRefToSeat: (s, d) => { log.apply.push(d.deskCatalogId); return new Promise((r) => log.pending.push(r)); },
    setDeskScale: (d, sc, lx) => { log.scale.push([sc, lx]); }, deskColorMats: dvf.deskColorMats, applyDeskColor: dvf.applyDeskColor, clampDeskScale: (v) => v,
    deskPreview: prev, setDeskPos: (d, p) => { log.pos.push(p ? JSON.stringify(p) : null); }, currentWdTab: '__desk__', WD_DESK_TAB: () => '__desk__', updateWdGizmoForActivePanel: () => { log.gizmo++; },
    saveSlots: () => { log.save++; }, Presence: () => ({ active: () => false }), refreshWdPreviewChar: () => { log.refresh++; }, layoutSeats: () => { log.layout++; }, renderWardrobe: () => { log.render++; },
    openAssetImport: () => {}, applyDeskDotThumb: () => {}, resolveCatalogGlb: async () => {}, TwErrorCodes: { notify(){} }, document: { createElement: el, getElementById: byId },
  };
  const names = Object.keys(env);
  const f = new Function(...names, mod.slice(a, b) + '\nreturn { renderWdDeskSection, _wdDeskDragged, _wdDeskDropped, _wdDeskTabOn };');
  const fns = f(...names.map(n => env[n])); const render = fns.renderWdDeskSection;
  const settle = async () => { log.pending.splice(0).forEach((r) => r()); await tick(); await tick(); };
  return { render, seat, log, cards, el, settle, byId, made, prev, fns, again(){ cards.length = 0; render(el()); } };
}
(async () => {
  await _part4;   // 4절(책상 카드 진단 줄)이 끝난 뒤
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
  /* mutation test — 그리기를 안 기다리고 바로 잡으면(옛 순서) · 전용 책상 카드가 안 잡으면 위 판정이 빨강 */
  const early = deskTab(MOD.replace('if(relayout) Promise.resolve(drawn).catch(()=>{}).then(()=>layoutSeats());', 'if(relayout) layoutSeats();'));
  let caught = false;
  if(early){ early.render(early.el()); early.cards.find(c => c.label === '책상 없음').onclick(); await tick(); caught = early.log.layout === 1; }
  chk(caught, '  mutation test — 그리기가 끝나기 전에 좌석 줄을 잡으면 잡힌다');
  const noLic = deskTab(MOD.replace('_wdApplyDeskChange(d=>{ d.deskCatalogId=rec.id; d.deskGlb=null; }, true);', '_wdApplyDeskChange(d=>{ d.deskCatalogId=rec.id; d.deskGlb=null; });'));
  caught = false;
  if(noLic){ noLic.render(noLic.el()); await noLic.cards.find(c => c.label === '전용').onclick(); await noLic.settle(); caught = noLic.log.layout === 0; }
  chk(caught, '  mutation test — 전용 책상 카드가 좌석 줄을 안 잡으면 잡힌다');
  say('── 5-2. 동작 — 책상 색 칸 보이기 · 색 · 크기 · 길이 조절이 책상을 다시 그리지 않는다');
  const tuneRows = async (mod, dv) => {
    const r = [], t = (ok, msg) => r.push([!!ok, msg]);
    const shown = (T) => { T.again(); const row = T.byId('wdDeskColorRow'); return !!row && /^display:flex;/.test(row.style.cssText); };
    let T = deskTab(mod, dv); if(!T){ t(false, '책상 탭 함수를 못 뗌'); return r; }
    t(shown(T) === false, '★ 색 받는 재질이 없는 책상(_col 메쉬 없음 · 내장 재질 없음) — «책상 색» 칸을 숨긴다');
    T.seat.desk.userData.customMats = []; t(shown(T) === false, '  GLB 책상인데 _col 메쉬가 0개 — 숨김');
    T.seat.desk.userData.customMats = ['m1', 'm2']; t(shown(T) === true, '  _col 메쉬가 있는 GLB 책상 — 보임');
    T.seat.desk.userData.customMats = null; T.seat.deskMat = 'base'; t(shown(T) === true, '  내장 기본 책상(deskMat) — 보임');
    T.seat.desk.userData.noDesk = true; t(shown(T) === false, '  «책상 없음» — 숨김');
    T.seat.desk.userData.noDesk = false; T.seat.deskMat = null; T.seat.desk.userData.customMats = ['m1', 'm2'];
    T.again();
    t(T.made.some(e => e.className === 'wd-desk-grid') && !T.made.some(e => e.className === 'wd-grid'), '책상 섬네일 줄은 wd-desk-grid(3등분 wd-grid 아님)');
    const col = T.byId('wdDeskColor'), sc = T.byId('wdDeskScale'), len = T.byId('wdDeskLenX');
    const a0 = T.log.apply.length, s0 = T.log.save;
    for(let i = 0; i < 30; i++){ col.value = '#0000' + (10 + i); col.oninput(); }
    t(T.log.apply.length === a0 && T.log.refresh === 0, '★ 색 고르기 창을 끄는 동안(input 30번) 책상 GLB 를 다시 그리지 않고 미리보기도 다시 만들지 않는다');
    t(T.log.color.length === 60 && T.log.color[59][0] === 'm2' && T.log.color[59][1] === '#000039' && T.seat.charDef.deskColor === '#000039', '  색은 색 받는 재질마다 바로 바뀐다 · def 에 적힌다');
    t(T.log.save === s0 + 30, '  저장은 예전처럼 바뀔 때마다');
    col.onchange();
    t(T.log.refresh === 1 && T.log.apply.length === a0, '  놓으면(change) 미리보기를 한 번 다시 그린다');
    sc.value = '0.25'; sc.oninput(); len.value = '1.5'; len.oninput();
    t(T.log.apply.length === a0 && T.log.refresh === 1 && T.seat.charDef.deskScale === 0.25 && T.seat.charDef.deskLenX === 1.5 && JSON.stringify(T.log.scale.slice(-1)[0]) === '[0.25,1.5]', '★ 크기 · 길이 슬라이더도 책상을 다시 그리지 않고 크기만 바꾼다');
    sc.onchange(); t(T.log.refresh === 2, '  슬라이더를 놓으면 미리보기 한 번');
    /* 책상을 바꾸면 다 그린 뒤 색 칸을 다시 맞춘다 */
    const row = T.byId('wdDeskColorRow');
    T.seat.desk.userData.customMats = null; T.cards[0].onclick(); await T.settle();
    t(row.style.display === 'none', '★ 책상을 바꾸면 다 그린 뒤 색 칸을 다시 맞춘다(색 없는 책상으로 → 숨김)');
    t(T.log.tune >= 31, '색 · 크기 · 길이 input 마다 미리보기의 책상 몸도 값만 맞춘다(deskPreview.tune)');
    /* 🪑 책상 위치 — 미리보기 손잡이를 끄는 동안 · 놓을 때 · [위치 초기화] */
    T = deskTab(mod, dv); T.again();
    const s1 = T.log.save, l1 = T.log.layout;
    T.prev.next = { x: 0.3, y: 0, z: -0.1 }; T.fns._wdDeskDragged();
    t(JSON.stringify(T.seat.charDef.deskPos) === '{"x":0.3,"y":0,"z":-0.1}' && T.log.pos.slice(-1)[0] === '{"x":0.3,"y":0,"z":-0.1}' && T.log.save === s1 && T.log.layout === l1, '★ 손잡이를 끄는 동안 — def.deskPos · 내 좌석 책상만 옮긴다(저장 · 좌석 줄은 아직)');
    T.fns._wdDeskDropped();
    t(T.log.save === s1 + 1 && T.log.layout === l1 + 1, '★ 놓으면 저장 · 좌석 줄을 한 번 다시 잡는다');
    T.prev.next = { x: 0, y: 0, z: 0 }; T.fns._wdDeskDropped();
    t(!('deskPos' in T.seat.charDef) && T.log.pos.slice(-1)[0] === null, '  0,0,0 으로 놓으면 deskPos 칸을 지운다(생성기 저장과 같은 모양)');
    T.prev.next = { x: 0.5, y: 0.1, z: 0 }; T.fns._wdDeskDropped();
    const rs = T.byId('wdDeskPosReset'); const s2 = T.log.save, g2 = T.log.gizmo;
    t(!!rs && typeof rs.onclick === 'function', '책상 탭에 [위치 초기화] 버튼이 있다');
    if(rs && rs.onclick) rs.onclick();
    t(!('deskPos' in T.seat.charDef) && T.log.save === s2 + 1 && T.log.gizmo === g2 + 1, '★ [위치 초기화] — deskPos 지움 · 저장 · 손잡이도 제자리로');
    T.prev.next = null; const p0 = T.log.pos.length; T.fns._wdDeskDragged();
    t(T.log.pos.length === p0, '  미리보기에 책상 몸이 없으면(readPos null) 아무것도 안 한다');
    return r;
  };
  (await tuneRows(MOD)).forEach(([ok, msg]) => chk(ok, msg));
  { const reds = async (m, dv) => { try{ return (await tuneRows(m, dv)).filter(([ok]) => !ok).length; }catch(_){ return 99; } };
    const M = [
      ['색 input 마다 책상을 다시 그림', MOD.replace('inColor.oninput=()=>{ _wdTuneDesk(', 'inColor.oninput=()=>{ _wdApplyDeskChange(')],
      ['크기 input 마다 책상을 다시 그림', MOD.replace('v=>{ _wdTuneDesk(d=>{ d.deskScale=clampDeskScale(v); }); }', 'v=>{ _wdApplyDeskChange(d=>{ d.deskScale=clampDeskScale(v); }); }')],
      ['색 칸을 늘 보임', MOD.replace("(deskColorMats(seat).length?'flex':'none')", "'flex'")],
      ['놓아도 미리보기를 안 그림', MOD.replace('inColor.onchange=()=>{ refreshWdPreviewChar(); };', '')],
      ['책상을 바꿔도 색 칸을 안 맞춤', MOD.replace('.then(()=>_wdSyncDeskColorRow(seat));', '.then(()=>{});')],
      ['섬네일 줄이 3등분', MOD.replace("grid.className='wd-desk-grid';", "grid.className='wd-grid';")],
      ['끄는 동안마다 저장', MOD.replace('function _wdDeskDragged(){ _wdSetDeskPos(deskPreview.readPos()); }', 'function _wdDeskDragged(){ _wdDeskDropped(); }')],
      ['놓아도 저장을 안 함', MOD.replace('  _wdCommitDesk(seat, seat.charDef);\n  layoutSeats();   // 좌우로 밀었으면 좌석 간격을 다시 잡는다', '')],
      ['0 이어도 칸을 남김', MOD.replace('if(deskPreview.isZero(pos)) delete seat.charDef.deskPos; else seat.charDef.deskPos = pos;', 'seat.charDef.deskPos = pos;')],
      ['조절이 미리보기 몸을 안 맞춤', MOD.replace('  deskPreview.tune(def);\n', '')],
    ];
    for(const [name, m] of M) chk(m !== MOD && (await reds(m)) > 0, '  mutation test — ' + name + ' → 빨강');
    const DM = [
      ['책상 없음에도 색 재질', DV_SRC.replace('if(!d || !d.userData || d.userData.noDesk) return [];', 'if(!d || !d.userData) return [];')],
      ['내장 기본 책상 재질을 안 봄', DV_SRC.replace('return seat.deskMat ? [seat.deskMat] : [];', 'return [];')],
      ['칠하기가 재질을 안 칠함', DV_SRC.replace('deskColorMats(seat).forEach(m=>_setDeskMatColor(m, color));', '')],
    ];
    for(const [name, dv] of DM) chk(dv !== DV_SRC && (await reds(MOD, dv)) > 0, '  mutation test(desk-visual) — ' + name + ' → 빨강');
    chk(!/customMats|deskMat\b/.test(MOD.slice(MOD.indexOf('function _wdApplyDeskChange('), MOD.indexOf('let wdRenderer=null'))), '꾸미기 책상 탭은 색 재질을 따로 정하지 않는다(customMats · deskMat 를 직접 읽지 않음 — desk-visual.js 의 deskColorMats · applyDeskColor 만)'); }
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
    chk(m2 !== MOD && r2.some(([ok]) => !ok), '  mutation test: ' + nm + (m2 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();

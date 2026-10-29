/* ═══ 🎨 sim-wardrobe.js — 🎨 꾸미기 창 모듈 구조 (2026-10-14 신설 · 앱 FSD 29번) ═══════════════
   app.js 의 꾸미기 다섯 구역 본문 을 parts/character/wardrobe.js 로 옮겼다(글자 그대로 · 바뀐 줄 70 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(꾸미기 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(ORBIT_DRAG_DIR · _clearMultiPanelRef · _wdAfterMainSwap · activeWdAdj · setActiveWdAdj · buildFreeColorPicker · commitWdDraft · createWardrobeAdjPanel · currentWdTab · detachWdGizmo · ensureWdDraft · ensureWdGizmo · placeWdWindows · refreshWdPreviewChar · refreshWdPreviewColorSection · renderWardrobe · setWdGizmoMode · sizeWdPreview · syncWdGizmoToXf · syncWdPreviewOwner · toggleEquip · updateWdCam · updateWdGizmoForActivePanel · wdCam · wdDraftDef · wdGizmo · wdGizmoMode · wdPreviewBase · wdWinSavedPos · wdScene)
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
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_attachHumanEars","_disposeWrapperFromSeat","_hsvToHex","_invalidatePendingEquip","_mkFrontFill","_rgbHexToHsv","_sweepOrphanPartWrappers","_wdLicenseDesks","addEntryToCat","addPartEntryInstance","applyClothVisibility","applyEquippedPartsToSeat","applyHueTint","applyPartXf","baseFlatOf","bindReorderHandle","boneSide","charFootFix","clampCharY","defToBase","defaultPartXf","entriesForCat","equipPartOnSeat","escHtml","findEntryById","findMySeat","firstEntryForCat","floorClampWrapper","getCommissionScene","groupOfCat","isDeskPartCat","isHueTintMesh","measureCharBox","openAssetImport","partCatInfo","partEntryId","partEntryInstanceCount","partEntryInstances","partEntryXf","partsInCat","partsInCatFor","partsInGroup","pruneSeatPartsAgainstDef","refitSeatAfterParts","removeEntryFromCat","removePartEntryInstance","reorderSavedPart","saveSlots","setPartEntryInstanceXf","toast","unequipStackablePart","_humanEarMat","_humanEarPic","applyDeskCatalogRefToSeat","applyDeskColorToCustom","applyDeskDotThumb","clampDeskScale","resolveCatalogGlb","setDeskScale","swThumb"];
const VAL_DEPS = ["ANIMAL_RUN_SCALE","CHAR_Z","_FILL_LIGHT_MUL","_KEY_LIGHT_MUL","_MAIN_LIGHT_COL","_MAIN_LIGHT_INT","seats","DEFAULT_DESK_OVERRIDE_ID","humanEar","twNav"];
const GET_DEPS = ["PART_CATS","PART_DEFAULT_OFFSET","PART_GROUPS","Presence","WD_DESK_TAB","gachaMod","isAdmin","isPremium","partPaintMod","savedParts","slots","DESK_LICENSE_HOLD","DESK_SCALE_DEFAULT","DESK_SCALE_MAX","DESK_SCALE_MIN"];
const SET_DEPS = [];
const EXPORTS = ["ORBIT_DRAG_DIR","_clearMultiPanelRef","_wdAfterMainSwap","ALBUM_TAB","selectWdTab","isAlbumTab","activeWdAdj","setActiveWdAdj","buildFreeColorPicker","commitWdDraft","createWardrobeAdjPanel","currentWdTab","detachWdGizmo","ensureWdDraft","ensureWdGizmo","placeWdWindows","refreshWdPreviewChar","refreshWdPreviewColorSection","renderWardrobe","setWdGizmoMode","sizeWdPreview","syncWdGizmoToXf","syncWdPreviewOwner","toggleEquip","updateWdCam","updateWdGizmoForActivePanel","wdCam","wdDraftDef","wdEar","setAdminPartActions","relinkDraftSrc","wdGizmo","wdGizmoMode","wdPreviewBase","wdWinSavedPos","wdScene"];
const MOVED = ["wdRenderer","wdScene","wdCam","wdPreviewBase","WD_PREVIEW_DESK_Y","WD_PREVIEW_DESK_Z","WD_PREVIEW_DESK_NUDGE","ensureWdPreview","wdGizmo","wdGizmoMode","wdGizmoCat","ensureWdGizmo","wdGizmoInstanceIdx","wdGizmoPartId","_wdGetActiveWrapperAndXf","syncWdGizmoToXf","attachWdGizmo","detachWdGizmo","setWdGizmoMode","updateWdGizmoForActivePanel","WD_WIN_POS_KEY","wdWinSavedPos","placeWdWindows","syncWdPreviewOwner","sizeWdPreview","wdYaw","wdPitch","wdHeightOffset","wdZoomMul","ORBIT_DRAG_DIR","wdCamCenter","wdCamLookY","wdCamBaseDist","WD_EAR_CAM_LIFT","WD_EAR_CAM_ZOOM","_wdEarCamOn","updateWdCam","wdDraftDef","ensureWdDraft","refreshWdPreviewChar","wdPreviewLoop","_wdCommitChain","commitWdDraft","_commitWdDraftNow","_commitWdDraftToOwner","_wdAfterMainSwap","refreshWdPreviewColorSection","activeWdAdj","_wdMultiActiveIdx","_wdGetSavedInstanceIdx","_wdSetSavedInstanceIdx","_clearMultiPanelRef","wdAdjAxis","_holdRepeat","hsvToHex","hexToHsv","buildFreeColorPicker","openCharColorPicker","createWardrobeAdjPanel","buildColorRows","currentWdTab","currentWdGroup","renderWardrobe","toggleEquip"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  ANIMAL_RUN_SCALE: ANIMAL_RUN_SCALE,","  CHAR_Z: CHAR_Z,","  PART_CATS: ()=>premiumMod.PART_CATS(),","  PART_DEFAULT_OFFSET: ()=>PART_DEFAULT_OFFSET,","  PART_GROUPS: ()=>premiumMod.PART_GROUPS,","  Presence: ()=>Presence,","  WD_DESK_TAB: ()=>premiumMod.WD_DESK_TAB,","  _FILL_LIGHT_MUL: _FILL_LIGHT_MUL,","  _KEY_LIGHT_MUL: _KEY_LIGHT_MUL,","  _MAIN_LIGHT_COL: _MAIN_LIGHT_COL,","  _MAIN_LIGHT_INT: _MAIN_LIGHT_INT,","  _attachHumanEars: (...a)=>_attachHumanEars(...a),","  _disposeWrapperFromSeat: (...a)=>_disposeWrapperFromSeat(...a),","  _hsvToHex: (...a)=>_hsvToHex(...a),","  _invalidatePendingEquip: (...a)=>_invalidatePendingEquip(...a),","  _mkFrontFill: (...a)=>_mkFrontFill(...a),","  _rgbHexToHsv: (...a)=>_rgbHexToHsv(...a),","  _sweepOrphanPartWrappers: (...a)=>_sweepOrphanPartWrappers(...a),","  _wdLicenseDesks: (...a)=>premiumMod._wdLicenseDesks(...a),","  addEntryToCat: (...a)=>premiumMod.addEntryToCat(...a),","  addPartEntryInstance: (...a)=>premiumMod.addPartEntryInstance(...a),","  applyClothVisibility: (...a)=>applyClothVisibility(...a),","  applyEquippedPartsToSeat: (...a)=>applyEquippedPartsToSeat(...a),","  applyHueTint: (...a)=>applyHueTint(...a),","  applyPartXf: (...a)=>applyPartXf(...a),","  baseFlatOf: (...a)=>lightToneMod.baseFlatOf(...a),","  bindReorderHandle: (...a)=>bindReorderHandle(...a),","  boneSide: (...a)=>boneSide(...a),","  charFootFix: (...a)=>charMeasureMod.charFootFix(...a),","  clampCharY: (...a)=>clampCharY(...a),","  defToBase: (...a)=>defToBase(...a),","  defaultPartXf: (...a)=>premiumMod.defaultPartXf(...a),","  entriesForCat: (...a)=>premiumMod.entriesForCat(...a),","  equipPartOnSeat: (...a)=>equipPartOnSeat(...a),","  escHtml: (...a)=>escHtml(...a),","  findEntryById: (...a)=>premiumMod.findEntryById(...a),","  findMySeat: (...a)=>findMySeat(...a),","  firstEntryForCat: (...a)=>premiumMod.firstEntryForCat(...a),","  floorClampWrapper: (...a)=>charMeasureMod.floorClampWrapper(...a),","  gachaMod: ()=>gachaMod,","  getCommissionScene: (...a)=>getCommissionScene(...a),","  groupOfCat: (...a)=>premiumMod.groupOfCat(...a),","  isAdmin: ()=>isAdmin,","  isPremium: ()=>isPremium,","  twNav: twNav,","  isDeskPartCat: (...a)=>premiumMod.isDeskPartCat(...a),","  isHueTintMesh: (...a)=>isHueTintMesh(...a),","  measureCharBox: (...a)=>charMeasureMod.measureCharBox(...a),","  openAssetImport: (...a)=>openAssetImport(...a),","  partCatInfo: (...a)=>premiumMod.partCatInfo(...a),","  partEntryId: (...a)=>premiumMod.partEntryId(...a),","  partEntryInstanceCount: (...a)=>premiumMod.partEntryInstanceCount(...a),","  partEntryInstances: (...a)=>premiumMod.partEntryInstances(...a),","  partEntryXf: (...a)=>premiumMod.partEntryXf(...a),","  partPaintMod: ()=>partPaintMod,","  partsInCat: (...a)=>premiumMod.partsInCat(...a),","  partsInCatFor: (...a)=>premiumMod.partsInCatFor(...a),","  partsInGroup: (...a)=>premiumMod.partsInGroup(...a),","  pruneSeatPartsAgainstDef: (...a)=>pruneSeatPartsAgainstDef(...a),","  refitSeatAfterParts: (...a)=>seatRefitMod.refitSeatAfterParts(...a),","  removeEntryFromCat: (...a)=>premiumMod.removeEntryFromCat(...a),","  removePartEntryInstance: (...a)=>premiumMod.removePartEntryInstance(...a),","  reorderSavedPart: (...a)=>premiumMod.reorderSavedPart(...a),","  saveSlots: (...a)=>slotSaveMod.saveSlots(...a),","  savedParts: ()=>premiumMod.savedParts(),","  seats: seats,","  setPartEntryInstanceXf: (...a)=>premiumMod.setPartEntryInstanceXf(...a),","  slots: ()=>slots,","  toast: (...a)=>toast(...a),","  unequipStackablePart: (...a)=>unequipStackablePart(...a),","  DEFAULT_DESK_OVERRIDE_ID: DEFAULT_DESK_OVERRIDE_ID,","  DESK_LICENSE_HOLD: ()=>premiumMod.DESK_LICENSE_HOLD,","  DESK_SCALE_DEFAULT: ()=>DESK_SCALE_DEFAULT,","  DESK_SCALE_MAX: ()=>DESK_SCALE_MAX,","  DESK_SCALE_MIN: ()=>DESK_SCALE_MIN,","  _humanEarMat: (...a)=>_humanEarMat(...a),","  _humanEarPic: (...a)=>_humanEarPic(...a),","  applyDeskCatalogRefToSeat: (...a)=>deskVisualMod.applyDeskCatalogRefToSeat(...a),","  applyDeskColorToCustom: (...a)=>deskVisualMod.applyDeskColorToCustom(...a),","  applyDeskDotThumb: (...a)=>applyDeskDotThumb(...a),","  clampDeskScale: (...a)=>clampDeskScale(...a),","  humanEar: humanEar,","  resolveCatalogGlb: (...a)=>catalogGlbMod.resolveCatalogGlb(...a),","  setDeskScale: (...a)=>setDeskScale(...a),","  swThumb: (...a)=>swThumb(...a),"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다.
   then 도 받는다 — 만들 때 부르는 서버 요청(.then 잇기)이 던지지 않게(풀리지는 않는다) */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
/* 꾸미기 창 · 미리보기 자리 맞추기가 창 크기 변화를 본다 — 가짜 DOM 에서는 아무 일도 안 하는 관찰자 */
class FakeResizeObserver{ observe(){} disconnect(){} }

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
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module', 'ResizeObserver',
    src + '\nreturn window.TwWardrobe;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, FakeResizeObserver);
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
/* 동작을 일부러 깨 본다 — 2-2절이 빨갛게 되어야 한다 */
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
  chk(m2 !== MOD && behave(m2).some(([ok]) => !ok), '동작 깨 보기 — ' + name + (m2 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
}
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

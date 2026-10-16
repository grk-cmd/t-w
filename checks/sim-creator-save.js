/* ═══ 🧍 sim-creator-save.js — 🧍 생성기 완료 모듈 (2026-10-16 신설 · C 구역 떼기 · w3) ═══════════════
   app.js 의 생성기 완료 — def 만들기 · 용량 재기 · 저장 을 parts/creator/creator-save.js 로 옮겼다(글자 그대로 · 바뀐 줄 45 — 읽는 · 쓰는 함수로 바꾼 자리).
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(DEF_SIZE_TOAST_MS · _creatorBuildDef · _creatorSizeGrow · _defSizeFile)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 만드는 줄 · deps 48줄 그대로 · 부르는 곳은 creatorSaveMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   ・4절: 동작 — 가짜 DOM · deps 로 모듈을 만들어 입력 → 결과(경계값 포함)를 본다
   [실행] app.js · desk-companion-prototype.html · creator-save.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["creator-save.js","parts/creator/creator-save.js","app/parts/creator/creator-save.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — creator-save.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_isBlankDraw","applyCharToSeat","applyDesktopRunClass","charDef","clampCharY","clearStampState","collectDeskItems","createSeat","layoutSeats","renderLauncher","renderSeatTabs","saveCurSlot","selectSeat","snapCanvas","toast"];
const VAL_DEPS = ["CHAR_SLOT_MAX","blinkC","creatorFlowMod","faceC","roomSyncMod","slots"];
const GET_DEPS = ["Presence","_blankFaceConfirmed","activeCustomDeskId","cBase","cBotColor","cCam","cDeskColor","cDeskGlbB64","cDeskLenX","cDeskPos","cDeskScale","cRenderer","cScene","cTopColor","cXform","charsMod","commissionMod","creatorMode","creatorOpen","curSlot","currentCreatorDef","customItems","skinIndex","slotSaveMod"];
const SET_DEPS = ["_blankFaceConfirmed","creatorOpen","curSlot"];
const EXPORTS = ["DEF_SIZE_TOAST_MS","_creatorBuildDef","_creatorSizeGrow","_defSizeFile"];
const MOVED = ["_creatorBuildDef","DEF_SIZE_TOAST_MS","_creatorSizeGrow","_defSizeFile"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  CHAR_SLOT_MAX: CHAR_SLOT_MAX,","  Presence: ()=>Presence,","  _blankFaceConfirmed: ()=>_blankFaceConfirmed,","  _isBlankDraw: (...a)=>_isBlankDraw(...a),","  activeCustomDeskId: ()=>activeCustomDeskId,","  applyCharToSeat: (...a)=>applyCharToSeat(...a),","  applyDesktopRunClass: (...a)=>applyDesktopRunClass(...a),","  blinkC: blinkC,","  cBase: ()=>cBase,","  cBotColor: ()=>cBotColor,","  cCam: ()=>cCam,","  cDeskColor: ()=>cDeskColor,","  cDeskGlbB64: ()=>cDeskGlbB64,","  cDeskLenX: ()=>cDeskLenX,","  cDeskPos: ()=>cDeskPos,","  cDeskScale: ()=>cDeskScale,","  cRenderer: ()=>cRenderer,","  cScene: ()=>cScene,","  cTopColor: ()=>cTopColor,","  cXform: ()=>cXform,","  charDef: (...a)=>charDef(...a),","  charsMod: ()=>charsMod,","  clampCharY: (...a)=>clampCharY(...a),","  clearStampState: (...a)=>clearStampState(...a),","  collectDeskItems: (...a)=>collectDeskItems(...a),","  commissionMod: ()=>commissionMod,","  createSeat: (...a)=>createSeat(...a),","  creatorFlowMod: creatorFlowMod,","  creatorMode: ()=>creatorMode,","  creatorOpen: ()=>creatorOpen,","  curSlot: ()=>curSlot,","  currentCreatorDef: ()=>currentCreatorDef,","  customItems: ()=>customItems,","  faceC: faceC,","  layoutSeats: (...a)=>layoutSeats(...a),","  renderLauncher: (...a)=>renderLauncher(...a),","  renderSeatTabs: (...a)=>renderSeatTabs(...a),","  roomSyncMod: roomSyncMod,","  saveCurSlot: (...a)=>saveCurSlot(...a),","  selectSeat: (...a)=>selectSeat(...a),","  skinIndex: ()=>skinIndex,","  slotSaveMod: ()=>slotSaveMod,","  slots: slots,","  snapCanvas: (...a)=>snapCanvas(...a),","  toast: (...a)=>toast(...a),","  setBlankFaceConfirmed: (v)=>{ _blankFaceConfirmed = v; },","  setCreatorOpen: (v)=>{ creatorOpen = v; },","  setCurSlot: (v)=>{ curSlot = v; },"];

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
  const api = new Function(...keys, src + '\nreturn window.TwCreatorSave;')(...keys.map(k => E[k]));
  return api.createCreatorSave(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwCreatorSave = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwCreatorSave(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(app.includes("const creatorSaveMod = TwCreatorSave.createCreatorSave({"), '만드는 줄(가드 없이 — 모듈은 늘 싣는다)');
  const mk = (app.match(new RegExp("const creatorSaveMod = TwCreatorSave\\.createCreatorSave\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);")) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(new RegExp("const creatorSaveMod = [\\s\\S]*?\\n\\}\\);"), '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));
  t(!bare.length, '부르는 곳은 creatorSaveMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/creator/creator-save.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/creator/creator-save.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/creator/creator-save.js"></script>', '')],
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const creatorSaveMod = TwCreatorSave.createCreatorSave({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const creatorSaveMod = TwCreatorSave.createCreatorSave({", "const creatorSaveMod = TwCreatorSave.createCreatorSave({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwCreatorSave = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith("const creatorSaveMod =")) continue; const n = EXPORTS.filter(x => ![].includes(x)).find(x => ls[i].includes("creatorSaveMod." + x)); if(n){ ls[i] = ls[i].replace("creatorSaveMod." + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createCreatorSave(deps){', 'function createCreatorSave(deps){ throw new Error("깨 봄");'), null, null],
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

/* 생성기 완료 — 지금 상태 → def(이어받는 칸 · 저장 안 하는 기본값) · 용량 재기 · [완료] 저장 칸 고르기를 가짜 상태로 본다 */
function rigS(o){
  o = o || {};
  const D = fakeDom();
  const st = Object.assign({ cur: 0, open: true, blank: false, cfm: false, mode: { kind: 'slot', edit: false }, src: null, xf: { s: 0.8, y: 0.2, rot: 0.1 }, deskPos: { x: 0, y: 0, z: 0 }, deskScale: 1, lenX: 1, glb: null, activeDesk: null, items: null, custom: {} }, o);
  const slots = st.slots || [null, null, null];
  const calls = [];
  const log = (n) => (...a) => { calls.push([n, ...a]); };
  const savedDesks = o.savedDesks || [], savedItems = o.savedItems || [];
  const over = { CHAR_SLOT_MAX: slots.length, slots, faceC: { id: 'face' }, blinkC: { id: 'blink' },
    charDef: (skin, f, b, top, bot) => ({ skin, face: f, blink: b, top, bot }), snapCanvas: (c) => ({ snap: c.id }),
    skinIndex: () => 2, cTopColor: () => '#111', cBotColor: () => '#222', cXform: () => st.xf, clampCharY: (y) => Math.max(0, Math.min(1, +y || 0)),
    cDeskColor: () => '#c9a36a', cDeskGlbB64: () => st.glb, activeCustomDeskId: () => st.activeDesk, cDeskScale: () => st.deskScale, cDeskPos: () => st.deskPos, cDeskLenX: () => st.lenX,
    cBase: () => ({}), collectDeskItems: () => st.items, customItems: () => st.custom,
    commissionMod: () => ({ savedDesks: () => savedDesks, savedItems: () => savedItems }),
    cRenderer: () => null, cScene: () => null, cCam: () => null, currentCreatorDef: () => st.src,
    roomSyncMod: { defWireForSize: (d) => d, _defSizeNames: () => [] },
    _isBlankDraw: (c) => c === 'BLANK' || (c && c.id === 'face' && st.blank), _blankFaceConfirmed: () => st.cfm, setBlankFaceConfirmed: (v) => { st.cfm = v; },
    creatorMode: () => st.mode, creatorOpen: () => st.open, setCreatorOpen: (v) => { st.open = v; }, curSlot: () => st.cur, setCurSlot: (v) => { st.cur = v; },
    charsMod: () => ({ _charsBoxFull: () => !!o.boxFull, _charsOnNew: log('onNew') }), slotSaveMod: () => ({ saveSlots: log('save') }), saveCurSlot: log('saveCur'),
    Presence: () => ({ active: () => !!o.inRoom, updateDef: log('presence') }), applyCharToSeat: log('applySeat'), toast: log('toast'), clearStampState: log('stampClear'),
    renderLauncher: log('renderLauncher'), applyDesktopRunClass: log('runClass'), creatorFlowMod: { closeCreator: log('close') },
    createSeat: () => ({}), selectSeat: log('select'), renderSeatTabs: log('tabs'), layoutSeats: log('layout') };
  let confirmAns = o.confirm !== undefined ? o.confirm : true;
  const sizeCalls = [];
  const DefSize = { checkGrowth: (a, b, n) => { sizeCalls.push([a, b]); return o.tooBig ? { ok: false, message: '너무 커요' } : { ok: true }; }, checkFile: (rest, bytes) => ({ ok: bytes < 100, rest }) };
  const api = build(MOD, over, { document: D.document, DefSize, confirm: () => confirmAns, window: { focus: log('focus') } });
  return { D, st, api, calls, slots, sizeCalls, el: (id) => D.document.getElementById(id), n: (k) => calls.filter(c => c[0] === k).length, last: (k) => (calls.filter(c => c[0] === k).pop() || [])[1] };
}
/* def 만들기 */
{ const r = rigS(); const d = r.api._creatorBuildDef(false);
  chk(d.skin === 2 && d.face.snap === 'face' && d.blink.snap === 'blink' && d.top === '#111' && d.bot === '#222', '저장 — 피부 · 표정 · 감은눈(복사본) · 옷색');
  chk(JSON.stringify(d.xf) === '{"s":0.8,"y":0.2,"z":0,"rot":0.1,"x":0}' && d.deskColor === '#c9a36a', 'xf — 크기 · 높이 · 회전, 앞뒤(z)는 0 으로 굳힌다');
  chk(!('deskScale' in d) && !('deskPos' in d) && !('deskLenX' in d) && !('deskGlb' in d) && d.deskItems === null, '기본값(책상 크기 1 · 위치 0 · 길이 1 · 기본 책상)은 저장하지 않는다 · 아이템이 없으면 null 로 반영'); }
{ const r = rigS({ xf: { s: 1, y: 7, rot: 0 } }); chk(r.api._creatorBuildDef(false).xf.y === 1, '경계 — 높이는 clampCharY 로 정리해 저장'); }
{ const r = rigS(); const d = r.api._creatorBuildDef(true); chk(d.face.id === 'face' && !('thumb' in d), '재기용(forSize) — 그림을 복사하지 않고 섬네일도 안 찍는다'); }
{ const src = { isCommission: true, commName: '', commGlb: 'G', equippedParts: { hat: 'h' }, partXfMemory: { m: 1 }, earL: 'e1', earAdj: 0, earR: null };
  const d = rigS({ src }).api._creatorBuildDef(false);
  chk(d.isCommission && d.commName === '커미션' && d.commGlb === 'G', '커미션으로 들어왔으면 GLB · 이름(없으면 «커미션») · 표식을 이어받는다');
  chk(d.equippedParts === src.equippedParts && d.partXfMemory === src.partXfMemory, '꾸미기 파츠 · 파츠 위치 기억을 이어받는다');
  chk(d.earL === 'e1' && d.earAdj === 0 && !('earR' in d), '사람 귀 — null 이 아닌 칸만(0 은 이어받음)'); }
{ const src = { animal: true, animalFace: 'af', animalBlink: 0, earL: 'x', thumb: 'T' };
  const d = rigS({ src }).api._creatorBuildDef(false);
  chk(d.animal === true && d.animalFace === 'af' && d.animalBlink === 0 && !('earL' in d), '🐾 동물 — 동물 칸을 이어받고 사람 귀 칸은 안 받는다');
  chk(d.thumb === 'T', '🐾 섬네일 캡처가 없으면 동물 창 섬네일을 유지'); }
{ const r = rigS({ deskScale: 1.3, deskPos: { x: 0, y: 0.1, z: 0 }, lenX: 1.5 }); const d = r.api._creatorBuildDef(false);
  chk(d.deskScale === 1.3 && JSON.stringify(d.deskPos) === '{"x":0,"y":0.1,"z":0}' && d.deskLenX === 1.5, '바꾼 책상 크기 · 위치(하나라도 0 이 아니면) · 길이는 저장'); }
{ const r = rigS({ glb: 'B64', activeDesk: 'd1', savedDesks: [{ id: 'd1', fromCatalog: true }] }); const d = r.api._creatorBuildDef(false);
  chk(d.deskCatalogId === 'd1' && !('deskGlb' in d), '카탈로그 책상 — GLB 대신 참조 id 만(나중에 바뀐 GLB 를 따라간다)');
  const d2 = rigS({ glb: 'B64', activeDesk: 'd2', savedDesks: [{ id: 'd2' }] }).api._creatorBuildDef(false);
  chk(d2.deskGlb === 'B64' && !('deskCatalogId' in d2), '로컬 책상(코드로 추가) — GLB 를 그대로'); }
{ const r = rigS({ items: { cup: 1, cat: 1, gone: 1 }, custom: { cup: { name: 'C', glb: 'g1' }, cat: { name: 'K', glb: 'g2' } }, savedItems: [{ id: 'cat', fromCatalog: true }] });
  const d = r.api._creatorBuildDef(false);
  chk(JSON.stringify(d.customItems) === '{"cup":{"name":"C","glb":"g1"}}', '커스텀 아이템 — 로컬 것만 GLB 를 박는다(카탈로그 · 세션에 없는 것은 뺀다)'); }
{ const r = rigS(); const d = r.api._creatorBuildDef(false); chk(!('deskLenX' in d), '길이 1 이면 deskLenX 칸 없음'); }
/* 용량 재기 */
{ const r = rigS({ items: { cup: 1 }, custom: { cup: { name: 'C', glb: 'g' } } });
  r.api._creatorSizeGrow((n) => { n.customItems.extra = { glb: 'x' }; n.big = 1; });
  const [a, b] = r.sizeCalls[0];
  chk(!a.big && !a.customItems.extra && b.big === 1 && b.customItems.extra, '키우기 재기 — 고친 쪽은 복사본(지금 모습 · 아이템 목록은 그대로)');
  chk(r.api._defSizeFile({}, 50).ok === true && r.api._defSizeFile({}, 500).ok === false, '파일 하나 재기 — DefSize.checkFile 결과를 그대로');
  chk(r.api.DEF_SIZE_TOAST_MS === 4000, '용량 안내 토스트 4초'); }
/* [완료] — 저장 칸 */
{ const r = rigS({ mode: { kind: 'slot', edit: false, slot: 2 } }); r.el('crDone').fire('click');
  chk(r.slots[2] && r.slots[2].skin === 2 && r.st.cur === 2 && r.n('save') === 1 && r.n('saveCur') === 1 && r.n('onNew') === 1, '[＋] 로 정한 칸에 새 캐릭터 · 현재 칸 · 저장 · 보관함 번호');
  chk(r.n('close') === 1 && r.last('toast') === '슬롯에 저장했어요', '닫고 «슬롯에 저장했어요»'); }
{ const r = rigS({ slots: ['a', null, null], cur: 0, mode: { kind: 'slot', edit: false } }); r.el('crDone').fire('click');
  chk(r.slots[1] && r.st.cur === 1, '칸이 안 정해졌으면(옛 길) 지금 칸이 차 있을 때 첫 빈 칸'); }
{ const r = rigS({ slots: ['a', 'b', 'c'], mode: { kind: 'slot', edit: false } }); r.el('crDone').fire('click');
  chk(r.last('toast') === '빈 슬롯이 없어요' && r.n('save') === 0, '빈 칸이 없으면 «빈 슬롯이 없어요» · 저장 안 함'); }
{ const r = rigS({ slots: [null, 'b', null], mode: { kind: 'slot', edit: false, slot: 1 } }); r.el('crDone').fire('click');
  chk(r.slots[1] === 'b' && /이미 캐릭터/.test(r.last('toast')), '새로 만들기인데 그 칸에 캐릭터가 있으면 덮어쓰지 않는다'); }
{ const r = rigS({ mode: { kind: 'slot', edit: false, slot: 0 }, boxFull: true }); r.el('crDone').fire('click');
  chk(r.slots[0] === null && r.n('save') === 0, '보관함 문턱이 차면 저장 안 함'); }
{ const r = rigS({ slots: ['old', null], mode: { kind: 'slot', edit: true, slot: 0 } }); r.el('crDone').fire('click');
  chk(r.slots[0] !== 'old' && r.n('onNew') === 0, '수정 — 그 칸을 갈고 보관함 새 번호는 안 준다'); }
{ const r = rigS({ mode: { kind: 'slot', edit: false, slot: 0 }, tooBig: true }); r.el('crDone').fire('click');
  chk(r.slots[0] === null && r.last('toast') === '너무 커요' && r.st.open === true, '용량을 넘겨 키웠으면 저장 안 함 · 생성기는 열린 채'); }
/* 좌석(실행 중 수정) */
{ const seat = { isMe: true }; const r = rigS({ slots: ['a', 'b'], cur: 1, mode: { kind: 'seat', seat, cameFromLauncher: false } }, ); r.st.mode = { kind: 'seat', seat };
  const r2 = rigS({ slots: ['a', 'b'], cur: 1, mode: { kind: 'seat', seat }, inRoom: true }); r2.el('crDone').fire('click');
  chk(r2.slots[1] && r2.slots[1] !== 'b' && seat.slot === 1 && r2.n('applySeat') === 1, '내 실행 좌석(slot 없음) — curSlot 으로 폴백해 슬롯에도 저장');
  chk(r2.n('presence') === 1 && r2.st.open === false && r2.last('toast') === '수정했어요', '방에 있으면 바뀐 모습을 보낸다 · «수정했어요»'); }
{ const seat = { isMe: false }; const r = rigS({ slots: ['a', 'b'], mode: { kind: 'seat', seat } }); r.el('crDone').fire('click');
  chk(r.slots.join() === 'a,b' && r.n('presence') === 0 && r.n('applySeat') === 1, '남의 좌석 — 화면만 바꾸고 내 슬롯은 안 건드린다'); }
{ const seat = { slot: 0, isMe: true }; const r = rigS({ slots: ['a'], mode: { kind: 'seat', seat, cameFromLauncher: true } }); r.el('crDone').fire('click');
  chk(r.el('launcher').classList.contains('on') && r.n('renderLauncher') === 1, '런처에서 들어온 수정 — 런처로 돌아간다'); }
/* 빈 얼굴 저장 확인 */
{ const r = rigS({ blank: true, src: { face: 'drawn' }, mode: { kind: 'slot', edit: true, slot: 0 }, confirm: false }); r.el('crDone').fire('click');
  chk(r.n('save') === 0 && r.n('focus') === 1 && r.st.cfm === false, '그림 있던 캐릭터를 빈 얼굴로 — [취소]면 저장 안 함(포커스 되돌림)'); }
{ const r = rigS({ blank: true, src: { face: 'drawn' }, mode: { kind: 'slot', edit: true, slot: 0 }, confirm: true }); r.el('crDone').fire('click');
  chk(r.n('save') === 1 && r.st.cfm === true, '[확인]이면 저장 — 공백 방어 1회 통과 표시'); }
{ const r = rigS({ blank: true, src: { face: 'BLANK' }, mode: { kind: 'slot', edit: true, slot: 0 }, confirm: false }); r.el('crDone').fire('click');
  chk(r.n('save') === 1 && r.n('focus') === 0, '원래도 빈 얼굴이면 묻지 않는다'); }
{ const r = rigS({ mode: { kind: 'slot', edit: false, slot: 3 } }); r.el('crDone').fire('click');
  chk(r.slots.length === 3 && !r.slots.some(Boolean) && r.last('toast') === '빈 슬롯이 없어요', '경계 — 칸 번호가 상한(CHAR_SLOT_MAX) 이상이면 저장 안 함'); }

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

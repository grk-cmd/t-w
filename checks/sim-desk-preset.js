/* sim-desk-preset.js — 🗂 책상 · 좌석 세팅 프리셋(creator/desk-preset-store.js · creator/desk-preset.js) 동작 · 연결
   실행:  node sim-desk-preset.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 프리셋은 «미리보기 크기가 안 맞음» · «라이선스 전용 책상 · 아이템이 되살아남» 제보를 고친 곳이다.
     app.js 에서 모듈 둘로 옮겼으니(C 구역 떼기 w4) 저장 · 담기 · 적용 · 칸 화면을 가짜 DOM · 가짜 모듈 위에서 돌려 고정한다.
   ・1절: 저장 — 늘 5칸 · 빈 칸 null · 깨진 값 · 배열 아님 · 앞 5칸만 쓰기 · 저장 실패 조용히
   ・2절: 담기 — 책상 · 위치 · 모델(활성 책상일 때만 GLB) · 아이템 · 로컬 아이템 · 좌석(높이는 clampCharY · 옛 앞뒤 없음)
   ・3절: 적용 — 캐릭터 없음 · 좌석 · 로컬 아이템(라이선스는 원본에서) · 책상 색 · 크기(clamp) · 길이 · 위치 · 카메라 기억 지우기
   ・4절: 책상 모델 — 프리셋 책상 · 못 읽음 · 라이선스 잠김 · 기본 책상(관리자 등록 · URL 받기 · 실패) · 내장 책상
   ・4-2절: 카탈로그 책상은 GLB 를 빼고 저장(10-16 제보 8 — 1MB 책상이면 4번째 칸부터 저장소가 넘쳤다) · 불러올 때 카탈로그에서 받기 · 못 찾으면 E-CHAR-08 · 옛 칸도 저장 때 가볍게
   ・5절: 칸 화면 · 팝업 · 입구 전제 · 6절: app.js 연결 · 7절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const STORE = read('creator/desk-preset-store.js'), MOD = read('creator/desk-preset.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!STORE || !MOD || !APP || !HTML) { say('  ? 원본 못 찾음 — desk-preset-store.js · desk-preset.js · app.js · desk-companion-prototype.html'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };

function lsOf(init, o = {}) { const m = Object.assign({}, init); return { m, getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { if (o.throwSet) throw new Error('full'); m[k] = v; } }; }
/* 읽기 · 쓰기는 shared/json-store.js 가 한다(판정 무변경) — 같은 가짜 저장소 위에 진짜 json-store 를 만들어 넘긴다 */
const JSON_STORE = read('json-store.js') || read('parts/shared/json-store.js') || read('app/parts/shared/json-store.js') || read('../app/parts/shared/json-store.js');
const jsonStoreOf = (ls) => { const m = { exports: {} }; new Function('window', 'module', JSON_STORE)(undefined, m); return m.exports.createJsonStore({ storage: () => ls }); };
/* 카탈로그 책상(다시 받을 수 있음) — 이름이 CAT 로 시작하는 id 로 흉내 */
const isCatDesk = (id) => /^CAT/.test(String(id));
const makeStore = (src, ls) => new Function('localStorage', 'window', 'module', src + '\nreturn window.TwDeskPresetStore;')(ls, {}, undefined).createDeskPresetStore({ jsonStore: jsonStoreOf(ls), notifyError: () => true, isCatalogDesk: isCatDesk });

/* 가짜 DOM */
function el(tag, id) {
  const L = {};
  const e = { tag, id, style: {}, dataset: {}, value: '', textContent: '', innerHTML: '', title: '', type: '', className: '', children: [], parent: null, onclick: null, oncontextmenu: null,
    appendChild(c) { c.parent = this; this.children.push(c); }, remove() { if (this.parent) this.parent.children = this.parent.children.filter((x) => x !== this); this.parent = null; },
    contains(x) { for (let q = x; q; q = q.parent) if (q === this) return true; return false; }, closest(sel) { for (let q = this; q; q = q.parent) if (sel === '.cr-preset-ctx' && q.className === 'cr-preset-ctx') return q; return null; },
    getBoundingClientRect: () => ({ left: 0, top: 0 }), addEventListener(t, f) { (L[t] = L[t] || []).push(f); }, dispatchEvent(ev) { (L[ev.type] || []).forEach((f) => f(ev)); e.dispatched = (e.dispatched || []).concat(ev.type); }, fire(t, ev) { (L[t] || []).forEach((f) => f(ev)); } };
  Object.defineProperty(e, 'innerHTML', { get() { return ''; }, set() { e.children = []; } });
  return e;
}

function world(src, o = {}) {
  const log = { toasts: [], calls: [], parsed: [], resolved: 0 };
  const call = (k) => (...a) => { log.calls.push([k, ...a]); };
  const ls = lsOf(o.ls || {});
  const store = makeStore(CUR_STORE, ls);   // behave 가 받은 저장 모듈 글(깨 보기가 바꾼 글도 여기로)
  const E = {};
  ['crScale', 'crZ', 'crRot', 'deskColor', 'deskScale', 'deskLenX', 'crPresetSlots', 'crPresetBtn', 'crPresetPopup'].forEach((i) => { E[i] = el('div', i); });
  E.crPresetPopup.style.display = 'none';
  (o.drop || []).forEach((k) => { delete E[k]; });
  const body = el('body', 'body'); const docL = {};
  const doc = { readyState: 'complete', body, getElementById: (i) => E[i] || null, createElement: (t) => el(t),
    addEventListener: (t, f) => { (docL[t] = docL[t] || []).push(f); }, removeEventListener: (t, f) => { docL[t] = (docL[t] || []).filter((x) => x !== f); } };
  const mat = { color: { set: (c) => { mat.c = c; } } };
  const st = { cBase: o.noBase ? null : { deskItems: { a: 1, b: 1 } }, cDeskColor: '#111111', cDeskScale: 0.2, cDeskLenX: 1.1, cDeskPos: { x: 1, y: 2, z: 3 }, activeCustomDeskId: o.activeDesk || null, cDeskGlbB64: 'DESKGLB',
    cXform: { s: 0.7, y: o.seatY === undefined ? 0.1 : o.seatY, z: 9, rot: 0.3 }, cDesk: { desk: 1 }, cDeskMat: mat, deskCamSaved: { saved: 1 }, crStep: o.step || 5, cDeskTemplate: 'old' };
  const customItems = Object.assign({}, o.customItems || {});
  const savedDesks = o.savedDesks || [], savedItems = o.savedItems || [];
  const timers = [];
  const T = new Function('window', 'document', 'localStorage', 'setTimeout', 'Event', 'module', src + '\nreturn window.TwDeskPreset;')({}, doc, ls, (f) => timers.push(f), class { constructor(t) { this.type = t; } }, undefined);
  const out = T.createDeskPreset({
    DEFAULT_DESK_OVERRIDE_ID: '__default_desk__', crState: st, deskPresetStoreMod: store,
    premiumMod: { _licenseLockedDeskId: (id) => !!(o.locked && id) },
    applyCreatorXform: call('xform'), applyDeskColorToCustom: call('color'), applyDeskItemsTo: call('items'), autoSaveDeskItemsNow: call('autosave'),
    assetCodeMod: () => ({ parseGlbBytes: (b) => { log.parsed.push(b); return o.parseFail || (o.overrideFail && b === 'B:OVGLB') ? Promise.reject(new Error('x')) : Promise.resolve({ scene: b }); } }),
    b64ToBuf: (s) => 'B:' + s,
    catalogGlbMod: () => ({ resolveCatalogGlb: async (rec) => { log.resolved++; rec.glb = 'OVGLB'; } }),
    clampCharY: (v) => Math.min(v, 0.6), clampDeskScale: (v) => Math.max(0.05, Math.min(0.3, v)), collectDeskItems: () => ({ it: { adj: 1 } }),
    commissionMod: () => ({ savedItems: () => savedItems, savedDesks: () => savedDesks }),
    crXformMod: () => ({ updateDeskPosNum: call('posnum') }), customItems: () => customItems,
    deskItemsMod: () => ({ allDeskItems: () => [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }),
    equipDeskItem: call('equip'), fitCreator: call('fit'), frameDeskCam: call('frame'),
    isAdmin: () => !!o.admin, isPremium: () => !!o.premium,
    setCreatorDeskScale: call('scale'), setDeskPos: call('pos'), swapDeskVisual: call('swap'), toast: (m) => log.toasts.push(m), notifyError: (code) => log.toasts.push(code),
  });
  const calls = (k) => log.calls.filter((c) => c[0] === k);
  return { out, log, st, E, ls, store, customItems, body, docL, timers, calls, mat };
}
const lastT = (w) => w.log.toasts[w.log.toasts.length - 1];

let CUR_STORE = STORE;
async function behave(src, storeSrc) {
  CUR_STORE = storeSrc;
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  /* 저장 */
  const N5 = JSON.stringify([null, null, null, null, null]);
  let S = makeStore(storeSrc, lsOf({}));
  t(JSON.stringify(S.loadDeskPresets()) === N5 && Object.keys(S).sort().join() === 'PRESET_SLOTS,diagSave,loadDeskPresets,saveDeskPresets,saveFailText,slimPresets' && S.PRESET_SLOTS === 5, '저장 — 비어 있으면 빈 5칸 · 칸 수(PRESET_SLOTS 5)와 읽기 · 쓰기');
  S = makeStore(storeSrc, lsOf({ 'tw.deskPresets': '{깨짐' })); const s2 = makeStore(storeSrc, lsOf({ 'tw.deskPresets': '{"a":1}' }));
  t(JSON.stringify(S.loadDeskPresets()) === N5 && JSON.stringify(s2.loadDeskPresets()) === N5, '저장 — 깨진 값 · 배열이 아니면 빈 5칸');
  S = makeStore(storeSrc, lsOf({ 'tw.deskPresets': JSON.stringify([1, 2]) })); const s3 = makeStore(storeSrc, lsOf({ 'tw.deskPresets': JSON.stringify([1, 2, 3, 4, 5, 6, 7]) }));
  t(JSON.stringify(S.loadDeskPresets()) === '[1,2,null,null,null]' && JSON.stringify(s3.loadDeskPresets()) === '[1,2,3,4,5]', '저장 — 모자라면 null 로 채우고 넘치면 앞 5칸');
  const L = lsOf({}); S = makeStore(storeSrc, L); S.saveDeskPresets([1, 2, 3, 4, 5, 6]);
  let threw = false; try { makeStore(storeSrc, lsOf({}, { throwSet: true })).saveDeskPresets([1]); } catch (_) { threw = true; }
  t(L.m['tw.deskPresets'] === '[1,2,3,4,5]' && !threw, '저장 — 앞 5칸만 쓰고(tw.deskPresets), 저장 실패는 조용히');

  /* 담기 — 우클릭 저장으로 */
  let w = null, err = null;
  try { w = world(src, { seatY: 0.9, activeDesk: 'D1', customItems: { x: { name: '컵', glb: 'G', extra: 1 } } }); } catch (e) { err = e; }
  t(!err && w && Object.keys(w.out).length === 0, '만들 때 던지지 않는다 · 내놓는 이름 없음(만들 때 건다)' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  if (!w) return r;
  const btn = (x, i) => x.E.crPresetSlots.children[i];
  const ctxSave = (x, i) => { btn(x, i).oncontextmenu({ preventDefault() {}, clientX: 5, clientY: 6 }); const menu = x.body.children[x.body.children.length - 1]; return menu; };
  let menu = ctxSave(w, 1); menu.children[0].onclick();
  const p = JSON.parse(w.ls.m['tw.deskPresets'])[1];
  t(p && p.deskColor === '#111111' && p.deskScale === 0.2 && p.deskLenX === 1.1 && JSON.stringify(p.deskPos) === '{"x":1,"y":2,"z":3}' && p.deskCatalogId === 'D1' && p.deskGlb === 'DESKGLB' && JSON.stringify(p.deskItems) === '{"it":{"adj":1}}' && typeof p.ts === 'number',
    '담기 — 책상 색 · 크기 · 길이 · 위치(복사) · 활성 책상 id 와 GLB · 아이템');
  t(JSON.stringify(p.customItems) === '{"x":{"name":"컵","glb":"G"}}' && JSON.stringify(p.seat) === '{"s":0.7,"y":0.6,"rot":0.3}' && lastT(w) === '프리셋 2번에 저장했어요', '담기 — 로컬 아이템은 이름 · GLB 만 · 좌석은 크기 · 높이(clampCharY — 0.9 → 0.6) · 회전(옛 앞뒤 z 없음) · 알림');
  w = world(src); ctxSave(w, 0).children[0].onclick();
  const p2 = JSON.parse(w.ls.m['tw.deskPresets'])[0];
  t(p2.deskCatalogId === null && p2.deskGlb === null && p2.customItems === null, '담기 — 기본 책상이면 id · GLB 없음 · 로컬 아이템이 없으면 null');
  w = world(src, { noBase: true }); ctxSave(w, 0).children[0].onclick();
  t(!w.ls.m['tw.deskPresets'] && lastT(w) === '먼저 캐릭터를 선택해 주세요', '저장 — 캐릭터가 없으면 안 담는다');

  /* 적용 */
  const P = (extra) => Object.assign({ seat: { s: 0.9, y: 0.8, z: 0.4, rot: 1.2 }, deskColor: '#222222', deskScale: 0.5, deskLenX: 1.4, deskPos: { x: '1', y: null, z: 'q' }, deskItems: { k: 1 } }, extra || {});
  const apply = async (o, preset, idx = 0) => { const x = world(src, Object.assign({ ls: { 'tw.deskPresets': JSON.stringify([preset]) } }, o)); btn(x, idx).onclick(); await flush(); return x; };
  w = await apply({ noBase: true }, P());
  t(lastT(w) === '먼저 캐릭터를 선택해 주세요' && !w.calls('xform').length, '캐릭터가 없으면 적용하지 않는다');
  w = await apply({}, P());
  t(w.st.cXform.s === 0.9 && w.st.cXform.y === 0.6 && w.st.cXform.rot === 1.2 && w.E.crScale.value === 0.9 && w.E.crZ.value === 0.6 && w.E.crRot.value === 1.2 && w.calls('xform').length === 1 && w.st.deskCamSaved === null,
    '좌석 — 크기 · 높이(clampCharY) · 회전을 상태와 슬라이더에 · 옛 앞뒤 z 는 무시 · 카메라 기억 지우기');
  t(w.st.cDeskColor === '#222222' && w.E.deskColor.value === '#222222' && (w.E.deskColor.dispatched || []).includes('input') && w.mat.c === '#222222' && w.calls('color')[0][2] === '#222222', '책상 색 — 상태 · 색 칸(input 이벤트) · 재질 · 커스텀 책상');
  t(w.st.cDeskScale === 0.3 && w.E.deskScale.value === 0.3 && w.st.cDeskLenX === 1.4 && w.calls('scale').length >= 2 && JSON.stringify(w.st.cDeskPos) === '{"x":1,"y":0,"z":0}' && w.calls('pos').length === 1 && w.calls('posnum').length === 1,
    '책상 크기(0.05~0.3 로 자름) · 길이 · 위치(숫자로 · 아니면 0) · 위치 숫자 칸');
  w = await apply({ customItems: { have: { name: '원래' } }, savedItems: [{ id: 'lic', licenseOnly: true }] }, P({ customItems: { lic: { name: 'L', glb: 'g' }, free: { name: 'F', glb: 'h' }, have: { name: '새' } } }));
  t(w.customItems.lic.licenseOnly === true && w.customItems.lic.name === 'L' && w.customItems.free.licenseOnly === false && w.customItems.free.deskItem === true && w.customItems.have.name === '원래',
    '로컬 아이템 — 없던 것만 넣고 라이선스 전용 여부는 원본 카탈로그에서(프리셋 값 아님)');

  /* 책상 모델 */
  w = await apply({}, P({ deskCatalogId: 'D9', deskGlb: 'PGLB' }));
  let sw = w.calls('swap')[0];
  t(w.log.parsed[0] === 'B:PGLB' && w.st.cDeskTemplate && w.st.cDeskTemplate.scene === 'B:PGLB' && w.st.cDeskGlbB64 === 'PGLB' && w.st.activeCustomDeskId === 'D9' && sw[3] === false,
    '프리셋 책상 — GLB 를 읽어 이 세션의 책상으로 · 기본 책상 덮어쓰기 아님');
  t(w.calls('equip').length === 2 && w.calls('equip').every((c) => c[3] === false) && w.calls('items')[0][2].k === 1 && w.calls('autosave').length === 1 && w.calls('fit')[0][1] === 'app' && w.calls('frame').length === 1 && lastT(w) === '프리셋을 불러왔어요',
    '모델 뒤 — 있던 아이템 빼고 프리셋 아이템 놓고 저장 · 카메라 다시(5단계면 책상까지) · 알림');
  w = await apply({ step: 3 }, P({ deskCatalogId: 'D9', deskGlb: 'PGLB' }));
  t(w.calls('fit')[0][1] === 'edit' && !w.calls('frame').length, '4단계 이하면 편집 카메라 · 책상 프레이밍 안 함');
  w = await apply({ parseFail: true }, P({ deskCatalogId: 'D9', deskGlb: 'PGLB' }));
  t(w.log.toasts.includes('E-CHAR-03') && w.calls('autosave').length === 1 && w.calls('fit').length === 1, '책상 모델을 못 읽으면 번호(E-CHAR-03)로 알리고 아이템 · 카메라는 그대로 진행');
  w = await apply({ locked: true }, P({ deskCatalogId: 'L1', deskGlb: 'PGLB' }));
  const w2 = await apply({ locked: true, premium: true }, P({ deskCatalogId: 'L1', deskGlb: 'PGLB' }));
  t(!w.log.parsed.length && w.st.activeCustomDeskId === null && w.st.cDeskTemplate === null && w2.st.activeCustomDeskId === 'L1', '라이선스 전용 책상 — 라이선스 · 관리자가 아니면 안 쓰고 기본 책상으로(있으면 씀)');
  w = await apply({ savedDesks: [{ id: '__default_desk__', glbUrl: 'u' }] }, P());
  sw = w.calls('swap')[0];
  t(w.log.resolved === 1 && w.log.parsed[0] === 'B:OVGLB' && sw && sw[3] === true && w.calls('autosave').length === 1, '기본 책상 — 관리자가 등록한 기본 책상(URL 이면 받아서)으로 · 덮어쓰기 표시');
  w = await apply({ savedDesks: [{ id: '__default_desk__', glb: 'OVGLB' }], overrideFail: true }, P());
  t(!w.log.resolved && w.calls('swap')[0][2] === null && w.calls('autosave').length === 1, '기본 책상을 못 읽으면 내장 책상(null)으로');
  w = await apply({}, P());
  t(w.calls('swap')[0][2] === null && w.st.cDeskGlbB64 === null && w.calls('autosave').length === 1, '등록한 기본 책상이 없으면 내장 책상');

  /* 카탈로그 책상 — 저장은 id 만 · 불러올 때 카탈로그에서 */
  w = world(src, { activeDesk: 'CAT1' }); ctxSave(w, 0).children[0].onclick();
  const pc = JSON.parse(w.ls.m['tw.deskPresets'])[0];
  t(pc.deskCatalogId === 'CAT1' && !('deskGlb' in pc) && lastT(w) === '프리셋 1번에 저장했어요', '★ 카탈로그 책상은 GLB 바이트를 빼고 id 만 저장한다(저장소가 넘치지 않게)');
  w = world(src, { activeDesk: 'MY1' }); ctxSave(w, 0).children[0].onclick();
  t(JSON.parse(w.ls.m['tw.deskPresets'])[0].deskGlb === 'DESKGLB', '  카탈로그에 없는 책상(직접 넣은 GLB)은 예전처럼 바이트를 담는다 — 다시 받을 곳이 없다');
  {
    const big = 'A'.repeat(1400000);
    const old = [{ deskCatalogId: 'CAT2', deskGlb: big, ts: 1 }, { deskCatalogId: 'MY2', deskGlb: 'KEEP', ts: 2 }, null, null, null];
    w = world(src, { activeDesk: 'CAT1', ls: { 'tw.deskPresets': JSON.stringify(old) } }); ctxSave(w, 2).children[0].onclick();
    const after = JSON.parse(w.ls.m['tw.deskPresets']);
    t(!('deskGlb' in after[0]) && after[0].deskCatalogId === 'CAT2' && after[1].deskGlb === 'KEEP' && w.ls.m['tw.deskPresets'].length < 2000,
      '★ 옛 칸도 저장할 때 같은 규칙으로 가벼워진다(1.4MB → ' + w.ls.m['tw.deskPresets'].length + '자) · 직접 넣은 책상은 그대로');
    const S2 = makeStore(storeSrc, lsOf({}));
    const slim = S2.slimPresets([null, { deskCatalogId: 'CAT3', deskGlb: 'X', a: 1 }, { deskCatalogId: null, deskGlb: 'Y' }, { deskCatalogId: 'CAT4' }]);
    t(slim[0] === null && !('deskGlb' in slim[1]) && slim[1].a === 1 && slim[2].deskGlb === 'Y' && slim[3].deskCatalogId === 'CAT4' && old[0].deskGlb === big, '  slimPresets — 빈 칸 · id 없는 칸 · 바이트 없는 칸은 그대로 · 원본은 안 건드린다');
  }
  w = await apply({ savedDesks: [{ id: 'CAT5', fromCatalog: true, glbUrl: 'u5' }] }, P({ deskCatalogId: 'CAT5' }));
  t(w.log.resolved === 1 && w.log.parsed[0] === 'B:OVGLB' && w.st.activeCustomDeskId === 'CAT5' && w.st.cDeskGlbB64 === 'OVGLB' && w.calls('swap')[0][3] === false && w.calls('autosave').length === 1,
    '★ id 만 담긴 프리셋 — 카탈로그 기록에서 GLB 를 받아(URL) 그 책상으로 연다');
  w = await apply({ savedDesks: [{ id: 'CAT6', glb: 'HAS' }] }, P({ deskCatalogId: 'CAT6' }));
  t(!w.log.resolved && w.log.parsed[0] === 'B:HAS' && w.st.activeCustomDeskId === 'CAT6', '  카탈로그 기록에 바이트가 이미 있으면 받지 않고 그것으로');
  w = await apply({}, P({ deskCatalogId: 'CAT7' }));
  t(w.log.toasts.includes('E-CHAR-08') && w.st.activeCustomDeskId === null && w.calls('swap')[0][2] === null && w.calls('autosave').length === 1, '★ 카탈로그에서 빠진 책상 — 번호(E-CHAR-08)로 알리고 기본 책상 · 아이템은 그대로 진행');
  w = await apply({ locked: true, savedDesks: [{ id: 'CAT8', fromCatalog: true, glbUrl: 'u8' }] }, P({ deskCatalogId: 'CAT8' }));
  t(!w.log.resolved && !w.log.parsed.length && w.st.activeCustomDeskId === null && !w.log.toasts.includes('E-CHAR-08'), '  라이선스 잠긴 책상은 받지도 않는다(예전처럼 기본 책상 · 알림 없음)');

  /* 칸 화면 · 팝업 */
  w = world(src, { ls: { 'tw.deskPresets': JSON.stringify([null, { ts: 1 }]) } });
  const bs = w.E.crPresetSlots.children;
  t(bs.length === 5 && bs[0].textContent === '1' && bs[1].textContent === '2 ✓' && /^빈 슬롯/.test(bs[0].title), '칸 화면 — 5칸 · 찬 칸은 ✓ · 빈 칸 안내');
  bs[0].onclick();
  t(/^빈 슬롯이에요/.test(lastT(w)), '빈 칸 클릭 — 안내만');
  menu = ctxSave(w, 1);
  t(menu.className === 'cr-preset-ctx' && menu.children.length === 2 && menu.children[0].textContent === '💾 이 슬롯에 덮어쓰기', '찬 칸 우클릭 — 덮어쓰기 · 비우기');
  menu.children[1].onclick();
  t(JSON.parse(w.ls.m['tw.deskPresets'])[1] === null && lastT(w) === '프리셋 2번을 비웠어요' && !w.body.children.includes(menu), '비우기 — 저장에서 지우고 메뉴 닫기');
  menu = ctxSave(w, 0);
  t(menu.children.length === 1 && menu.children[0].textContent === '💾 지금 세팅을 여기 저장', '빈 칸 우클릭 — 저장만');
  const pop = w.E.crPresetPopup;
  w.E.crPresetBtn.fire('click', { stopPropagation() {} });
  const opened = pop.style.display === 'block';
  (w.docL.mousedown || []).forEach((f) => f({ target: pop }));
  const stay = pop.style.display === 'block';
  (w.docL.mousedown || []).forEach((f) => f({ target: el('div') }));
  t(opened && stay && pop.style.display === 'none' && w.E.crPresetBtn.dataset.bound === '1', '팝업 버튼 — 열고 · 안을 누르면 그대로 · 밖을 누르면 닫는다(한 번만 건다)');
  threw = false;
  try { const x = world(src, { drop: ['crPresetSlots', 'crPresetBtn'] }); t(!x.calls('xform').length, '입구 전제 — 칸 상자 · 버튼이 없으면 만들 때 던지지 않고 그리지 · 걸지 않는다'); } catch (_) { threw = true; }
  if (threw) t(false, '입구 전제 — 칸 상자 · 버튼이 없을 때 던졌다');
  return r;
}

function wire(app, html) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const A = strip(app);
  t(!/function captureDeskPreset\b|function applyDeskPreset\b|function renderDeskPresetSlots\b|function loadDeskPresets\b|const PRESET_KEY\b/.test(A), 'app.js 에 옮긴 선언이 안 남았다');
  t(/const deskPresetStoreMod = TwDeskPresetStore\.createDeskPresetStore\(\{\n  jsonStore: TwJsonStore,\n  notifyError: \(\.\.\.a\)=>TwErrorCodes\.notify\(\.\.\.a\),\n  isCatalogDesk: \(id\)=>commissionMod\.catalogBacked\(commissionMod\.savedDesks\(\)\.find\(d=>d\.id===id\)\),\n\}\);/.test(app),
    '저장 만드는 줄(가드 없이) · deps 는 jsonStore · notifyError · isCatalogDesk(카탈로그 판단은 commission.js catalogBacked 한 곳)');
  const mk = (app.match(/const deskPresetMod = TwDeskPreset\.createDeskPreset\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  t(mk.split('\n').length === 28 && /  crState: crState,/.test(mk) && /  deskPresetStoreMod: deskPresetStoreMod,/.test(mk) && app.indexOf('const deskPresetStoreMod =') < app.indexOf('const deskPresetMod ='), '프리셋 만드는 줄(가드 없이) · deps 27 · 저장 모듈을 먼저 만든다');
  const iS = html.indexOf('<script src="parts/creator/desk-preset-store.js"></script>'), iM = html.indexOf('<script src="parts/creator/desk-preset.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iS > 0 && iM > 0 && iA > iS && iA > iM, 'html — 두 파일을 app.js 보다 먼저 싣는다');
  return r;
}

(async () => {
  const B = await behave(MOD, STORE);
  B.forEach(([ok, msg], i) => { const s = { 0: '── 1. 저장', 4: '── 2. 담기', 9: '── 3. 적용', 14: '── 4. 책상 모델', 22: '── 4-2. 카탈로그 책상 — id 만 저장 · 불러올 때 받기', 30: '── 5. 칸 화면 · 팝업 · 입구 전제' }; if (s[i]) say(s[i]); chk(ok, msg); });
  say('── 6. app.js 연결');
  wire(APP, HTML).forEach(([ok, msg]) => chk(ok, msg));
  chk(!SMOKE || (/PRELOAD\.push\('desk-preset-store\.js'\);/.test(SMOKE) && /PRELOAD\.push\('desk-preset\.js'\);/.test(SMOKE)), 'smoke 가 두 파일을 먼저 싣는다');
  say('── 7. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['저장 5칸 → 4칸', null, (s) => s.replace('const PRESET_SLOTS = 5;', 'const PRESET_SLOTS = 4;')],
    ['저장 키 바뀜', null, (s) => s.replace("const PRESET_KEY = 'tw.deskPresets';", "const PRESET_KEY = 'tw.deskPreset';")],
    ['담기에서 높이 자르기 없앰', (m) => m.replace('y:clampCharY(crState.cXform.y)', 'y:crState.cXform.y'), null],
    ['적용이 옛 앞뒤 z 를 높이로', (m) => m.replace("if(typeof p.seat.y==='number')", "if(typeof p.seat.z==='number') p.seat.y=p.seat.z; if(typeof p.seat.y==='number')"), null],
    ['라이선스를 프리셋 값으로', (m) => m.replace('licenseOnly:!!(_rec && _rec.licenseOnly)', 'licenseOnly:false'), null],
    ['책상 크기 clamp 없앰', (m) => m.replace('crState.cDeskScale=clampDeskScale(p.deskScale);', 'crState.cDeskScale=p.deskScale;'), null],
    ['카메라 기억 안 지움', (m) => m.replace('  crState.deskCamSaved = null;\n', ''), null],
    ['라이선스 잠금 없앰', (m) => m.replace('(!isPremium() && !isAdmin()) && premiumMod._licenseLockedDeskId(p.deskCatalogId)', 'false'), null],
    ['기본 책상 덮어쓰기 표시 안 함', (m) => m.replace('swapDeskVisual(crState.cDesk, sc, true);', 'swapDeskVisual(crState.cDesk, sc);'), null],
    ['저장이 카탈로그 책상 바이트를 그대로', null, (s) => s.replace('return jsonStore.save(PRESET_KEY, slimPresets(arr.slice(0,PRESET_SLOTS)));', 'return jsonStore.save(PRESET_KEY, arr.slice(0,PRESET_SLOTS));')],
    ['불러올 때 카탈로그에서 안 받음', (m) => m.replace('  if(p.deskGlb) return p.deskGlb;\n', '  return p.deskGlb || null;\n'), null],
    ['못 찾으면 조용히 기본 책상', (m) => m.replace("if(!b64){ notifyError('E-CHAR-08'); applyDefaultDesk(); return; }", 'if(!b64){ applyDefaultDesk(); return; }'), null],
    ['만들 때 던짐', (m) => m.replace('function createDeskPreset(deps){', 'function createDeskPreset(deps){ throw new Error("깨 봄");'), null],
    ['app.js 에 본문이 남음', 'APP', (a) => a + '\nfunction applyDeskPreset(p){}'],
    ['html 줄 빠짐', 'HTML', (h) => h.replace('<script src="parts/creator/desk-preset.js"></script>', '')],
  ];
  for (const [name, fm, f2] of breaks) {
    let m2 = MOD, s2 = STORE, a2 = APP, h2 = HTML;
    if (typeof fm === 'function') m2 = fm(MOD); else if (fm === 'APP') a2 = f2(APP); else if (fm === 'HTML') h2 = f2(HTML); else if (fm === null && f2) s2 = f2(STORE);
    const changed = m2 !== MOD || s2 !== STORE || a2 !== APP || h2 !== HTML;
    let rows; try { rows = ((m2 !== MOD || s2 !== STORE) ? await behave(m2, s2) : []).concat(wire(a2, h2)); } catch (_) { rows = [[false, '던짐']]; }
    chk(changed && rows.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 책상 프리셋은 creator/desk-preset-store.js · desk-preset.js 에서'));
  process.exit(fail ? 1 : 0);
})();

/* ═══ 🔄 sim-catalog-sync.js — 🔄 카탈로그 실시간 동기화 모듈 구조 (2026-10-16 신설 · 구역 떼기 C · w2) ═══════════════
   app.js 의 카탈로그 실시간 동기화 본문 을 parts/character/catalog-sync.js 로 옮겼다(글자 그대로 · 바뀐 줄 18 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(4절 — 가짜 firebaseAPI · 좌석으로 구독 · 합치기 · 좌석 다시 반영 · 가챠 옮기기).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(없음)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 39줄 그대로 · 부르는 곳은 catalogSyncMod.이름 · html(app.js 앞)
   ・4절: 동작 — 순수 판정 · 가짜 객체로 입력 → 출력 · 경계값(옮기기 전 app.js 글로도 같은 판정이 돈다)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · catalog-sync.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["catalog-sync.js","parts/character/catalog-sync.js","app/parts/character/catalog-sync.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — catalog-sync.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["applyClothVisibility","applyDeskCatalogRefToSeat","applyDeskColorToCustom","applyDeskItemsTo","b64ToBuf","clearHolderDeskItems","equipDeskItem","equipPartOnSeat","fitModel","layoutSeats","loadSavedItemsIntoSession","renderCrItems","renderLauncher","setCreatorDeskScale","swapDeskVisual","toast","unequipPartFromSeat"];
const VAL_DEPS = ["DEFAULT_DESK_OVERRIDE_ID","adminCategory","assetCodeMod","catalogGlbMod","commissionMod","premiumMod","rideBenchMod","seats","wardrobeMod"];
const GET_DEPS = ["activeCustomDeskId","catalogNet","cBase","cDesk","cDeskColor","cDeskGlbB64","cDeskScale","cDeskTemplate","creatorOpen","customItems","gachaMod","isAdmin"];
const SET_DEPS = ["cDeskGlbB64","cDeskTemplate"];
const EXPORTS = [];
const MOVED = ["mergeCatalogIntoSavedItems","subscribeCatalogItems","mergeCatalogIntoSavedDesks","subscribeCatalogDesks","mergeCatalogIntoSavedParts","subscribeCatalogParts","subscribeCustomCats","subscribeCatOverrides"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  DEFAULT_DESK_OVERRIDE_ID: DEFAULT_DESK_OVERRIDE_ID,","  activeCustomDeskId: ()=>activeCustomDeskId,","  adminCategory: adminCategory,","  applyClothVisibility: (...a)=>applyClothVisibility(...a),","  applyDeskCatalogRefToSeat: (...a)=>applyDeskCatalogRefToSeat(...a),","  applyDeskColorToCustom: (...a)=>applyDeskColorToCustom(...a),","  applyDeskItemsTo: (...a)=>applyDeskItemsTo(...a),","  assetCodeMod: assetCodeMod,","  b64ToBuf: (...a)=>b64ToBuf(...a),","  cBase: ()=>cBase,","  cDesk: ()=>cDesk,","  cDeskColor: ()=>cDeskColor,","  cDeskGlbB64: ()=>cDeskGlbB64,","  cDeskScale: ()=>cDeskScale,","  cDeskTemplate: ()=>cDeskTemplate,","  catalogGlbMod: catalogGlbMod,","  catalogNet: ()=>window.firebaseAPI,","  clearHolderDeskItems: (...a)=>clearHolderDeskItems(...a),","  commissionMod: commissionMod,","  creatorOpen: ()=>creatorOpen,","  customItems: ()=>customItems,","  equipDeskItem: (...a)=>equipDeskItem(...a),","  equipPartOnSeat: (...a)=>equipPartOnSeat(...a),","  fitModel: (...a)=>fitModel(...a),","  gachaMod: ()=>gachaMod,","  isAdmin: ()=>isAdmin,","  layoutSeats: (...a)=>layoutSeats(...a),","  loadSavedItemsIntoSession: (...a)=>loadSavedItemsIntoSession(...a),","  premiumMod: premiumMod,","  renderCrItems: (...a)=>renderCrItems(...a),","  renderLauncher: (...a)=>renderLauncher(...a),","  rideBenchMod: rideBenchMod,","  seats: seats,","  setCreatorDeskScale: (...a)=>setCreatorDeskScale(...a),","  swapDeskVisual: (...a)=>swapDeskVisual(...a),","  toast: (...a)=>toast(...a),","  unequipPartFromSeat: (...a)=>unequipPartFromSeat(...a),","  wardrobeMod: wardrobeMod,","  setCDeskGlbB64: (v)=>{ cDeskGlbB64 = v; },","  setCDeskTemplate: (v)=>{ cDeskTemplate = v; },"];

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
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module', 'MutationObserver', 'ResizeObserver',
    src + '\nreturn window.TwCatalogSync;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createCatalogSync(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(!/\bfirebaseAPI\b/.test(strip(mod)), '모듈은 firebaseAPI 를 직접 보지 않는다 — 데이터는 catalogNet() 으로만(서버 이관 provider)');
  t(/window\.TwCatalogSync = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwCatalogSync(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("CATALOG_SYNC_MOD_OFF") && app.includes("const catalogSyncMod = TwCatalogSync.createCatalogSync({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const catalogSyncMod = TwCatalogSync\\.createCatalogSync\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:]|\\(\\)\\{\\})').test(A.replace(/const catalogSyncMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 catalogSyncMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/character/catalog-sync.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/character/catalog-sync.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/catalog-sync.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const catalogSyncMod = TwCatalogSync.createCatalogSync({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const catalogSyncMod = TwCatalogSync.createCatalogSync({", "const catalogSyncMod = TwCatalogSync.createCatalogSync({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwCatalogSync = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],

  ['모듈이 firebaseAPI 를 직접 봄', m => m.replace('catalogNet().subscribeCatalogItems(', 'window.firebaseAPI.subscribeCatalogItems('), null, null],
  ['만들 때 던짐', m => m.replace('function createCatalogSync(deps){', 'function createCatalogSync(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}

/* ── 4. 동작 — 가짜 firebaseAPI · 좌석 · 저장 목록 위에서 구독 · 합치기 · 다시 반영(옮기기 전 app.js 글로도 같은 판정이 돈다) */
say('── 4. 동작 — 구독 · 합치기 · 좌석 · 생성기 다시 반영');
{
  const PREMOVE = !!process.env.TW_PREMOVE;
  const GETS = ['activeCustomDeskId', 'cBase', 'cDesk', 'cDeskColor', 'cDeskGlbB64', 'cDeskScale', 'cDeskTemplate', 'creatorOpen', 'customItems', 'gachaMod', 'isAdmin'];
  const flush = async () => { for(let i = 0; i < 8; i++) await new Promise(r => setImmediate(r)); };
  const load = (o) => {
    o = o || {};
    const log = [];
    const L = (...a) => log.push(a.map(x => typeof x === 'object' && x && x.__n ? x.__n : (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(':'));
    const st = { items: o.items || [], desks: o.desks || [], parts: o.parts || [] };
    const subs = {}, listeners = [];
    const fb = {
      subscribeCatalogItems: (cb) => { subs.items = cb; L('sub', 'items'); },
      subscribeCatalogDesks: (cb) => { subs.desks = cb; L('sub', 'desks'); },
      subscribeCatalogParts: (cb) => { subs.parts = cb; L('sub', 'parts'); },
      subscribeCustomCats: (cb) => { subs.cats = cb; L('sub', 'cats'); },
      subscribeCatOverrides: (cb) => { subs.over = cb; L('sub', 'over'); },
      migrateGachaCatalog: () => { L('migrate'); return o.migrateFails ? Promise.reject(new Error('x')) : Promise.resolve({ moved: ['g1', 'g2'] }); },
    };
    const win = { firebaseAPI: o.noApi ? undefined : fb, addEventListener: (ev, fn, opt) => listeners.push([ev, fn, opt]) };
    const els = { launcher: { classList: { contains: () => !!o.launcherOn } }, wdPreviewPanel: { classList: { contains: () => !!o.wdOn } } };
    const doc = { getElementById: (id) => els[id] || null };
    const cons = { warn: (...a) => L('warn', a[0]), log: () => {} };
    const raw = {
      DEFAULT_DESK_OVERRIDE_ID: '__default_desk__',
      seats: o.seats || [],
      customItems: o.customItems || {},
      commissionMod: { savedItems: () => st.items, setSavedItems: (v) => { st.items = v; L('setItems'); }, savedDesks: () => st.desks, setSavedDesks: (v) => { st.desks = v; L('setDesks'); }, persistSavedAssets: () => L('persistAssets') },
      premiumMod: { savedParts: () => st.parts, setSavedParts: (v) => { st.parts = v; L('setParts'); }, persistSavedParts: () => L('persistParts'),
        _normPartRec: (r) => Object.assign({ norm: true }, r), partEntryId: (e) => typeof e === 'string' ? e : (e && e.id),
        entriesForCat: (def, cat) => { const v = def.equippedParts[cat]; return Array.isArray(v) ? v : [v]; }, partEntryXf: (e) => e && e.xf,
        pruneUnownedLicenseAssets: () => { L('licPrune'); if(o.licThrows) throw new Error('lic'); },
        setCustomPartCats: (v) => L('setCats', v), rebuildPartCats: () => L('rebuildCats'), setPartCatOverrides: (v) => L('setOver', v) },
      catalogGlbMod: { resolveCatalogGlbAll: async (x) => { L('resolveAll'); return x; } },
      assetCodeMod: { parseGlbBytes: async (b) => ({ __n: 'tpl(' + b + ')' }) },
      b64ToBuf: (b) => 'buf:' + b,
      equipDeskItem: (s, def, on) => L('equipDeskItem', s, def.id, on),
      loadSavedItemsIntoSession: async () => { await new Promise(r => setImmediate(r)); L('loadSession'); },
      clearHolderDeskItems: (s) => L('clearHolder', s),
      applyDeskItemsTo: (s, di) => L('applyDeskItems', s),
      renderCrItems: () => L('renderCrItems'),
      swapDeskVisual: (d, sc, def) => L('swapDesk', d, sc === null ? 'null' : sc, !!def),
      applyDeskColorToCustom: (d, c) => L('deskColor', d, c),
      setCreatorDeskScale: (s) => L('crDeskScale', s),
      applyDeskCatalogRefToSeat: (s, d) => L('deskRef', s, d),
      unequipPartFromSeat: (s, c) => L('unequip', s, c),
      applyClothVisibility: (s) => L('cloth', s),
      equipPartOnSeat: (s, cat, rec, opt) => { L('equipPart', s, cat, rec.id, opt.stackableXf || '-'); return Promise.resolve(); },
      fitModel: (s) => L('fit', s),
      layoutSeats: () => L('layout'),
      renderLauncher: () => L('renderLauncher'),
      toast: (m) => L('toast', m),
      rideBenchMod: { _remeasureRideHeadTop: (s) => L('remeasure', s) },
      wardrobeMod: { renderWardrobe: () => L('renderWd'), refreshWdPreviewChar: () => L('refreshWd') },
      gachaMod: { pruneUnownedGachaParts: () => L('gachaPrune') },
      adminCategory: { renderCategoryManager: () => L('catMgr') },
      creatorOpen: !!o.creatorOpen, cBase: o.cBase, cDesk: o.cDesk, cDeskColor: o.cDeskColor, cDeskGlbB64: o.cDeskGlbB64, cDeskScale: o.cDeskScale,
      cDeskTemplate: null, activeCustomDeskId: o.activeCustomDeskId || null, isAdmin: !!o.isAdmin,
    };
    if(!PREMOVE){
      const deps = Object.assign({}, raw);
      GETS.forEach(n => { deps[n] = () => raw[n]; });
      deps.catalogNet = () => win.firebaseAPI;   // 데이터 provider — 늦게 생겨도 부를 때 찾는다
      deps.setCDeskGlbB64 = (v) => L('set cDeskGlbB64', v); deps.setCDeskTemplate = (v) => L('set cDeskTemplate', v);
      new Function('window', 'module', 'document', 'console', MOD)(win, undefined, doc, cons);
      win.TwCatalogSync.createCatalogSync(deps);
    } else {
      const a1 = SRC.indexOf('async function mergeCatalogIntoSavedItems'), b1 = SRC.indexOf('// 좌석의 charDef.deskCatalogId를 보고', a1);
      const a2 = SRC.indexOf('function mergeCatalogIntoSavedParts'), b2 = SRC.indexOf('/* ═══ 🪑 책상 · 아이템 등록', a2);
      const names = Object.keys(raw);
      new Function(...names, 'window', 'document', 'console', SRC.slice(a1, b1) + '\n' + SRC.slice(a2, b2))(...names.map(n => raw[n]), win, doc, cons);
    }
    return { log, st, subs, listeners, win, raw };
  };
  const has = (log, s) => log.includes(s);
  const idx = (log, s) => log.indexOf(s);
  (async () => {
    /* 구독 걸기 */
    let W = load();
    chk(W.log.filter(x => x.startsWith('sub')).join() === 'sub:items,sub:desks,sub:parts,sub:cats,sub:over' && !W.listeners.length, 'firebaseAPI 가 있으면 만들 때 아이템 · 책상 · 파츠 · 카테고리 · 이름 덮어쓰기 구독을 바로 건다');
    W = load({ noApi: true });
    chk(W.listeners.length === 4 && W.listeners.every(l => l[0] === 'firebase-ready' && l[2] && l[2].once === true) && !W.log.length, '  없으면 firebase-ready 를 한 번만(once) 기다린다 — 걸개 넷(카테고리 둘은 한 걸개)');
    W.win.firebaseAPI = { subscribeCatalogItems: () => W.log.push('late') };
    W.listeners.forEach(l => l[1]());
    chk(W.log.join() === 'late', '  firebase-ready 뒤에도 그 함수가 없는 구독은 조용히 건너뛴다');

    /* 아이템 */
    const seatA = { __n: 'A', deskItems: { gone: {} }, charDef: { deskItems: { i1: {} } } }, seatB = { __n: 'B', deskItems: {} };
    W = load({ seats: [seatA, seatB], customItems: { gone: { id: 'gone' }, i1: { id: 'i1' } }, items: [{ id: 'gone', fromCatalog: true }, { id: 'local' }, { id: 'i1', fromCatalog: true, old: 1 }] });
    await W.subs.items({ i3: { name: 'c' }, i2: { order: 2 }, i1: { order: 1 } }); await flush();
    chk(W.st.items.map(r => r.id).join() === 'i1,i2,i3,local' && W.st.items.slice(0, 3).every(r => r.fromCatalog) && !W.st.items[0].old, '아이템 — 카탈로그 order 순(없으면 뒤) · 카탈로그 판으로 덮고 · 로컬 전용은 뒤에 남긴다');
    chk(has(W.log, 'equipDeskItem:A:gone:false') && !('gone' in W.raw.customItems) && 'i1' in W.raw.customItems, '  관리자가 지운 아이템은 올려 둔 좌석에서 내리고 customItems 에서도 지운다');
    chk(idx(W.log, 'resolveAll') < idx(W.log, 'setItems') && idx(W.log, 'persistAssets') < idx(W.log, 'loadSession') && idx(W.log, 'loadSession') < idx(W.log, 'clearHolder:A'), '  GLB 해결 → 합치기 → 저장 → 세션 등록을 기다린 뒤 좌석 다시 적용(크기 0.8 고정 회귀 방지)');
    chk(has(W.log, 'applyDeskItems:A') && has(W.log, 'clearHolder:B') && !has(W.log, 'applyDeskItems:B') && has(W.log, 'licPrune') && !has(W.log, 'renderCrItems'), '  def 에 아이템이 있는 좌석만 다시 올리고 · 라이선스 접기 · 생성기가 닫혀 있으면 카드 안 그림');
    W = load({ creatorOpen: true, cBase: { __n: 'cBase', deskItems: { i1: {}, nope: {}, x: null } }, customItems: { i1: { id: 'i1' } }, licThrows: true });
    await W.subs.items({ i1: {} }); await flush();
    chk(has(W.log, 'equipDeskItem:cBase:i1:true') && W.log.filter(x => x.startsWith('equipDeskItem')).length === 1 && has(W.log, 'renderCrItems') && has(W.log, 'warn:[라이선스] 아이템 카탈로그 도착 후 정리 실패'), '  생성기가 열려 있으면 생성기 책상의 카탈로그 아이템만 새 GLB 로 다시 올리고 카드도 다시 그린다 · 라이선스 접기 실패는 경고만');

    /* 책상 */
    const sR = { __n: 'R', desk: { __n: 'dR' }, charDef: { deskCatalogId: 'gone', deskGlb: 'g' } };
    const sC = { __n: 'C', desk: { __n: 'dC' }, charDef: { deskCatalogId: 'd1' } };
    const sD = { __n: 'D', desk: { __n: 'dD' }, charDef: { deskScale: 0.2, deskColor: '#fff' } };
    const sG = { __n: 'G', charDef: { deskGlb: 'own' } };
    W = load({ seats: [sR, sC, sD, sG], desks: [{ id: 'gone', fromCatalog: true }, { id: 'mine' }] });
    await W.subs.desks({ d2: { order: 5 }, d1: { order: 0 } }); await flush();
    chk(W.st.desks.map(r => r.id).join() === 'd1,d2,mine', '책상 — 카탈로그 order 순 · 로컬 전용 남김');
    chk(sR.charDef.deskCatalogId === null && sR.charDef.deskGlb === null && has(W.log, 'swapDesk:dR:null:false'), '  지워진 책상을 쓰던 좌석은 기본 책상으로');
    chk(has(W.log, 'deskRef:C:' + JSON.stringify(sC.charDef)) && has(W.log, 'deskRef:D:{"deskCatalogId":"__default_desk__","deskScale":0.2,"deskColor":"#fff"}') && !W.log.some(x => x.startsWith('deskRef:G')), '  카탈로그 책상 좌석은 새 GLB 로 · 기본 책상 좌석은 __default_desk__ 덮어쓰기로 다시 그린다(자기 GLB 좌석은 그대로)');
    chk(idx(W.log, 'licPrune') > idx(W.log, 'setDesks') && !has(W.log, 'renderCrItems'), '  합친 뒤 라이선스 접기 · 생성기 닫혀 있으면 생성기 손 안 댐');
    W = load({ creatorOpen: true, cDesk: { __n: 'cDesk' }, cDeskGlbB64: 'old', activeCustomDeskId: 'd1', cDeskColor: '#c00', cDeskScale: 0.3 });
    await W.subs.desks({ d1: { glb: 'NEW' } }); await flush();
    chk(has(W.log, 'swapDesk:cDesk:tpl(buf:NEW):false') && has(W.log, 'deskColor:cDesk:#c00') && has(W.log, 'crDeskScale:0.3') && has(W.log, 'renderCrItems'), '  생성기에서 고른 카탈로그 책상이 바뀌면 미리보기를 새 GLB 로 다시 그린다(색 · 크기 다시)');
    if(!PREMOVE) chk(has(W.log, 'set cDeskTemplate:tpl(buf:NEW)') && has(W.log, 'set cDeskGlbB64:NEW'), '  생성기 상태(cDeskTemplate · cDeskGlbB64)는 쓰는 함수로 바꾼다');
    W = load({ creatorOpen: true, cDesk: { __n: 'cDesk' }, cDeskColor: '#0c0', cDeskScale: 0.1 });
    await W.subs.desks({ __default_desk__: { glb: 'OV' } }); await flush();
    chk(has(W.log, 'swapDesk:cDesk:tpl(buf:OV):true'), '  기본 책상을 보고 있으면 __default_desk__ 덮어쓰기로');
    W = load({ creatorOpen: true, cDesk: { __n: 'cDesk' }, cDeskColor: '#0c0', cDeskScale: 0.1 });
    await W.subs.desks({}); await flush();
    chk(has(W.log, 'swapDesk:cDesk:null:false') && has(W.log, 'crDeskScale:0.1'), '  덮어쓰기가 없으면 원래 기본 책상으로');

    /* 파츠 */
    const sP = { __n: 'P', gltfRoot: {}, charDef: { equippedParts: { hat: 'p1', bag: 'gone', deco: [{ id: 's1', xf: 'XF' }, { id: 's2' }] } }, equippedPartObjs: {}, stackedPartObjs: { deco: { s2: {} } } };
    const sQ = { __n: 'Q', charDef: {} };
    W = load({ seats: [sP, sQ], parts: [{ id: 'gone', fromCatalog: true }, { id: 'loc', cat: 'hat' }], launcherOn: true, wdOn: true });
    await W.subs.parts({ p1: { cat: 'hat', order: 2 }, s1: { cat: 'deco', stackable: true, order: 1 }, s2: { cat: 'deco', stackable: true } }); await flush();
    chk(W.st.parts.map(r => r.id).join() === 's1,p1,s2,loc' && W.st.parts[0].norm && W.st.parts[0].fromCatalog, '파츠 — _normPartRec 로 다듬어 order 순 · 로컬 전용 남김');
    chk(!('bag' in sP.charDef.equippedParts) && has(W.log, 'unequip:P:bag') && idx(W.log, 'persistParts') > idx(W.log, 'setParts'), '  지워진 파츠는 좌석에서 벗기고 저장');
    chk(has(W.log, 'equipPart:P:hat:p1:-') && has(W.log, 'equipPart:P:deco:s1:XF') && !W.log.some(x => x.startsWith('equipPart:P:deco:s2')), '  안 붙은 파츠만 다시 붙인다(겹쳐 다는 파츠는 자기 xf 로 · 이미 붙은 것은 건너뜀)');
    chk(has(W.log, 'fit:P') && has(W.log, 'layout') && has(W.log, 'remeasure:P') && !has(W.log, 'remeasure:Q') && !has(W.log, 'fit:Q'), '  새로 붙은 좌석만 바닥 다시 맞춤 · 올라타기 머리 높이는 파츠를 단 좌석마다 다시 잰다(파츠 없는 좌석은 건너뜀)');
    chk(has(W.log, 'renderLauncher') && has(W.log, 'refreshWd') && has(W.log, 'renderWd') && has(W.log, 'gachaPrune'), '  런처 · 꾸미기 미리보기가 열려 있으면 다시 그리고 · 꾸미기 창 · 가챠 회수');
    W = load({ seats: [{ __n: 'S', gltfRoot: {}, charDef: { equippedParts: { hat: 'p1' } }, equippedPartObjs: { hat: {} } }] });
    await W.subs.parts({ p1: { cat: 'hat' } }); await flush();
    chk(!W.log.some(x => x.startsWith('equipPart') || x.startsWith('fit')) && !has(W.log, 'renderLauncher') && !has(W.log, 'refreshWd'), '  다 붙어 있으면 다시 붙이지도 바닥을 다시 맞추지도 않는다 · 닫힌 화면은 안 그림');

    /* 가챠 카탈로그 옮기기(관리자) */
    W = load({ isAdmin: true });
    await W.subs.parts({ g1: { _legacyGacha: true } }); await W.subs.parts({ g1: { _legacyGacha: true } }); await flush();
    chk(W.log.filter(x => x === 'migrate').length === 1 && W.win.__gachaMigrated === true && has(W.log, 'toast:🎰 가챠 파츠 2개를 새 카탈로그 경로로 옮겼어요 (구버전 노출 차단)'), '관리자 세션 — 옛 가챠 표식이 보이면 한 번만 옮기고 알린다');
    W = load({ isAdmin: true, migrateFails: true });
    await W.subs.parts({ g1: { _legacyGacha: true } }); await flush();
    chk(W.win.__gachaMigrated === false, '  실패하면 표식을 풀어 다음 콜백에서 다시');
    W = load({ isAdmin: false });
    await W.subs.parts({ g1: { _legacyGacha: true } }); await flush();
    chk(!has(W.log, 'migrate'), '  관리자가 아니면 옮기지 않는다');

    /* 합치기 규칙(순수 함수) — 아이템 · 책상 · 파츠가 같이 쓴다 */
    if(!PREMOVE){
      /* 순수 함수라 모듈 글에서 그 함수만 뽑아 돌린다(괄호 짝으로 끝을 찾는다) */
      const i0 = MOD.indexOf('function mergeCatalogList('); let k0 = MOD.indexOf('{', i0), d0 = 0;
      for(; k0 < MOD.length; k0++){ if(MOD[k0] === '{') d0++; else if(MOD[k0] === '}' && --d0 === 0) break; }
      const MG = i0 < 0 ? null : new Function(MOD.slice(i0, k0 + 1) + '\nreturn mergeCatalogList;')();
      const e0 = MG(null, []), e1 = MG({}, []);
      chk(typeof MG === 'function' && e0.list.length === 0 && e0.removedIds.length === 0 && e1.list.length === 0, 'mergeCatalogList — 빈 · null 스냅샷 + 빈 목록이면 빈 결과');
      const saved = [{ id: 'gone', fromCatalog: true }, { id: 'mine' }, { id: 'a', fromCatalog: true, name: '옛', order: 9 }, { id: 'b', name: '로컬판' }];
      const snap = JSON.stringify(saved);
      const r = MG({ c: { order: 9999 }, a: { name: '새', order: 2 }, z: {}, b: { order: 0 } }, saved);
      chk(r.list.map(x => x.id).join() === 'b,a,c,z,mine' && r.removedIds.join() === 'gone', '  order 오름차순(0 이 맨 앞 · 없으면 9999 와 같은 자리 · 같으면 원래 차례) · 지워진 것은 removedIds · 로컬 전용은 뒤');
      chk(r.list[1].name === '새' && r.list[1].fromCatalog === true && r.list[0].fromCatalog === true && r.list[0].name === undefined && !r.list.some(x => x.name === '로컬판'), '  같은 id 는 서버판이 이긴다(로컬판 b 도 서버 것으로 바뀜 · 로컬 칸은 안 섞임)');
      chk(JSON.stringify(saved) === snap, '  저장 목록은 바꾸지 않는다(새 배열)');
      const r2 = MG({ g: { gacha: true } }, [], (x) => Object.assign(x, { stackable: !!x.gacha }));
      chk(r2.list[0].stackable === true && r2.list[0].id === 'g', '  norm 을 주면 카탈로그 항목마다 먼저 다듬는다(파츠 — _normPartRec)');
      const r3 = MG({}, [{ id: 'x', fromCatalog: true }, { id: 'y', fromCatalog: true }, { id: 'l' }]);
      chk(r3.removedIds.join() === 'x,y' && r3.list.map(x => x.id).join() === 'l', '  경계 — 카탈로그가 비면 온 적 있는 것은 전부 지운 것 · 로컬 전용만 남는다');
    }

    /* 카테고리 */
    W = load();
    W.subs.cats({ a: { cat: 'x', name: 'n' }, b: null, c: {} });
    W.subs.over(null);
    chk(has(W.log, 'setCats:[{"cat":"x","name":"n"}]') && has(W.log, 'setOver:{}') && W.log.filter(x => x === 'rebuildCats').length === 2 && W.log.filter(x => x === 'catMgr').length === 2, '카테고리 — cat 없는 항목은 거르고 · 덮어쓰기 없음은 {} · 둘 다 다시 짓고 관리 창도 다시 그린다');
    say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
    process.exit(fail ? 1 : 0);
  })().catch(e => { chk(false, '4절 던짐 — ' + (e && e.stack || e)); say(`\n✗ 통과 ${pass} · 실패 ${fail}`); process.exit(1); });
  return;
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

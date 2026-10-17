/* sim-asset-import.js — 📥 코드로 추가하기(creator/asset-import.js) 동작 · 연결
   실행:  node sim-asset-import.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 판매자 코드로 책상 · 아이템 · 파츠를 넣는 입구다. app.js 에서 모듈로 옮겼으니(C 구역 떼기 w4)
     창 열기 · 거르기(복호화 · 1MB · 개수 · 캐릭터 용량) · 종류별 등록을 가짜 DOM · 가짜 모듈 위에서 돌려 고정한다.
   ・1절: 창 열기 · 닫기 — 종류별 제목 · 입력 비우기 · 넣을 종류 기억
   ・2절: 거르기 — 복호화 없음 · 빈 입력 · 틀린 비밀번호 · 1MB 초과 · 개수 한도(파츠는 꾸미기 통만) · 캐릭터 용량(책상은 지금 책상을 빼고)
   ・3절: 등록 — 책상(바로 끼우기) · 아이템(등록 · 장착) · 파츠(이 기기 통 · 꾸미기 다시 그리기 구독)
   ・4절: 입구 전제 · 5절: app.js 연결 · 6절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('creator/asset-import.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!MOD || !APP || !HTML) { say('  ? 원본 못 찾음 — asset-import.js · app.js · desk-companion-prototype.html'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

function world(src, o = {}) {
  const log = { toasts: [], calls: [], built: null, sized: null, parts: 0 };
  const cl = () => ({ s: new Set(), add(c) { this.s.add(c); }, remove(c) { this.s.delete(c); }, contains(c) { return this.s.has(c); } });
  const E = {};
  ['assetImpOverlay', 'assetImpTitle', 'assetImpCode', 'assetImpPass', 'assetImpCancel', 'assetImpGo'].forEach((i) => { E[i] = { id: i, value: '', textContent: '', classList: cl(), onclick: null }; });
  (o.drop || []).forEach((k) => { delete E[k]; });
  const doc = { getElementById: (i) => E[i] || null };
  const win = { crypto: o.noCrypto ? undefined : { subtle: {} } };
  const desks = o.desks || [], items = o.items || [], parts = o.parts || [], allParts = [];
  const st = { _assetImpKind: 'item', _assetImpCat: null, cBase: o.noBase ? null : { deskAnchor: {} }, cDesk: { d: 1 }, cDeskScale: 0.2, cDeskColor: '#abc', cDeskTemplate: null, cDeskGlbB64: null, activeCustomDeskId: null };
  const customItems = {};
  const cache = new Map([['x', 1]]);
  const T = new Function('window', 'document', 'crypto', 'DefSize', 'module', src + '\nreturn window.TwAssetImport;')(win, doc, win.crypto, { jsonBytes: (v) => JSON.stringify(v).length }, undefined);
  const out = T.createAssetImport({
    twNav: { NAV: { ASSET_IMPORT: 'assetImport' }, on: (n, f) => { log.navOn = [n, f]; } },
    DEF_SIZE_TOAST_MS: () => 5000,
    _creatorBuildDef: (b) => { log.built = b; return { deskGlb: 'G', deskCatalogId: 'C', keep: 1 }; },
    _defSizeFile: (rest, add) => { log.sized = { rest, add }; return o.sizeFail ? { ok: false, message: '용량이 넘어요' } : { ok: true }; },
    applyDeskColorToCustom: (d, c) => log.calls.push(['color', d, c]),
    assetCodeMod: () => ({
      decryptAssetCode: async (code, pw) => { if (pw !== 'pw') throw new Error('bad'); return { buf: 'BUF' }; },
      unwrapAsset: () => ({ glbBuf: { byteLength: o.bytes || 100, slice() { return this; } }, name: '물건', icon: o.icon }),
      parseGlbFull: async () => ({ scene: { sc: 1 }, animations: ['A'] }),
    }),
    codeCryptoMod: () => ({ _b64: () => 'B64' }),
    commissionMod: () => ({ MAX_GLB_BYTES: 1000, MAX_CUSTOM_ASSETS: 2, MAX_CUSTOM_ITEMS: 2, savedDesks: () => desks, savedItems: () => items, persistSavedAssets: () => log.calls.push(['persist']) }),
    crState: st, creatorOpen: () => o.open !== false, customItems: () => customItems,
    deskItemsMod: () => ({ registerCustomItem: (id, name, glb, scene, icon, anim) => { customItems[id] = { id }; log.calls.push(['reg', id, name, glb, scene, icon, anim]); } }),
    equipDeskItem: (h, def, on) => log.calls.push(['equip', h, def, on]),
    partSceneMod: () => ({ partSceneCache: cache }),
    premiumMod: { partCatInfo: (c) => (c === 'hat' ? { label: '모자' } : null), partsInCatFor: (c, g) => { log.calls.push(['inCatFor', c, g]); return parts; }, MAX_PARTS_PER_CAT: 2,
      partsInCat: () => [1, 2, 3], savedParts: () => allParts, persistSavedParts: () => log.calls.push(['persistParts']) },
    renderCrItems: () => log.calls.push(['render']), setCreatorDeskScale: (v) => log.calls.push(['scale', v]), swapDeskVisual: (d, s) => log.calls.push(['swap', d, s]),
    toast: (...a) => log.toasts.push(a),
  });
  out.onPartAdded(() => { log.parts++; });
  const go = async (code, pw) => { E.assetImpCode.value = code; E.assetImpPass.value = pw; await E.assetImpGo.onclick(); };
  return { out, log, E, st, desks, items, allParts, customItems, cache, go };
}
const lastT = (w) => (w.log.toasts[w.log.toasts.length - 1] || [])[0];
const has = (w, k) => w.log.calls.find((c) => c[0] === k);

async function behave(src) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let w = null, err = null;
  try { w = world(src); } catch (e) { err = e; }
  t(!err && w && Object.keys(w.out).sort().join() === 'onPartAdded,openAssetImport', '만들 때 던지지 않고 openAssetImport · onPartAdded 를 내놓는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  if (!w) return r;
  t(w.log.navOn && w.log.navOn[0] === 'assetImport' && w.log.navOn[1] === w.out.openAssetImport, '만들 때 창 열기 통로에 openAssetImport 를 건다(NAV.ASSET_IMPORT)');
  w.E.assetImpCode.value = 'old'; w.E.assetImpPass.value = 'old';
  w.out.openAssetImport('desk');
  t(w.E.assetImpTitle.textContent === '책상 코드로 추가하기' && w.E.assetImpCode.value === '' && w.E.assetImpPass.value === '' && w.E.assetImpOverlay.classList.contains('on') && w.st._assetImpKind === 'desk' && w.st._assetImpCat === null,
    '책상으로 열기 — 제목 · 입력 비우기 · 창 열기 · 넣을 종류 기억');
  w.out.openAssetImport('part', 'hat'); const t1 = w.E.assetImpTitle.textContent;
  w.out.openAssetImport('part', 'zzz'); const t2 = w.E.assetImpTitle.textContent;
  w.out.openAssetImport('item'); const t3 = w.E.assetImpTitle.textContent;
  t(t1 === '모자 코드로 추가하기' && t2 === '파츠 코드로 추가하기' && t3 === '아이템 코드로 추가하기' && w.st._assetImpCat === null, '파츠는 칸 이름(없으면 «파츠») · 아이템 · 칸은 다시 열 때 비운다');
  w.E.assetImpCancel.onclick();
  t(!w.E.assetImpOverlay.classList.contains('on'), '[취소] — 창을 닫는다');

  const run = async (o, kind, cat, code = 'c', pw = 'pw') => { const x = world(src, o); x.out.openAssetImport(kind, cat); await x.go(code, pw); return x; };
  let x = await run({ noCrypto: true }, 'item');
  t(lastT(x) === '이 환경에선 복호화를 쓸 수 없어요', '복호화(crypto.subtle)가 없으면 알림');
  x = await run({}, 'item', null, '', 'pw');
  const x2 = await run({}, 'item', null, 'c', '');
  t(lastT(x) === '코드와 비밀번호를 입력해 주세요' && lastT(x2) === '코드와 비밀번호를 입력해 주세요', '코드나 비밀번호가 비면 알림');
  x = await run({}, 'item', null, 'c', 'no');
  t(lastT(x) === '추가 실패: 코드나 비밀번호를 확인해 주세요' && x.E.assetImpOverlay.classList.contains('on'), '틀린 비밀번호 — 알리고 창은 둔다');
  x = await run({ bytes: 1001 }, 'item');
  const x3 = await run({ bytes: 1000 }, 'item');
  t(lastT(x) === 'GLB가 1MB를 넘어요' && !x.items.length && x3.items.length === 1, 'GLB 가 한도(MAX_GLB_BYTES) 초과면 안 받는다 · 딱 한도는 받는다');
  x = await run({ items: [1, 2] }, 'item');
  const x4 = await run({ desks: [1, 2] }, 'desk'), x5 = await run({ parts: [1, 2] }, 'part', 'hat');
  t(/^최대 2개까지 추가할 수 있어요/.test(lastT(x)) && /^최대 2개/.test(lastT(x4)) && /^최대 2개/.test(lastT(x5)) && x.items.length === 2, '종류마다 개수 한도 — 꽉 차면 안 받는다(아이템 · 책상 · 파츠)');
  t(JSON.stringify(has(x5, 'inCatFor')) === JSON.stringify(['inCatFor', 'hat', false]), '파츠 개수는 그 칸의 꾸미기 통(가챠 빼고)만 센다');
  x = await run({ sizeFail: true }, 'desk');
  const sz = x.log.sized;
  t(x.log.toasts[0][0] === '용량이 넘어요' && x.log.toasts[0][1] === null && x.log.toasts[0][2] === 5000 && x.log.built === true && sz && !('deskGlb' in sz.rest) && !('deskCatalogId' in sz.rest) && sz.rest.keep === 1 && sz.add === JSON.stringify('B64').length + 12 && !x.desks.length,
    '책상 — 캐릭터 용량을 넘으면 안 받는다(지금 책상 자리를 비운 나머지와 견줌 · 알림은 오래)');
  x = await run({ sizeFail: true }, 'item');
  t(x.log.sized.add === JSON.stringify({ name: '물건', glb: 'B64' }).length + 20 && 'deskGlb' in x.log.sized.rest && !x.items.length, '아이템 — 이름 · GLB 를 더한 크기로 견준다');
  x = await run({ sizeFail: true }, 'part', 'hat');
  const x6 = await run({ sizeFail: true, open: false }, 'desk');
  t(!x.log.sized && x.allParts.length === 1 && !x6.log.sized && x6.desks.length === 1, '파츠 · 생성기가 닫혀 있을 때는 캐릭터 용량을 안 본다');

  x = await run({ icon: 'ic' }, 'desk');
  const d = x.desks[0];
  t(d && /^c[0-9a-z]+$/.test(d.id) && d.name === '물건' && d.icon === 'ic' && d.glb === 'B64' && has(x, 'persist') && x.st.cDeskTemplate && x.st.cDeskTemplate.sc === 1 && x.st.cDeskGlbB64 === 'B64' && x.st.activeCustomDeskId === d.id,
    '책상 — 저장 목록에 넣고 · 이 세션의 책상으로 · 활성 책상 id');
  t(JSON.stringify(has(x, 'swap')) === JSON.stringify(['swap', { d: 1 }, { sc: 1 }]) && has(x, 'scale')[1] === 0.2 && has(x, 'color')[2] === '#abc' && has(x, 'render') && lastT(x) === '책상을 추가했어요' && !x.E.assetImpOverlay.classList.contains('on'),
    '책상 — 바로 끼우고(크기는 지금 슬라이더 값 그대로) · 색 · 목록 다시 · 알림 · 창 닫기');
  x = await run({}, 'item');
  const it = x.items[0], reg = has(x, 'reg'), eq = has(x, 'equip');
  t(it && reg && reg[1] === it.id && reg[5] === '' && reg[6][0] === 'A' && eq && eq[2] === x.customItems[it.id] && eq[3] === true && has(x, 'render') && lastT(x) === '아이템을 추가했어요', '아이템 — 저장 · 등록(아이콘 없으면 빈 글) · 지금 캐릭터 책상에 장착 · 목록 다시 · 알림');
  x = await run({ noBase: true }, 'item');
  t(x.items.length === 1 && !has(x, 'equip'), '아이템 — 캐릭터(책상 자리)가 없으면 장착은 건너뛴다');
  x = await run({}, 'part', 'hat');
  const p = x.allParts[0];
  t(p && p.cat === 'hat' && p.order === 3 && has(x, 'persistParts') && !x.cache.has(p.id) && x.log.parts === 1 && lastT(x) === '파츠를 추가했어요(이 기기에만 저장됨)' && !has(x, 'render'), '파츠 — 그 칸 끝 순서로 이 기기 통에 · 캐시 비우기 · 꾸미기 다시 그리기(구독) · 알림');

  let threw = false;
  try {
    const a = world(src, { drop: ['assetImpOverlay'] }); a.out.openAssetImport('desk');
    const b = world(src, { drop: ['assetImpGo'] });
    t(a.E.assetImpTitle.textContent === '' && a.E.assetImpCancel.onclick === null && b.E.assetImpCancel.onclick === null, '입구 전제 — 창 · [추가] 버튼이 없으면 만들 때 던지지 않고 버튼을 걸지도 열지도 않는다');
  } catch (_) { threw = true; }
  if (threw) t(false, '입구 전제 — 창이 없을 때 던졌다');
  return r;
}

function wire(app, html) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const A = strip(app);
  t(!/function openAssetImport\b|const assetImpOverlay\b/.test(A), 'app.js 에 옮긴 선언이 안 남았다');
  const mk = (app.match(/const assetImportMod = TwAssetImport\.createAssetImport\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  t(mk.split('\n').map((l) => l.trim().split(':')[0]).join() === 'twNav,DEF_SIZE_TOAST_MS,_creatorBuildDef,_defSizeFile,applyDeskColorToCustom,assetCodeMod,codeCryptoMod,commissionMod,crState,creatorOpen,customItems,deskItemsMod,equipDeskItem,partSceneMod,premiumMod,renderCrItems,setCreatorDeskScale,swapDeskVisual,toast',
    '만드는 줄(가드 없이) · deps 19 — wardrobeMod 는 받지 않는다(순환)');
  t(/\}\);\nassetImportMod\.onPartAdded\(\(\)=>wardrobeMod\.renderWardrobe\(\)\);/.test(app), '만드는 줄 바로 뒤에서 꾸미기 다시 그리기를 구독으로 잇는다');
  t((A.match(/openAssetImport: \(\.\.\.a\)=>twNav\.go\(twNav\.NAV\.ASSET_IMPORT, \.\.\.a\),/g) || []).length === 2 && !/(^|[^.\w$])openAssetImport\(/.test(A), '꾸미기 · 생성기 배치는 창 열기 통로(twNav.NAV.ASSET_IMPORT)로 연다 — 꾸미기 ↔ 이 모듈 순환 없음');
  const iM = html.indexOf('<script src="parts/creator/asset-import.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — creator/asset-import.js 를 app.js 보다 먼저 싣는다');
  return r;
}

(async () => {
  const B = await behave(MOD);
  B.forEach(([ok, msg], i) => { const s = { 0: '── 1. 창 열기 · 닫기', 4: '── 2. 거르기', 13: '── 3. 등록', 18: '── 4. 입구 전제' }; if (s[i]) say(s[i]); chk(ok, msg); });
  say('── 5. app.js 연결');
  wire(APP, HTML).forEach(([ok, msg]) => chk(ok, msg));
  chk(!SMOKE || /PRELOAD\.push\('asset-import\.js'\);/.test(SMOKE), 'smoke 가 asset-import.js 를 먼저 싣는다');
  say('── 6. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['개수 한도 >= → >', (m) => m.replace('if(arr.length>=_maxAssets)', 'if(arr.length>_maxAssets)'), null, null],
    ['1MB 검사 없앰', (m) => m.replace("if(u.glbBuf.byteLength>commissionMod().MAX_GLB_BYTES){ toast('GLB가 1MB를 넘어요'); return; }", ''), null, null],
    ['파츠도 가챠까지 셈', (m) => m.replace('premiumMod.partsInCatFor(crState._assetImpCat, false)', 'premiumMod.partsInCatFor(crState._assetImpCat, true)'), null, null],
    ['책상 용량에 지금 책상을 같이 셈', (m) => m.replace("if(kind==='desk'){ delete _rest.deskGlb; delete _rest.deskCatalogId; }", ''), null, null],
    ['꾸미기 다시 그리기 안 부름', (m) => m.replace('      _partAddedFns.forEach((f)=>f());', ''), null, null],
    ['책상 크기를 처음값으로', (m) => m.replace('setCreatorDeskScale(crState.cDeskScale)', 'setCreatorDeskScale(0.175)'), null, null],
    ['입구 전제 없앰(열기)', (m) => m.replace('function openAssetImport(kind, cat){ if(!assetImpOverlay) return;', 'function openAssetImport(kind, cat){'), null, null],
    ['만들 때 던짐', (m) => m.replace('function createAssetImport(deps){', 'function createAssetImport(deps){ throw new Error("깨 봄");'), null, null],
    ['app.js 에 본문이 남음', null, (a) => a + '\nfunction openAssetImport(){}', null],
    ['구독 줄 빠짐', null, (a) => a.replace(/\nassetImportMod\.onPartAdded\(\(\)=>wardrobeMod\.renderWardrobe\(\)\);[^\n]*/, ''), null],
    ['deps 하나 빠짐', null, (a) => a.replace('createAssetImport({\n  twNav: twNav,\n', 'createAssetImport({\n'), null],
    ['html 줄 빠짐', null, null, (h) => h.replace('<script src="parts/creator/asset-import.js"></script>', '')],
  ];
  for (const [name, fm, fa, fh] of breaks) {
    const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(APP) : APP, h2 = fh ? fh(HTML) : HTML;
    const changed = m2 !== MOD || a2 !== APP || h2 !== HTML;
    let rows; try { rows = (fm ? await behave(m2) : []).concat(wire(a2, h2)); } catch (_) { rows = [[false, '던짐']]; }
    chk(changed && rows.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 코드로 추가하기는 creator/asset-import.js 에서'));
  process.exit(fail ? 1 : 0);
})();

/* sim-desk-setup.js — 🪑 생성기 책상 세팅(creator/desk-setup.js) 동작 · 연결
   실행:  node sim-desk-setup.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 책상 · 아이템 카드는 «라이선스 전용이 골라짐» · «기본 책상이 다른 모델» · «순서가 안 맞음» 제보를 고친 곳이다.
     app.js 에서 모듈로 옮겼으니(C 구역 떼기 w4) 가짜 DOM · 가짜 모듈 위에서 카드 그리기 · 고르기 · 지우기 · 순서 · 아이템 고르기를 돌려 고정한다.
   ・1절: 책상 카드 — 기본 책상 · 저장 책상(관리자 덮어쓰기 빼고 · 전용은 관리자만) · 고르기(URL 받기 · 용량 · 적용) · 기본으로 · 지우기(회수는 확인 뒤 catalogNet)
   ・2절: 아이템 카드 — 5개씩 쪽 넘김 · 쪽 번호 · 기본 아이템 켜고 끄기(관리자 교체분) · 커스텀(아직 안 읽힘 · 용량 · 카탈로그는 안 잼) · 한도 표시 · 안내
   ・3절: 고르기 · 순서 · 갈고리 — 우클릭(관리자는 등록 창) · 놓인 아이템 고르기 · 순서 바꾸기(카탈로그 것만 순서 저장) · 미리보기 우클릭
   ・4절: 입구 전제 · 5절: app.js 연결 · 6절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => process.stdout.write(s + '\n');
console.log = () => {};   // 모듈의 진단 로그([아이템 우클릭 …])는 판정과 무관
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('creator/desk-setup.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!MOD || !APP || !HTML) { say('  ? 원본 못 찾음 — desk-setup.js · app.js · desk-companion-prototype.html'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };

function el(tag, id) {
  const L = {};
  return { tag, id, style: {}, dataset: {}, children: [], value: '', title: '', textContent: '', className: '', type: '', parentElement: { style: {} },
    get firstChild() { return this.children[0] || null; }, set innerHTML(v) { this.children = []; }, get innerHTML() { return ''; },
    appendChild(c) { this.children.push(c); return c; }, addEventListener(t, f) { (L[t] = L[t] || []).push(f); }, fire(t, ev) { (L[t] || []).forEach((f) => f(ev)); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }) };
}
function world(src, o = {}) {
  const log = { toasts: [], calls: [], net: [] };
  const call = (k) => (...a) => { log.calls.push([k, ...a]); };
  const E = {};
  ['crDeskRow', 'crItemRow', 'deskColor', 'deskScale', 'crItemPager', 'deskAddCode', 'itemAddCode', 'crDeskLicenseHint', 'creatorPreview'].forEach((i) => { E[i] = el('div', i); });
  (o.drop || []).forEach((k) => { delete E[k]; });
  const doc = { getElementById: (i) => E[i] || null, createElement: (t) => el(t) };
  let desks = JSON.parse(JSON.stringify(o.desks || [])), items = JSON.parse(JSON.stringify(o.items || []));   // 세상마다 새 객체(받은 GLB 가 다음 판정으로 새지 않게)
  const customItems = Object.assign({}, o.customItems || {});
  const st = { activeCustomDeskId: o.active || null, cDesk: { desk: 1 }, cDeskMat: { m: 1 }, cDeskColor: '#ccc', cDeskScale: o.deskScale === undefined ? 0.2 : o.deskScale, cDeskTemplate: 'T', cDeskGlbB64: 'G',
    crItemPage: o.page || 0, crStep: o.step || 5, cCam: {}, cBase: o.noBase ? null : { deskAnchor: o.noAnchor ? null : {}, deskItems: Object.assign({}, o.equipped || {}), activeDeskItem: null } };
  const net = o.noNet ? null : { unpublishDesk: (id) => { log.net.push(['unDesk', id]); return Promise.resolve(); }, unpublishItem: (id) => { log.net.push(['unItem', id]); return Promise.resolve(); },
    updateItemsOrder: (m) => { log.net.push(['iOrder', m]); return o.orderFail ? Promise.reject(new Error('x')) : Promise.resolve(); }, updateDesksOrder: (m) => { log.net.push(['dOrder', m]); return Promise.resolve(); } };
  const cards = [];
  const assetCardsMod = {
    swThumb: (label, on, icon, onDelete, active) => { const c = el('div'); c.label = label; c.on = on; c.icon = icon; c.onDelete = onDelete; c.active = active; c.children.push(el('div')); cards.push(c); return c; },
    applyDeskDotThumb: (rec, card) => { card.dot = rec; }, bindReorderHandle: (h, card, id, onDrop) => { card.reorder = { id, onDrop }; },
  };
  const ray = { setFromCamera: () => {}, intersectObjects: () => o.hits || [] };
  const confirmFn = () => !!o.confirm;
  const T = new Function('window', 'document', 'confirm', 'module', src + '\nreturn window.TwDeskSetup;')({ focus() {} }, doc, confirmFn, undefined);
  const out = T.createDeskSetup({
    DEFAULT_DESK_OVERRIDE_ID: '__default_desk__', DEF_SIZE_TOAST_MS: () => 5000, DESK_ITEMS: [{ id: 'plant', name: '화분' }, { id: 'cup', name: '컵' }, { id: 'books', name: '책' }], DESK_SCALE_DEFAULT: 0.175,
    _creatorSizeGrow: (fn) => { const d = {}; fn(d); log.calls.push(['grow', d]); return o.sizeFail ? { ok: false, message: '용량' } : { ok: true }; },
    _syncCrColorSwatches: call('sync'), applyDeskColorToCustom: call('color'), assetCardsMod,
    assetCodeMod: () => ({ parseGlbBytes: (b) => (o.parseFail ? Promise.reject(new Error('x')) : Promise.resolve({ scene: b })) }), autoSaveDeskItemsNow: call('autosave'), b64ToBuf: (s) => 'B:' + s,
    catalogGlbMod: () => ({ resolveCatalogGlb: async (rec) => { log.calls.push(['resolve', rec.id]); if (!o.resolveFail) rec.glb = 'RGLB'; } }),
    catalogNet: () => net, clampDeskScale: (v) => Math.max(0.05, Math.min(0.3, v)),
    commissionMod: () => ({ savedDesks: () => desks, savedItems: () => items, setSavedDesks: (a) => { desks = a; }, setSavedItems: (a) => { items = a; }, persistSavedAssets: call('persist'), MAX_CUSTOM_ASSETS: 2, MAX_CUSTOM_ITEMS: 3 }),
    crState: st, creatorOpen: () => o.open !== false, customItems: () => customItems,
    deskItemsMod: () => ({ deskItemDef: (id) => (o.override && o.override[id]) || null }), equipDeskItem: call('equip'),
    isAdmin: () => !!o.admin, isPremium: () => !!o.premium, lightToneMod: () => ({ _setDeskMatColor: call('matColor') }),
    ndc: { x: 0, y: 0 }, premiumMod: { _wdLicenseDesks: () => o.licDesks || [] }, ray,
    setCreatorDeskScale: call('scale'), swapDeskVisual: call('swap'), toast: (m, a, b) => log.toasts.push([m, a, b]),
  });
  out.setHooks({ openDeskRegister: call('register'), attachItemGizmo: call('gizmo') });
  const calls = (k) => log.calls.filter((c) => c[0] === k);
  return { out, log, st, E, cards, calls, customItems, getDesks: () => desks, getItems: () => items };
}
const lastT = (w) => (w.log.toasts[w.log.toasts.length - 1] || [])[0];
const deskCards = (w) => w.E.crDeskRow.children, itemCards = (w) => w.E.crItemRow.children;

async function behave(src) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let w = null, err = null;
  try { w = world(src); } catch (e) { err = e; }
  t(!err && w && Object.keys(w.out).sort().join() === 'renderCrItems,selectDeskItemForAdjust,setHooks', '만들 때 던지지 않고 셋을 내놓는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  if (!w) return r;
  const D = [{ id: '__default_desk__', glbUrl: 'u' }, { id: 'd1', name: '나무', glb: 'G1' }, { id: 'd2', name: '전용', glb: 'G2', licenseOnly: true, fromCatalog: true }, { id: 'd3', name: '카탈', glbUrl: 'u3', fromCatalog: true }];
  w = world(src, { desks: D }); w.out.renderCrItems();
  let dc = deskCards(w);
  t(dc[0].label === '기본 책상' && dc[0].on === true && dc.map((c) => c.label).join() === '기본 책상,나무,카탈' && dc[1].onDelete && !dc[2].onDelete, '책상 카드 — 기본 책상(켜짐) · 저장 책상(관리자 덮어쓰기 · 전용 빼고) · 카탈로그 것은 일반 사용자가 못 지움');
  const wa = world(src, { desks: D, admin: true }); wa.out.renderCrItems();
  dc = deskCards(wa);
  t(dc.map((c) => c.label).join() === '기본 책상,나무,전용,카탈' && dc[2].reorder && dc[2].reorder.id === 'd2' && dc[2].dataset.reorderId === 'd2', '관리자 — 전용 책상도 보이고 카탈로그 책상에 ☰ 손잡이');
  dc[0].oncontextmenu({ preventDefault() {} }); dc[2].oncontextmenu({ preventDefault() {} });
  t(JSON.stringify(wa.calls('register')) === '[["register","desk","__default_desk__"],["register","desk","d2"]]', '관리자 우클릭 — 등록 창 갈고리(openDeskRegister)로');
  /* 고르기 */
  w = world(src, { desks: D, deskScale: 0 }); w.out.renderCrItems(); await deskCards(w)[1].onclick(); await flush();
  t(w.st.activeCustomDeskId === 'd1' && w.st.cDeskTemplate.scene === 'B:G1' && w.st.cDeskGlbB64 === 'G1' && w.st.cDeskScale === 0.175 && w.calls('swap')[0][2].scene === 'B:G1' && w.calls('grow')[0][1].deskGlb === 'G1' && deskCards(w)[1].on,
    '책상 고르기 — 용량을 재고(코드로 넣은 책상) GLB 를 읽어 적용 · 크기 0 이면 처음 값 · 다시 그림');
  await deskCards(w)[1].onclick(); await flush();
  t(w.calls('swap').length === 1, '이미 고른 책상을 다시 누르면 아무 일 없음');
  w = world(src, { desks: D }); w.out.renderCrItems(); await deskCards(w)[2].onclick(); await flush();
  t(w.calls('resolve')[0][1] === 'd3' && w.st.activeCustomDeskId === 'd3' && !w.calls('grow').length, '카탈로그 책상 — URL 이면 받아서 · 용량은 안 잼(id 만 실림)');
  w = world(src, { desks: D, resolveFail: true }); w.out.renderCrItems(); await deskCards(w)[2].onclick(); await flush();
  const w2 = world(src, { desks: D, sizeFail: true }); w2.out.renderCrItems(); await deskCards(w2)[1].onclick(); await flush();
  const w3 = world(src, { desks: D, parseFail: true }); w3.out.renderCrItems(); await deskCards(w3)[1].onclick(); await flush();
  t(lastT(w) === '책상 GLB를 불러올 수 없어요 (네트워크 확인)' && w2.log.toasts[0][0] === '용량' && w2.log.toasts[0][2] === 5000 && !w2.st.activeCustomDeskId && lastT(w3) === '책상 적용 실패', '못 받음 · 용량 초과 · 못 읽음 — 알리고 그대로');
  w = world(src, { desks: D, active: 'd1' }); w.out.renderCrItems(); await deskCards(w)[0].onclick(); await flush();
  t(w.st.activeCustomDeskId === null && w.st.cDeskTemplate === null && w.calls('resolve')[0][1] === '__default_desk__' && w.calls('swap')[0][3] === true && w.calls('color').length >= 1, '기본 책상 — 관리자가 등록한 기본 책상(URL 받기)으로 · 덮어쓰기 표시');
  /* 잠금 안전망 — 거르기 뒤에 licenseOnly 가 서는 경우(카탈로그가 늦게 와 licenseOnly 를 아직 모르던 순간)에도 고르지 못한다 */
  w = world(src, { desks: [{ id: 'late', name: '늦게', glbUrl: 'u' }] });
  { let n = 0; const rec = JSON.parse(JSON.stringify({ id: 'late', name: '늦게', glbUrl: 'u' })); Object.defineProperty(rec, 'licenseOnly', { get: () => (n++ > 0) }); w.getDesks().splice(0, 1, rec); }
  w.out.renderCrItems();
  const lateCard = deskCards(w)[1]; await lateCard.onclick(); await flush();
  t(lateCard.style.opacity === '.55' && lateCard.children[0].children.some((n) => n.textContent === '🔒') && /라이선스 보유자만/.test(lastT(w)) && !w.calls('resolve').length && !w.st.activeCustomDeskId,
    '라이선스 전용 책상(늦게 안 경우) — 🔒 · 흐리게 · 눌러도 안 고르고 GLB 도 안 받는다');
  /* 지우기 */
  w = world(src, { desks: D, active: 'd1' }); w.out.renderCrItems(); deskCards(w)[1].onDelete();
  t(!w.getDesks().find((d) => d.id === 'd1') && w.calls('persist').length === 1 && w.st.activeCustomDeskId === null && !w.log.net.length, '책상 지우기 — 저장에서 빼고 · 고른 책상이었으면 기본으로');
  const wc = world(src, { desks: D, admin: true, confirm: false }); wc.out.renderCrItems(); deskCards(wc)[3].onDelete();
  const wy = world(src, { desks: D, admin: true, confirm: true }); wy.out.renderCrItems(); deskCards(wy)[3].onDelete();
  t(wc.getDesks().length === 4 && !wc.log.net.length && wy.log.net[0][0] === 'unDesk' && wy.log.net[0][1] === 'd3' && wy.getDesks().length === 3, '카탈로그 책상 회수 — 확인을 받아야 · catalogNet().unpublishDesk');

  /* 아이템 카드 */
  const I = [{ id: 'i1' }, { id: 'i2' }, { id: 'i3', fromCatalog: true }, { id: 'i4' }, { id: 'plant', name: '교체 화분' }];
  const C = { i1: { id: 'i1', name: '하나', glb: 'g1' }, i2: { id: 'i2', name: '둘', licenseOnly: true }, i3: { id: 'i3', name: '셋' }, i4: { id: 'i4', name: '넷' } };
  w = world(src, { items: I, customItems: C }); w.out.renderCrItems();
  let ic = itemCards(w);
  t(ic.map((c) => c.label).join() === '화분,컵,책,하나,둘' && w.E.crItemPager.style.display === 'flex' && w.E.crItemPager.children.length === 2 && w.E.crItemPager.children[0].className === 'cr-item-page-btn on' && ic[0].dot && ic[0].dot.id === 'plant',
    '아이템 — 기본 셋 + 커스텀(교체분 id 는 빼고)을 5개씩 · 쪽 번호 · 기본 아이템 카드에 교체분 썸네일');
  t(ic[4].style.opacity === '.55' && ic[4].children[0].children.some((n) => n.textContent === '🔒'), '라이선스 전용 아이템 — 🔒 · 흐리게(라이선스 · 관리자 아님)');
  w.E.crItemPager.children[1].onclick();
  ic = itemCards(w);
  t(w.st.crItemPage === 1 && ic.map((c) => c.label).join() === '셋,넷', '쪽 넘기기 — 두 번째 쪽');
  const wp = world(src, { items: I, customItems: C, page: 9 }); wp.out.renderCrItems();
  const w1p = world(src, { items: [], customItems: {} }); w1p.out.renderCrItems();
  t(wp.st.crItemPage === 1 && w1p.E.crItemPager.style.display === 'none', '쪽 번호가 넘치면 마지막 쪽으로 · 한 쪽이면 쪽 번호 숨김');
  const wn = world(src, { items: [{ id: 'zz' }], customItems: {} }); wn.out.renderCrItems();
  t(itemCards(wn).length === 3, '아직 안 읽힌 커스텀 아이템은 건너뛴다');
  w = world(src, { items: I, customItems: C, override: { plant: { id: 'plant', name: '교체 화분', x: 1 } } }); w.out.renderCrItems();
  ic = itemCards(w); ic[0].onclick();
  t(ic[0].label === '교체 화분' && w.calls('equip')[0][2].x === 1 && w.calls('equip')[0][3] === true && w.calls('autosave').length === 1, '기본 아이템 켜기 — 관리자 교체분 이름 · def 로 · 저장');
  const wna = world(src, { items: I, customItems: C, noAnchor: true }); wna.out.renderCrItems(); itemCards(wna)[0].onclick();
  t(!wna.calls('equip').length, '책상 자리가 없으면 켜지 않는다');
  w = world(src, { items: I, customItems: C, sizeFail: true }); w.out.renderCrItems(); itemCards(w)[3].onclick();
  t(!w.calls('equip').length && lastT(w) === '용량' && w.calls('grow')[0][1].customItems.i1.glb === 'g1', '커스텀 아이템 켜기 — 이름 · GLB 를 더한 용량이 넘으면 안 켠다');
  w = world(src, { items: I, customItems: C, sizeFail: true, page: 1 }); w.out.renderCrItems(); itemCards(w)[0].onclick();
  t(w.calls('equip').length === 1 && !w.calls('grow').length, '카탈로그 아이템은 용량을 안 잰다(id 만 실림)');
  w = world(src, { desks: [{ id: 'a' }, { id: 'b' }], items: [{ id: 'x' }, { id: 'y' }, { id: 'z' }] }); w.out.renderCrItems();
  t(w.E.deskAddCode.style.opacity === '0.4' && /최대 2개/.test(w.E.deskAddCode.title) && w.E.itemAddCode.style.opacity === '0.4', '한도가 차면 «코드로 추가하기» 를 흐리게 · 안내');
  const wl = world(src, { licDesks: [1] }); wl.out.renderCrItems(); const wla = world(src, { licDesks: [1], admin: true }); wla.out.renderCrItems();
  t(wl.E.crDeskLicenseHint.style.display === 'flex' && wla.E.crDeskLicenseHint.style.display === 'none' && wl.E.deskColor.value === '#ccc' && wl.calls('sync').length === 1, '전용 책상 안내(관리자 빼고) · 색 칸 · 색 견본 맞추기');

  /* 고르기 · 순서 · 갈고리 */
  const piv = { p: 1 };
  w = world(src, { items: I, customItems: C, equipped: { i1: piv } }); w.out.renderCrItems();
  itemCards(w)[3].oncontextmenu({ preventDefault() {} });
  t(w.st.cBase.activeDeskItem === piv && w.calls('gizmo').length === 1, '우클릭(일반) — 놓인 아이템을 고르고 기즈모 갈고리');
  const wq = world(src, { open: false }); wq.out.selectDeskItemForAdjust(piv);
  t(wq.st.cBase.activeDeskItem === piv && wq.calls('gizmo').length === 1 && !wq.E.crDeskRow.children.length, '생성기가 닫혀 있으면 카드는 안 그린다');
  w = world(src, { items: [{ id: 'a', fromCatalog: true }, { id: 'b' }, { id: 'c', fromCatalog: true }], customItems: { a: { id: 'a', name: 'A' }, b: { id: 'b', name: 'B' }, c: { id: 'c', name: 'C' } }, admin: true });
  w.out.renderCrItems();
  const reo = itemCards(w).find((c) => c.reorder).reorder; reo.onDrop('c', 'a'); await flush();
  t(w.getItems().map((x) => x.id).join() === 'c,a,b' && w.getItems()[0].order === 0 && JSON.stringify(w.log.net[0]) === '["iOrder",{"c":0,"a":1}]' && w.calls('gizmo').length === 1 && w.calls('persist').length === 1, '아이템 순서 — 옮기고 order 다시 · 카탈로그 것만 순서 저장(catalogNet) · 기즈모 갈고리');
  w = world(src, { items: [{ id: 'a', fromCatalog: true }, { id: 'b', fromCatalog: true }], customItems: { a: { id: 'a' }, b: { id: 'b' } }, admin: true, orderFail: true }); w.out.renderCrItems();
  itemCards(w).find((c) => c.reorder).reorder.onDrop('b', 'a'); await flush();
  t(/^⚠ 순서가 온라인에는 반영 안 됐어요/.test(lastT(w)), '순서 저장 실패 — 이 화면에서만 바뀌었다고 알림');
  w = world(src, { desks: [{ id: 'x', fromCatalog: true, name: 'X' }, { id: 'y', fromCatalog: true, name: 'Y' }], admin: true }); w.out.renderCrItems();
  deskCards(w)[1].reorder.onDrop('y', 'x'); await flush();
  t(w.getDesks().map((d) => d.id).join() === 'y,x' && JSON.stringify(w.log.net[0]) === '["dOrder",{"y":0,"x":1}]', '책상 순서 — 옮기고 카탈로그 순서 저장');
  w = world(src, { hits: [{ object: { userData: {}, parent: { userData: { isDeskItemPivot: true }, tag: 'pivot' } } }], equipped: { a: {} } });
  let prevented = false;
  w.E.creatorPreview.fire('contextmenu', { clientX: 10, clientY: 10, preventDefault() { prevented = true; } });
  const wadm = world(src, { admin: true, hits: [{ object: { userData: { isDeskItemPivot: true } } }], equipped: { a: {} } }); wadm.E.creatorPreview.fire('contextmenu', { preventDefault() {} });
  const ws4 = world(src, { step: 4, hits: [{ object: { userData: { isDeskItemPivot: true } } }], equipped: { a: {} } }); ws4.E.creatorPreview.fire('contextmenu', { preventDefault() {} });
  t(prevented && w.st.cBase.activeDeskItem && w.st.cBase.activeDeskItem.tag === 'pivot' && !wadm.st.cBase.activeDeskItem && !ws4.st.cBase.activeDeskItem, '미리보기 우클릭 — 5단계 · 일반 사용자만 · 맞은 메쉬의 아이템 묶음을 고른다');
  w = world(src); w.E.deskColor.fire('input', { target: { value: '#abcdef' } });
  t(w.st.cDeskColor === '#abcdef' && w.calls('matColor')[0][2] === '#abcdef' && w.calls('color')[0][2] === '#abcdef', '책상 색 칸 — 상태 · 책상 재질 · 커스텀 책상');

  /* 입구 전제 */
  let threw = false;
  try {
    const a = world(src, { drop: ['crDeskRow', 'deskColor', 'creatorPreview'] }); a.out.renderCrItems();
    const b = world(src, { noBase: true }); b.out.selectDeskItemForAdjust({});
    t(!a.cards.length && !b.calls('gizmo').length, '입구 전제 — 카드 줄 · 색 칸 · 미리보기가 없거나 캐릭터가 없으면 던지지 않고 아무것도 안 한다');
  } catch (_) { threw = true; }
  if (threw) t(false, '입구 전제 — 없을 때 던졌다');
  return r;
}

function wire(app, html) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const A = strip(app);
  t(!/function renderCrItems\b|function reorderSavedItem\b|function selectDeskItemForAdjust\b|const DESK_ICON\b/.test(A), 'app.js 에 옮긴 선언이 안 남았다');
  const mk = (app.match(/const deskSetupMod = TwDeskSetup\.createDeskSetup\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  t(mk.split('\n').length === 29 && /  crState: crState,/.test(mk) && /  catalogNet: \(\)=>window\.firebaseAPI,/.test(mk) && !/adminPartReg|crXformMod/.test(mk), '만드는 줄(가드 없이) · deps 29 · 데이터 provider 한 줄 · 관리자 등록 · 기즈모 모듈은 받지 않는다(순환)');
  const iX = app.indexOf('const crXformMod = TwCreatorXform.'), iH = app.indexOf('deskSetupMod.setHooks({');
  t(iH > iX && /openDeskRegister: \(\.\.\.a\)=>adminPartReg\.openDeskRegister\(\.\.\.a\),/.test(app) && /attachItemGizmo: \(\)=>crXformMod\.attachItemGizmoToActive\(\),/.test(app), 'crXformMod 를 만든 뒤 갈고리 둘을 잇는다');
  t(/function bindHold\(el, fn\)\{/.test(app), 'bindHold 는 app.js 에 남는다(animal.js 가 전역으로 읽는다)');
  const iM = html.indexOf('<script src="parts/creator/desk-setup.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — creator/desk-setup.js 를 app.js 보다 먼저 싣는다');
  return r;
}

(async () => {
  const B = await behave(MOD);
  B.forEach(([ok, msg], i) => { const s = { 0: '── 1. 책상 카드', 12: '── 2. 아이템 카드', 23: '── 3. 고르기 · 순서 · 갈고리', 30: '── 4. 입구 전제' }; if (s[i]) say(s[i]); chk(ok, msg); });
  say('── 5. app.js 연결');
  wire(APP, HTML).forEach(([ok, msg]) => chk(ok, msg));
  chk(!SMOKE || /PRELOAD\.push\('desk-setup\.js'\);/.test(SMOKE), 'smoke 가 desk-setup.js 를 먼저 싣는다');
  say('── 6. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['전용 책상을 모두에게', (m) => m.replace('(isAdmin() || !rec.licenseOnly)', 'true'), null, null],
    ['잠긴 책상도 골라짐', (m) => m.replace("if(deskLocked){ toast('🔒 ", "if(false){ toast('🔒 "), null, null],
    ['카탈로그 책상도 용량 잼', (m) => m.replace('      if(!rec.fromCatalog){\n        const _sz = _creatorSizeGrow(d=>{ d.deskGlb = rec.glb;', '      if(true){\n        const _sz = _creatorSizeGrow(d=>{ d.deskGlb = rec.glb;'), null, null],
    ['회수 확인 없앰', (m) => m.replace("if(!confirm('\"'+(rec.name||'책상')+'\"을(를) 모든 사용자에게서 회수할까요?')){ window.focus(); return; }", ''), null, null],
    ['쪽당 5 → 6', (m) => m.replace('const CR_ITEM_PAGE_SIZE = 5;', 'const CR_ITEM_PAGE_SIZE = 6;'), null, null],
    ['쪽 번호 넘침 안 잡음', (m) => m.replace('if(crState.crItemPage >= _totalPages) crState.crItemPage = _totalPages-1;', ''), null, null],
    ['관리자 교체분 무시', (m) => m.replace('const eff=deskItemsMod().deskItemDef(def.id)||def;', 'const eff=def;'), null, null],
    ['카탈로그 아닌 것도 순서 저장', (m) => m.replace('commissionMod().savedItems().forEach((p,i)=>{ if(p.fromCatalog) orderMap[p.id]=i; });', 'commissionMod().savedItems().forEach((p,i)=>{ orderMap[p.id]=i; });'), null, null],
    ['기즈모 갈고리 안 부름', (m) => m.replace('  crState.cBase.activeDeskItem = pivot;\n  if(creatorOpen()) renderCrItems();\n  if(_hooks.attachItemGizmo) _hooks.attachItemGizmo();', '  crState.cBase.activeDeskItem = pivot;\n  if(creatorOpen()) renderCrItems();'), null, null],
    ['관리자도 미리보기 우클릭', (m) => m.replace('  if(isAdmin()) return;   // 관리자는', '  if(false) return;   // 관리자는'), null, null],
    ['입구 전제 없앰(카드)', (m) => m.replace("  if(!document.getElementById('crDeskRow') || !document.getElementById('crItemRow') || !document.getElementById('deskColor')) return;\n", ''), null, null],
    ['만들 때 던짐', (m) => m.replace('function createDeskSetup(deps){', 'function createDeskSetup(deps){ throw new Error("깨 봄");'), null, null],
    ['app.js 에 본문이 남음', null, (a) => a + '\nfunction renderCrItems(){}', null],
    ['갈고리 줄 빠짐', null, (a) => a.replace('deskSetupMod.setHooks({', 'void({'), null],
    ['html 줄 빠짐', null, null, (h) => h.replace('<script src="parts/creator/desk-setup.js"></script>', '')],
  ];
  for (const [name, fm, fa, fh] of breaks) {
    const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(APP) : APP, h2 = fh ? fh(HTML) : HTML;
    const changed = m2 !== MOD || a2 !== APP || h2 !== HTML;
    let rows; try { rows = (fm ? await behave(m2) : []).concat(wire(a2, h2)); } catch (_) { rows = [[false, '던짐']]; }
    chk(changed && rows.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 책상 세팅은 creator/desk-setup.js 에서'));
  process.exit(fail ? 1 : 0);
})();

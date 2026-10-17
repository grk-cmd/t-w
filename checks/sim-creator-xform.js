/* sim-creator-xform.js — 🧭 생성기 변형(creator/creator-xform.js) 동작 · 연결
   실행:  node sim-creator-xform.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 생성기 5 · 6단계에서 아이템 · 책상 · 캐릭터를 옮기고 돌리고 키운 값이 «무엇으로 저장되는가» 를 고정한다.
     app.js 에서 모듈로 옮겼으니(C 구역 떼기 w4) 버튼 · 슬라이더 · 기즈모 드래그 끝 → adj · cDeskPos · cXform 을 입력 → 출력으로 본다.
   ・1절: 만들 때 — 던지지 않고 셋을 내놓는다 · 높이 슬라이더 범위를 심는다
   ・2절: 캐릭터 슬라이더 · 되돌리기 — 크기 · 높이(clampCharY) · 방향 · data-rs z → 높이
   ・3절: 아이템 — 크기 ＋/－(0.05 칸 · 2.5 상한 · 0.05 하한 · 바닥 클램프) · 크기 초기화 · 이동 · 회전 초기화 · 고른 아이템 없음 · 코드로 추가 버튼
   ・4절: 기즈모 — 아이템에 붙이기 · 책상 위치 모드(켜기 · 꺼짐 · 초기화 · 숫자 글) · 드래그 끝 저장(아이템 adj · yaw / 책상 cDeskPos) · 회전 모드 Y 고리만 · 바닥 클램프가 파츠 핀을 뺀다
   ・5절: 책상 길이 · 배율 버튼 · 6절: app.js 연결 · 7절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('creator/creator-xform.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if (!MOD || !APP || !HTML) { say('  ? 원본 못 찾음 — creator-xform.js · app.js · desk-companion-prototype.html'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

function el(id, extra) {
  const cls = new Set();
  return Object.assign({ id, value: '', style: {}, innerHTML: '', textContent: '', dataset: {}, ev: {}, title: '',
    classList: { toggle: (c, on) => { (on === undefined ? !cls.has(c) : on) ? cls.add(c) : cls.delete(c); }, remove: (c) => cls.delete(c), add: (c) => cls.add(c), contains: (c) => cls.has(c) },
    addEventListener(t, f) { (this.ev[t] = this.ev[t] || []).push(f); }, fire(t, e) { (this.ev[t] || []).forEach((f) => f(e || { target: this })); } }, extra || {});
}
function world(src, o = {}) {
  const log = { toasts: [], saves: 0, applyXf: 0, layouts: 0, imports: [], setDeskPos: [], deskScale: [], clamp: [], slotSaves: 0, bf: [] };
  const ids = ['crItemColors', 'crItemBigger', 'crItemSmaller', 'crItemRemove', 'crItemXfReset', 'deskAddCode', 'itemAddCode', 'crScale', 'crZ', 'crRot', 'deskPosNum', 'deskPosGz', 'deskPosReset', 'deskScaleReset', 'deskScale', 'deskLenX', 'deskLenXReset'];
  const E = {}; ids.forEach((i) => { E[i] = el(i); });
  const modeBtns = ['translate', 'rotate'].map((m) => el('mode-' + m, { dataset: { mode: m } }));
  const rsBtns = ['s', 'z', 'rot'].map((k) => el('rs-' + k, { dataset: { rs: k } }));
  const rows = [];
  E.crItemColors.appendChild = (r) => rows.push(r);
  const mkDiv = () => { const d = { style: {}, innerHTML: '', q: {}, querySelector(sel) { return (d.q[sel] = d.q[sel] || el(sel)); } }; return d; };
  const doc = { createElement: mkDiv, getElementById: (i) => E[i] || null, querySelectorAll: (q) => (q.includes('cr-gz-mode') ? modeBtns : q.includes('mini-reset') ? rsBtns : []) };
  class TC { constructor() { this.ev = {}; this.object = null; this.visible = false; this.mode = 'translate'; }
    setSize(n) { this.size = n; } setSpace(s) { this.space = s; } setMode(m) { this.mode = m; } addEventListener(t, f) { (this.ev[t] = this.ev[t] || []).push(f); }
    attach(x) { this.object = x; } detach() { this.object = null; } update() {} fire(t, e) { (this.ev[t] || []).forEach((f) => f(e)); } }
  const THREE = { Euler: class { setFromQuaternion(q, order) { return { y: order === 'YXZ' ? q.yawYXZ : 999 }; } } };
  if (!o.noTC) THREE.TransformControls = TC;
  const state = { cBase: o.cBase === undefined ? { activeDeskItem: null, charDef: {} } : o.cBase, cDesk: o.cDesk === undefined ? { position: { x: 0, y: 0, z: 0 }, userData: {} } : o.cDesk,
    cDeskPos: { x: 0, y: 0, z: 0 }, cDeskLenX: 1, cDeskScale: 0.175, cXform: { s: 0.7, y: 0, z: 0, rot: 0 } };
  const scene = { added: [], add(x) { this.added.push(x); } };
  const deps = {
    CHAR_Y_MAX: 0.6, DESK_PART_ANCHOR_NAME: () => '__deskPartAnchor', DESK_SCALE_DEFAULT: 0.175,
    _applyItemColor: () => {}, applyCreatorXform: () => { log.applyXf++; }, applyDeskAdj: () => {}, autoSaveDeskItemsNow: () => { log.saves++; },
    bindHold: (e, fn) => { e.hold = fn; },
    cBase: () => state.cBase, cCam: () => ({}), cDesk: () => state.cDesk, cDeskLenX: () => state.cDeskLenX, cDeskPos: () => state.cDeskPos, cDeskScale: () => state.cDeskScale,
    cRenderer: () => ({ domElement: {} }), cScene: () => scene, cXform: () => state.cXform,
    clampCharY: (v) => Math.max(0, Math.min(0.6, v)),
    deskItemOrigin: o.noOrigin ? null : { resetXf: (p, adj) => { adj.x = 9; return true; } },
    floorClampWrapper: (obj, label, hard, filt) => { log.clamp.push({ obj, label, hard, filt }); return o.clampDy || 0; },
    baseFlatOf: (m, ...rest) => { log.bf.push(rest.length); return m.k; },   // light-tone.baseFlatOf 대신 — 재질마다 표시값을 돌려준다
    layoutSeats: () => { log.layouts++; }, openAssetImport: (k) => log.imports.push(k),
    setCreatorDeskScale: (v) => log.deskScale.push(v), setDeskPos: (d, p) => log.setDeskPos.push(Object.assign({}, p)),
    slotSaveMod: () => ({ saveSlots: () => { log.slotSaves++; } }), syncDeskPartAnchor: () => {}, toast: (m) => log.toasts.push(m),
    setCDeskLenX: (v) => { state.cDeskLenX = v; }, setCDeskPos: (v) => { state.cDeskPos = v; }, setCDeskScale: (v) => { state.cDeskScale = v; },
  };
  const T = new Function('window', 'document', 'THREE', 'module', src + '\nreturn window.TwCreatorXform;')({ openCharColorPicker: null }, doc, THREE, undefined);
  const out = T.createCreatorXform(deps);
  return { out, log, E, rows, modeBtns, rsBtns, state, scene, gizmo: () => scene.added[0] };
}
const item = (adj) => ({ userData: { adj: Object.assign({ x: 0, y: 0, z: 0, rot: 0, scale: 1 }, adj || {}) }, position: { x: 1, y: 2, z: 3 }, scale: { x: 1.5 }, quaternion: { yawYXZ: 2.5 }, rotation: { y: 0.6 } });

function behave(src) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let w = null, err = null;
  try { w = world(src); } catch (e) { err = e; }
  t(!err && w && Object.keys(w.out).sort().join() === 'attachItemGizmoToActive,detachItemGizmo,updateDeskPosNum', '만들 때 던지지 않고 셋을 내놓는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  if (!w) return r;
  t(w.E.crZ.min === 0 && w.E.crZ.max === 0.6 && w.E.crZ.step === 0.01 && w.E.crZ.title === '캐릭터 높이', '앞뒤 슬라이더(#crZ)를 높이로 — 0 ~ CHAR_Y_MAX · 0.01 칸');

  w.E.crScale.fire('input', { target: { value: '1.2' } });
  w.E.crZ.fire('input', { target: { value: '5' } });
  w.E.crRot.fire('input', { target: { value: '-1' } });
  t(w.state.cXform.s === 1.2 && w.state.cXform.y === 0.6 && w.state.cXform.rot === -1 && w.log.applyXf === 3, '크기 · 높이(상한으로 잘림) · 방향 → cXform · 바로 반영');
  w.rsBtns[1].fire('click'); w.rsBtns[0].fire('click');
  t(w.state.cXform.y === 0 && w.E.crZ.value === 0 && w.state.cXform.s === 0.7 && w.E.crScale.value === 0.7 && w.state.cXform.z === 0, '되돌리기 — data-rs z 는 높이(y) 0 · s 는 0.7');

  w = world(src);
  w.E.crItemBigger.hold();
  t(w.log.toasts[0] === '먼저 크기를 조정할 아이템을 우클릭해서 선택해 주세요' && w.log.saves === 0, '고른 아이템이 없으면 안내만');
  const p = item({ scale: 2.48 }); w.state.cBase.activeDeskItem = p;
  w.E.crItemBigger.hold();
  t(p.userData.adj.scale === 2.5 && w.log.saves === 1 && w.log.clamp.some((c) => c.obj === p && c.hard === true), '＋ — 2.5 에서 멈춘다 · 바닥 클램프(hard) · 저장');
  p.userData.adj.scale = 1; w.E.crItemBigger.hold();
  t(Math.abs(p.userData.adj.scale - 1.05) < 1e-9, '＋ 한 번 = 0.05');
  p.userData.adj.scale = 0.07; w.E.crItemSmaller.hold();
  t(p.userData.adj.scale === 0.05, '－ — 0.05 아래로 안 간다');
  const w2 = world(src, { clampDy: 0.3 }); const p2 = item({ y: -1 }); p2.position.y = 0.4; w2.state.cBase.activeDeskItem = p2; w2.E.crItemBigger.hold();
  t(p2.userData.adj.y === 0.4, '키워서 바닥을 뚫으면 올린 높이를 adj.y 에 되짚는다');
  p.userData.adj.scale = 2; p.userData.autoScale = 0.8; w.E.crItemRemove.onclick();
  t(p.userData.adj.scale === 0.8 && p.userData.adj.x === 0, '크기 초기화 — autoScale 로(위치는 그대로)');
  delete p.userData.autoScale; w.E.crItemRemove.onclick();
  t(p.userData.adj.scale === 1, '크기 초기화 — autoScale 없으면 1');
  w.E.crItemXfReset.onclick();
  t(p.userData.adj.x === 9 && w.log.toasts[w.log.toasts.length - 1] === '처음 자리로 되돌렸어요', '이동 · 회전 초기화 — 처음 자리(deskItemOrigin)로');
  const w3 = world(src, { noOrigin: true }); const p3 = item({ x: 5, y: 5, z: 5, rot: 1 }); w3.state.cBase.activeDeskItem = p3; w3.E.crItemXfReset.onclick();
  t(p3.userData.adj.x === 0 && p3.userData.adj.rot === 0 && w3.log.toasts[0] === '위치·회전을 원래대로 되돌렸어요', '처음 자리 모듈이 없으면 0 으로');
  w.E.deskAddCode.onclick(); w.E.itemAddCode.onclick();
  t(w.log.imports.join() === 'desk,item', '코드로 추가 — 책상 · 아이템');

  w = world(src);
  w.out.updateDeskPosNum();
  t(w.E.deskPosNum.textContent === '기본 위치', '책상 위치 0 → «기본 위치»');
  w.state.cDeskPos = { x: 1, y: -0.5, z: 0.125 }; w.out.updateDeskPosNum();
  t(w.E.deskPosNum.textContent === 'x 1.00 · y -0.50 · z 0.13', '책상 위치 숫자 — 소수 둘째 자리');
  w.E.deskPosGz.fire('click');
  const g = w.gizmo();
  t(g && g.object === w.state.cDesk && g.visible && g.mode === 'translate' && g.showX === true && w.E.deskPosGz.classList.contains('on') && g.size === 2.1 && g.space === 'local', '책상 위치 켜기 — 기즈모(하나 · 2.1 · local)를 책상에 · 이동 · 세 축');
  w.state.cDesk.position = { x: 0.3, y: 0, z: -0.2 };
  const left = item(); w.state.cBase.activeDeskItem = left;   // 아이템이 남아 있어도 책상 값은 아이템으로 안 간다
  g.fire('objectChange');
  const cl = w.log.clamp[w.log.clamp.length - 1];
  t(cl.obj === w.state.cDesk && cl.hard && cl.filt({ name: '__deskPartAnchor' }) === true && cl.filt({ name: 'plant' }) === false && w.state.cDesk.userData.deskPosBase.x === 0.3, '책상 끌기 — 바닥 클램프가 파츠 핀만 뺀다 · 상쇄 몫 갱신');
  g.fire('dragging-changed', { value: false });
  t(w.state.cDeskPos.x === 0.3 && w.state.cDeskPos.z === -0.2 && w.log.layouts === 1 && w.log.saves === 0 && left.userData.adj.x === 0, '책상 드래그 끝 — cDeskPos 로 되짚고 좌석을 다시 잡는다(아이템 저장 안 함)');
  w.E.deskPosReset.fire('click');
  t(w.state.cDeskPos.x === 0 && w.log.setDeskPos[w.log.setDeskPos.length - 1].x === 0 && w.E.deskPosNum.textContent === '기본 위치' && g.object === w.state.cDesk, '책상 위치 초기화 — 0 · 다시 놓기 · 기즈모도 따라온다');
  const pi = item(); w.state.cBase.activeDeskItem = pi; w.out.attachItemGizmoToActive();
  t(g.object === pi && g.visible && !w.E.deskPosGz.classList.contains('on'), '아이템을 고르면 기즈모가 아이템으로 · 책상 위치 모드는 꺼진다');
  w.modeBtns[1].fire('click');
  t(g.mode === 'rotate' && g.showX === false && g.showZ === false && g.showY === true && w.modeBtns[1].classList.contains('on') && !w.modeBtns[0].classList.contains('on'), '회전 모드 — Y 고리만 · 버튼 켜짐 표시');
  g.fire('dragging-changed', { value: false });
  t(pi.userData.adj.x === 1 && pi.userData.adj.y === 2 && pi.userData.adj.z === 3 && pi.userData.adj.rot === 2.5 && pi.userData.adj.scale === 1.5 && w.log.saves === 1, '아이템 드래그 끝 — 위치 · YXZ yaw(rotation.y 아님) · 크기를 adj 로 · 저장');
  g.fire('dragging-changed', { value: true });
  t(w.log.saves === 1, '드래그 시작에는 저장하지 않는다');
  w.state.cBase.activeDeskItem = null; w.out.attachItemGizmoToActive();
  t(g.object === null && g.visible === false, '고른 아이템이 없으면 떼고 숨긴다');
  w.out.detachItemGizmo();
  const w4 = world(src, { cDesk: null }); w4.E.deskPosGz.fire('click');
  t(w4.log.toasts[0] === '책상을 아직 불러오는 중이에요' && !w4.E.deskPosGz.classList.contains('on'), '책상이 아직 없으면 위치 모드를 안 켠다');
  const w5 = world(src, { noTC: true }); let threw = false; try { w5.state.cBase.activeDeskItem = item(); w5.out.attachItemGizmoToActive(); } catch (_) { threw = true; }
  t(!threw && !w5.scene.added.length, 'TransformControls 가 없으면 조용히 아무 일도 안 한다');

  /* 색 되돌리기(↺) — 플랫 배율은 baseFlatOf(재질) 하나로 읽는다(대체값을 따로 넘기지 않는다) */
  {
    const x2 = world(src);
    const col = () => ({ v: 0, set(h) { this.v = h === '#ffffff' ? 1 : 0.5; return this; } });
    const emi = () => ({ r: 0, copy(c) { this.r = c.v; return this; }, multiplyScalar(k) { this.r *= k; return this; } });
    const mA = { k: 0.366, color: col(), emissive: emi(), userData: {} };
    const mB = { k: 0.2, color: col(), emissive: emi(), userData: { baseFlat: 0.2 } };
    const pc = item(); pc.userData.colorGroups = { col1: [{ material: mA, userData: { origColor: 'ffffff' } }, { material: mB, userData: { origColor: 'ffffff' } }] }; pc.userData.colors = { col1: '#000' };
    x2.state.cBase.activeDeskItem = pc;
    x2.out.attachItemGizmoToActive();   // 색 패널을 그린다
    const rst = x2.rows[0] && x2.rows[0].q['.cr-item-rst'];
    if (rst) rst.fire('click');
    t(rst && Math.abs(mA.emissive.r - 0.366) < 1e-9 && Math.abs(mB.emissive.r - 0.2) < 1e-9 && !('col1' in pc.userData.colors) && x2.log.bf.length === 2 && x2.log.bf.every((n) => n === 0),
      '색 되돌리기 — 원래 색 × baseFlatOf(재질) · 대체값을 따로 넘기지 않음 · 저장된 색 지움');
  }
  w = world(src);
  w.E.deskLenX.fire('input', { target: { value: '1.5' } });
  t(w.state.cDeskLenX === 1.5 && w.state.cBase.charDef.deskLenX === 1.5 && w.log.slotSaves === 1 && w.log.deskScale[0] === 0.175, '책상 길이 1.5 → 상태 · 캐릭터 def · 슬롯 저장 · 배율 다시');
  w.E.deskLenX.fire('input', { target: { value: '1' } });
  t(w.state.cBase.charDef.deskLenX === null, '길이 1(기본)은 def 에 null');
  w.E.deskLenX.fire('input', { target: { value: '' } });
  t(w.state.cDeskLenX === 1, '빈 값은 1');
  w.state.cDeskScale = 0.3; w.E.deskScaleReset.fire('click');
  t(w.state.cDeskScale === 0.175 && w.E.deskScale.value === 0.175 && w.log.deskScale[w.log.deskScale.length - 1] === 0.175, '책상 배율 되돌리기 — 기본값');
  w.E.deskLenXReset.fire('click');
  t(w.state.cDeskLenX === 1 && w.E.deskLenX.value === 1 && w.state.cBase.charDef.deskLenX === null, '책상 길이 되돌리기 — 1 · def null');
  return r;
}

function wire(app, html) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const A = strip(app);
  t(!/function ensureItemGizmo\b|let itemGizmo\b|let deskPosGizOn\b|function bindCrXform\b/.test(A), 'app.js 에 옮긴 선언이 안 남았다');
  const mk = (app.match(/const crXformMod = TwCreatorXform\.createCreatorXform\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  const keys = mk.split('\n').map((l) => (/^  ([\w$]+):/.exec(l) || [])[1]);
  t(keys.length === 31 && /  baseFlatOf: \(\.\.\.a\)=>lightToneMod\.baseFlatOf\(\.\.\.a\),/.test(mk) && ['setCDeskLenX', 'setCDeskPos', 'setCDeskScale'].every((k) => new RegExp('  ' + k + ': \\(v\\)=>\\{ crState\\.' + k.slice(3, 4).toLowerCase() + k.slice(4) + ' = v; \\},').test(mk)) && /  cBase: \(\)=>crState\.cBase,/.test(mk) && /  deskItemOrigin: deskItemOrigin,/.test(mk),
    '만드는 줄(가드 없이) · deps 28(baseFlatOf 포함) + 쓰는 함수 3');
  t(/crXformMod\.attachItemGizmoToActive\(/.test(A) && /crXformMod\.detachItemGizmo\(/.test(A) && /crXformMod\.updateDeskPosNum\(/.test(A) && !/(^|[^.\w$])(attachItemGizmoToActive|detachItemGizmo|updateDeskPosNum)\(/.test(A), '부르는 곳은 crXformMod.이름');   // 닫기의 detachItemGizmo 는 creator-flow.js 로 옮겨 가 app.js 에는 deps 이음(crXformMod.detachItemGizmo(...a))으로 남는다
  const iM = html.indexOf('<script src="parts/creator/creator-xform.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — creator/creator-xform.js 를 app.js 보다 먼저 싣는다');
  return r;
}

console.warn = () => {};   // 모듈 경고(TransformControls 없음 등)는 판정과 무관 — 출력만 줄인다
const B = behave(MOD);
B.forEach(([ok, msg], i) => { const s = { 0: '── 1. 만들 때', 2: '── 2. 캐릭터 슬라이더 · 되돌리기', 4: '── 3. 아이템', 15: '── 4. 기즈모', 30: '── 5. 책상 길이 · 배율' }; if (s[i]) say(s[i]); chk(ok, msg); });
say('── 6. app.js 연결');
wire(APP, HTML).forEach(([ok, msg]) => chk(ok, msg));
say('── 7. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['yaw 를 rotation.y 로', (m) => m.replace('p.userData.adj.rot = _itemYaw(p);', 'p.userData.adj.rot = p.rotation.y;'), null, null],
  ['회전에서도 X 고리', (m) => m.replace('g.showX = !rot;', 'g.showX = true;'), null, null],
  ['크기 상한 2.5 → 3', (m) => m.replace('const ITEM_SCALE_MAX = 2.5;', 'const ITEM_SCALE_MAX = 3;'), null, null],
  ['한 칸 0.05 → 0.1', (m) => m.replace('const ITEM_SCALE_STEP = 0.05;', 'const ITEM_SCALE_STEP = 0.1;'), null, null],
  ['파츠 핀을 같이 잰다', (m) => m.replace("floorClampWrapper(cDesk(), '책상', true, o => o.name === DESK_PART_ANCHOR_NAME());", "floorClampWrapper(cDesk(), '책상', true);"), null, null],
  ['책상 드래그도 아이템 저장', (m) => m.replace('        layoutSeats();   // 좌우로 밀었으면 좌석 간격을 다시 잡는다\n        return;', '        layoutSeats();'), null, null],
  ['만들 때 던짐', (m) => m.replace('function createCreatorXform(deps){', 'function createCreatorXform(deps){ throw new Error("깨 봄");'), null, null],
  ['app.js 에 본문이 남음', null, (a) => a + '\nfunction ensureItemGizmo(){}', null],
  ['deps 하나 빠짐', null, (a) => a.replace('  deskItemOrigin: deskItemOrigin,\n', ''), null],
  ['html 줄 빠짐', null, null, (h) => h.replace('<script src="parts/creator/creator-xform.js"></script>', '')],
];
for (const [name, fm, fa, fh] of breaks) {
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(APP) : APP, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== APP || h2 !== HTML;
  let rows; try { rows = (fm ? behave(m2) : []).concat(wire(a2, h2)); } catch (_) { rows = [[false, '던짐']]; }
  chk(changed && rows.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 생성기 변형은 creator/creator-xform.js 에서'));
process.exit(fail ? 1 : 0);

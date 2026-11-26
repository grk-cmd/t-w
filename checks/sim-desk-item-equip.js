/* ═══ 🪑 sim-desk-item-equip.js — 책상 아이템 장착 · 저장 반영(character/desk-item-equip.js · app.js 분리 M5) ═══════════════
   [왜] app.js 의 «책상 아이템 장착» 구역을 모듈로 옮겼다. 동작은 그대로여야 한다.
   ・1절: 라이선스 전용 막기 — 일반 유저는 막고 · 프리미엄 · 관리자 · 친구 좌석은 통과 · 카탈로그 기록(savedItems)의 licenseOnly 도 본다
   ・2절: 장착 · 해제 — 진짜 three 로 pivot · 부모 · 기본 조정값 · 해제 때 위치 기억 → 다시 켜면 복원 · 믹서 목록 정리 · 손 본 부착
   ・3절: 재생 방식 — auto(바로 반복) · idle(자리비움 목록) · click(한 번)
   ・4절: 커스텀 아이템 크기 맞춤 · _col 색 그룹 · 손 따라가는 지점
   ・5절: 모으기 collectDeskItems · 켜고 끌 때 바로 저장 autoSaveDeskItemsNow · 불러와 입히기 applyDeskItemsTo(크기 비율 환산)
   ・6절: 생성기 몫 — 생성기 holder 만 선택 표시 · 기즈모 해제 · 처음 자리 기억
   ・7절: 연결 — html · 만드는 줄 · 옛 이름 · app.js 에 장착 함수가 남지 않음
   ・8절: mutation test
   [실행] 러너 스테이징 또는 저장소 루트에서. three 는 vendor/three/three.min.js. */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('character/desk-item-equip.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음 — desk-item-equip.js · app.js · desk-companion-prototype.html'); process.exit(2); }
const threePath = ['vendor/three/three.min.js', 'app/vendor/three/three.min.js', 'three.min.js'].find(p => fs.existsSync(p));
if(!threePath){ say('  ? 원본 못 찾음 — three.min.js'); process.exit(2); }
const THREE = require(path.resolve(threePath));
const near = (a, b) => Math.abs(a - b) < 1e-6;

function build(src, o){
  o = o || {};
  const log = { toast: [], saves: 0, select: [], detach: 0, remembered: [] };
  const defs = o.defs || {};
  const st = { cBase: o.cBase || null, premium: !!o.premium, admin: !!o.admin, saved: o.saved || [], custom: o.custom || {} };
  const DeskItemOrigin = o.noOrigin ? undefined : { createDeskItemOrigin: () => ({ remember: (p, adj) => log.remembered.push([p, Object.assign({}, adj)]) }) };
  const win = {};
  const con = { log: () => {}, warn: () => {} };
  new Function('THREE', 'DeskItemOrigin', 'window', 'module', 'console', src)(THREE, DeskItemOrigin, win, undefined, con);
  const activeItemMixers = new Set(), idle = new Set();
  const mod = win.TwDeskItemEquip.createDeskItemEquip({
    _idleItemPivots: idle, activeItemMixers,
    commissionMod: () => ({ savedItems: () => st.saved }),
    crState: () => ({ cBase: st.cBase }),
    crXformMod: () => ({ attachItemGizmoToActive: () => log.detach++ }),
    customItems: () => st.custom,
    deskItemsMod: () => ({ allDeskItems: () => Object.values(defs), deskItemDef: (id) => defs[id] }),
    deskSetupMod: () => ({ selectDeskItemForAdjust: (p) => log.select.push(p) }),
    catalogReceived: () => !!(o.received || st.received),
    licenseAssetBlocked: (item) => !!(item && item.locked === true),   // account-state.js 와 같은 판단(서버 locked 하나)
    launcherPrevMod: () => ({ lHolder: () => null }),
    slotSaveMod: () => ({ saveSlots: () => log.saves++ }),
    lightToneMod: { baseFlatOf: () => 0.5 },
    toast: (m) => log.toast.push(m),
  });
  return { mod, log, st, activeItemMixers, idle, defs };
}
const mkDef = (id, extra) => Object.assign({ id, name: id, build: () => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x336699 })); g.add(m); return g; } }, extra || {});
const mkHolder = (extra) => Object.assign({ deskAnchor: new THREE.Group() }, extra || {});
const clip = (n) => new THREE.AnimationClip(n, -1, [new THREE.VectorKeyframeTrack('.position', [0, 1], [0, 0, 0, 1, 1, 1])]);

say('§1 라이선스 전용 막기');
{
  const d = mkDef('vip', { licenseOnly: true });
  const LOCKEDREC = [{ id: 'vip', licenseOnly: true, locked: true }], OPENREC = [{ id: 'vip', licenseOnly: true, locked: false }];   // 서버가 사람마다 정해 싣는다(보유자 · 관리자에게는 locked:false)
  let b = build(SRC, { saved: LOCKEDREC }); let h = mkHolder(); b.mod.equipDeskItem(h, d, true);
  chk(b.log.toast.length === 1 && b.log.toast[0].includes('라이선스') && !h.deskItems, '서버 locked:true — 막고 안내(장착 안 함)');
  b = build(SRC, { saved: OPENREC }); h = mkHolder(); b.mod.equipDeskItem(h, d, true);
  chk(h.deskItems && h.deskItems.vip && b.log.toast.length === 0, '★ 전용 분류여도 서버 locked:false(보유자 · 관리자)면 통과 — 앱이 다시 가리지 않는다');
  b = build(SRC); h = mkHolder(); b.mod.equipDeskItem(h, d, true);
  chk(!!(h.deskItems && h.deskItems.vip) && b.log.toast.length === 0, '레코드가 아직 없으면(받기 전) 막을 것도 없다');
  b = build(SRC, { saved: LOCKEDREC }); h = mkHolder({ remote: true }); b.mod.equipDeskItem(h, d, true);
  chk(!!(h.deskItems && h.deskItems.vip) && b.log.toast.length === 0, '★ 친구 좌석은 보는 사람의 locked 를 안 본다');
  b = build(SRC, { saved: [{ id: 'cc', licenseOnly: true, locked: true }] }); h = mkHolder(); b.mod.equipDeskItem(h, mkDef('cc', { licenseOnly: false }), true);
  chk(b.log.toast.length === 1 && !h.deskItems, '카탈로그 기록(savedItems)의 서버 locked 가 참이면 def 가 licenseOnly:false 여도 막는다');
  /* 모를 땐 막는다 — 커스텀 아이템인데 카탈로그 기록이 없으면 locked 를 모른다(캐릭터 코드로 딸려 온 것). 기록이 오면 다시 판정한다 */
  const cu = mkDef('vip', { custom: true, licenseOnly: false });
  b = build(SRC); h = mkHolder(); b.mod.equipDeskItem(h, cu, true);
  chk(!h.deskItems && b.log.toast.length === 0, '★ 받기 전(처음 · 받기 실패) · 기록 없음 → 막는다(소리 없이 — 장착 안 함)');
  b = build(SRC, { received: true }); h = mkHolder(); b.mod.equipDeskItem(h, cu, true);
  chk(!!(h.deskItems && h.deskItems.vip) && b.log.toast.length === 0, '★ 받은 뒤 · 기록 없음 → 장착한다(카탈로그 물건이 아니다 — 친구가 코드로 추가한 소품)');
  b = build(SRC, { received: true, saved: [{ id: 'vip', locked: true }] }); h = mkHolder(); b.mod.equipDeskItem(h, cu, true);
  chk(!h.deskItems && b.log.toast.length === 1, '★ 받은 뒤 · locked:true → 막고 안내한다');
  b = build(SRC, { saved: [{ id: 'vip', locked: false }] }); h = mkHolder(); b.mod.equipDeskItem(h, cu, true);
  chk(!!(h.deskItems && h.deskItems.vip), '  ↳ 기록이 오고 locked:false 면 그때 장착된다');
  b = build(SRC, { saved: [{ id: 'vip', locked: true }] }); h = mkHolder(); b.mod.equipDeskItem(h, cu, true);
  chk(!h.deskItems && b.log.toast.length === 1, '  ↳ 기록이 오고 locked:true 면 막고 안내한다');
  b = build(SRC); h = mkHolder({ remote: true }); b.mod.equipDeskItem(h, cu, true);
  chk(!!(h.deskItems && h.deskItems.vip), '  ↳ 친구 좌석은 기록이 없어도 막지 않는다');
  b = build(SRC); h = mkHolder(); b.mod.equipDeskItem(h, mkDef('plant'), true);
  chk(!!(h.deskItems && h.deskItems.plant), '  ↳ 기본 내장 아이템(custom 아님)은 기록이 없어도 막지 않는다');
  b = build(SRC); h = mkHolder(); b.mod.equipDeskItem(h, cu, false);
  chk(b.log.toast.length === 0, '  ↳ 끄기는 기록이 없어도 막지 않는다');
  { const m2 = SRC.replace('&& !_siRec && !catalogReceived()', '&& !_siRec'); const b2 = build(m2, { received: true }); const h2 = mkHolder(); b2.mod.equipDeskItem(h2, cu, true);
    chk(m2 !== SRC && !h2.deskItems, '  mutation test: «받았는가» 를 안 보면 받은 뒤에도 막혀 버린다(= 위 «받은 뒤 · 기록 없음» 판정이 빨강)'); }
  { const mm = SRC.replace('if(def && def.custom && !_siRec && !catalogReceived()){ _markSkipped(holder, def.id); return; }', ''); const bb = build(mm); const hh = mkHolder(); bb.mod.equipDeskItem(hh, cu, true);
    chk(mm !== SRC && !!(hh.deskItems && hh.deskItems.vip), '  mutation test: 기록 없을 때 막는 줄을 지우면 장착돼 버린다(= 위 판정이 빨강)'); }
  b = build(SRC, { saved: LOCKEDREC }); h = mkHolder(); b.mod.equipDeskItem(h, d, false);
  chk(b.log.toast.length === 0, '끄기(on=false)는 막지 않는다');
}
say('§2 장착 · 해제');
{
  const b = build(SRC); const h = mkHolder(); const d = mkDef('plant');
  b.mod.equipDeskItem(h, d, true);
  const p = h.deskItems.plant;
  chk(p.parent === h.deskAnchor && p.userData.isDeskItemPivot === true && p.userData.holder === h && h.activeDeskItem === p, '책상 앵커에 pivot 을 만들고 표식 · 소유 좌석 · 활성 아이템을 건다');
  chk(JSON.stringify(p.userData.adj) === JSON.stringify({ x: 0, z: 0, scale: 1, rot: 0 }) && p.scale.x === 1 && p.rotation.y === 0, '기본 내장 아이템은 조정값 (0, 0, 1, 0) 그대로');
  p.userData.adj.x = 0.3; p.userData.adj.scale = 2; p.userData.adj.rot = 1; b.mod.applyDeskAdj(p);
  chk(near(p.position.x, 0.3) && near(p.scale.x, 2) && near(p.rotation.y, 1) && p.position.y === 0, 'applyDeskAdj — 조정값을 위치 · 크기 · 회전에 반영(빈 y 는 0)');
  b.mod.equipDeskItem(h, d, false);
  chk(h.deskItems.plant === null && p.parent === null && h.activeDeskItem === null, '끄면 떼고 비운다');
  b.mod.equipDeskItem(h, d, true);
  const p2 = h.deskItems.plant;
  chk(p2 !== p && near(p2.userData.adj.x, 0.3) && near(p2.userData.adj.scale, 2), '해제 전 위치 · 크기를 기억했다가 다시 켜면 복원');
  b.mod.equipDeskItem(h, d, true);
  chk(h.deskAnchor.children.length === 1 && h.deskItems.plant !== p2, '켠 채 또 켜면 옛 것을 떼고 새로 만든다(둘이 겹치지 않는다)');
  const bone = new THREE.Group(); const h2 = mkHolder({ bones: { handL: bone } });
  b.mod.equipDeskItem(h2, mkDef('cup', { attachTo: 'handL' }), true);
  chk(h2.deskItems.cup.parent === bone, 'attachTo 가 handL 이고 그 본이 있으면 책상 앵커 대신 손 본에 붙인다');
  const h3 = mkHolder(); b.mod.equipDeskItem(h3, mkDef('cup2', { attachTo: 'handL' }), true);
  chk(h3.deskItems.cup2.parent === h3.deskAnchor, '그 본이 없으면 책상 앵커');
  const h4 = { }; let threw = false; try{ b.mod.equipDeskItem(h4, mkDef('x'), true); }catch(_){ threw = true; }
  chk(!threw && !h4.deskItems.x, '붙일 곳(앵커)이 없으면 만들지 않는다');
}
say('§3 재생 방식');
{
  const b = build(SRC);
  const mk = (mode, extra) => { const h = mkHolder(); const d = mkDef('a', Object.assign({ animations: [clip('Walk'), clip('my_idle')], playMode: mode }, extra)); b.mod.equipDeskItem(h, d, true); return h.deskItems.a; };
  const pa = mk('auto');
  chk(pa.userData.idleAction.isRunning() && b.activeItemMixers.has(pa.userData.itemMixer) && pa.userData.playMode === 'auto', 'auto — 바로 반복 재생 · 믹서 목록에');
  chk(pa.userData.idleAction.getClip().name === 'my_idle', '  클립은 이름에 idle 이 든 것');
  const pi = mk('idle');
  chk(b.idle.has(pi) && !pi.userData.idleAction.isRunning() && !b.activeItemMixers.has(pi.userData.itemMixer), 'idle — 자리비움 목록에만 넣고 정지로 시작');
  const pc = mk(undefined);
  chk(pc.userData.playMode === 'click' && pc.userData.idleAction.loop === THREE.LoopOnce && pc.userData.idleAction.clampWhenFinished === true && !pc.userData.idleAction.isRunning(), '기본은 click — 한 번만 · 끝 프레임에 정지');
  const pl = mk(undefined, { autoPlay: true });
  chk(pl.userData.playMode === 'auto', '옛 아이템(playMode 없음 · autoPlay)은 auto 로 본다');
  const h = mkHolder(); const dd = mkDef('z', { animations: [clip('Walk')], playMode: 'idle' }); b.mod.equipDeskItem(h, dd, true); const pz = h.deskItems.z;
  b.mod.equipDeskItem(h, dd, false);
  chk(!b.idle.has(pz) && !b.activeItemMixers.has(pz.userData.itemMixer), '끄면 두 목록에서 모두 뺀다');
}
say('§4 커스텀 크기 · 색 그룹 · 손 지점');
{
  const b = build(SRC, { saved: [{ id: 'big' }, { id: 'colored' }] }); const h = mkHolder();
  const d = mkDef('big', { custom: true, defaultSize: 0.5, build: () => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2)); m.position.set(5, 7, 0); g.add(m); return g; } });
  b.mod.equipDeskItem(h, d, true);
  const p = h.deskItems.big; const obj = p.children[0]; const box = new THREE.Box3().setFromObject(obj);
  chk(near(p.userData.autoScale, 0.5 / 4) && near(p.userData.adj.scale, 0.125) && near(p.userData.adj.y, 1.1) && p.userData.adj.z === 0, '커스텀 — 가장 긴 변(4)을 defaultSize(0.5)에 맞춘 배율 · 높이 보정 1.1');
  chk(near(box.min.y, 0) && near((box.min.x + box.max.x) / 2, 0), '  원본 원점이 어디든 «바닥 중앙» 이 pivot 원점에 오게 옮긴다');
  const d2 = mkDef('colored', { build: () => { const g = new THREE.Group(); const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xff0000 })); a.name = 'body_col'; const c = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x00ff00 })); c.name = 'trim_col2'; const hl = new THREE.Group(); hl.name = 'hand_L'; g.add(a, c, hl); return g; } });
  const h2 = mkHolder(); b.mod.equipDeskItem(h2, d2, true); const p2 = h2.deskItems.colored;
  chk(Object.keys(p2.userData.colorGroups).sort().join() === 'col1,col2' && p2.userData.colorGroups.col1[0].userData.origColor === 'ff0000', '_col · _col2 메시를 색 그룹(col1 · col2)으로 묶고 원래 색을 기억');
  chk(p2.userData.handTrackers && p2.userData.handTrackers.L && p2.userData.handTrackers.L.name === 'hand_L' && !p2.userData.handTrackers.R, 'hand_L 이름 지점을 손 따라가기로 등록');
  p2.userData.colors = { col1: '#0000ff' }; b.mod._applyItemColor(p2);
  const m1 = p2.userData.colorGroups.col1[0].material;
  chk(m1.color.getHexString() === '0000ff' && near(m1.emissive.b, 0.5), '_applyItemColor — 색을 바꾸고 emissive 는 색 × 플랫 몫');
  const o = p2.userData.colorGroups.col2[0].material; chk(o.color.getHexString() === '00ff00', '  고르지 않은 그룹은 그대로');
  b.mod.equipDeskItem(h2, d2, false); b.mod.equipDeskItem(h2, d2, true);
  chk(h2.deskItems.colored.userData.colors && h2.deskItems.colored.userData.colors.col1 === '#0000ff', '해제했다 다시 켜도 색이 복원된다');
}
say('§5 모으기 · 저장 · 불러오기');
{
  const b = build(SRC, { defs: { plant: mkDef('plant'), mug: mkDef('mug') } });
  const h = mkHolder();
  chk(b.mod.collectDeskItems(h) === null, '켠 아이템이 없으면 null');
  b.mod.equipDeskItem(h, b.defs.plant, true);
  h.deskItems.plant.userData.adj.x = 0.7; h.deskItems.plant.userData.autoScale = 0.25;
  const c = b.mod.collectDeskItems(h);
  chk(Object.keys(c).join() === 'plant' && c.plant.adj.x === 0.7 && c.plant.autoScale === 0.25 && c.plant.adj !== h.deskItems.plant.userData.adj, '조정값 · autoScale 을 복사해 모은다');
  h.deskItems.plant.userData.colorGroups = { col1: [] }; h.deskItems.plant.userData.colors = {};
  chk(JSON.stringify(b.mod.collectDeskItems(h).plant.colors) === '{}', '색 그룹이 있으면 비어 있어도 colors 를 항상 적는다(초기화 상태를 기록)');
  const bad = build(SRC);
  bad.mod.autoSaveDeskItemsNow();
  chk(bad.log.saves === 0, '생성기 캐릭터가 없으면 저장하지 않는다');
  const cb = mkHolder({ charDef: {} });
  const s = build(SRC, { defs: { plant: mkDef('plant'), cust: mkDef('cust') }, cBase: cb, custom: { cust: { name: 'N', glb: 'G' }, plant: { name: 'P', glb: 'GP' } }, saved: [{ id: 'plant', fromCatalog: true }] });
  s.mod.equipDeskItem(cb, s.defs.plant, true); s.mod.equipDeskItem(cb, s.defs.cust, true); s.log.saves = 0;
  s.mod.autoSaveDeskItemsNow();
  chk(cb.charDef.deskItems && Object.keys(cb.charDef.deskItems).sort().join() === 'cust,plant' && s.log.saves === 1, '켜고 끌 때 def.deskItems 에 바로 반영하고 슬롯을 저장');
  chk(JSON.stringify(cb.charDef.customItems) === '{"cust":{"name":"N","glb":"G"}}', '  customItems 에는 업로드한 것만(카탈로그에서 온 것은 뺀다)');
  const a = build(SRC, { defs: { plant: mkDef('plant', { custom: true, defaultSize: 1 }) }, saved: [{ id: 'plant' }] });
  const ha = mkHolder();
  a.mod.applyDeskItemsTo(ha, { plant: { adj: { x: 1, y: 2, z: 3, scale: 0.4, rot: 0.5 }, autoScale: 0.2, colors: {} } });
  const pa = ha.deskItems.plant;
  chk(near(pa.userData.adj.x, 1) && near(pa.userData.adj.rot, 0.5) && near(pa.userData.adj.scale, pa.userData.autoScale * (0.4 / 0.2)), '저장 당시 «자동 크기 대비 비율»(0.4/0.2)을 지금 자동 크기에 곱해 환산한다');
  const a2 = build(SRC, { defs: { plant: mkDef('plant') } }); const hb = mkHolder();
  a2.mod.applyDeskItemsTo(hb, { plant: { adj: { x: 1, scale: 3 } } });
  chk(near(hb.deskItems.plant.userData.adj.scale, 3), 'autoScale 정보가 없는 옛 저장은 절대값 그대로');
  let threw = false; try{ a2.mod.applyDeskItemsTo(hb, null); a2.mod.applyDeskItemsTo({}, { plant: {} }); a2.mod.applyDeskItemsTo(hb, { nope: { adj: {} } }); }catch(_){ threw = true; }
  chk(!threw, '데이터 없음 · 앵커 없음 · 모르는 아이템 id 는 조용히 지나간다');
  const a3 = build(SRC, { defs: { c: mkDef('c', { build: () => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xff0000 })); m.name = 'x_col'; g.add(m); return g; } }) } }); const hc = mkHolder();
  a3.mod.applyDeskItemsTo(hc, { c: { adj: {}, colors: {} } });
  chk(hc.deskItems.c.userData.colorGroups.col1[0].material.color.getHexString() === 'ff0000', '저장된 색이 없는 그룹은 원래 색(origColor)으로 되돌린다');
}
say('§5-B 받기 전에 건너뛴 아이템은 저장본에서 지워지지 않는다');
{
  const ORIG = () => ({ vip: { adj: { x: 1 } }, other: { adj: { x: 2 } } });
  const run = (src) => {
    const cb = mkHolder({ charDef: { deskItems: ORIG() } });
    const b = build(src, { cBase: cb, defs: { vip: mkDef('vip', { custom: true }), other: mkDef('other', { custom: true }), plant: mkDef('plant') } });
    b.mod.applyDeskItemsTo(cb, cb.charDef.deskItems);   // 카탈로그를 받기 전 — 기록 없는 커스텀 둘을 건너뛴다
    b.mod.equipDeskItem(cb, b.defs.plant, true);          // 다른 조정(기본 아이템 켜기)
    b.mod.autoSaveDeskItemsNow();
    return { cb, b };
  };
  const r = run(SRC);
  chk(!r.cb.deskItems.vip && r.cb._skippedItems instanceof Map && r.cb._skippedItems.get('vip').adj.x === 1 && r.cb._skippedItems.get('other').adj.x === 2, '건너뛴 소품을 holder 에 따로 적어 둔다');
  chk(Object.keys(r.cb.charDef.deskItems).sort().join() === 'other,plant,vip' && r.cb.charDef.deskItems.vip.adj.x === 1 && r.cb.charDef.deskItems.other.adj.x === 2, '★ 다른 조정 뒤 저장해도 건너뛴 두 소품의 원본(위치 · 크기)이 저장본에 남는다');
  const cb2 = mkHolder({ charDef: { deskItems: ORIG() } });
  const b2 = build(SRC, { cBase: cb2, defs: { vip: mkDef('vip', { custom: true }), other: mkDef('other', { custom: true }) } });
  b2.mod.applyDeskItemsTo(cb2, cb2.charDef.deskItems); b2.mod.autoSaveDeskItemsNow();
  chk(cb2.charDef.deskItems && Object.keys(cb2.charDef.deskItems).sort().join() === 'other,vip', '★ 전부 건너뛰었어도 null 이 저장되지 않는다');
  /* 카탈로그가 도착한 뒤 — 같은 holder 에 다시 올리면 표시가 풀리고 저장본에 그대로 있다 */
  b2.st.received = true;
  b2.mod.applyDeskItemsTo(cb2, { vip: cb2.charDef.deskItems.vip, other: cb2.charDef.deskItems.other });
  chk(!!(cb2.deskItems.vip && cb2.deskItems.other) && cb2._skippedItems.size === 0 && cb2.deskItems.vip.userData.adj.x === 1, '카탈로그가 오면 저장된 위치째 올라오고 건너뜀 표시가 풀린다');
  /* 프리셋을 얹은 뒤 건너뜀 — 저장본에는 옛 캐릭터 값이 아니라 프리셋 값이 남는다 */
  const cbp = mkHolder({ charDef: { deskItems: ORIG() } });
  const bp = build(SRC, { cBase: cbp, defs: { vip: mkDef('vip', { custom: true }), other: mkDef('other', { custom: true }) } });
  bp.mod.applyDeskItemsTo(cbp, { vip: { adj: { x: 9 } } });   // 프리셋이 입히려던 값
  bp.mod.autoSaveDeskItemsNow();
  chk(cbp.charDef.deskItems && cbp.charDef.deskItems.vip.adj.x === 9 && !cbp.charDef.deskItems.other, '★ 프리셋을 얹은 뒤 건너뜀 → 저장본에 프리셋 값(x:9)이 남는다(옛 캐릭터 값 x:1 이 아니다)');
  /* 카탈로그 아이템인데 GLB 를 아직 안 받아 등록 전(첫 화면 뒤에 받는다) — 생성기에서 다른 아이템을 켜고 저장해도 지워지지 않는다 */
  const pend = (src) => { const c = mkHolder({ charDef: { deskItems: { pend: { adj: { x: 5 } } } } }); const bb = build(src, { cBase: c, defs: { plant: mkDef('plant') } });
    bb.st.saved = [{ id: 'pend', glbUrl: 'https://x/p.glb' }]; bb.st.received = true;
    bb.mod.applyDeskItemsTo(c, c.charDef.deskItems); bb.mod.equipDeskItem(c, bb.defs.plant, true); bb.mod.autoSaveDeskItemsNow(); return c; };
  const pc = pend(SRC);
  chk(pc.charDef.deskItems && pc.charDef.deskItems.pend && pc.charDef.deskItems.pend.adj.x === 5 && pc.charDef.deskItems.plant, '★ GLB 를 받기 전이라 등록 안 된 카탈로그 아이템 — 다른 아이템을 켜고 저장해도 저장본에 원본째 남는다');
  const pm = SRC.replace("    if(!def){ if(_glbPending(id)){ _markSkipped(holder, id); holder._skippedItems.set(id, data[id]); } return; }", "    if(!def) return;");
  chk(pm !== SRC && !(pend(pm).charDef.deskItems || {}).pend, '  mutation test — 건너뜀으로 안 적으면 저장이 그 아이템을 지운다(빨강)');
  const mm = SRC.replace("_sk.forEach((entry,id)=>{ if(entry && !d[id]){ d[id]=entry; any=true; } });", '');
  const rb = run(mm);
  const rbp = (() => { const c = mkHolder({ charDef: { deskItems: ORIG() } }); const bb = build(SRC.replace("if(holder._skippedItems && holder._skippedItems.has(id)) holder._skippedItems.set(id, e);", ''), { cBase: c, defs: { vip: mkDef('vip', { custom: true }) } }); bb.mod.applyDeskItemsTo(c, { vip: { adj: { x: 9 } } }); bb.mod.autoSaveDeskItemsNow(); return c; })();
  chk(!rbp.charDef.deskItems || !rbp.charDef.deskItems.vip || rbp.charDef.deskItems.vip.adj.x !== 9, '  mutation test: 건너뛰는 순간 원본을 붙잡지 않으면 프리셋 값이 저장본에 남지 않는다(= 위 «프리셋» 판정이 빨강)');
  chk(mm !== SRC && Object.keys(rb.cb.charDef.deskItems || {}).sort().join() === 'plant', '  mutation test: collectDeskItems 의 합치는 줄을 빼면 건너뛴 소품이 저장본에서 지워진다(= 위 판정이 빨강)');
  /* 저장 길 셋이 같은 결과 — 자동 저장 · 생성기 «완성 → 저장»(creator-save.js) · 프리셋 저장(desk-preset.js)은 모두 collectDeskItems 로 모은다 */
  const cb3 = mkHolder({ charDef: { deskItems: ORIG() } });
  const b3 = build(SRC, { cBase: cb3, defs: { vip: mkDef('vip', { custom: true }), other: mkDef('other', { custom: true }), plant: mkDef('plant') } });
  b3.mod.applyDeskItemsTo(cb3, cb3.charDef.deskItems); b3.mod.equipDeskItem(cb3, b3.defs.plant, true);
  const viaCollect = b3.mod.collectDeskItems(cb3);   // creator-save 의 def.deskItems · desk-preset 의 deskItems 가 받는 값
  chk(Object.keys(viaCollect).sort().join() === 'other,plant,vip' && viaCollect.vip.adj.x === 1, '★ collectDeskItems 한 곳이 건너뛴 원본을 합친다 — 생성기 «완성 → 저장» · 프리셋 저장이 받는 값에도 두 소품이 남는다');
  const rd = (names) => { for(const n of names){ try{ return require('fs').readFileSync(n, 'utf8'); }catch(_){} } return ''; };
  const CS = rd(['creator-save.js', 'parts/creator/creator-save.js', 'app/parts/creator/creator-save.js']), DP = rd(['desk-preset.js', 'parts/creator/desk-preset.js', 'app/parts/creator/desk-preset.js']);
  chk(/def\.deskItems=di;/.test(CS) && /collectDeskItems\(cBase\(\)\)/.test(CS) && /deskItems: crState\.cBase \? collectDeskItems\(crState\.cBase\) : null/.test(DP), '  ↳ creator-save.js · desk-preset.js 가 직접 모으지 않고 collectDeskItems 를 부른다(합치기 한 곳)');
}
say('§6 생성기 몫');
{
  const cb = mkHolder();
  const b = build(SRC, { cBase: cb, defs: { plant: mkDef('plant') } });
  b.mod.equipDeskItem(cb, b.defs.plant, true);
  chk(b.log.select.length === 1 && b.log.select[0] === cb.deskItems.plant, '생성기 holder 는 방금 켠 아이템을 선택 표시');
  chk(b.log.remembered.length >= 1 && b.log.remembered[0][0] === cb.deskItems.plant, '  처음 자리를 기억한다(⟲ 초기화가 돌아갈 곳)');
  b.mod.equipDeskItem(cb, b.defs.plant, false);
  chk(b.log.detach === 1, '활성 아이템을 끄면 기즈모도 떼라고 알린다');
  const other = mkHolder(); b.log.select.length = 0; b.log.remembered.length = 0;
  b.mod.equipDeskItem(other, b.defs.plant, true);
  chk(b.log.select.length === 0 && b.log.remembered.length === 0, '다른 holder 는 선택 표시 · 처음 자리 기억을 안 한다');
  const n = build(SRC, { noOrigin: true, cBase: cb, defs: { plant: mkDef('plant') } });
  chk(n.mod.deskItemOrigin === null, '처음 자리 모듈이 없으면 deskItemOrigin 은 null');
  let threw = false; try{ n.mod.equipDeskItem(cb, n.defs.plant, true); }catch(_){ threw = true; }
  chk(!threw, '  없어도 장착은 된다');
}
say('§7 연결');
{
  const iE = HTML.indexOf('<script src="parts/character/desk-item-equip.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>'), iP = HTML.indexOf('<script src="parts/character/part-anim.js"></script>');
  chk(iE > 0 && iA > iE, 'html — desk-item-equip.js 를 app.js 보다 먼저 싣는다');
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  chk(/const deskItemEquipMod = TwDeskItemEquip\.createDeskItemEquip\(\{[\s\S]*?crState: \(\)=>crState,[\s\S]*?licenseAssetBlocked: \(\.\.\.a\)=>acctStateMod\.licenseAssetBlocked\(\.\.\.a\),[\s\S]*?\}\);/.test(code), 'app.js — 만들고 늦게 생기는 것 · 다시 대입되는 let(customItems …)은 읽는 함수로 · 전용 자산 막기는 account-state.js 판단(licenseAssetBlocked)으로 넘긴다');
  const names = ['applyDeskAdj', 'deskItemOrigin', 'equipDeskItem', 'collectDeskItems', 'autoSaveDeskItemsNow', 'applyDeskItemsTo', '_applyItemColor'];
  chk(names.every(n => new RegExp('^const ' + n + ' = deskItemEquipMod\\.' + n + ';', 'm').test(code)), '  옛 이름 일곱을 const 로 받는다');
  chk(!/function (equipDeskItem|collectDeskItems|autoSaveDeskItemsNow|applyDeskItemsTo|_applyItemColor|applyDeskAdj|_rememberCrItemOrigin)\b/.test(code), '  app.js 에 장착 함수가 남아 있지 않다');
  chk(code.indexOf('const partAnimMod') < code.indexOf('const deskItemEquipMod'), '  재생 목록(part-anim)을 만든 뒤에 만든다(activeItemMixers · _idleItemPivots 를 값으로 받는다)');
}
say('§8 mutation test');
{
  const brk = (from, to) => { const m = SRC.replace(from, to); return m === SRC ? null : m; };
  const m1 = brk('!(holder && holder.remote)', 'true');
  chk(!!m1 && (() => { const b = build(m1, { saved: [{ id: 'v', locked: true }] }); const h = mkHolder({ remote: true }); b.mod.equipDeskItem(h, mkDef('v', { licenseOnly: true }), true); return !h.deskItems; })(), '친구 좌석에도 라이선스를 걸면 빨강');
  const m2 = brk('holder._itemAdjMemory[def.id]=Object.assign({},cur.userData.adj);', '');
  chk(!!m2 && (() => { const b = build(m2); const h = mkHolder(); const d = mkDef('p'); b.mod.equipDeskItem(h, d, true); h.deskItems.p.userData.adj.x = 0.9; b.mod.equipDeskItem(h, d, false); b.mod.equipDeskItem(h, d, true); return !near(h.deskItems.p.userData.adj.x, 0.9); })(), '해제 전 위치를 기억하지 않으면 빨강');
  const m3 = brk('activeItemMixers.add(mixer);\n      } else if(playMode===\'idle\')', '} else if(playMode===\'idle\')');
  chk(!!m3 && (() => { const b = build(m3); const h = mkHolder(); b.mod.equipDeskItem(h, mkDef('a', { animations: [clip('i')], playMode: 'auto' }), true); return b.activeItemMixers.size === 0; })(), 'auto 아이템을 믹서 목록에 안 넣으면 빨강');
  const m4 = brk('const ITEM_Y_START_OFFSET = 1.1;', 'const ITEM_Y_START_OFFSET = 0;');
  chk(!!m4 && (() => { const b = build(m4, { saved: [{ id: 'c' }] }); const h = mkHolder(); b.mod.equipDeskItem(h, mkDef('c', { custom: true }), true); return !near(h.deskItems.c.userData.adj.y, 1.1); })(), '커스텀 높이 보정을 바꾸면 빨강');
  const m5 = brk('savedAdj.scale = p.userData.autoScale * userMul;', '');
  chk(!!m5 && (() => { const b = build(m5, { defs: { plant: mkDef('plant', { custom: true, defaultSize: 1 }) }, saved: [{ id: 'plant' }] }); const h = mkHolder(); b.mod.applyDeskItemsTo(h, { plant: { adj: { scale: 0.4 }, autoScale: 0.2 } }); const p = h.deskItems.plant; return !near(p.userData.adj.scale, p.userData.autoScale * 2); })(), '크기 비율 환산을 빼면 빨강');
  const m6 = brk('if(!crState().cBase || !crState().cBase.charDef) return;', '');
  chk(!!m6 && (() => { const b = build(m6); try{ b.mod.autoSaveDeskItemsNow(); }catch(_){ return true; } return b.log.saves > 0; })(), '생성기 캐릭터 없을 때 건너뛰기를 빼면 빨강');
}
say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);

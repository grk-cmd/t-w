/* ═══ 🧬 sim-char-apply.js — 캐릭터 def 를 좌석에 입히기(character/char-apply.js · app.js 분리 M12) ═══════════════
   [왜] applyCharToSeat 묶음을 모듈로 옮겼다. 동작은 그대로여야 한다.
   ・1절: 파츠 비우기 _purgeSeatParts · 리깅 파츠 xf 다시 굽기 refreshRiggedPartsXf
   ・2절: 동물 귀 등록 _registerAnimalEarOn(중복 · 본 없음 · 라이드 다시 잼) · window 고리(registerAnimalEar · rebuildAnimalSeats)
   ・3절: applyCharToSeat — 라이드 정리 · 책상 배율(동물 60%) · 평준화 지움 · 커미션 캐시 없음이면 파싱만 걸고 돌아감 · 인간 몸 · 동물 몸 · 기본 몸 폴백 · 크기 넣기(xf) · 클릭 판정
   ・4절: 연결 — html 순서 · 만드는 줄 · 옛 이름 · app.js 에 본문이 안 남음
   ・5절: 일부러 깨 보기
   [실행] 러너 스테이징 또는 저장소 루트에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('character/char-apply.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음 — char-apply.js · app.js · desk-companion-prototype.html'); process.exit(2); }

const quat = () => ({ cloned: true, clone(){ return { cloned: true }; } });
function mkSeat(o){
  return Object.assign({ desk: { userData: {} }, rig: { position: { z: 0 } }, deskMat: null, placeholder: { root: { visible: false, traverse(fn){ (this.meshes || []).forEach(fn); }, meshes: [] } },
    bodyWrap: { add(){}, remove(){} }, blink: { closed: true }, headAnchor: { position: { set(){} } }, bodyAnchor: { position: { set(){} } }, userData: {} }, o || {});
}
function build(src, o){
  o = o || {};
  const log = [];
  const win = { buildAnimalBase: o.noAnimal ? undefined : (o.animalBase === undefined ? () => null : () => o.animalBase) };
  const els = {};
  const doc = { getElementById: (id) => (id === 'launcher' ? { classList: { contains: () => !!o.launcherOn } } : (els[id] = els[id] || { value: null })) };
  const seats = o.seats || [];
  const state = { curSlot: 0, slots: o.slots || [], customItems: {}, baseAnims: ['A'] };
  const inst = o.inst === undefined ? { faceMat: {}, root: { userData: {} }, upMat: { color: { set(c){ log.push('up:' + c); } } }, loMat: { color: { set(c){ log.push('lo:' + c); } } } } : o.inst;
  const deps = {
    ANIMAL_RUN_SCALE: 0.6, DEFAULT_DESK_OVERRIDE_ID: 'defDesk',
    BASE_ANIMS: () => state.baseAnims, assetCodeMod: () => ({ parseGlbFull: async () => ({ scene: {}, animations: [] }), parseGlbBytes: async () => ({}) }),
    _attachHumanEars: (r, d) => log.push('humanEars'), _syncHumanEarRig: (s) => log.push('syncHumanEar'),
    applyDeskItemsTo: (s, items) => log.push('deskItems'), applyEquippedPartsToSeat: (s, d) => { log.push('parts'); return Promise.resolve(); }, applyPartXf: (s, c) => log.push('xf:' + c),
    b64ToBuf: (b) => b, clampCharY: (v) => Math.max(0, Math.min(0.6, +v || 0)),
    commSceneCache: new Map(o.commCache || []), compositeFace: (s, f) => 'cv', creatorPrevMod: { clearHolderDeskItems: (s) => log.push('clearHolder') },
    curSlot: () => state.curSlot, customItems: () => state.customItems, defToBase: (d) => { log.push('defToBase'); return o.base || { group: {}, root: {}, faceMat: {}, fT: 'f', bT: 'b' }; },
    deskItemsMod: () => ({ registerCustomItem(){} }),
    deskPlaceMod: () => ({ syncSeatDeskZ: (d) => log.push('syncZ'), setDeskScale: (d, s, l) => log.push('scale:' + s + ',' + l), setDeskPos: (d, p) => log.push('pos') }),
    deskVisualMod: () => ({ applyDeskCatalogRefToSeat: (s, d) => log.push('deskCatalog:' + (d.deskCatalogId || '')), swapDeskVisual(){} }),
    fitModel: (s) => log.push('fit'), getCommissionScene: (g) => { log.push('comm:' + g); return Promise.resolve(); },
    instantiateBase: (cs) => { log.push('inst'); return inst; }, lightToneMod: { _setDeskMatColor: (m, c) => log.push('deskColor') },
    matToneMod: { setFaceMap: (m, t) => log.push('faceMap'), applyLightPresetToInstance: (i) => log.push('tone') },
    mkFaceTex: (c) => 'tex', renderLauncher: () => log.push('renderLauncher'),
    rideBenchMod: { unmountRide: (s) => log.push('unmount:' + (s.name || '?')), _rideRiders: (s) => s.riders || [], _remeasureRideHeadTop: (s) => log.push('remeasure') },
    seatCharZ: (s) => 0.33, seatEqMod: { seatEqK: (s) => 1.5 }, seatModelLoadMod: { setupSeatModel: (s, r, a, n) => { log.push('setup'); s.bones = {}; } },
    seatRefitMod: { refitSeatAfterParts: (s, op) => { log.push('refit'); state.refit = op; } }, seats,
    seatsMod: { selected: () => o.selected || null }, slots: state.slots, unequipPartFromSeat: (s, c, inc) => { if(o.unequipThrows) throw new Error('x'); log.push('unequip:' + c); }, unequipStackablePart: (s, c, id) => log.push('unstack:' + c + ':' + id),
  };
  const THREE = {};
  const names = ['window', 'document', 'console', 'module'];
  new Function(...names, src)(win, doc, { log(){}, warn: (...a) => log.push('warn'), error(){} }, undefined);
  const mod = win.TwCharApply.createCharApply(deps);
  return { mod, log, win, state, deps, seats, doc, els };
}

say('§1 파츠 비우기 · 리깅 xf');
{
  const b = build(SRC);
  const s = mkSeat({ stackedPartObjs: { hat: { a: {}, b: {} } }, equippedPartObjs: { top: {}, bot: {} }, _equipSeq: { top: 1, hat: 5 } });
  b.mod._purgeSeatParts(s);
  chk(b.log.filter(l => l.startsWith('unstack:')).length === 2 && b.log.filter(l => l.startsWith('unequip:')).length === 2, '겹쳐 끼운 파츠 · 하나씩 끼운 파츠를 전부 뗀다');
  chk(JSON.stringify(s.equippedPartObjs) === '{}' && JSON.stringify(s.stackedPartObjs) === '{}' && s._equipSeq.top === 2 && s._equipSeq.hat === 6, '목록을 비우고 진행 중이던 낡은 장착을 무효화(_equipSeq +1)');
  const n = mkSeat({}); b.mod._purgeSeatParts(n);
  chk(JSON.stringify(n.equippedPartObjs) === '{}' && n._equipSeq === undefined, '파츠가 없던 좌석도 던지지 않는다');
  let th = false; const bt = build(SRC, { unequipThrows: true }); const st = mkSeat({ equippedPartObjs: { top: {} }, _equipSeq: { top: 1 } });
  try{ bt.mod._purgeSeatParts(st); }catch(_){ th = true; }
  chk(!th && JSON.stringify(st.equippedPartObjs) === '{}' && st._equipSeq.top === 2, '뗄 때 던져도 삼키고 정리는 끝까지(목록 비움 · 장착 무효화)');
  const r = build(SRC); r.mod.refreshRiggedPartsXf(null);
  chk(r.log.length === 0, 'refreshRiggedPartsXf — 좌석이 없으면 아무 일 없음');
  const s2 = mkSeat({ equippedPartObjs: { top: { userData: { rigged: true } }, bot: { userData: {} }, x: null }, stackedPartObjs: { hat: { a: { userData: { rigged: true } } }, belt: { a: { userData: {} } } } });
  r.mod.refreshRiggedPartsXf(s2);
  chk(JSON.stringify(r.log) === '["xf:top","xf:hat"]', '리깅된 파츠가 있는 분류만 xf 를 다시 굽는다(겹침 분류는 하나라도 리깅이면)');
}
say('§2 동물 귀 · window 고리');
{
  const b = build(SRC);
  const w = { quaternion: quat() };
  const s = mkSeat({ bones: {} });
  b.mod._registerAnimalEarOn(s, w);
  chk(s.bones.ear.length === 1 && s.boneRest.ear.length === 1 && s.earTimers === null && b.log.includes('remeasure'), '귀를 등록하고 기준 자세를 적고 타이머를 비우고 올라탄 좌석 머리 높이를 다시 잰다');
  b.log.length = 0; b.mod._registerAnimalEarOn(s, w);
  chk(s.bones.ear.length === 1 && b.log.length === 0, '같은 귀를 또 등록하지 않는다(재빌드 · 스윕 중복)');
  b.mod._registerAnimalEarOn(mkSeat({}), w); b.mod._registerAnimalEarOn(null, w); b.mod._registerAnimalEarOn(s, null);
  chk(b.log.length === 0, '본이 없거나 좌석 · 귀가 없으면 아무 일 없음');
  chk(typeof b.win.registerAnimalEar === 'function' && typeof b.win.rebuildAnimalSeats === 'function', '★ window.registerAnimalEar · window.rebuildAnimalSeats 고리를 만들 때 건다(animal.js 가 window. 로 부른다)');
  const s3 = mkSeat({ bones: {} }); const root = { userData: { __animalSeat: s3 } };
  b.win.registerAnimalEar(root, { quaternion: quat() });
  chk(s3.bones.ear.length === 1, 'registerAnimalEar — 뿌리의 역참조 좌석에 등록');
  let th = false; try{ b.win.registerAnimalEar(null, {}); b.win.registerAnimalEar({ userData: {} }, {}); }catch(_){ th = true; }
  chk(!th, '  역참조가 없으면 조용히');
  const a1 = mkSeat({ charDef: { animal: true } }), h1 = mkSeat({ charDef: {} }), n1 = mkSeat({});
  const rb = build(SRC, { seats: [a1, h1, n1, null], launcherOn: true, slots: [{ animal: true }] });
  rb.win.rebuildAnimalSeats();
  chk(rb.log.includes('renderLauncher') && rb.log.includes('inst') && rb.log.filter(l => l === 'inst').length === 1, 'rebuildAnimalSeats — 동물 좌석만 다시 입히고(1명) 런처가 열려 있고 슬롯이 동물이면 런처도 다시 그린다');
  const rb2 = build(SRC, { seats: [a1], launcherOn: false, slots: [{ animal: true }] }); rb2.win.rebuildAnimalSeats();
  chk(!rb2.log.includes('renderLauncher'), '  런처가 닫혀 있으면 안 그린다');
  const rb3 = build(SRC, { seats: [a1], launcherOn: true, slots: [{}] }); rb3.win.rebuildAnimalSeats();
  chk(!rb3.log.includes('renderLauncher'), '  슬롯이 동물이 아니면 안 그린다');
}
say('§3 applyCharToSeat');
{
  const def = { skin: 0, face: 'f', blink: 'b', top: '#111', bot: '#222', xf: { s: 1.3, y: 9, rot: 2, x: 0.4 }, deskScale: 1.2, deskLenX: 1.1 };
  let b = build(SRC); let s = mkSeat({ name: 'me', ridingOn: {}, riders: [{ name: 'up1' }, { name: 'up2' }] });
  b.seats.push(s);
  b.mod.applyCharToSeat(s, def);
  chk(b.log.slice(0, 3).join() === 'unmount:me,unmount:up1,unmount:up2', '★ 라이드 정리 — 내가 탄 것을 먼저 내리고 내 위에 탄 좌석들도 내린다');
  chk(s.charDef === def && s.desk.userData.animCorr === 1 && s.desk.userData.eqK === 1.5 && s.rig.position.z === 0.33 && b.log.includes('syncZ'), 'def 를 넣고 책상 배율(사람 1) · 평준화 k · 캐릭터 z · 책상 z 맞춤');
  chk(s.userScale === 1.3 && s.userY === 0.6 && s.userZ === 0 && s.userRot === 2 && s.userX === 0.4, 'xf 를 넣는다 — 높이는 상한(0.6) · 앞뒤는 0 으로 폐기');
  chk(b.log.includes('inst') && b.log.includes('faceMap') && b.log.includes('tone') && b.log.includes('humanEars') && b.log.includes('setup') && b.log.includes('syncHumanEar') && b.log.includes('fit') && b.log.includes('refit'), '인간 몸 — 조립 · 얼굴 · 옷색 · 톤 · 사람 귀 · 애니메이션 · 맞춤 · 파츠 뒤 재맞춤');
  chk(b.log.includes('up:#111') && b.log.includes('lo:#222'), '  옷색을 입힌다');
  chk(s._animalBuilt === false && s.blink.closed === false, '  동물로 조립됐는지 표시(false) · 눈 뜸으로 시작');
  chk(b.state.refit.layout === true && b.state.refit.isCurrent() === true && (s.charDef = {}, b.state.refit.isCurrent() === false), '  파츠 뒤 재맞춤은 같은 def 일 때만(낡은 좌석 방어)');
  chk(b.log.includes('scale:1.2,1.1') && b.log.includes('pos') && b.log.includes('deskCatalog:defDesk'), '책상 크기 · 위치 · 기본 책상 카탈로그 적용(비동기)');
  // 동물
  b = build(SRC, { animalBase: { _animal: true, faceMat: {}, root: { userData: {} }, fT: 'aF', bT: 'aB' } }); s = mkSeat({ bones: undefined }); const ad = { animal: true, top: '#1', bot: '#2' };
  b.mod.applyCharToSeat(s, ad);
  chk(s.desk.userData.animCorr === 0.6 && s._animalBuilt === true && !b.log.includes('humanEars') && s.blinkTex === 'aB', '동물 — 책상 60% · 동물로 조립 표시 · 사람 귀 안 올림 · 동물이 준 텍스처');
  chk(s.userScale === 1 && s.userRot === 0 && s.userX === 0.1, '  xf 가 없으면 크기 1 · 회전 0 · x 0.1');
  // 동물인데 GLB 파싱 전 → 인간 폴백
  b = build(SRC, { animalBase: null }); s = mkSeat({}); b.mod.applyCharToSeat(s, { animal: true });
  chk(b.log.includes('inst') && s._animalBuilt === false, '동물 GLB 가 아직 없으면(null) 인간 몸으로 폴백 · 동물 표시 false(직전 캐릭터 판정을 안 남긴다)');
  // 커미션 캐시 없음
  b = build(SRC); s = mkSeat({}); b.mod.applyCharToSeat(s, { commGlb: 'G1' });
  chk(b.log.includes('comm:G1') && !b.log.includes('inst') && !b.log.includes('fit') && b.log.includes('syncZ'), '★ 커미션 GLB 가 캐시에 없으면 파싱만 걸고 돌아간다 — 그 앞에서 책상 z 는 맞춰 둔다');
  b = build(SRC, { commCache: [['G1', {}]] }); s = mkSeat({}); b.mod.applyCharToSeat(s, { commGlb: 'G1', isCommission: true });
  chk(b.log.includes('inst') && !b.log.includes('up:undefined') && !b.log.some(l => l.startsWith('up:')), '커미션 캐시가 있으면 조립하고 옷색은 안 입힌다(텍스처 기반)');
  // 기본 몸 폴백
  b = build(SRC, { inst: null }); s = mkSeat({ gltfRoot: {}, bodyWrap: { remove(){ b.log.push('remove'); }, add(){ b.log.push('add'); } } });
  b.mod.applyCharToSeat(s, { xf: { s: 2, y: 0.1, rot: 1 } });
  chk(b.log.includes('defToBase') && b.log.includes('remove') && b.log.includes('add') && s.isPlaceholder === false && s.hasRig === false && s.placeholder.root.visible === false && s.userScale === 2 && b.log.includes('fit'), '몸을 못 만들면 기본 캐릭터로 폴백 — 옛 몸을 떼고 새로 붙이고 크기 넣기');
  chk(s.blink.closed === false, '  폴백도 눈 뜸으로 시작');
  // 선택된 좌석이면 슬라이더 값 채움
  { const me = mkSeat({}); b = build(SRC, { selected: me }); b.mod.applyCharToSeat(me, { xf: { s: 1.4, y: 0.2, rot: 3 } });
    chk(b.els.sScale.value === 1.4 && b.els.sY.value === 0.2 && b.els.sZ.value === 0 && b.els.sRot.value === 3, '고른 좌석이면 크기 · 높이 · 앞뒤 · 회전 슬라이더 값을 채운다');
    const other = mkSeat({}); b = build(SRC, { selected: mkSeat({}) }); b.mod.applyCharToSeat(other, { xf: { s: 1.4 } });
    chk(b.els.sScale === undefined, '  고른 좌석이 아니면 슬라이더를 안 건드린다'); }
  // 클릭 판정
  const meshA = { isMesh: true, userData: {}, raycast: function(){ return 'orig'; } };
  b = build(SRC, { animalBase: { _animal: true, faceMat: {}, root: { userData: {} }, fT: 'f', bT: 'b' } }); s = mkSeat({}); s.placeholder.root.meshes = [meshA]; s.placeholder.root.visible = false;
  b.mod.applyCharToSeat(s, { animal: true });
  chk(meshA.userData.__origRaycast && meshA.raycast() === undefined, '동물 + 숨은 placeholder 는 클릭 판정에서 뺀다(raycast 비움 · 원본 보관)');
  s.placeholder.root.visible = false; b.mod.applyCharToSeat(s, {});
  chk(meshA.userData.__origRaycast === undefined && meshA.raycast() === 'orig', '  인간으로 바뀌면 원본 raycast 를 되돌린다');
}
say('§4 연결');
{
  const iC = HTML.indexOf('<script src="parts/character/char-apply.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iC > 0 && iA > iC, 'html — char-apply.js 를 app.js 보다 먼저 싣는다');
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  chk(/const charApplyMod = TwCharApply\.createCharApply\(\{[\s\S]*?slots: slots,[\s\S]*?\}\);/.test(code), 'app.js — 만든다');
  chk(['_purgeSeatParts', 'refreshRiggedPartsXf', '_registerAnimalEarOn', 'applyCharToSeat'].every(n => new RegExp('^const ' + n + ' = charApplyMod\\.' + n + ';', 'm').test(code)), '  옛 이름 넷을 const 로 받는다');
  chk(!/function (applyCharToSeat|_purgeSeatParts|refreshRiggedPartsXf|_setPlaceholderPickable|_registerAnimalEarOn|_sweepAnimalEars)\b|window\.(rebuildAnimalSeats|registerAnimalEar)\s*=/.test(code), '  app.js 에 본문 · window 고리를 거는 줄이 안 남음(모듈이 건다)');
  const AN = read('character/animal.js') || '';
  chk(/window\.rebuildAnimalSeats\(\)/.test(AN) && /window\.registerAnimalEar\(/.test(AN), '  그 고리를 부르는 쪽(animal.js)이 그대로 있다');
}
say('§5 일부러 깨 보기');
{
  const brk = (from, to) => { const m = SRC.replace(from, to); return m === SRC ? null : m; };
  const m1 = brk("if(rideBenchMod._rideRiders(seat).length){", "if(false){");
  chk(!!m1 && (() => { const b = build(m1); const s = mkSeat({ name: 'me', riders: [{ name: 'u' }] }); b.mod.applyCharToSeat(s, {}); return !b.log.includes('unmount:u'); })(), '내 위에 탄 좌석 정리를 빼면 빨강');
  const m2 = brk("_purgeSeatParts(seat);   // ★ 리빌드 전 옛 파츠·진행 중 장착 정리 (유령 파츠 방지)", "");
  chk(!!m2 && (() => { const b = build(m2); const s = mkSeat({ equippedPartObjs: { top: {} } }); b.mod.applyCharToSeat(s, {}); return s.equippedPartObjs && s.equippedPartObjs.top !== undefined; })(), '입히기 전 파츠 정리를 빼면 빨강');
  const m3 = brk("seat._animalBuilt = !!inst._animal;", "");
  chk(!!m3 && (() => { const b = build(m3); const s = mkSeat({ _animalBuilt: true }); b.mod.applyCharToSeat(s, {}); return s._animalBuilt === true; })(), '동물 표시를 갱신하지 않으면 빨강(직전 판정이 남는다)');
  const m4 = brk("      return;\n    }\n  }\n  // 🐾 동물 캐릭터", "    }\n  }\n  // 🐾 동물 캐릭터");
  chk(!!m4 && (() => { const b = build(m4); b.mod.applyCharToSeat(mkSeat({}), { commGlb: 'G1' }); return b.log.includes('inst'); })(), '커미션 캐시 없음에서 돌아가지 않으면 빨강');
  const m5 = brk("if(seat.bones.ear.indexOf(wrap)>=0) return;", "");
  chk(!!m5 && (() => { const b = build(m5); const s = mkSeat({ bones: {} }); const w = { quaternion: quat() }; b.mod._registerAnimalEarOn(s, w); b.mod._registerAnimalEarOn(s, w); return s.bones.ear.length === 2; })(), '귀 중복 등록 방지를 빼면 빨강');
  const m6 = brk("window.rebuildAnimalSeats=function(){", "window.rebuildAnimalSeatsX=function(){");
  chk(!!m6 && build(m6).win.rebuildAnimalSeats === undefined, 'window.rebuildAnimalSeats 고리를 빼면 빨강');
  const m7 = brk("seat.userY=clampCharY(xf.y);", "seat.userY=xf.y;");
  chk(!!m7 && (() => { const b = build(m7); const s = mkSeat({}); b.mod.applyCharToSeat(s, { xf: { y: 9 } }); return s.userY === 9; })(), '높이 상한을 빼면 빨강');
}
say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);

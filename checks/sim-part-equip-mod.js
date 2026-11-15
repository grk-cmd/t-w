/* ═══ 🎀 sim-part-equip-mod.js — 파츠 붙이기 · 떼기 · def 대조(character/part-equip.js · app.js 분리 T6) ═══════════════
   [왜] app.js «WARDROBE PARTS» 의 장착 · 해제 · 대조를 0.13 글 그대로 모듈로 옮겼다. 복제 · 재질 · 리깅 판정은 코어 호출이고 좌석 몫이 여기 남는다.
   ・1절: 만들 때 던지지 않고 아홉 이름을 내놓는다 · extractBonesInto(본 찾기 · 좌우 · 귀)
   ・2절: 떼기 — 비동기 장착 무효화(번호 올리기) · 해제 순서(무효화 → 지우기 → 유령 청소 → 다시 맞추기) · stackable 한 개만 · 다시 맞추기가 던져도 삼킴
   ・3절: 유령 wrapper 청소 · def 대조(pruneSeatPartsAgainstDef — 조회 실패는 유지, stackable 은 id 단위)
   ・4절: 장착 입구 — 카테고리 정보 없으면 세션당 1회 경고 · applyEquippedPartsToSeat 뒷정리(가시성 · _lastOp) · 조회 실패 경고
   ・5절: 연결(html 순서 · 만드는 줄 · 옛 이름 아홉 · 본문 안 남음 · #830 두 줄) · 6절: 일부러 깨 보기
   [실행] 러너 스테이징 또는 저장소 루트에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('character/part-equip.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음 — part-equip.js · app.js · desk-companion-prototype.html'); process.exit(2); }
const EXPORTS = ['extractBonesInto', 'equipPartOnSeat', 'unequipPartFromSeat', 'unequipStackablePart', 'pruneSeatPartsAgainstDef', 'applyEquippedPartsToSeat', '_invalidatePendingEquip', '_disposeWrapperFromSeat', '_sweepOrphanPartWrappers'];

function build(src, o){
  o = o || {};
  const log = { teardown: [], refit: [], vis: [], warn: [] };
  const recs = o.recs || [];
  const premiumMod = {
    partCatInfo: (cat) => (o.noInfo ? null : { group: 'misc' }),
    entriesForCat: (def, cat) => { const v = def && def.equippedParts && def.equippedParts[cat]; return v == null ? [] : (Array.isArray(v) ? v : [v]); },
    partEntryId: (e) => e.id, savedParts: () => recs, partEntryXf: (e) => e.xf, getRecHides: () => null, isDeskPartCat: () => false,
  };
  const fn = (name) => (...a) => { (log[name] = log[name] || []).push(a); };
  const win = {};
  const w = console.warn; console.warn = (m) => log.warn.push(m);
  new Function('window', 'module', src)(win, undefined);
  const mod = win.TwPartEquip.createPartEquip({
    premiumMod, rideBenchMod: {}, seatRefitMod: { requestRefit: (s) => { if(o.refitThrows) throw new Error('x'); log.refit.push(s); } }, skelShare: {}, partsCore: {},
    partSceneMod: () => ({}), boneSide: (n) => (/_l|left/.test(n) ? 'l' : /_r|right/.test(n) ? 'r' : ''), _diagRiggedPartAlignment: () => {},
    _applyXfToWrapper: () => {}, _computeAnimalHeadDy: () => 0, _computePartAuthorOffset: () => null, _diagPartHeadSpace: () => {}, applyPartXf: () => {},
    _unequipClothCat: () => {}, applyClothVisibility: (s) => log.vis.push(s),
    _clipHasMotion: () => false, _partAnimNotice: () => {}, _pickPartClip: () => null, _setupPartIdleAnim: () => {}, _stripPartClipOwnedTracks: () => {},
    _teardownPartIdleAnim: (o2) => log.teardown.push(o2),
  });
  return { mod, log, restore: () => { console.warn = w; } };
}
const node = (name, kids, ud) => { const n = { name, children: kids || [], userData: ud || {}, parent: null, remove(c){ const i = this.children.indexOf(c); if(i >= 0) this.children.splice(i, 1); c.parent = null; } }; n.children.forEach((c) => { c.parent = n; }); return n; };

say('§1 만들기 · 본 찾기');
{
  const t = build(SRC);
  chk(EXPORTS.every((n) => typeof t.mod[n] === 'function') && Object.keys(t.mod).length === EXPORTS.length, '아홉 이름을 내놓는다');
  const bones = [{ isBone: true, name: 'Spine1' }, { isBone: true, name: 'Head' }, { isBone: true, name: 'arm_L' }, { isBone: true, name: 'arm_R' }, { isBone: true, name: 'leg_l' }, { isBone: true, name: 'ear_L' }, { isBone: false, name: 'x' }];
  const target = {}; t.mod.extractBonesInto(target, { traverse: (f) => bones.forEach(f) });
  chk(target.bones.spine === bones[0] && target.bones.head === bones[1] && target.bones.handL === bones[2] && target.bones.handR === bones[3] && target.bones.legL === bones[4] && target.bones.ear.length === 1 && target.equippedPartObjs, '본 — 등뼈 · 머리 · 좌우 손 · 다리 · 귀 · 장착 칸을 만든다');
  t.restore();
}
say('§2 떼기');
{
  const t = build(SRC);
  const seat = { _equipSeq: { hat: 1, 'hat:a': 5, 'cape': 2 } };
  t.mod._invalidatePendingEquip(seat, 'hat', 'a'); chk(seat._equipSeq['hat:a'] === 6 && seat._equipSeq.hat === 1, 'id 를 주면 그 키만 올린다');
  t.mod._invalidatePendingEquip(seat, 'hat'); chk(seat._equipSeq.hat === 2 && seat._equipSeq['hat:a'] === 7 && seat._equipSeq.cape === 2, 'id 가 없으면 일반 키 + stackable 키(그 카테고리만)');
  t.mod._invalidatePendingEquip(seat, 'hat', null, false); chk(seat._equipSeq.hat === 3 && seat._equipSeq['hat:a'] === 7, 'includeStackable=false 면 일반 키만');
  let th = false; try{ t.mod._invalidatePendingEquip(null, 'x'); t.mod._invalidatePendingEquip({}, 'x'); t.mod._invalidatePendingEquip({ _equipSeq: {} }, ''); }catch(_){ th = true; }
  chk(!th, '좌석 · 번호표 · 카테고리가 없으면 아무 일도 안 한다');
  const wrap = node('__partWrap_hat', [], { __twPartWrap: true, adoptedBones: [], multiExtras: [] });
  const grp = node('g', [wrap]); const s2 = { group: grp, _equipSeq: { hat: 0 }, equippedPartObjs: { hat: wrap } };
  t.log.refit.length = 0;
  t.mod.unequipPartFromSeat(s2, 'hat');
  chk(s2.equippedPartObjs.hat === undefined && wrap.parent === null && grp.children.length === 0, '장착 파츠를 지우고 씬에서 뗀다');
  chk(s2._equipSeq.hat === 1, '★ 늦게 도착한 장착을 막으려고 번호를 먼저 올린다');
  chk(t.log.refit.length === 1, '뗀 것이 있으면 다음 프레임 다시 맞추기를 요청한다');
  chk(t.log.teardown.length >= 1, '반복 재생 믹서를 정리한다');
  t.log.refit.length = 0; t.mod.unequipPartFromSeat({ group: node('g'), _equipSeq: {} }, 'hat'); chk(t.log.refit.length === 0, '뗄 게 없으면 다시 맞추기 없음');
  const st = node('__partWrap_hat_i', [], { __twPartWrap: true }); const keep = node('k', [], { __twPartWrap: true });
  const s3 = { group: node('g', [st, keep]), _equipSeq: {}, stackedPartObjs: { hat: { a: st, b: keep } } };
  t.mod.unequipStackablePart(s3, 'hat', 'a');
  chk(s3.stackedPartObjs.hat.a === undefined && s3.stackedPartObjs.hat.b === keep && s3._equipSeq['hat:a'] === 1, 'stackable 은 그 id 만 뗀다(다른 것은 유지)');
  t.mod.unequipStackablePart(s3, 'hat', 'b'); chk(s3.stackedPartObjs.hat === undefined, '마지막을 떼면 그 카테고리 칸도 지운다');
  const t2 = build(SRC, { refitThrows: true }); let th2 = false;
  try{ t2.mod.unequipPartFromSeat({ group: node('g'), equippedPartObjs: { hat: node('w') }, _equipSeq: {} }, 'hat'); }catch(_){ th2 = true; }
  chk(!th2, '다시 맞추기가 던져도 떼기는 끝난다'); t2.restore();
  t.restore();
}
say('§3 유령 청소 · def 대조');
{
  const t = build(SRC);
  const live = node('live', [], { __twPartWrap: true }), ghost = node('ghost', [], { __twPartWrap: true }), ear = node('ear', [], {});
  const seat = { group: node('g', [live, ghost, ear]), equippedPartObjs: { hat: live } };
  t.mod._sweepOrphanPartWrappers(seat);
  chk(seat.group.children.includes(live) && !seat.group.children.includes(ghost) && seat.group.children.includes(ear), '등록 안 된 파츠 wrapper(__twPartWrap)만 지운다 · 귀 같은 다른 것은 그대로');
  const t2 = build(SRC, { recs: [{ id: 'n1', cat: 'hat', stackable: false }, { id: 's1', cat: 'hat', stackable: true }] });
  const w1 = node('w1', [], { __twPartWrap: true }), w2 = node('w2', [], { __twPartWrap: true }), w3 = node('w3', [], { __twPartWrap: true });
  const s2 = { group: node('g', [w1, w2, w3]), _equipSeq: {}, equippedPartObjs: { hat: w1, cape: w3 }, stackedPartObjs: { hat: { s1: w2, gone: w3 } } };
  t2.mod.pruneSeatPartsAgainstDef(s2, { equippedParts: { hat: [{ id: 'n1' }, { id: 's1' }] } });
  chk(s2.equippedPartObjs.hat === w1, '일반 파츠가 def 에 있으면 유지');
  chk(s2.equippedPartObjs.cape === undefined, 'def 에 없는 카테고리는 해제');
  chk(s2.stackedPartObjs.hat.s1 === w2 && s2.stackedPartObjs.hat.gone === undefined, 'stackable 은 def 에 없는 id 만 개별 해제');
  const t3 = build(SRC, { recs: [] });
  const w4 = node('w4', [], { __twPartWrap: true }); const s3 = { group: node('g', [w4]), _equipSeq: {}, equippedPartObjs: { hat: w4 } };
  t3.mod.pruneSeatPartsAgainstDef(s3, { equippedParts: { hat: [{ id: 'n1' }] } });
  chk(s3.equippedPartObjs.hat === w4, '★ 파츠 정보 조회가 실패하면 «일반 파츠 없음» 으로 보지 않고 유지(착용 파츠 증발 사고)');
  let th = false; try{ t3.mod.pruneSeatPartsAgainstDef(null, {}); }catch(_){ th = true; } chk(!th, '좌석이 없으면 아무 일도 안 한다');
  [t, t2, t3].forEach((x) => x.restore());
}
say('§4 장착 입구 · 일괄');
(async () => {
  {
    const t = build(SRC, { noInfo: true });
    const seat = {}; await t.mod.equipPartOnSeat(seat, 'zz', { id: 'q' }); await t.mod.equipPartOnSeat(seat, 'zz', { id: 'q' });
    chk(seat.equippedPartObjs && t.log.warn.length === 1 && /카테고리 정보를 못 찾아/.test(t.log.warn[0]), '카테고리 정보가 없으면 아무것도 안 붙이고 경고는 세션당 1회');
    chk((await t.mod.equipPartOnSeat(null, 'zz', {})) === undefined, '좌석이 없으면 돌아간다');
    t.restore();
  }
  {
    const t = build(SRC, { recs: [] });
    const seat = { _lastOp: 5 };
    await t.mod.applyEquippedPartsToSeat(seat, { equippedParts: { hat: [{ id: 'nope' }] } });
    chk(t.log.vis[0] === seat && seat._lastOp === null, '모두 반영 뒤 가시성을 맞추고 _lastOp 를 다시 무장한다');
    chk(t.log.warn.length === 1 && /파츠 정보를 못 찾아/.test(t.log.warn[0]), '조회 실패는 조용히 넘기지 않고 1회 경고');
    const s2 = { _lastOp: 3 }; await t.mod.applyEquippedPartsToSeat(s2, null);
    chk(s2._lastOp === null && t.log.vis[1] === s2, '꾸미기 파츠가 하나도 없어도 뒷정리는 한다(자리비움 풀림 사고)');
    chk((await t.mod.applyEquippedPartsToSeat(null, {})) === undefined, '좌석이 없으면 돌아간다');
    t.restore();
  }
  say('§5 연결');
  {
    const iO = HTML.indexOf('<script src="parts/character/part-equip.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
    chk(iO > 0 && iA > iO, 'html — part-equip.js 를 app.js 보다 먼저 싣는다');
    const code = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
    const mk = (code.match(/const partEquipMod = TwPartEquip\.createPartEquip\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
    chk(mk.split('\n').filter((l) => l.trim()).length === 21, 'app.js — 만드는 줄 deps 스물하나');
    chk(/partSceneMod: \(\)=>partSceneMod,/.test(mk), '  뒤에서 만들어지는 partSceneMod 는 읽는 함수');
    chk(EXPORTS.every((n) => new RegExp('^const ' + n + ' = partEquipMod\\.' + n + ';', 'm').test(APP)), '  옛 이름 const 아홉');
    chk(!/function (extractBonesInto|equipPartOnSeat|unequipPartFromSeat|unequipStackablePart|pruneSeatPartsAgainstDef|applyEquippedPartsToSeat|_invalidatePendingEquip|_disposeWrapperFromSeat|_sweepOrphanPartWrappers|_refitAfterUnequip|_equipWarnOnce)\b/.test(code), '  app.js 에 본문이 안 남음');
    chk((SRC.match(/skelShare\.shareSkeletons\(/g) || []).length === 2, '★ 같은 뼈대 한 벌(#830) 두 줄(본체 · 다중 파츠 사본)이 그대로 있다');
  }
  say('§6 일부러 깨 보기');
  {
    const brk = (from, to) => { const m = SRC.replace(from, to); return m === SRC ? null : m; };
    const m1 = brk("  _invalidatePendingEquip(seat, cat, null, includeStackable);\n", '');
    chk(!!m1 && (() => { const t = build(m1); const s = { group: node('g'), _equipSeq: { hat: 0 } }; t.mod.unequipPartFromSeat(s, 'hat'); t.restore(); return s._equipSeq.hat === 0; })(), '해제 때 무효화를 빼면 빨강');
    const m2 = brk("if(!rec) return true;   // 조회 실패 = 장착 유지", "if(!rec) return false;");
    chk(!!m2 && (() => { const t = build(m2, { recs: [] }); const w = node('w', [], { __twPartWrap: true }); const s = { group: node('g', [w]), _equipSeq: {}, equippedPartObjs: { hat: w } }; t.mod.pruneSeatPartsAgainstDef(s, { equippedParts: { hat: [{ id: 'n' }] } }); t.restore(); return s.equippedPartObjs.hat === undefined; })(), '조회 실패를 «없음» 으로 보면 빨강');
    const m3 = brk("seat._lastOp = null;\n}", "}");
    chk(!!m3 && await (async () => { const t = build(m3); const s = { _lastOp: 1 }; await t.mod.applyEquippedPartsToSeat(s, null); t.restore(); return s._lastOp === 1; })(), '_lastOp 재무장을 빼면 빨강');
    const m4 = brk("if(_equipWarnSeen.has(key)) return;", '');
    chk(!!m4 && await (async () => { const t = build(m4, { noInfo: true }); const s = {}; await t.mod.equipPartOnSeat(s, 'zz', {}); await t.mod.equipPartOnSeat(s, 'zz', {}); t.restore(); return t.log.warn.length === 2; })(), '경고 1회 제한을 빼면 빨강');
    const m5 = brk("if(!live.has(node)) orphans.push(node);", "orphans.push(node);");
    chk(!!m5 && (() => { const t = build(m5); const l = node('l', [], { __twPartWrap: true }); const s = { group: node('g', [l]), equippedPartObjs: { hat: l } }; t.mod._sweepOrphanPartWrappers(s); t.restore(); return !s.group.children.includes(l); })(), '등록된 wrapper 까지 지우면 빨강');
  }
  say('');
  say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})();

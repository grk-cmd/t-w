/* ═══ 🎀 sim-part-xf.js — 파츠 저작 오프셋 · xf 적용(character/part-xf.js · app.js 분리 T5) ═══════════════
   [왜] app.js 의 저작 오프셋 · xf 적용 구역을 0.13 글 그대로 모듈로 옮겼다. 계산 본문은 코어(createParts)이고 여기는 옛 이름 잇기 + applyPartXf 순서다.
   ・1절: 옛 이름 → 코어 호출(인자 그대로 · 기본 오프셋 표를 같이 넘김) · 그림칸은 wrapper 에 그림칸이 있을 때만
   ・2절: applyPartXf — 본체 wrapper 와 다중 파츠 extras 에 인스턴스 xf 를 차례로(모자란 칸은 기본값) · stackable 은 id 별 · 책상 위 파츠는 바닥 맞춤
   ・3절: 연결(html 순서 · 만드는 줄 · 옛 이름 const 여섯 · 본문이 안 남음) · 4절: 일부러 깨 보기
   [실행] 러너 스테이징 또는 저장소 루트에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('character/part-xf.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음 — part-xf.js · app.js · desk-companion-prototype.html'); process.exit(2); }

function build(src, o){
  o = o || {};
  const log = { core: [], xf: [], lift: [], pic: [] };
  const partsCore = {
    charBoneBindInverses: (...a) => { log.core.push(['inv', a]); return 'INV'; },
    computeAuthorOffset: (...a) => { log.core.push(['off', a]); return 'OFF'; },
    isLegacyAuthorCompensation: (...a) => { log.core.push(['legacy', a]); return 'LEG'; },
    applyXfToWrapper: (w, xf, cat, opt) => { log.xf.push([w, xf, cat]); log.opt = opt; },
  };
  const DEF = { hat: { y: 1 } };
  const premiumMod = {
    defaultPartXf: () => 'DEFXF',
    partEntryInstances: (e) => e.inst || [],
    findEntryById: (def, cat, id) => (def.entries[cat] || []).find((e) => e.id === id) || null,
    firstEntryForCat: (def, cat) => (def.entries[cat] || [])[0] || null,
    entriesForCat: (def, cat) => def.entries[cat] || [],
    partEntryId: (e) => e.id,
    partCatInfo: (cat) => (o.catInfo === undefined ? { desk: cat === 'deskpart' } : o.catInfo),
    isDeskPartCat: (i) => !!(i && i.desk),
  };
  const partPaintMod = { wrapperHasPic: (w) => !!w.hasPic, applyPartPic: (w, p) => log.pic.push([w, p]) };
  const charMeasureMod = { floorClampWrapper: (w, cat) => { if(o.liftThrows) throw new Error('x'); log.lift.push([w, cat]); } };
  const win = {};
  new Function('window', 'module', src)(win, undefined);
  const mod = win.TwPartXf.createPartXf({ partsCore, PART_DEFAULT_OFFSET: DEF, premiumMod, partPaintMod, lightToneMod: {}, bodyMeasureMod: {}, charMeasureMod, instantiateBase: () => null });
  return { mod, log, DEF };
}
const wrp = (id, extras, hasPic) => ({ userData: { baseCenter: {}, partId: id, multiExtras: extras || [] }, hasPic });

say('§1 옛 이름 → 코어');
{
  const { mod, log, DEF } = build(SRC);
  chk(mod._charBoneBindInverses('root') === 'INV' && log.core[0][1][0] === 'root', '_charBoneBindInverses → 코어 charBoneBindInverses');
  chk(mod._computePartAuthorOffset('bb', 'c', 'bone', 'root', 'hat', 'cb') === 'OFF' && log.core[1][1].join() === ['bb', 'c', 'bone', 'root', 'hat', 'cb', DEF].join() && log.core[1][1][6] === DEF, '_computePartAuthorOffset → 코어 computeAuthorOffset(기본 오프셋 표를 끝에 넘김)');
  chk(mod._isLegacyAuthorCompensation('p', 'a') === 'LEG' && log.core[2][1].join() === 'p,a', '_isLegacyAuthorCompensation → 코어');
  const w = wrp('a'); mod._applyXfToWrapper(w, 'XF', 'hat');
  chk(log.xf[0][0] === w && log.xf[0][1] === 'XF' && log.xf[0][2] === 'hat' && log.opt.defaultOffsets === DEF && log.opt.defaultXf() === 'DEFXF', '_applyXfToWrapper → 코어 applyXfToWrapper(기본 xf · 기본 오프셋)');
  log.opt.applyPic(wrp('a', [], true), 'URL'); log.opt.applyPic(wrp('b', [], false), 'URL2');
  chk(log.pic.length === 1 && log.pic[0][1] === 'URL', '그림칸은 wrapper 에 그림칸이 있을 때만 얹는다');
}
say('§2 applyPartXf');
{
  const t = build(SRC);
  let th = false; try{ t.mod.applyPartXf(null, 'hat'); t.mod.applyPartXf({}, 'hat'); }catch(_){ th = true; }
  chk(!th && t.log.xf.length === 0, 'seat · def 가 없으면 아무 일도 안 한다');
  const ex1 = wrp('x1'), ex2 = wrp('x2'), main = wrp('m', [ex1, ex2]);
  const seat = { charDef: { entries: { hat: [{ id: 'm', inst: ['I0', 'I1'] }] } }, equippedPartObjs: { hat: main } };
  const t2 = build(SRC); t2.mod.applyPartXf(seat, 'hat');
  chk(t2.log.xf.map((x) => x[1]).join() === 'I0,I1,DEFXF', '본체는 인스턴스 0 · extras 는 1 · 모자란 칸은 기본 xf');
  const seat2 = { charDef: { entries: { hat: [{ id: 'zz', inst: ['F0'] }] } }, equippedPartObjs: { hat: main } };
  const t3 = build(SRC); t3.mod.applyPartXf(seat2, 'hat');
  chk(t3.log.xf[0][1] === 'F0', 'partId 로 못 찾으면 그 카테고리 첫 entry');
  const noBase = { userData: {} }; const t4 = build(SRC);
  t4.mod.applyPartXf({ charDef: { entries: { hat: [{ id: 'm', inst: ['I0'] }] } }, equippedPartObjs: { hat: noBase } }, 'hat');
  chk(t4.log.xf.length === 0, 'baseCenter 가 아직 없는 wrapper 는 건너뛴다');
  const s5 = wrp('s1'), s6 = wrp('s2');
  const t5 = build(SRC); t5.mod.applyPartXf({ charDef: { entries: { hat: [{ id: 's1', inst: ['A'] }, { id: 's2', inst: ['B'] }] } }, stackedPartObjs: { hat: { s1: s5, s2: s6 } } }, 'hat');
  chk(t5.log.xf.map((x) => x[1]).join() === 'A,B', 'stackable 은 id 별 entry 로 각자');
  const dm = wrp('d', [wrp('d2')]); const t6 = build(SRC);
  t6.mod.applyPartXf({ charDef: { entries: { deskpart: [{ id: 'd', inst: ['D'] }] } }, equippedPartObjs: { deskpart: dm } }, 'deskpart');
  chk(t6.log.lift.length === 2 && t6.log.lift[0][0] === dm, '책상 위 파츠는 파츠 자신을 바닥에 맞춘다(본체 + extras)');
  const t7 = build(SRC); t7.mod.applyPartXf({ charDef: { entries: { hat: [{ id: 'm', inst: ['I0'] }] } }, equippedPartObjs: { hat: wrp('m') } }, 'hat');
  chk(t7.log.lift.length === 0, '책상 파츠가 아니면 바닥 맞춤 없음');
  const t8 = build(SRC, { liftThrows: true }); let th2 = false;
  try{ t8.mod.applyPartXf({ charDef: { entries: { deskpart: [{ id: 'd', inst: ['D'] }] } }, equippedPartObjs: { deskpart: wrp('d') } }, 'deskpart'); }catch(_){ th2 = true; }
  chk(!th2, '바닥 맞춤이 던져도 삼킨다');
}
say('§3 연결');
{
  const iO = HTML.indexOf('<script src="parts/character/part-xf.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iO > 0 && iA > iO, 'html — part-xf.js 를 app.js 보다 먼저 싣는다');
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  chk(/const partXfMod = TwPartXf\.createPartXf\(\{\s*partsCore: partsCore,\s*PART_DEFAULT_OFFSET: PART_DEFAULT_OFFSET,\s*premiumMod: premiumMod,\s*partPaintMod: partPaintMod,\s*lightToneMod: lightToneMod,\s*bodyMeasureMod: bodyMeasureMod,\s*charMeasureMod: charMeasureMod,\s*instantiateBase: \(\.\.\.a\)=>instantiateBase\(\.\.\.a\),\s*\}\);/.test(code), 'app.js — 만드는 줄 deps 여덟');
  chk(['_computePartAuthorOffset', '_diagPartHeadSpace', '_computeAnimalHeadDy', '_isLegacyAuthorCompensation', '_applyXfToWrapper', 'applyPartXf'].every((n) => new RegExp('^const ' + n + ' = partXfMod\\.' + n + ';', 'm').test(APP)), '  옛 이름 const 여섯');
  chk(/const partsCore = TwCharCore\.createParts\(\{/.test(code) && code.indexOf('const partsCore = TwCharCore.createParts') < code.indexOf('const partXfMod = TwPartXf'), '  코어 파츠는 app.js 가 모듈보다 먼저 만들어 넘긴다');
  chk(!/function (_charBoneBindInverses|_computePartAuthorOffset|_diagPartHeadSpace|_measureBodyBoxInLocal|_headTopAboveBone|_baseHeadTopAboveBone|_computeAnimalHeadDy|_isLegacyAuthorCompensation|_applyXfToWrapper|applyPartXf)\b/.test(code), '  app.js 에 본문이 안 남음');
}
say('§4 일부러 깨 보기');
{
  const brk = (from, to) => { const m = SRC.replace(from, to); return m === SRC ? null : m; };
  const m1 = brk('cat, charBones, PART_DEFAULT_OFFSET);', 'cat, charBones);');
  chk(!!m1 && build(m1).mod._computePartAuthorOffset('a', 'b', 'c', 'd', 'e', 'f') && (() => { const x = build(m1); x.mod._computePartAuthorOffset('a', 'b', 'c', 'd', 'e', 'f'); return x.log.core[0][1].length === 6; })(), '기본 오프셋 표를 안 넘기면 빨강');
  const m2 = brk("if(partPaintMod.wrapperHasPic(w)) partPaintMod.applyPartPic(w, pic);", "partPaintMod.applyPartPic(w, pic);");
  chk(!!m2 && (() => { const x = build(m2); x.mod._applyXfToWrapper(wrp('a'), 'XF', 'hat'); x.log.opt.applyPic(wrp('b', [], false), 'U'); return x.log.pic.length === 1; })(), '그림칸 판정을 빼면 빨강');
  const m3 = brk('instances[i+1] || premiumMod.defaultPartXf()', 'instances[i+1]');
  chk(!!m3 && (() => { const x = build(m3); x.mod.applyPartXf({ charDef: { entries: { hat: [{ id: 'm', inst: ['I0'] }] } }, equippedPartObjs: { hat: wrp('m', [wrp('x')]) } }, 'hat'); return x.log.xf[1][1] === undefined; })(), 'extras 기본 xf 를 빼면 빨강');
  const m4 = brk('}catch(_){}\n}', '}catch(_){ throw _; }\n}');
  chk(!!m4 && (() => { const x = build(m4, { liftThrows: true }); try{ x.mod.applyPartXf({ charDef: { entries: { deskpart: [{ id: 'd', inst: ['D'] }] } }, equippedPartObjs: { deskpart: wrp('d') } }, 'deskpart'); return false; }catch(_){ return true; } })(), '바닥 맞춤 예외를 안 삼키면 빨강');
}
say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);

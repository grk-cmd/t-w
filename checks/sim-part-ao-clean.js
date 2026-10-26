/* ═══ 🎩 sim-part-ao-clean.js — 꾸미기에서 옮긴 파츠 자리가 실행 화면에서도 그대로인가 ═══════════════════════
   [무엇을 지키나] _applyXfToWrapper 는 wrapper 마다 한 번 «옛 손보정(저작 오프셋을 반대로 눌러 둔 값)» 인지 판정해 +ao 를 되더한다.
     꾸미기 기즈모 · 위치 초기화가 쓴 값은 깨끗한 값인데, 실행 화면 좌석은 새 wrapper 라 판정이 다시 돌아서
     크게 옮긴 값을 손보정으로 잘못 보고 원래 자리로 되돌려 붙였다. 깨끗한 값은 xf.aoClean 으로 저장값에 남긴다.
   ・1절: 가짜 벡터 위에서 _applyXfToWrapper 를 실제로 돌린다 — 옛 값(표식 없음)은 예전처럼 되더함 · aoClean 이면 옮긴 자리 그대로 · 작은 조정은 둘 다 그대로
   ・2절: wardrobe.js — 기즈모 역함수(syncWdGizmoToXf) · 위치 초기화를 실제로 돌린다(크게 옮김 → 저장 → 새 wrapper 에서 같은 자리 · 초기화 값에 aoClean)
   ・3절: 일부러 깨 보기
   [실행] app.js · wardrobe.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
const path = require('path');
function findUp(name){
  const stack = ['.'];
  while(stack.length){
    const d = stack.shift();
    const f = path.join(d, name);
    if(fs.existsSync(f)) return f;
    for(const e of fs.readdirSync(d, { withFileTypes: true })) if(e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.')) stack.push(path.join(d, e.name));
  }
  return null;
}
const read = (n) => { const f = findUp(n); return f ? fs.readFileSync(f, 'utf8') : ''; };
const APP = read('app.js'), WD = read('wardrobe.js');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
function grabFn(src, head){
  const i = src.indexOf(head);
  if(i < 0) return null;
  let k = src.indexOf('{', i + head.length - 1), d = 0;
  for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
  return null;
}
class V3 {
  constructor(x = 0, y = 0, z = 0){ this.x = x; this.y = y; this.z = z; }
  copy(v){ this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  sub(v){ this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  set(x, y, z){ this.x = x; this.y = y; this.z = z; return this; }
  lengthSq(){ return this.x * this.x + this.y * this.y + this.z * this.z; }
}
/* 새 wrapper(실행 화면 좌석처럼 표식 없음)에 xf 를 걸고 y 자리를 돌려준다 */
function placeY(fns, xf){
  const apply = new Function('THREE', 'premiumMod', 'PART_DEFAULT_OFFSET', 'partPaintMod', fns + '\nreturn _applyXfToWrapper;')({ Vector3: V3 }, { defaultPartXf: () => ({ pos: [0, 0, 0], rot: [0, 0, 0], scale: 1 }) }, {}, { wrapperHasPic: () => false });
  const wrp = { userData: { baseCenter: new V3(0, 0, 0), authorOff: new V3(0, 1.4, 0) }, position: new V3(), rotation: new V3(), scale: { setScalar(){} }, updateMatrix(){}, updateMatrixWorld(){} };
  apply(wrp, xf, 'hat');
  return Math.round(wrp.position.y * 1000) / 1000;
}
function judgeApply(fns){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  if(!fns){ t(false, 'app.js 에서 _applyXfToWrapper · _isLegacyAuthorCompensation 을 못 찾음'); return r; }
  try{
    const legacy = placeY(fns, { pos: [0, -1.0, 0], rot: [0, 0, 0], scale: 1 });
    const clean = placeY(fns, { pos: [0, -1.0, 0], rot: [0, 0, 0], scale: 1, aoClean: true });
    const small = placeY(fns, { pos: [0, -0.2, 0], rot: [0, 0, 0], scale: 1 });
    const smallC = placeY(fns, { pos: [0, -0.2, 0], rot: [0, 0, 0], scale: 1, aoClean: true });
    t(legacy === -1, '표식 없는 옛 값(ao 반대로 크게) — 예전처럼 손보정으로 보고 되더한다(-1.4 - 1.0 + 1.4 = -1.0 · 지금 ' + legacy + ')');
    t(clean === -2.4, '★ aoClean 값 — 옮긴 자리 그대로(-1.4 - 1.0 = -2.4 · 지금 ' + clean + ')');
    t(small === -1.6 && smallC === -1.6, '  작은 조정은 표식이 있든 없든 그대로(-1.6)');
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 80)); }
  return r;
}
/* 기즈모 역함수(syncWdGizmoToXf)를 실제로 돌린다 — 옛 손보정 값으로 붙은 wrapper 를 ao 반대로 크게 옮기고 sync 한 뒤,
   표식 없는 새 wrapper(실행 화면 좌석)에 그 xf 를 걸어 같은 자리에 붙는지 본다(왕복). */
function roundTrip(fns, wd){
  const sync = grabFn(wd, 'function syncWdGizmoToXf(){');
  if(!sync) throw new Error('syncWdGizmoToXf 를 못 찾음');
  const xf = { pos: [0, -1.0, 0], rot: [0, 0, 0], scale: 1 };   // 옛 손보정 값
  const mkWrp = () => ({ userData: { baseCenter: new V3(0, 0, 0), authorOff: new V3(0, 1.4, 0) }, position: new V3(), rotation: new V3(), scale: { x: 1, setScalar(){} }, updateMatrix(){}, updateMatrixWorld(){} });
  const apply = new Function('THREE', 'premiumMod', 'PART_DEFAULT_OFFSET', 'partPaintMod', fns + '\nreturn _applyXfToWrapper;')({ Vector3: V3 }, { defaultPartXf: () => ({ pos: [0, 0, 0], rot: [0, 0, 0], scale: 1 }) }, {}, { wrapperHasPic: () => false });
  const w1 = mkWrp(); apply(w1, xf, 'hat');
  w1.position.y = -3.0;   // 기즈모로 ao 반대 방향으로 크게 내림
  const saved = [];
  new Function('_wdGetActiveWrapperAndXf', 'partCatInfo', 'isDeskPartCat', 'floorClampWrapper', 'PART_DEFAULT_OFFSET', 'wdGizmoCat', 'setPartEntryInstanceXf', 'applyPartXf', 'wdPreviewBase', 'THREE', sync + '\nreturn syncWdGizmoToXf;')(
    () => ({ wrapper: w1, xf, entry: {}, idx: 0 }), () => null, () => false, () => {}, () => ({}), 'hat', (e, i, x) => saved.push(x), () => {}, null, { Vector3: V3 })();
  const w2 = mkWrp(); apply(w2, JSON.parse(JSON.stringify(xf)), 'hat');   // 저장 → 다시 읽은 값(실행 화면)
  return { y: Math.round(w2.position.y * 1000) / 1000, saved: saved.length };
}
/* 위치 초기화(resetOne('pos'))를 실제로 돌린다 — 대상 xf 에 표식이 붙는지 */
function resetPos(wd){
  const i = wd.indexOf('  const _resetTargets = ()=>{'), j = wd.indexOf("  resetRow.querySelector('.wd-reset-pos')");
  if(i < 0 || j < 0) throw new Error('위치 초기화 묶음을 못 찾음');
  const x = { pos: [0, -1.0, 0], rot: [0, 0, 0], scale: 1 };
  const entry = { xf: x };
  const base = { charDef: {}, equippedPartObjs: {}, stackedPartObjs: {} };
  new Function('wdPreviewBase', 'wdDraftDef', 'findEntryById', 'firstEntryForCat', 'partEntryInstances', 'defaultPartXf', 'setPartEntryInstanceXf', 'cat', 'id', 'currentInstanceIdx', 'xf', 'defXf', 'sync',
    wd.slice(i, j) + "\nresetOne('pos');")(base, null, () => entry, () => entry, (e) => [e.xf], () => ({ pos: [0, 0, 0], rot: [0, 0, 0], scale: 1 }), () => {}, 'hat', 'p1', 0, x, null, () => {});
  return x;
}
function judgeWd(wd, fns){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  try{
    const rt = roundTrip(fns || F, wd);
    t(rt.saved === 1 && rt.y === -3, '★ 기즈모로 크게 옮긴 값 — 저장 뒤 새 wrapper(실행 화면)에서도 옮긴 자리 그대로(-3 · 지금 ' + rt.y + ')');
  }catch(e){ t(false, '기즈모 왕복을 돌려 보다 던짐 — ' + String(e.message || e).slice(0, 80)); }
  try{
    const x = resetPos(wd);
    t(x.aoClean === true && x.pos.join() === '0,0,0', '  위치 초기화가 쓴 값 — 처음 자리 · aoClean');
  }catch(e){ t(false, '위치 초기화를 돌려 보다 던짐 — ' + String(e.message || e).slice(0, 80)); }
  return r;
}

const FNS = [grabFn(APP, 'function _isLegacyAuthorCompensation(pos, ao){'), grabFn(APP, 'function _applyXfToWrapper(wrp, xf, cat){')];
const F = FNS.every(Boolean) ? FNS.join('\n') : null;
say('── 1. 실행 화면 좌석에 걸어 본다');
judgeApply(F).forEach(([ok, msg]) => chk(ok, msg));
say('── 2. 꾸미기가 표식을 쓴다');
judgeWd(WD, F).forEach(([ok, msg]) => chk(ok, msg));
say('── 3. 일부러 깨 보기');
const breaks = [
  ['판정이 표식을 안 봄', () => judgeApply(F && F.replace('!xf.aoClean && ', '')), F],
  ['기즈모가 표식을 안 씀', () => judgeWd(WD.replace('if(ao) xf.aoClean = true;', '')), WD],
  ['초기화가 표식을 안 씀', () => judgeWd(WD.replace(' x.aoClean = true; }', ' }')), WD],
];
for(const [name, run] of breaks){
  let rows; try{ rows = run(); }catch(_){ rows = [[false, '던짐']]; }
  chk(rows.some(([ok]) => !ok), name);
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

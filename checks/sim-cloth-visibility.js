/* ═══ 👕 sim-cloth-visibility.js — 옷 겹침(character/cloth-visibility.js · app.js 분리 T4) ═══════════════
   [왜] _unequipClothCat · applyClothVisibility 를 모듈로 옮겼다(글은 0.13 app.js 와 같다). 동작은 그대로여야 한다.
   ・1절: applyClothVisibility — hides 명시 · 옛 파츠 관례 기본값(onepiece · cape · 일반) · 꾸미기 파츠 꺼짐이면 «파츠 없음» · 없는 rec 건너뜀
   ・2절: 자리비움 중이면 visible 이 아니라 _prevVisible 에 적는다 · 끝에서 올라탄 좌석 머리 재측정(던져도 삼킴)
   ・3절: _unequipClothCat — 해제 + def 에서 지움
   ・4절: 연결(html 순서 · 만드는 줄 · 옛 이름 · app.js 에 본문이 안 남음) · 5절: 일부러 깨 보기
   [실행] 러너 스테이징 또는 저장소 루트에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('character/cloth-visibility.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음 — cloth-visibility.js · app.js · desk-companion-prototype.html'); process.exit(2); }

function build(src, o){
  o = o || {};
  const win = {}, log = { unequip: [], remeasure: [], deco: [] };
  new Function('window', 'module', src)(win, undefined);
  const recs = o.recs || [];
  const mod = win.TwClothVisibility.createClothVisibility({
    decoPartsMod: { applyDecoPartsVisibility: (s) => log.deco.push(s), decoPartsVisible: () => o.decoVisible !== false },
    premiumMod: {
      entriesForCat: (def, cat) => { const v = def.equippedParts[cat]; return Array.isArray(v) ? v : [v]; },
      partEntryId: (e) => e,
      savedParts: () => recs,
      getRecHides: (rec) => (rec.hides === undefined ? null : rec.hides),
    },
    rideBenchMod: { _remeasureRideHeadTop: (s) => { log.remeasure.push(s); if(o.remeasureThrows) throw new Error('x'); } },
    unequipPartFromSeat: (s, c, i) => log.unequip.push([s, c, i]),
  });
  return { mod, log };
}
const mesh = () => ({ visible: true, userData: {} });
const mkSeat = (eq) => ({ charDef: { equippedParts: eq }, upMesh: mesh(), loMesh: mesh(), onepieceMesh: mesh(), capeMesh: mesh(), glassesMesh: mesh(), hatMesh: mesh(), maskMesh: mesh(), wingMesh: mesh(), handLMesh: mesh(), handRMesh: mesh() });
const vis = (s) => [s.upMesh, s.loMesh, s.onepieceMesh, s.capeMesh, s.hatMesh].map((m) => m.visible ? 1 : 0).join('');

say('§1 hides 판정');
{
  const t = build(SRC, { recs: [{ id: 'a', hides: ['top', 'hat'] }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'h', hides: [] }] });
  let s = mkSeat({ top: ['a'] }); t.mod.applyClothVisibility(s);
  chk(vis(s) === '01110', '관리자가 명시한 hides(top · hat) 만 숨긴다');
  s = mkSeat({ onepiece: ['b'] }); t.mod.applyClothVisibility(s);
  chk(vis(s) === '00011', '옛 파츠(hides 없음) onepiece 는 상 · 하의 · 원피스를 숨긴다');
  s = mkSeat({ cape: ['c'] }); t.mod.applyClothVisibility(s);
  chk(s.upMesh.visible && s.loMesh.visible && s.capeMesh.visible, '옛 파츠 cape 는 아무것도 안 숨긴다(겉옷처럼 덮음)');
  s = mkSeat({ top: ['d'] }); t.mod.applyClothVisibility(s);
  chk(!s.upMesh.visible && s.loMesh.visible, '옛 파츠 일반 카테고리는 자기 부위만 숨긴다');
  s = mkSeat({ top: ['h'] }); t.mod.applyClothVisibility(s);
  chk(s.upMesh.visible, '빈 배열 hides 는 아무것도 안 숨긴다(명시)');
  s = mkSeat({ top: ['zzz'] }); t.mod.applyClothVisibility(s);
  chk(s.upMesh.visible, '저장된 rec 가 없으면 건너뛴다');
  const t2 = build(SRC, { recs: [{ id: 'a', hides: ['top'] }], decoVisible: false });
  s = mkSeat({ top: ['a'] }); t2.mod.applyClothVisibility(s);
  chk(s.upMesh.visible && t2.log.deco.length === 1, '꾸미기 파츠 꺼짐이면 «파츠 없음» 으로 세어 기본 메시를 되돌린다 · 표시 설정 먼저 맞춤');
  let th = false; try{ t.mod.applyClothVisibility(null); }catch(_){ th = true; }
  chk(!th, 'seat 가 없으면 아무 일도 안 한다');
}
say('§2 자리비움 · 재측정');
{
  const t = build(SRC, { recs: [{ id: 'a', hides: ['top'] }] });
  const s = mkSeat({ top: ['a'] }); s.upMesh.userData._prevVisible = true; s.upMesh.visible = false;
  t.mod.applyClothVisibility(s);
  chk(s.upMesh.userData._prevVisible === false && s.upMesh.visible === false, '숨은 중(_prevVisible 있음)이면 복원값만 갱신하고 visible 은 안 쓴다');
  chk(t.log.remeasure.length === 1 && t.log.remeasure[0] === s, '끝에서 올라탄 좌석 머리 꼭대기를 한 번 다시 잰다');
  const t3 = build(SRC, { remeasureThrows: true });
  let th = false; try{ t3.mod.applyClothVisibility(mkSeat({})); }catch(_){ th = true; }
  chk(!th, '재측정이 던져도 삼킨다');
}
say('§3 _unequipClothCat');
{
  const t = build(SRC);
  const s = mkSeat({ top: ['a'], hat: ['b'] });
  t.mod._unequipClothCat(s, 'top');
  chk(t.log.unequip.length === 1 && t.log.unequip[0][1] === 'top' && !('top' in s.charDef.equippedParts) && 'hat' in s.charDef.equippedParts, '해제를 부르고 def 에서 그 카테고리만 지운다');
  const s2 = { charDef: null }; t.mod._unequipClothCat(s2, 'top');
  chk(t.log.unequip.length === 2, 'def 가 없어도 던지지 않는다');
}
say('§4 연결');
{
  const iO = HTML.indexOf('<script src="parts/character/cloth-visibility.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iO > 0 && iA > iO, 'html — cloth-visibility.js 를 app.js 보다 먼저 싣는다');
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  chk(/const clothVisMod = TwClothVisibility\.createClothVisibility\(\{\s*decoPartsMod: decoPartsMod,\s*premiumMod: premiumMod,\s*rideBenchMod: rideBenchMod,\s*unequipPartFromSeat: \(\.\.\.a\)=>unequipPartFromSeat\(\.\.\.a\),\s*\}\);/.test(code), 'app.js — 만드는 줄 deps 넷 그대로');
  chk(/const _unequipClothCat = clothVisMod\._unequipClothCat;/.test(code) && /const applyClothVisibility = clothVisMod\.applyClothVisibility;/.test(code), '  옛 이름 const 둘');
  chk(!/function (applyClothVisibility|_unequipClothCat)\b/.test(code), '  app.js 에 본문이 안 남음');
}
say('§5 일부러 깨 보기');
{
  const brk = (from, to) => { const m = SRC.replace(from, to); return m === SRC ? null : m; };
  const cases = [
    ['모두 숨김 기준 뒤집기(visible 직접 씀)', brk('if(mesh.userData._prevVisible !== undefined) mesh.userData._prevVisible = v;', 'if(false) mesh.userData._prevVisible = v;'),
      () => { const t = build(brk('if(mesh.userData._prevVisible !== undefined) mesh.userData._prevVisible = v;', 'if(false) mesh.userData._prevVisible = v;'), { recs: [{ id: 'a', hides: ['top'] }] }); const s = mkSeat({ top: ['a'] }); s.upMesh.userData._prevVisible = true; s.upMesh.visible = false; t.mod.applyClothVisibility(s); return s.upMesh.userData._prevVisible === true; }],
    ['onepiece 관례 기본값 빼기', brk("hides = ['top','bottom','onepiece']", "hides = ['onepiece']"),
      () => { const t = build(brk("hides = ['top','bottom','onepiece']", "hides = ['onepiece']"), { recs: [{ id: 'b' }] }); const s = mkSeat({ onepiece: ['b'] }); t.mod.applyClothVisibility(s); return s.upMesh.visible; }],
    ['재측정 안 부름', brk('rideBenchMod._remeasureRideHeadTop(seat)', '0'),
      () => { const t = build(brk('rideBenchMod._remeasureRideHeadTop(seat)', '0')); t.mod.applyClothVisibility(mkSeat({})); return t.log.remeasure.length === 0; }],
    ['def 에서 안 지움', brk('delete seat.charDef.equippedParts[cat];', ''),
      () => { const t = build(brk('delete seat.charDef.equippedParts[cat];', '')); const s = mkSeat({ top: ['a'] }); t.mod._unequipClothCat(s, 'top'); return 'top' in s.charDef.equippedParts; }],
    ['꺼짐 판정 무시', brk('decoPartsMod.decoPartsVisible() ?', 'true ?'),
      () => { const t = build(brk('decoPartsMod.decoPartsVisible() ?', 'true ?'), { recs: [{ id: 'a', hides: ['top'] }], decoVisible: false }); const s = mkSeat({ top: ['a'] }); t.mod.applyClothVisibility(s); return !s.upMesh.visible; }],
  ];
  for(const [name, m, fn] of cases) chk(!!m && (() => { try{ return fn(); }catch(_){ return true; } })(), name + ' — 깨면 빨강');
}
say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);

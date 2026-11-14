/* ═══ 🐾 sim-human-ear-attach.js — 사람 귀 붙이기(character/human-ear-attach.js · app.js 분리 M2) ═══════════════
   [왜] app.js «사람 귀» 구역(귀 재질 · 귀 그림 · 까닥임 등록 · def 에 맞게 붙이기)을 모듈로 옮겼다. 동작은 그대로여야 한다.
   ・1절: 귀 재질 — 흰색 · DoubleSide · emissive = FLAT_EMISSIVE(진짜 three)
   ・2절: 까닥임 등록 _syncHumanEarRig — 붙은 귀는 동물 귀 등록으로 올리고 떨어진 옛 귀는 목록에서 걷는다 · 빈 입력은 조용히
   ・3절: 붙이기 _attachHumanEars — 동물 · 뿌리 없음 · 모듈 없음은 건너뜀 · 붙으면 그림 → 꾸미기 알림 → 좌석 까닥임 → 탑승 머리 높이 다시 재기 · 던져도 앱은 계속
   ・4절: 연결 — html · 만드는 줄 · 옛 이름 다섯 · app.js 에 귀 함수가 남지 않음
   ・5절: 일부러 깨 보기
   [실행] 러너 스테이징 또는 저장소 루트에서. three 는 vendor/three/three.min.js. */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('character/human-ear-attach.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음 — human-ear-attach.js · app.js · desk-companion-prototype.html'); process.exit(2); }
const threePath = ['vendor/three/three.min.js', 'app/vendor/three/three.min.js', 'three.min.js'].find(p => fs.existsSync(p));
if(!threePath){ say('  ? 원본 못 찾음 — three.min.js'); process.exit(2); }
const THREE = require(path.resolve(threePath));

/* 가짜 HumanEar — 부름을 기록하고, attachFromDef 는 def.__ears 만큼 wrapper 를 만들어 onAttach 를 부른다 */
function build(src, o){
  o = o || {};
  const log = { holder: [], attach: [], pic: [], wd: [], remeasure: [], registered: [], mats: [] };
  const HumanEar = o.noModule ? undefined : { createHumanEar: (d) => ({
    ensureHolder: (root) => log.holder.push(root),
    attachFromDef: (root, def, opts) => {
      log.attach.push({ root, def, opts });
      if(o.attachThrows) throw new Error('boom');
      (def.__ears || []).forEach(side => { const w = new THREE.Group(); w.userData.humanEar = side; root.add(w); opts.onAttach(w); });
    },
  }) };
  const win = {};
  new Function('THREE', 'HumanEar', 'window', 'module', src)(THREE, HumanEar, win, undefined);
  const seats = [];
  const deps = {
    _registerAnimalEarOn: (seat, w) => { log.registered.push(w.userData.humanEar); (seat.bones.ear.indexOf(w) < 0) && seat.bones.ear.push(w); seat.boneRest.ear.push(1); },
    lightToneMod: { FLAT_EMISSIVE: 0.37 },
    seats: () => seats,
    partPaintMod: () => ({ applyPartPic: (w, pic) => { if(o.picThrows) throw new Error('pic'); log.pic.push([w.userData.humanEar, pic]); } }),
    wardrobeMod: () => ({ wdEar: { onEarAttached: (root) => { if(o.wdThrows) throw new Error('wd'); log.wd.push(root); } } }),
    rideBenchMod: () => ({ _remeasureRideHeadTop: (s) => log.remeasure.push(s) }),
  };
  const mod = win.TwHumanEarAttach.createHumanEarAttach(deps);
  return { mod, log, seats, deps };
}
const mkSeat = (root) => ({ modelRoot: root, bones: { ear: [] }, boneRest: {} });

say('§1 귀 재질');
{
  const { mod } = build(SRC);
  const m = mod._humanEarMat();
  chk(m instanceof THREE.MeshStandardMaterial && m.color.getHexString() === 'ffffff' && m.side === THREE.DoubleSide && m.metalness === 0 && m.roughness === 0.9, '흰색 · 양면 · 금속 0 · 거칠기 0.9');
  chk(m.emissive.r === 0.37 && m.emissive.g === 0.37 && m.emissive.b === 0.37, '플랫 조명 몫(FLAT_EMISSIVE 0.37)을 emissive 로');
  chk(mod._humanEarMat() !== m, '부를 때마다 새 재질');
}

say('§2 까닥임 등록');
{
  const { mod, log } = build(SRC);
  const root = new THREE.Group(); const live = new THREE.Group(); live.userData.humanEar = 'L'; root.add(live);
  const stale = new THREE.Group(); stale.userData.humanEar = 'R';   // root 에서 떨어진 옛 귀
  const seat = mkSeat(root); seat.bones.ear = [stale]; seat.boneRest = { ear: ['restStale'] }; seat.earTimers = { x: 1 };
  mod._syncHumanEarRig(seat);
  chk(!seat.bones.ear.includes(stale) && !seat.boneRest.ear.includes('restStale') && seat.earTimers === null, '떨어진 옛 귀는 귀 목록 · 기준 자세 · 타이머에서 걷는다');
  chk(log.registered.length === 1 && log.registered[0] === 'L' && seat.bones.ear.includes(live), '붙어 있는 귀는 동물 귀 등록으로 올린다');
  const dog = new THREE.Group(); dog.userData.animalEar = true; const s2 = mkSeat(root); s2.bones.ear = [dog]; s2.boneRest = { ear: ['r'] };
  mod._syncHumanEarRig(s2);
  chk(s2.bones.ear.includes(dog), '사람 귀 표식이 없는 귀(동물 귀)는 건드리지 않는다');
  let threw = false; try{ mod._syncHumanEarRig(null); mod._syncHumanEarRig({}); mod._syncHumanEarRig({ bones: {}, modelRoot: root }); mod._syncHumanEarRig({ bones: { ear: [] } }); }catch(_){ threw = true; }
  chk(!threw, '좌석 · 뼈 · 귀 목록 · 모델 뿌리 중 하나라도 없으면 조용히 지나간다');
  const s3 = mkSeat(root); mod._syncHumanEarRig(s3);
  chk(s3.boneRest.ear && s3.boneRest.ear.length === 1, 'boneRest.ear 가 없으면 만든다');
}

say('§3 붙이기');
{
  const root = new THREE.Group();
  const b = build(SRC); const seat = mkSeat(root); b.seats.push(seat);
  b.mod._attachHumanEars(root, { __ears: ['L', 'R'], earPicL: 'picL', earPicR: 'picR' });
  chk(b.log.holder[0] === root && b.log.attach.length === 1 && typeof b.log.attach[0].opts.material === 'function', 'holder 를 먼저 만들고 귀 재질 함수와 함께 붙인다');
  chk(JSON.stringify(b.log.pic) === JSON.stringify([['L', 'picL'], ['R', 'picR']]), '귀마다 그림(earPicL · earPicR)을 입힌다');
  chk(b.log.wd.length === 2 && b.log.wd[0] === root, '붙을 때마다 꾸미기에 알린다');
  chk(b.log.remeasure.length === 2 && b.log.remeasure[0] === seat, '이 뿌리의 좌석이면 까닥임 등록 + 탑승 머리 높이 다시 재기');
  chk(b.log.registered.length >= 2 && seat.bones.ear.length === 2, '붙인 뒤 한 번 더 까닥임 등록(콜백 없이 붙은 경우까지)');
  const a = build(SRC); a.mod._attachHumanEars(root, { animal: true, __ears: ['L'] }); a.mod._attachHumanEars(null, { __ears: ['L'] });
  chk(a.log.attach.length === 0 && a.log.holder.length === 0, '동물 def · 뿌리 없음은 건너뛴다');
  const n = build(SRC, { noModule: true });
  let threw = false; try{ n.mod._attachHumanEars(root, { __ears: ['L'] }); }catch(_){ threw = true; }
  chk(!threw && n.mod.humanEar === null, '귀 모듈이 없으면 humanEar 는 null · 붙이기는 조용히 건너뛴다');
  const t = build(SRC, { attachThrows: true }); const w = []; const ow = console.warn; console.warn = (...x) => w.push(x.join(' '));
  let th2 = false; try{ t.mod._attachHumanEars(root, { __ears: ['L'] }); }catch(_){ th2 = true; } console.warn = ow;
  chk(!th2 && w.some(x => x.includes('붙이기 실패')), '붙이다 던져도 앱은 계속(경고만)');
  const p = build(SRC, { picThrows: true, wdThrows: true }); p.seats.push(mkSeat(root));
  let th3 = false; console.warn = () => {}; try{ p.mod._attachHumanEars(root, { __ears: ['L'], earPicL: 'x' }); }catch(_){ th3 = true; } console.warn = ow;
  chk(!th3 && p.log.remeasure.length === 1, '그림 · 꾸미기 알림이 던져도 뒤 단계(까닥임 · 높이 재기)는 이어진다');
  const o = build(SRC); o.mod._attachHumanEars(root, { __ears: ['L'] });
  chk(o.log.remeasure.length === 0, '이 뿌리의 좌석이 없으면(미리보기) 높이 다시 재기는 안 한다');
}

say('§4 연결');
{
  const iH = HTML.indexOf('<script src="parts/character/human-ear-attach.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>'), iE = HTML.indexOf('<script src="parts/character/human-ear.js"></script>');
  chk(iH > 0 && iA > iH && iE > 0, 'html — human-ear-attach.js 를 app.js 보다 먼저 싣는다(human-ear.js 도 실린다)');
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  chk(/const humanEarAttachMod = TwHumanEarAttach\.createHumanEarAttach\(\{[\s\S]*?seats: \(\)=>seats,[\s\S]*?\}\);/.test(code), 'app.js — 원래 자리에서 만들고 늦게 생기는 것(seats · partPaintMod · wardrobeMod · rideBenchMod)은 읽는 함수로 넘긴다');
  chk(['humanEar', '_humanEarMat', '_humanEarPic', '_syncHumanEarRig', '_attachHumanEars'].every(n => new RegExp('^const ' + n + ' = humanEarAttachMod\\.' + n + ';', 'm').test(code)), '  옛 이름 다섯을 const 로 받는다');
  chk(!/function (_humanEarMat|_humanEarPic|_syncHumanEarRig|_attachHumanEars)\b|HumanEar\.createHumanEar/.test(code), '  app.js 에 귀 함수 · 귀 모듈 만드는 줄이 남아 있지 않다');
  chk(/_attachHumanEars\(inst\.root, def\)/.test(code) && /_syncHumanEarRig\(seat\)/.test(code), '  부르는 곳(파츠 장착 · 좌석 입히기)은 옛 이름 그대로');
}

say('§5 일부러 깨 보기');
{
  const brk = (from, to) => { const m = SRC.replace(from, to); return m === SRC ? null : m; };
  const m1 = brk('if(!humanEar || !root || (def && def.animal)) return;', 'if(!humanEar || !root) return;');
  chk(!!m1 && (() => { const b = build(m1); b.mod._attachHumanEars(new THREE.Group(), { animal: true, __ears: ['L'] }); return b.log.attach.length === 1; })(), '동물 def 에 사람 귀를 붙이면 빨강');
  const m2 = brk('live.indexOf(o) < 0', 'false');
  chk(!!m2 && (() => { const b = build(m2); const r = new THREE.Group(); const st = new THREE.Group(); st.userData.humanEar = 'R'; const s = mkSeat(r); s.bones.ear = [st]; s.boneRest = { ear: [1] }; b.mod._syncHumanEarRig(s); return s.bones.ear.includes(st); })(), '옛 귀를 안 걷으면 빨강');
  const m3 = brk('_humanEarPic(w, def);', '');
  chk(!!m3 && (() => { const b = build(m3); b.mod._attachHumanEars(new THREE.Group(), { __ears: ['L'] }); return b.log.pic.length === 0; })(), '귀 그림을 안 입히면 빨강');
  const m4 = brk('m.emissive.setScalar(lightToneMod.FLAT_EMISSIVE);', '');
  chk(!!m4 && build(m4).mod._humanEarMat().emissive.r !== 0.37, '플랫 조명 몫을 빼면 빨강');
  const m5 = brk('rideBenchMod()._remeasureRideHeadTop(_s);', '');
  chk(!!m5 && (() => { const b = build(m5); const r = new THREE.Group(); b.seats.push(mkSeat(r)); b.mod._attachHumanEars(r, { __ears: ['L'] }); return b.log.remeasure.length === 0; })(), '탑승 머리 높이를 다시 안 재면 빨강');
}
say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);

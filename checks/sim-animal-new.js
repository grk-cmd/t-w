/* sim-animal-new.js — 🐾 새 동물 만들기(parts/character/animal.js startNewAnimal)를 오려 내 가짜 화면으로 돌려 본다
   실행: node checks/run.js sim-animal-new
   ・1절 종족 선택 창을 닫고 연다 — 인간 카드처럼. 남겨 두면 창 쌓기가 올린 선택 창(83~)이 동물 만들기 창(56)을 덮는다(B-1119-5)
   ・2절 신규 컨텍스트 — 편집 대상(_editSrcDef · _editSeat)을 비우고 [＋]가 정한 칸을 받는다 · 칸이 숫자가 아니면 null
   ・3절 카드의 두 길(정상 · 숨김 해금)이 모두 이 한 벌을 부른다 — 카드 안에서 따로 openPreview 를 부르지 않는다
   ・4절 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const P = ['animal.js', 'parts/character/animal.js', 'app/parts/character/animal.js'].find(p => fs.existsSync(p));
if (!P) { say('  ? 원본 못 찾음 — animal.js'); process.exit(2); }
const SRC = fs.readFileSync(P, 'utf8');

/* 이름으로 함수 한 개를 오려 낸다(중괄호 짝) */
function cutFn(src, name){
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) return null;
  const open = src.indexOf('{', m.index);
  let d = 0;
  for (let j = open; j < src.length; j++){
    if (src[j] === '{') d++;
    else if (src[j] === '}' && --d === 0) return src.slice(m.index, j + 1);
  }
  return null;
}

/** 오려 낸 startNewAnimal 을 가짜 화면 · 가짜 모듈 상태로 돌린다 */
function world(code, opts){
  const o = opts || {};
  const log = [];
  const cls = new Set(['on']);
  const race = o.noRace ? null : { classList: { remove: (c) => { cls.delete(c); log.push('race-off'); }, contains: (c) => cls.has(c) } };
  const document = { getElementById: (id) => (id === 'raceOverlay' ? race : null) };
  const window = { __twRaceTargetSlot: o.slot };
  const reset = () => log.push('reset');
  const openPreview = () => log.push('open:' + (race ? (cls.has('on') ? 'race-on' : 'race-off') : 'no-race'));
  const mod = new Function('document', 'window', '_resetAnimalState', 'openPreview',
    "let _editSrcDef = 'old-def', _editSeat = 'old-seat', _targetSlot = 'old-slot';\n" + code +
    '\nreturn { run: startNewAnimal, state: () => ({ _editSrcDef, _editSeat, _targetSlot }) };')(document, window, reset, openPreview);
  mod.run();
  return { log, state: mod.state(), raceOn: () => cls.has('on') };
}

const FN = cutFn(SRC, 'startNewAnimal');
say('── 1절 종족 선택 창');
if (!FN){ chk(false, 'animal.js 에 startNewAnimal 이 없다'); }
else {
  const w = world(FN, { slot: 2 });
  chk(!w.raceOn(), '종족 선택 창을 닫는다(인간 카드처럼)');
  chk(w.log.join() === 'race-off,reset,open:race-off', '  ↳ 닫은 뒤에 초기화 · 동물 만들기 창을 연다 — ' + w.log.join(' · '));
  const n = world(FN, { noRace: true, slot: 0 });
  chk(n.log.join() === 'reset,open:no-race', '선택 창이 없는 화면(다른 길로 열림)에서도 연다');

  say('── 2절 신규 컨텍스트');
  chk(w.state._editSrcDef === null && w.state._editSeat === null, '편집 대상을 비운다(엉뚱한 칸 · 좌석에 덮어쓰지 않게)');
  chk(w.state._targetSlot === 2 && n.state._targetSlot === 0, '[＋]가 정한 칸을 받는다(0번 칸 포함)');
  chk(world(FN, { slot: '3' }).state._targetSlot === null && world(FN, {}).state._targetSlot === null, '칸이 숫자가 아니거나 없으면 null(추측하지 않음)');
}

say('── 3절 카드의 두 길');
const CARD = cutFn(SRC, 'initCard') || '';
const calls = (CARD.match(/\bstartNewAnimal\(\)/g) || []).length;
chk(calls === 2, '정상 · 숨김 해금 두 길이 모두 startNewAnimal() 을 부른다 (' + calls + ')');
chk(!/\bopenPreview\(\)/.test(CARD) && !/_resetAnimalState\(\)/.test(CARD), '카드 안에서 따로 열거나 초기화하지 않는다(한 벌만)');

say('── 4절 깨 보기');
if (FN){
  const broken = FN.replace(/\n[^\n]*raceOverlay[^\n]*/, '');
  chk(broken !== FN && world(broken, { slot: 1 }).raceOn(), '깨 보기 — 선택 창 닫는 줄을 빼면 창이 남는다(1절이 잡는 모양)');
}

say(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);

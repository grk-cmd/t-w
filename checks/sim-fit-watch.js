/* ═══ 🩺 sim-fit-watch.js — 다시 맞춘 높이 경고(character/fit-watch.js · app.js fitModel 배선) ═══════════════
   [왜] B-1109-9 — 파츠 보관함(T)을 닫으면 캐릭터가 뜬 채 남는데 어느 값이 띄우는지 알 길이 없었다. 다시 맞출 때 설명되지 않는 높이 바뀜을
        console.warn 한 줄로 남겨 오류 기록(tw-error.log)으로 받는다.
   ・1절: 모듈을 불러 돌린다 — 첫 값 · 그대로 · 발밑 · 슬라이더 바뀜은 조용히 · 설명 안 되는 높이 · 크기 · rig 뜸은 경고 · 모델마다 따로 · 빈 값
   ・2절: 배선 — fitModel 이 기본 자세 안에서 발밑 깊이를 잰 뒤 note(값 다섯 · 상태) · html 에 app.js 보다 먼저
   ・3절: 깨 보기
   [실행] 러너 스테이징(평평한 폴더) 또는 checks/ 에서. */
'use strict';
const fs = require('fs');
const path = require('path');
const { joinRenderer } = require('./sim-renderer-src.js');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const pick = (list) => list.map((f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } }).find(Boolean) || null;
const D = ['.', 'character', 'parts/character', 'app/parts/character', '../apps/desktop/app/parts/character'];
const MOD = pick(D.map((d) => path.join(d, 'fit-watch.js')));
const APP = pick(['app.js', 'parts/app.js', 'app/parts/app.js', '../apps/desktop/app/parts/app.js']);
const HTML = pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html', '../apps/desktop/app/desk-companion-prototype.html']);
for(const [n, v] of [['fit-watch.js', MOD], ['app.js', APP], ['html', HTML]]){ if(!v){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); } }
const loadWin = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwFitWatch; };

const T = (o) => Object.assign({ scale: 1.0, foot: -0.13, lift: 0, under: 0, y: -0.13 }, o);
/* fitModel 과 같은 식으로 값을 만든다 — 슬라이더 몫 = 높이 × 동물 배율 ÷ 캐릭터 크기 */
/* under 는 measureUnderfootDepth 처럼 «슬라이더를 더한 뒤 바닥 아래로 내려간 깊이» — 발밑 파츠 깊이 D 에서 슬라이더 몫을 뺀 만큼(0 아래로는 0) */
const fit = (o) => { const lift = o.userY * (o.animal ? 0.4 : 1) / (o.uz || 1); const under = Math.max(0, (o.D || 0) - lift); return T({ lift, under, y: -0.13 + lift + under + (o.extra || 0) }); };
function behave(src){
  const M = loadWin(src), out = [], r = {};
  const W = M.createFitWatch({ warn: (m) => out.push(m) });
  const seat = { gltfRoot: {} };
  r.first = W.note(seat, T()) === 'first' && out.length === 0;
  r.same = W.note(seat, T(), { rigY: 0.001 }) === 'same';
  /* 평소 조작 — 동물 · 크기 0.63 · 높이가 0 이 아닌 캐릭터의 크기 바꿈 */
  const human = { gltfRoot: {} }, animal = { gltfRoot: {} }, comm = { gltfRoot: {} };
  W.note(human, fit({ userY: 0, uz: 0.63 }));  r.slider = W.note(human, fit({ userY: 0.2, uz: 0.63 })) === 'same';
  W.note(animal, fit({ userY: 0, animal: true })); r.slider = r.slider && W.note(animal, fit({ userY: 0.1, animal: true })) === 'same';
  W.note(comm, fit({ userY: 0.2, uz: 0.63 }));  r.slider = r.slider && W.note(comm, fit({ userY: 0.2, uz: 0.7 })) === 'same';
  /* 욕조(깊이 0.2 · 0.3)를 단 채 높이 · 크기 슬라이더를 끈다 — 깊이는 바뀌지만 슬라이더 몫으로 설명된다 */
  const tub = { gltfRoot: {} }, tub2 = { gltfRoot: {} };
  W.note(tub, fit({ userY: 0, D: 0.2 })); for(let i = 1; i <= 30; i++) W.note(tub, fit({ userY: i * 0.01, D: 0.2, uz: 0.63 }));
  W.note(tub2, fit({ userY: 0.2, D: 0.3, uz: 1 })); for(let i = 1; i <= 20; i++) W.note(tub2, fit({ userY: 0.2, D: 0.3, uz: 1 - i * 0.02 }));
  r.slider = r.slider && out.length === 0;
  /* 입장 — 첫 값(파츠 붙기 전 깊이 0) → 파츠가 붙은 뒤 깊이 D 는 적지 않는다 */
  const enter = { gltfRoot: {} };
  W.note(enter, T()); r.enterQuiet = W.note(enter, T({ under: 0.2, y: 0.07 })) === 'same' && out.length === 0;
  /* 발밑 깊이가 바뀌면 높이 경고는 안 내고 따로 한 줄 */
  const n0 = out.length;
  r.under = W.note(seat, T({ under: 0.3, y: 0.17 })) === 'same' && out.length === n0 + 1 && /^\[높이 · 발밑\] 발밑 깊이가 바뀜 0\.000→0\.300/.test(out[n0]);
  W.note(seat, T());
  /* 설명 안 되는 높이 */
  const n1 = out.length;
  r.lift = W.note(seat, T({ y: 0.25 }), { riding: true, wrapRotX: -1.5, animal: true, userY: 0.2, groupY: 0.8 }) === 'warn' && out.length === n1 + 1;
  const w = out[n1] || '';
  r.text = /^\[높이\] 다시 맞춘 캐릭터 높이가 설명 안 되게 바뀜 — y -0\.130→0\.250/.test(w) && /좌석 y 0\.800/.test(w) && /눕힘 -1\.500/.test(w) && /높이 슬라이더 0\.200/.test(w) && /올라탐/.test(w) && /동물/.test(w) && !/액자 고정/.test(w);
  r.held = W.note(seat, T({ y: 0.30 })) === 'held' && out.length === n1 + 1;        // 이어지는 동안 또 안 적는다
  r.release = W.note(seat, T({ y: 0.30 })) === 'same';                              // 그대로가 되면 풀린다
  W.note(seat, T()); W.note(seat, T());   // 높이가 돌아오며 한 번 더 경고 → 그대로로 풀기
  r.scale = W.note(seat, T({ scale: 1.05 })) === 'warn';
  W.note(seat, T()); W.note(seat, T());
  const n2 = out.length;
  r.rig = W.note(seat, T(), { rigY: 0.3, pinned: true }) === 'warn' && /rig y 0\.300 .* · 액자 고정/.test(out[n2] || '');
  r.rigOnce = W.note(seat, T(), { rigY: 0.3, pinned: true }) === 'same' && W.note(seat, T(), { rigY: 0.3, pinned: true }) === 'same';   // 액자 고정이 그대로면 처음 한 번만
  const seat2 = { gltfRoot: {} };
  r.perRoot = W.note(seat2, T({ y: 5 })) === 'first';
  r.empty = W.note(null, T()) === null && W.note({}, T()) === null && W.note(seat, null) === null;
  return r;
}

say('── 1. 동작');
const b = behave(MOD);
chk(b.first, '  새 모델의 첫 값은 적기만 한다');
chk(b.same, '  그대로면 조용히');
chk(b.slider, '★ 평소 조작은 조용히 — 크기 0.63 사람 · 동물의 높이 슬라이더 · 높이가 있는 캐릭터의 크기 바꿈 · 욕조를 단 채 높이 · 크기 슬라이더(실제로 더한 슬라이더 몫으로 견준다)');
chk(b.under, '★ 발밑 깊이가 설명 안 되게 바뀌면 높이 경고 대신 «[높이 · 발밑]» 한 줄(전→후)');
chk(b.enterQuiet, '  입장 때 파츠가 붙기 전 → 붙은 뒤의 깊이 바뀜은 적지 않는다');
chk(b.lift, '★ 설명 안 되는 높이 바뀜은 경고 한 줄');
chk(b.text, '  경고에 지난값→지금값 · 좌석 y · 눕힘 · 슬라이더 날값 · 올라탐 · 동물');
chk(b.held && b.release, '  한 번 경고하면 다시 «그대로» 가 될 때까지 또 적지 않는다(슬라이더를 끄는 동안 쌓이지 않게)');
chk(b.scale, '  크기가 1% 넘게 바뀌어도 경고');
chk(b.rig && b.rigOnce, '  rig 가 떠 있게 바뀌면 경고 · 액자 고정 그대로면 처음 한 번만');
chk(b.perRoot, '  모델마다 따로 견준다');
chk(b.empty, '  좌석 · 모델 · 값이 없으면 null');

say('── 2. 배선');
const SRC = joinRenderer(APP);
const cut = (src, name) => { const i = src.indexOf('function ' + name + '('); if(i < 0) return ''; let d = 0; for(let k = src.indexOf('{', i); k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };
function wired(app){
  const f = cut(app, 'fitModel');
  const at = (re) => { const m = re.exec(f); return m ? m.index : -1; };   // joinRenderer 는 옮긴 모듈 접두사(charMeasureMod.)를 걷는다
  const iU = at(/const _under = (?:charMeasureMod\.)?measureUnderfootDepth\(m\); m\.position\.y \+= _under;/),
        iN = f.indexOf('fitWatchMod.note(seat, { scale: baseScale, foot: _foot, lift: _lift, under: _under, y: m.position.y },'),
        iL = f.indexOf('}finally{ restPoseMod.leave(_rest); }');
  return /const fitWatchMod = TwFitWatch\.createFitWatch\(\{ warn: \(m\)=>console\.warn\(m\) \}\);/.test(app)
    && /const _foot = (?:charMeasureMod\.)?charFootFix\(b2\); m\.position\.y = _foot;/.test(f)
    && /const _lift = clampCharY\(seat\.userY\) \* _animPos \/ _uz; m\.position\.y \+= _lift;/.test(f)
    && /\{ userY: clampCharY\(seat\.userY\), rigY: sR\.y, groupY: sG\.y, wrapRotX: \(_rest && _rest\.rot\) \? _rest\.rot\.x : 0, pinned: !!seat\.pinned, riding: !!seat\.ridingOn, animal: isAnim \}/.test(f)
    && iU > 0 && iN > iU && iL > iN;
}
chk(wired(SRC), '★ fitModel — 기본 자세 안에서 발밑 깊이를 잰 바로 뒤 note(크기 · 발바닥 · 슬라이더 · 발밑 · 높이 + rig 높이 · 눕힘 · 액자 고정 · 올라탐 · 동물)');
chk(/parts\/character\/fit-watch\.js[\s\S]*parts\/app\.js/.test(HTML.slice(HTML.indexOf('fit-watch.js') - 40)), '  html 에 app.js 보다 먼저');

say('── 3. 깨 보기');
chk(!behave(MOD.replace('((t.under - p.under) + (t.lift - p.lift))', '(t.under - p.under)')).slider, '슬라이더 몫을 설명에서 빼면 위 «평소 조작은 조용히» 가 빨강');
chk(!behave(MOD.replace("if(underMoved && !(L.fresh && p.under === 0)) warn(", "if(false) warn(")).under, '발밑 깊이 한 줄을 빼면 위 ★ 가 빨강');
chk(!behave(MOD.replace(' && Math.abs((t.under + t.lift) - (p.under + p.lift)) > TOL_Y', '')).slider, '발밑 줄에서 슬라이더 몫을 안 빼면 위 «평소 조작은 조용히»(욕조 + 슬라이더) 가 빨강');
chk(!behave(MOD.replace(' && !(L.fresh && p.under === 0)', '')).enterQuiet, '입장 한 번 빼기를 없애면 위 «입장 때» 가 빨강');
chk(!behave(MOD.replace("if(L.held) return 'held';", '')).held, '이어지는 경고 막기를 빼면 위 «또 적지 않는다» 가 빨강');
chk(!behave(MOD.replace(' && Math.abs(rigY - L.rigY) > RIG_LIFT', '')).rigOnce, 'rig 뜸을 «바뀌었을 때만» 안 보면 위 «액자 고정은 처음 한 번» 이 빨강');
chk(!wired(SRC.replace('fitWatchMod.note(seat,', 'void(seat,')), 'fitModel 에서 note 를 빼면 위 2절 ★ 가 빨강');

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

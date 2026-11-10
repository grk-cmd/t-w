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

const T = (o) => Object.assign({ scale: 1.0, foot: -0.13, userY: 0, under: 0, y: -0.13 }, o);
function behave(src){
  const M = loadWin(src), out = [], r = {};
  const W = M.createFitWatch({ warn: (m) => out.push(m) });
  const seat = { gltfRoot: {} };
  r.first = W.note(seat, T()) === 'first' && out.length === 0;
  r.same = W.note(seat, T(), { rigY: 0.001 }) === 'same';
  r.under = W.note(seat, T({ under: 0.3, y: 0.17 })) === 'same' && W.note(seat, T()) === 'same';        // 욕조 붙이고 떼기
  r.slider = W.note(seat, T({ userY: 0.2, y: 0.07 })) === 'same' && W.note(seat, T()) === 'same';      // 높이 슬라이더
  r.lift = W.note(seat, T({ y: 0.25 }), { rigY: 0, pinned: false, riding: true, wrapRotX: -1.5, animal: true }) === 'warn' && out.length === 1;
  r.text = /^\[높이\] 다시 맞춘 캐릭터 높이가 설명 안 되게 바뀜 — y 0\.250→/.test(out[0] || '') === false && /y -0\.130→0\.250/.test(out[0] || '') && /올라탐/.test(out[0]) && /동물/.test(out[0]) && /눕힘 -1\.500/.test(out[0]) && !/액자 고정/.test(out[0]);
  W.note(seat, T());
  r.scale = W.note(seat, T({ scale: 1.05 })) === 'warn';
  W.note(seat, T());
  r.rig = W.note(seat, T(), { rigY: 0.3, pinned: true }) === 'warn' && /rig y 0\.300 · 눕힘 0\.000 · 액자 고정/.test(out[out.length - 1]);
  const seat2 = { gltfRoot: {} };
  r.perRoot = W.note(seat2, T({ y: 5 })) === 'first';
  r.empty = W.note(null, T()) === null && W.note({}, T()) === null && W.note(seat, null) === null;
  return r;
}

say('── 1. 동작');
const b = behave(MOD);
chk(b.first, '  새 모델의 첫 값은 적기만 한다');
chk(b.same, '  그대로면 조용히');
chk(b.under && b.slider, '★ 발밑 깊이(욕조 · 방석) · 높이 슬라이더로 설명되는 바뀜은 조용히');
chk(b.lift, '★ 설명 안 되는 높이 바뀜은 경고 한 줄');
chk(b.text, '  경고에 지난값→지금값 · 상태(올라탐 · 동물 · 눕힘)를 적는다');
chk(b.scale, '  크기가 1% 넘게 바뀌어도 경고');
chk(b.rig, '  다시 맞출 때 rig 가 떠 있으면(액자 고정 등) 경고 · 상태를 적는다');
chk(b.perRoot, '  모델마다 따로 견준다');
chk(b.empty, '  좌석 · 모델 · 값이 없으면 null');

say('── 2. 배선');
const SRC = joinRenderer(APP);
const cut = (src, name) => { const i = src.indexOf('function ' + name + '('); if(i < 0) return ''; let d = 0; for(let k = src.indexOf('{', i); k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };
function wired(app){
  const f = cut(app, 'fitModel');
  const at = (re) => { const m = re.exec(f); return m ? m.index : -1; };   // joinRenderer 는 옮긴 모듈 접두사(charMeasureMod.)를 걷는다
  const iU = at(/const _under = (?:charMeasureMod\.)?measureUnderfootDepth\(m\); m\.position\.y \+= _under;/),
        iN = f.indexOf('fitWatchMod.note(seat, { scale: baseScale, foot: _foot, userY: clampCharY(seat.userY), under: _under, y: m.position.y },'),
        iL = f.indexOf('}finally{ restPoseMod.leave(_rest); }');
  return /const fitWatchMod = TwFitWatch\.createFitWatch\(\{ warn: \(m\)=>console\.warn\(m\) \}\);/.test(app)
    && /const _foot = (?:charMeasureMod\.)?charFootFix\(b2\); m\.position\.y = _foot;/.test(f)
    && /\{ rigY: sR\.y, wrapRotX: \(_rest && _rest\.rot\) \? _rest\.rot\.x : 0, pinned: !!seat\.pinned, riding: !!seat\.ridingOn, animal: isAnim \}/.test(f)
    && iU > 0 && iN > iU && iL > iN;
}
chk(wired(SRC), '★ fitModel — 기본 자세 안에서 발밑 깊이를 잰 바로 뒤 note(크기 · 발바닥 · 슬라이더 · 발밑 · 높이 + rig 높이 · 눕힘 · 액자 고정 · 올라탐 · 동물)');
chk(/parts\/character\/fit-watch\.js[\s\S]*parts\/app\.js/.test(HTML.slice(HTML.indexOf('fit-watch.js') - 40)), '  html 에 app.js 보다 먼저');

say('── 3. 깨 보기');
chk(!behave(MOD.replace('const explained = (t.under - p.under) + (t.userY - p.userY);', 'const explained = 0;')).under, '설명되는 바뀜을 빼면 위 «욕조 · 슬라이더는 조용히» 가 빨강');
chk(!behave(MOD.replace('if(Math.abs(dy) <= TOL_Y && ds <= TOL_SCALE && !rigUp) return \'same\';', "return 'same';")).lift, '늘 조용히 하면 위 «경고 한 줄» 이 빨강');
chk(!behave(MOD.replace('last.set(root, { ...t });', '')).same, '지난값을 안 남기면 위 «그대로면 조용히» 가 빨강');
chk(!wired(SRC.replace('fitWatchMod.note(seat,', 'void(seat,')), 'fitModel 에서 note 를 빼면 위 2절 ★ 가 빨강');

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

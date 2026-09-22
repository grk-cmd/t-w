#!/usr/bin/env node
/* ═══ 🕒 sim-focus-cap.js — 누적 상한과 레벨 상한은 다른 값이다 (CHECKS.md §30) ═══
   [무엇을 지키나]
     예전엔 `FOCUS_LEVEL_CAP_HOURS`(999) 하나가 두 몫을 했다 — 레벨을 999 에서 접는 것과,
     **누적 초 자체를 999시간에서 멈추는 것.** 그래서 회차(999 를 채우면 ★ + 레벨 1부터)를
     붙일 재료가 안 쌓였다. 이제 누적만 100회차(99,900시간)까지 열어 둔다.

   [이 검사가 있는 이유 — 셋]
     ① 같은 상한이 **세 파일에 흩어져 있다**(app.js · firebase-init.js · 규칙 파일).
        하나만 올리면 조용히 안 맞고, 서버 쪽이 낮으면 잘리는 게 아니라 **쓰기가 통째로 거부**된다.
     ② 되돌아가기 쉬운 자리다. `capSec = FOCUS_LEVEL_CAP_HOURS*3600` 은 예전 모양이라
        무심코 복원되면 누적이 다시 999시간에서 멈춘다 — 화면에는 아무 표시도 안 난다.
     ③ **레벨 표시와 별은 같이 가야 한다.** 레벨을 먼저 모듈로로 바꾸면 999 를 넘긴 사람이
        별 없이 Lv.1 로 떨어져 보인다. 4절이 그 짝을 묶어 둔다.

   실행: node sim-focus-cap.js   (app.js 가 있는 폴더에서)
   종료 코드: 0=통과 · 1=실패 · 2=원본 없음
*/
'use strict';
const fs = require('fs');
const path = require('path');

function load(name){
  for (const p of [path.join(process.cwd(), name), path.join(__dirname, name)]){
    try { return fs.readFileSync(p, 'utf8'); } catch (_){}
  }
  return null;
}
const APP = load('app.js');
if (!APP){ console.log('? app.js 를 못 찾음 — app.js 가 있는 폴더에서 실행할 것'); process.exit(2); }
const FI    = load('firebase-init.js');
const RULES = load('firebase-database-rules.json');

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log('  ✓ ' + m); };
const bad = (m) => { fail++; console.log('  ✗ ' + m); };
const t   = (c, m) => c ? ok(m) : bad(m);
const num = (n) => Number(n).toLocaleString('en-US');

function grab(src, header){
  const i = src.indexOf(header);
  if (i < 0) return null;
  let j = src.indexOf('{', i), depth = 0;
  if (j < 0) return null;
  for (let k = j; k < src.length; k++){
    if (src[k] === '{') depth++;
    else if (src[k] === '}'){ depth--; if (!depth) return src.slice(i, k + 1); }
  }
  return null;
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/* ═══ 1절. app.js — 두 상한이 갈려 있다 ═══════════════════════════════════ */
console.log('\n[1] app.js — 상한 선언');

const decl = (APP.match(/const\s+FOCUS_(?:CYCLE_SEC|CYCLE_CAP|TOTAL_CAP_SEC)\s*=[^;]+;/g) || []);
t(decl.length === 3, `FOCUS_CYCLE_SEC · FOCUS_CYCLE_CAP · FOCUS_TOTAL_CAP_SEC 선언 (지금 ${decl.length}개)`);
t(/const\s+FOCUS_LEVEL_CAP_HOURS\s*=\s*999/.test(APP), 'FOCUS_LEVEL_CAP_HOURS 는 999 그대로 (레벨 표시용)');

let C = null;
try {
  C = new Function('const FOCUS_LEVEL_CAP_HOURS=999;\n' + decl.join('\n')
    + '\nreturn { cycle:FOCUS_CYCLE_SEC, n:FOCUS_CYCLE_CAP, total:FOCUS_TOTAL_CAP_SEC };')();
} catch (e){ bad('상한 상수를 계산하지 못했다 — ' + e.message); }

if (C){
  t(C.cycle === 999 * 3600, `회차 한 바퀴 = 999시간 (${num(C.cycle)}초)`);
  t(C.n >= 2, `회차를 ${C.n}개 열어 뒀다 — 1이면 예전과 같다(의미 없음)`);
  t(C.total === C.cycle * C.n, `누적 상한 = 한 바퀴 × 회차 수 (${num(C.total)}초 = ${num(C.total / 3600)}시간)`);
  t(C.total > C.cycle, '누적 상한이 레벨 상한보다 크다 ★ 이 검사의 본론');
  /* RTDB 는 정수를 배정도로 다룬다 — 안전 정수 밖이면 조용히 값이 뭉갠다. */
  t(Number.isSafeInteger(C.total), '누적 상한이 안전 정수 안이다');
}

/* ═══ 2절. app.js — 999시간을 넘겨도 쌓인다 (실행) ═══════════════════════ */
console.log('\n[2] app.js — 적립·레벨 (떼어서 실행)');

const fnAdd = grab(APP, 'function addFocusSeconds(');
const fnLv  = grab(APP, 'function getFocusLevel(');
t(!!fnAdd, 'addFocusSeconds() 를 뽑았다');
t(!!fnLv,  'getFocusLevel() 을 뽑았다');

t(!!fnAdd && /FOCUS_TOTAL_CAP_SEC/.test(strip(fnAdd)), '적립이 누적 상한을 본다');
t(!!fnAdd && !/FOCUS_LEVEL_CAP_HOURS\s*\*\s*3600/.test(strip(fnAdd)),
  '적립에 옛 모양(FOCUS_LEVEL_CAP_HOURS*3600)이 없다 — 되돌아가기 쉬운 자리');

const fnSync = grab(APP, 'async function syncFocusTotalToServer(') || grab(APP, 'function syncFocusTotalToServer(');
t(!!fnSync && /FOCUS_TOTAL_CAP_SEC/.test(strip(fnSync)) && !/FOCUS_LEVEL_CAP_HOURS\s*\*\s*3600/.test(strip(fnSync)),
  '서버 동기화도 누적 상한을 본다 (여기만 낮으면 올린 만큼이 매번 깎인다)');

function runAdd(start, add){
  const f = new Function('ctx', `
    let _focusTotalSec = ctx.start, _focusTodaySec = 0, _focusSessionSec = 0;
    const FOCUS_LEVEL_CAP_HOURS = 999, FOCUS_CYCLE_SEC = 999*3600;
    const FOCUS_CYCLE_CAP = ctx.n, FOCUS_TOTAL_CAP_SEC = ctx.cap;
    const FOCUS_TOTAL_KEY='a', FOCUS_TODAY_SEC_KEY='b', FOCUS_TODAY_DATE_KEY='c';
    const localStorage = { getItem: () => null, setItem: () => {} };
    const _focusDayStr = () => 'd';
    const _pushLevelIfChanged = () => {};
    ${fnAdd}
    addFocusSeconds(ctx.add);
    return _focusTotalSec;
  `);
  return f({ start, add, cap: C ? C.total : 999 * 3600 * 100, n: C ? C.n : 100 });
}
function runLevel(total){
  return new Function('ctx', `
    const _focusTotalSec = ctx.total, FOCUS_LEVEL_CAP_HOURS = 999, FOCUS_CYCLE_SEC = 999*3600;
    ${fnLv}
    return getFocusLevel();
  `)({ total });
}

if (fnAdd && fnLv && C){
  try {
    const H = 3600;
    t(runAdd(999 * H, H) === 1000 * H, '★ 999시간에서 한 시간 더 일하면 1000시간이 된다 (예전엔 999에서 멈췄다)');
    t(runAdd(0, H) === H, '평범한 적립은 그대로');
    t(runAdd(C.total, H) === C.total, `누적 상한(${num(C.total / 3600)}시간)에서는 멈춘다`);
    t(runAdd(C.total - 10, H) === C.total, '상한을 넘겨 더하면 상한에서 잘린다');
    t(runLevel(998 * H) === 999, '레벨은 998시간에서 999 (1시간 = 1레벨)');
    t(runLevel(5000 * H) === 999, '★ 999시간을 넘겨도 레벨 표시는 999 에서 접힌다 — 별이 붙기 전까지');
  } catch (e){ bad('적립·레벨을 실행하지 못했다 — ' + e.message); }
}

/* ═══ 3절. 세 파일의 상한이 같은 값인가 ═══════════════════════════════════ */
console.log('\n[3] 상한 한 벌 — app.js · firebase-init.js · 규칙');

if (!FI) console.log('  · firebase-init.js 가 없다 — 어댑터 대조는 건너뜀');
else {
  const fnSFT = grab(FI, 'async syncFocusTotal(');
  const m = fnSFT && strip(fnSFT).match(/const\s+CAP\s*=\s*([0-9*\s]+);/);
  if (!m) bad('firebase-init.js syncFocusTotal 의 CAP 을 못 찾았다');
  else {
    let v = null;
    try { v = new Function('return ' + m[1])(); } catch (_){}
    t(!!C && v === C.total, `어댑터 CAP 이 app.js 와 같다 (${num(v)})`);
  }
}

if (!RULES) console.log('  · 규칙 파일이 없다 — 서버 상한 대조는 건너뜀 (게시 전이면 여기가 진짜 관문이다)');
else {
  const m = RULES.match(/newData\.child\('totalSec'\)\.val\(\)\s*<=\s*(\d+)/);
  if (!m) bad("규칙 파일에서 users/$userId/focus 의 totalSec 상한을 못 찾았다");
  else t(!!C && Number(m[1]) === C.total,
    `규칙의 totalSec 상한이 app.js 와 같다 (${num(Number(m[1]))}) ★ 낮으면 쓰기가 통째로 거부된다`);
  /* 랭킹(leaderboard)이 생기면 sec 상한도 같은 값이어야 한다 — 아직 없으면 알림만. */
  const lb = RULES.indexOf('"leaderboard"');
  if (lb < 0) console.log('  · 규칙에 leaderboard 블록이 아직 없다 (핸드오프 B §1) — 넣을 때 sec 상한을 같은 값으로');
  else {
    const seg = RULES.slice(lb, lb + 1200);
    const s2 = seg.match(/newData\.val\(\)\s*<=\s*(\d+)/);
    t(!!s2 && !!C && Number(s2[1]) === C.total, '랭킹 sec 상한도 같은 값이다');
  }
}

/* ═══ 4절. 레벨 표시와 별은 같이 간다 ═════════════════════════════════════ */
console.log('\n[4] 회차 표시 — 반쪽만 가지 않게');

const lvMod   = !!fnLv && /%\s*FOCUS_CYCLE_SEC/.test(strip(fnLv));
const starOn  = /['"]lv-star['"]/.test(strip(APP)) || /lv-star/.test(strip(APP));
t(lvMod === starOn,
  lvMod === starOn
    ? (lvMod ? '레벨 모듈로와 별 붙이기가 둘 다 있다' : '아직 둘 다 없다 — 그릇만 키운 단계 (다음 단계에서 함께)')
    : (lvMod ? '★ 레벨만 모듈로가 됐다 — 999 를 넘긴 사람이 별 없이 Lv.1 로 보인다'
             : '★ 별만 붙었다 — 레벨이 안 접히면 별이 안 는다'));
t(/getFocusLevel\(\)/.test(strip(APP)), '레벨을 읽는 통로는 getFocusLevel() 하나 그대로');

/* ── 판정 ─────────────────────────────────────────────────────────────────── */
console.log('');
console.log(`통과 ${pass} · 실패 ${fail}`);
if (fail) console.log(`실패 ${fail}건`);
else console.log('전부 통과 ✅');
process.exit(fail ? 1 : 0);

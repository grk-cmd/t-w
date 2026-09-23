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
     ③ **표시와 별은 같이 가야 하고, 해금 레벨은 접히면 안 된다.** 4절(개정 70 에서 다시 씀)이 둘을 묶는다.

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
    t(runLevel(5000 * H) === 999, '★ 999시간을 넘겨도 해금 레벨(getFocusLevel)은 999 에 머문다 — 해금·가챠 기준이라 모듈로가 아니다(개정 70)');
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

/* ═══ 4절. 해금 레벨과 표시 레벨은 갈린다 · 표시와 별은 같이 간다 (개정 70 에서 다시 씀) ═══════════════
   [옛 판정] «getFocusLevel 이 모듈로가 되는 것 ↔ 별이 붙는 것» 이 짝이었다(handoff §3-1-b 의 옛 계획).
   [왜 바꿨나] getFocusLevel 은 표시만이 아니라 **해금 기준**이다 — 춤 · 책상 · 💣 · 날리기 색(받는 쪽 판정까지) · 동물 ·
     가챠 뽑기 수. 모듈로로 바꾸면 2회차 사람이 Lv.1 이 되어 전부 다시 잠기고 뽑기 수가 줄어든다.
   [지금] 해금 레벨은 999 에서 멈추고, 표시는 myFocusShow()(이번 바퀴 레벨 + 별)가 따로 낸다.
     «반쪽만 가지 않게» 는 이제 **표시 쪽 모듈로 ↔ 별 붙이기** 의 짝이다. */
console.log('\n[4] 회차 표시 — 해금은 누적 · 표시는 이번 바퀴 + 별');

const CODE4 = strip(APP);
const lvMod   = !!fnLv && /%\s*FOCUS_CYCLE_SEC/.test(strip(fnLv));
t(!lvMod, '★ getFocusLevel() 은 모듈로가 아니다 — 해금·가챠가 쓰는 값이다');
const fnCyc  = grab(APP, 'function focusCycleOf(');
const fnShow = grab(APP, 'function myFocusShow(');
const dispMod = !!fnCyc && /%\s*FOCUS_CYCLE_SEC/.test(strip(fnCyc)) && !!fnShow && /focusCycleOf\(_focusTotalSec\)/.test(strip(fnShow));
const starOn  = /lv-star/.test(CODE4);
t(dispMod === starOn,
  dispMod === starOn
    ? (dispMod ? '표시 모듈로(focusCycleOf · myFocusShow)와 별 붙이기가 둘 다 있다' : '아직 둘 다 없다')
    : (dispMod ? '★ 표시만 모듈로가 됐다 — 999 를 넘긴 사람이 별 없이 Lv.1 로 보인다'
               : '★ 별만 붙었다 — 표시 레벨이 안 접힌다'));
/* 표시 자리는 전부 myFocusShow 를 거친다 — 좌석 루프 · 내 정보 머리 · 마이홈 카드 */
t(/const st = myFocusShow\(\), lv = st \? st\.lv : getFocusLevel\(\);/.test(CODE4), '내 좌석 — 회차면 이번 바퀴 레벨 + 별');
t(/if\(lv\)\{ let n = 1, st = null; try\{ n = getFocusLevel\(\); st = myFocusShow\(\); \}catch\(_\)\{\} _plFillLv\(lv, n, st\); \}/.test(CODE4), '[내 정보] 머리 배지도 myFocusShow');
/* 보내는 level 은 해금 레벨 그대로 — 받는 쪽 게이트(날리기 색)와 옛 판 */
t(/level:myLevel, exp:_myExpCells\(\), \.\.\.myStarOut\(\),/.test(CODE4) && /myLevel=getFocusLevel\(\);/.test(CODE4), '★ 프리즌스 level 은 해금 레벨 · 표시는 cyc/clv/starC 로 따로');
const setProfCalls = (CODE4.match(/setMyProfile\([^;]*\)/g) || []);
t(setProfCalls.length >= 3 && setProfCalls.every(c => /myStarProfileOut\(\)|, so\)/.test(c)) && /const so = myStarProfileOut\(\)/.test(CODE4), `★ 프로필 쓰기는 매번 회차를 싣는다 — 고른 색이 없으면 비워서(서버 값 지킴 · 개정 71 · ${setProfCalls.length}곳)`);
/* 경험치 칸 — 999 에서 멈추던 분기가 없다 */
const fnCells = grab(APP, 'function expCellsFromSec(');
t(!!fnCells && !/FOCUS_LEVEL_CAP_HOURS/.test(strip(fnCells)), '경험치 칸은 이번 시간 안의 진행도 — 999 에서 가득 찬 채 멈추지 않는다');
/* 떼어서 실행 — 표시 */
if (fnCyc && fnShow){
  try {
    const run = (total) => new Function('ctx', `
      const _focusTotalSec = ctx.total, FOCUS_CYCLE_SEC = 999*3600;
      const getStarColor = () => '#ffd76a';
      ${fnCyc}
      ${fnShow}
      return myFocusShow();`)({ total });
    const H = 3600;
    t(run(998 * H) === null, '998시간 — 회차 없음(null)');
    const a = run(999 * H), b = run(999 * 2 * H + 341 * H + 10);
    t(a && a.cyc === 1 && a.lv === 1 && b && b.cyc === 2 && b.lv === 342, '★ 999시간 = 1회차 Lv.1 · 2회차 341시간 = Lv.342');
  } catch (e){ bad('표시를 실행하지 못했다 — ' + e.message); }
}
t(/getFocusLevel\(\)/.test(CODE4), '해금을 읽는 통로는 getFocusLevel() 하나 그대로');

/* ═══ 5절. 남의 회차 받기 · 배지 그리기 (개정 70 · 떼어서 실행) ═══════════════════════════ */
console.log('\n[5] 받기(starFromRemote) · 배지(_plFillLv) · 칠하기(_starPaint)');
{
  const need = ['function starFromRemote(', 'function _starColorOk(', 'function _plFillLv(', 'function _starPaint(', 'function lvStarStr(',
                'function lvStarBadgeClass(', 'function lvBadgeClass(', 'function lvTierNum('].map(h => grab(APP, h));
  const palS = APP.indexOf('const STAR_PALETTE = ['), palE = APP.indexOf('];', palS) + 2;
  const tiers = (APP.match(/const LV_TIERS = \[[\s\S]*?\];/) || [''])[0];
  if (!need.every(Boolean) || palS < 0 || !tiers) bad('5절 재료를 못 뽑았다');
  else try {
    /* 가짜 요소 — textContent 에 쓰면 자식이 비워진다(진짜 DOM 과 같게 · _plFillLv 가 그걸로 요소를 재활용한다). */
    const mkEl = () => { let tc = ''; const e = { className: '', children: [], style: { p: {}, setProperty(k, v){ this.p[k] = v; }, removeProperty(k){ delete this.p[k]; } },
      appendChild(c){ this.children.push(c); return c; } };
      Object.defineProperty(e, 'textContent', { get: () => tc, set: v => { tc = v; e.children = []; } }); return e; };
    const E = new Function('document', `
      const FOCUS_CYCLE_CAP = 100, FOCUS_LEVEL_CAP_HOURS = 999;
      ${APP.slice(palS, palE)}
      ${tiers}
      ${need.join('\n')}
      return { starFromRemote, _plFillLv };`)({ createElement: () => mkEl(), createTextNode: t => ({ text: t }) });
    const R = E.starFromRemote;
    t(R(null) === null && R({}) === null && R({ cyc: 0 }) === null && R({ level: 999 }) === null, '회차 없음 · 옛 판(필드 없음) → null (평소 배지)');
    const a = R({ cyc: 2, clv: 342, starC: '#ff7ad0' });
    t(a && a.cyc === 2 && a.lv === 342 && a.color === '#ff7ad0', '2회차 · 342 · 분홍 그대로');
    const b = R({ cyc: 5000, clv: 99999, starC: '#000000' }), c = R({ cyc: 3, clv: 0, starC: 'red;background:url(x)' });
    t(b && b.cyc === 100 && b.lv === 999 && b.color === '#ffd76a' && c && c.lv === 1 && c.color === '#ffd76a',
      '★ 범위 밖은 자르고 팔레트 밖 색(어두운 색 · 주입 문자열)은 첫 색으로 — style 에 들어가도 안전');
    const el = mkEl();
    E._plFillLv(el, 999, a);
    t(el.className === 'mh-flv lv-star lvx' && el.children[0].className === 'pre' && el.children[0].textContent === '★' && el.children[1].text === '342' && el.style.p['--pre-c'] === '#ff7ad0',
      '★ 회차 배지 — lv-star lvx(shine 없음) · 흰 별 «★» · 이번 바퀴 342 · --pre-c');
    E._plFillLv(el, 342, null);
    t(/^mh-flv t9/.test(el.className) && el.children[0].className === 'lvp' && !('--pre-c' in el.style.p), '같은 요소를 평소 배지로 다시 쓰면 --pre-c 를 걷는다(재활용 요소)');
    E._plFillLv(el, null, null);
    t(el.className === '', '레벨 모르는 상대(옛 판)는 배지를 숨긴다 — 예전 그대로');
  } catch (e){ bad('5절을 실행하지 못했다 — ' + e.message); }
}

/* ═══ 6절. 색이 계정을 따라간다 (개정 71 · 떼어서 실행) ═══════════════════════════════════
   원본 = 이 기기 tw.starColor · 서버 사본 = 프로필 starC. 새 기기(고른 값 없음)는 받아 오고, 받기 전에 프로필을 써도
   서버의 색을 금색으로 덮지 않는다(starC 를 비워 보내고 firebase-init 이 기존 값을 지킨다). 로그아웃하면 지운다. */
const PENDING6 = [];
console.log('\n[6] 색이 계정을 따라간다 — 받아 오기 · 비워 보내기 · 서버 값 지키기 · 로그아웃');
{
  const hs = ['function _starColorOk(', 'function getStarColor(', 'function _starPicked(', 'function setStarColor(', 'function focusCycleOf(',
              'function myFocusShow(', 'function myStarOut(', 'function myStarProfileOut(', 'async function _adoptStarColorFromProfile('];
  const fs6 = hs.map(h => grab(APP, h));
  const palS = APP.indexOf('const STAR_PALETTE = ['), palE = APP.indexOf('];', palS) + 2;
  if (!fs6.every(Boolean)) bad('6절 재료를 못 뽑았다 — ' + hs.filter((h, i) => !fs6[i]).join(' '));
  else {
    const mk = (o) => {
      const LS = { st: Object.assign({}, o.st || {}), getItem(k){ return k in this.st ? this.st[k] : null; }, setItem(k, v){ this.st[k] = String(v); } };
      const calls = [];
      const api = { fetchProfileStarC: async (uid) => { calls.push(uid); if (o.pickDuring) LS.st['tw.starColor'] = o.pickDuring; return o.remote === undefined ? null : o.remote; } };
      const E = new Function('localStorage', 'window', 'env', `
        const STAR_COLOR_KEY = 'tw.starColor', FOCUS_CYCLE_SEC = 999*3600;
        let _focusTotalSec = env.total;
        const getMyUserId = () => env.uid;
        const firebaseAPI = window.firebaseAPI;   // 브라우저에선 전역 — 여기선 window 에서 꺼내 둔다
        ${APP.slice(palS, palE)}
        ${fs6.join('\n')}
        return { getStarColor, myStarOut, myStarProfileOut, adopt: _adoptStarColorFromProfile };`)(LS, { firebaseAPI: api }, { total: o.total || 0, uid: o.uid === undefined ? 'U1' : o.uid });
      return Object.assign(E, { LS, calls });
    };
    const C = 999 * 3600, P0 = '#ffd76a', PINK = '#ff7ad0', MINT = '#6ef0a0';
    PENDING6.push((async () => {
      let v = mk({ total: 2 * C, remote: PINK });
      let r = v.myStarProfileOut();
      t(r.cyc === 2 && r.starC === null && v.myStarOut().starC === P0, '★ 고른 값이 없으면 프로필엔 starC 를 비워 보낸다 — 방(프리즌스)엔 보이는 색(금)');
      t(await v.adopt() === true && v.LS.st['tw.starColor'] === PINK && v.getStarColor() === PINK && v.myStarProfileOut().starC === PINK, '★ 새 기기 — 프로필 starC(분홍)를 받아 와 이 기기 값으로');
      const n = v.calls.length; await v.adopt();
      t(v.calls.length === n, '  이미 고른 값이 있으면 다시 읽지 않는다(이 기기 값이 원본)');
      v = mk({ total: 2 * C, st: { 'tw.starColor': MINT }, remote: PINK });
      t(await v.adopt() === false && v.LS.st['tw.starColor'] === MINT && !v.calls.length, '  이 기기에서 고른 색은 서버 값에 덮이지 않는다');
      v = mk({ total: 2 * C, remote: '#000000' });
      t(await v.adopt() === false && !('tw.starColor' in v.LS.st), '  팔레트 밖 색(어두운 색)은 안 받는다');
      v = mk({ total: 2 * C, remote: PINK, pickDuring: MINT });
      t(await v.adopt() === false && v.LS.st['tw.starColor'] === MINT, '  읽는 사이 이 기기에서 골랐으면 그쪽이 이긴다');
      v = mk({ total: 2 * C, remote: PINK, uid: null });
      t(await v.adopt() === false && !v.calls.length, '  uid 없으면(로그인 전) 안 읽는다');
      v = mk({ total: 10, remote: PINK });
      t(v.myStarProfileOut().cyc === null && v.myStarProfileOut().starC === null, '  회차 전 — 보내는 회차 필드 없음(예전 그대로)');
    })().catch(e => bad('6절 실행 실패 — ' + e.message)));
  }
  /* 부르는 자리 · 로그아웃 목록 */
  const initMh = CODE4.slice(CODE4.indexOf('try{ await _adoptStarColorFromProfile(); }catch(_){}'), CODE4.indexOf('try{ await _adoptStarColorFromProfile(); }catch(_){}') + 400);
  t(/_adoptStarColorFromProfile\(\); \}catch\(_\)\{\}\s*try\{ await firebaseAPI\.setMyProfile\(myId,/.test(initMh), '★ 마이홈 초기화 — 받아 오기가 첫 프로필 쓰기보다 먼저');
  const ats = grab(APP, 'async function _applyTransferSnapshot(') || '';
  t(/await _adoptStarColorFromProfile\(\)/.test(strip(ats)), '  로그인 복원 끝에서도 받아 온다(로그아웃이 지웠으니)');
  const keys = (APP.match(/const ACCOUNT_LOCAL_KEYS = \(\)=>\[([\s\S]*?)\n\];/) || [])[1] || '';
  t(/'tw\.starColor'/.test(keys), '★ tw.starColor 는 로그아웃 목록에 — 돌아올 길(프로필 starC)이 생겼다');
  /* firebase-init — 비어 온 starC 는 서버 값을 지킨다 */
  if (FI){
    const fp = grab(FI, 'async setMyProfile(');
    const fr = grab(FI, 'async fetchProfileStarC(');
    t(!!fr && /profile\/starC/.test(fr) && /\^#\[0-9a-f\]\{6\}\$/.test(fr), '  firebase-init fetchProfileStarC — 프로필 starC 한 값 · #rrggbb 만');
    if (fp) PENDING6.push((async () => {
      const run = async (star, cur) => {
        const env = { log: [], cur, out: null };
        const g = new Function('env', `
          const _whenAuthReady = async () => {};
          const db = {}; const ref = (d, p) => ({ p });
          const get = async (r) => { env.log.push('get:' + r.p); return { val: () => env.cur }; };
          const set = async (r, v) => { env.log.push('set:' + r.p); env.out = v; };
          return { ${fp} };`)(env);
        await g.setMyProfile('U1', '키위', 999, star);
        return env;
      };
      let e = await run({ cyc: 2, clv: 342, starC: null }, '#ff7ad0');
      t(e.out.cyc === 2 && e.out.clv === 342 && e.out.starC === '#ff7ad0' && e.log[0] === 'get:users/U1/profile/starC', '★ starC 가 비어 오면 서버의 기존 색을 지킨다(읽기 한 번 → set)');
      e = await run({ cyc: 2, clv: 342, starC: '#6ef0a0' }, '#ff7ad0');
      t(e.out.starC === '#6ef0a0' && !e.log.some(l => /^get:/.test(l)), '  고른 색이 오면 그걸 쓰고 읽지 않는다');
      e = await run({ cyc: null, clv: null, starC: null }, '#ff7ad0');
      t(!('cyc' in e.out) && !('starC' in e.out) && !e.log.some(l => /^get:/.test(l)), '  회차 없으면 필드 없음 · 읽기 없음(예전 비용 그대로)');
    })().catch(e => bad('6절 firebase-init 실행 실패 — ' + e.message)));
  }
}

/* ── 판정 ─────────────────────────────────────────────────────────────────── */
/* 6절이 비동기라 판정은 그 뒤에 — 6절의 줄은 찍힌 순서가 섞일 수 있다(판정 수는 같다). */
Promise.all(PENDING6).then(() => {
  console.log('');
  console.log(`통과 ${pass} · 실패 ${fail}`);
  if (fail) console.log(`실패 ${fail}건`);
  else console.log('전부 통과 ✅');
  process.exit(fail ? 1 : 0);
});

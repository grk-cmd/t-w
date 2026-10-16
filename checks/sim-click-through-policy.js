/* ═══ 🖱 sim-click-through-policy.js — 클릭 통과 판단 규칙 한 곳(click-through-policy.js) ═══════════════
   «클릭 통과로 바꿀지» 판단이 네 길(렌더러 mousemove · 재판정 · 고착 회복 사다리 / main ⓔ·ⓕ·ⓖ)에 흩어져 제보마다 한 길만 고쳐 왔다.
   규칙을 순수 함수 모듈 하나로 묶었다 — 렌더러는 deps.clickPolicy, main 은 require 로 같은 파일을 쓴다.
   ・1절: 모듈 모양 · 상수 값(동작을 고정한다 — 값을 바꾸면 여기가 빨강)
   ・2절: 렌더러 표 — 상황 → 결정(경계값 포함)
   ・3절: main 표 — 상황 → 결정(경계값 · 회수 이유 글)
   ・4절: 연결 — desktop-run.js · app.js · html · smoke · main.js 가 이 모듈을 부른다
   ・5절: 같은 조건을 다른 파일에 다시 쓰면 빨강(+ 일부러 깨 보기)
   [실행] 스테이징(node checks/run.js) 또는 저장소 루트에서. */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const d of [process.cwd(), __dirname, path.join(__dirname, '..')]){ try{ return fs.readFileSync(path.join(d, f), 'utf8'); }catch(_){} } return null; };
const firstOf = (...fs_) => { for(const f of fs_){ const t = read(f); if(t != null) return [f, t]; } return [null, null]; };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const [, POLSRC] = firstOf('click-through-policy.js', 'parts/launcher/click-through-policy.js', 'app/parts/launcher/click-through-policy.js');
const [, RUN] = firstOf('desktop-run.js', 'parts/launcher/desktop-run.js', 'app/parts/launcher/desktop-run.js');
const [, APP] = firstOf('app.js', 'parts/app.js', 'app/parts/app.js');
const [, HTML] = firstOf('desk-companion-prototype.html', 'app/desk-companion-prototype.html');
const [, MAIN] = firstOf('main.js');
const [, SMOKE] = firstOf('smoke.js', 'checks/smoke.js');
if(!POLSRC || !RUN || !APP || !HTML || !MAIN){ say('  ? 원본 못 찾음 — click-through-policy.js · desktop-run.js · app.js · html · main.js'); process.exit(2); }

function load(src){
  const m = { exports: {} }, w = {};
  new Function('module', 'exports', 'window', src)(m, m.exports, w);
  return { mod: m.exports, win: w.TwClickThroughPolicy };
}
const L = load(POLSRC), P = L.mod;

/* ── 1. 모듈 모양 · 상수 ── */
say('── 1. 모듈 모양 · 상수 값');
chk(P && L.win === P, 'module.exports(main) 와 window.TwClickThroughPolicy(렌더러)가 같은 것');
const FNS = ['holdForDrag', 'moveStep', 'hitStep', 'pointerDownStep', 'pokeStep', 'clickMayKick', 'kickStep',
  'mainArmed', 'stallStep', 'staleCaptureStep', 'foreignInputStep', 'deferExpiredStep'];
chk(FNS.every(n => typeof P[n] === 'function'), '판단 함수 ' + FNS.length + '개');
const CONSTS = { MOVE_GAP_RECEIVING_MS: 40, MOVE_GAP_PASSING_MS: 10, PASS_DEBOUNCE_MS: 150, KICK_GAP_MS: 1500, MOVE_ALIVE_MS: 3000,
  POKE_ALIVE_MS: 3000, KICK_REARM_STAGES: 2, KICK_PROBE_MS: 800, RENDERER_STALL_MS: 12000, FWD_STALE_MS: 1200, FWD_MOVE_MIN_PX: 60,
  FWD_REFIRE_MS: 2000, FGN_CHAR_MARGIN: 1.5, FGN_BOUNDS_FRESH_MS: 3000, FGN_TRUST_MS: 2000, FGN_DEFER_MS: 600 };
const badC = Object.keys(CONSTS).filter(k => P[k] !== CONSTS[k]);
chk(!badC.length, '상수 ' + Object.keys(CONSTS).length + '개가 묶기 전 값 그대로' + (badC.length ? ' — 다름: ' + badC.join(' · ') : ''));
chk(!/document\.|companion\.|setTimeout|setIgnoreMouse|firebaseAPI/.test(strip(POLSRC)), '순수 함수 — DOM · IPC · 타이머를 안 본다');

/* 표 돌리기 — [이름, 입력, 기대] 행마다 한 줄. 객체 결과는 기대에 적은 칸만 비교한다. */
function table(fn, rows){
  let bad = [];
  for(const [name, inp, want] of rows){
    const got = fn(inp);
    const ok = (want !== null && typeof want === 'object')
      ? Object.keys(want).every(k => JSON.stringify(got && got[k]) === JSON.stringify(want[k]))
      : got === want;
    if(!ok) bad.push(name + ' → ' + JSON.stringify(got));
  }
  return bad;
}
const T = (label, fn, rows) => { const b = table(fn, rows); chk(!b.length, label + ' (' + rows.length + '행)' + (b.length ? ' — ' + b.slice(0, 3).join(' / ') : '')); };

/* ── 2. 렌더러 ── */
say('── 2. 렌더러 표 — 상황 → 결정');
T('holdForDrag — 끄는 중 + main 도 클릭받기일 때만 붙잡는다', P.holdForDrag, [
  ['끄는 중 · 받기', { dragging: { seat: 0 }, ignoreSent: false }, true],
  ['끄는 중 · main 통과(남은 플래그)', { dragging: { seat: 0 }, ignoreSent: true }, false],
  ['끄는 중 · 아직 안 보냄(null)', { dragging: { seat: 0 }, ignoreSent: null }, false],
  ['안 끔 · 받기', { dragging: null, ignoreSent: false }, false],
]);
const mv = (o) => Object.assign({ moveMode: false, ignoring: true, ignoreSent: true, dragging: null, sinceCheck: 1000 }, o);
T('moveStep — 이동 모드 · 스로틀 경계 · 끌기', P.moveStep, [
  ['이동 모드 · 통과 캐시 → 즉시 받기(스로틀 없음)', mv({ moveMode: true, sinceCheck: 0 }), { act: 'receive', stamp: false }],
  ['이동 모드 · 판정 캐시 null → 받기', mv({ moveMode: true, ignoring: null }), { act: 'receive', stamp: false }],
  ['이동 모드 · 이미 받기 → 그대로', mv({ moveMode: true, ignoring: false }), { act: 'keep', stamp: false }],
  ['통과 중 9ms → 스로틀', mv({ sinceCheck: 9 }), { act: 'keep', stamp: false }],
  ['통과 중 10ms → 판정', mv({ sinceCheck: 10 }), { act: 'judge', stamp: true }],
  ['받는 중 39ms → 스로틀', mv({ ignoring: false, ignoreSent: false, sinceCheck: 39 }), { act: 'keep', stamp: false }],
  ['받는 중 40ms → 판정', mv({ ignoring: false, ignoreSent: false, sinceCheck: 40 }), { act: 'judge', stamp: true }],
  ['끄는 중 · 받기 → 붙잡기(시각은 찍는다)', mv({ ignoring: false, ignoreSent: false, dragging: {} }), { act: 'keep', stamp: true }],
  ['끄는 중 · main 통과 → 판정(유령 방지)', mv({ ignoring: false, ignoreSent: true, dragging: {} }), { act: 'judge', stamp: true }],
]);
T('hitStep — 받기는 즉시 · 통과는 늦게 · 이미 통과면 그대로', P.hitStep, [
  ['맞음', { hit: true, ignoring: true }, 'receive'],
  ['빗나감 · 받는 중', { hit: false, ignoring: false }, 'pass-later'],
  ['빗나감 · 캐시 null', { hit: false, ignoring: null }, 'pass-later'],
  ['빗나감 · 이미 통과', { hit: false, ignoring: true }, 'keep'],
]);
T('pointerDownStep', P.pointerDownStep, [
  ['통과 캐시', { ignoring: true }, 'receive'], ['받는 중', { ignoring: false }, 'keep'], ['null', { ignoring: null }, 'keep'],
]);
const pk = (pt, o) => Object.assign({ pt, ignoreSent: false, dragging: null }, o);
T('pokeStep — main 상태 정정 · 끌기 보호 · left/null', P.pokeStep, [
  ['구버전 null → 화면 밖 판정', pk(null), { resync: false, act: 'judge', x: -9999, y: -9999 }],
  ['left → 화면 밖 판정', pk({ left: true }), { resync: false, act: 'judge', x: -9999 }],
  ['좌표 → 그 자리 판정', pk({ x: 5, y: 7 }), { resync: false, act: 'judge', x: 5, y: 7 }],
  ['ig 다름 → 정정', pk({ x: 5, y: 7, ig: true }), { resync: true, act: 'judge', x: 5 }],
  ['ig 같음 → 정정 없음', pk({ x: 5, y: 7, ig: false }), { resync: false }],
  ['ig 가 불리언 아님(구버전) → 정정 없음', pk({ x: 5, y: 7, ig: 1 }), { resync: false }],
  ['아직 안 보냄(null) → 정정 없음', pk({ x: 5, y: 7, ig: true }, { ignoreSent: null }), { resync: false }],
  ['끄는 중 · 받기 · left → 붙잡기', pk({ left: true, ig: false }, { dragging: {} }), { resync: false, act: 'keep' }],
  ['끄는 중이지만 main 이 통과(ig) → 정정 뒤 판정', pk({ left: true, ig: true }, { dragging: {} }), { resync: true, act: 'judge' }],
]);
T('clickMayKick — 휠은 사다리를 안 탄다', P.clickMayKick, [
  ['클릭', { offOverlay: false }, true], ['휠', { wheel: true }, false], ['구버전(필드 없음)', {}, true], ['state 없음', undefined, true],
  ['wheel 이 참 같은 값이지만 true 아님', { wheel: 1 }, true],
]);
const kk = (o) => Object.assign({ ignoreSent: true, offOverlay: false, penApp: false, now: 100000, lastKickAt: 0, lastMoveSeen: 0,
  lastPokePen: false, lastPokeAt: 0, stage: 0 }, o);
T('kickStep — 게이트 순서 · 경계 · 단계', P.kickStep, [
  ['이미 받기 → 없음', kk({ ignoreSent: false }), { act: 'none', stage: 0 }],
  ['아직 안 보냄 → 없음', kk({ ignoreSent: null }), { act: 'none' }],
  ['다른 모니터 → 건너뜀', kk({ offOverlay: true }), { act: 'skip-off' }],
  ['offOverlay 구버전(undefined) → 돈다', kk({ offOverlay: undefined }), { act: 'rearm', stage: 1 }],
  ['펜 앱 → 건너뜀', kk({ penApp: true }), { act: 'skip-pen' }],
  ['다른 모니터가 펜 앱보다 먼저', kk({ offOverlay: true, penApp: true }), { act: 'skip-off' }],
  ['연타 1499ms → 없음', kk({ lastKickAt: 100000 - 1499 }), { act: 'none' }],
  ['연타 1500ms → 돈다', kk({ lastKickAt: 100000 - 1500 }), { act: 'rearm' }],
  ['mousemove 2999ms 전 → 살아 있음', kk({ lastMoveSeen: 100000 - 2999 }), { act: 'none' }],
  ['mousemove 3000ms 전 → 죽음', kk({ lastMoveSeen: 100000 - 3000 }), { act: 'rearm' }],
  ['펜 재판정 2999ms 전 → 살아 있음', kk({ lastPokePen: true, lastPokeAt: 100000 - 2999 }), { act: 'none' }],
  ['펜 재판정 3000ms 전 → 돈다', kk({ lastPokePen: true, lastPokeAt: 100000 - 3000 }), { act: 'rearm' }],
  ['일반 앱 재판정(방금) → 생존 신호 아님', kk({ lastPokePen: false, lastPokeAt: 100000 - 10 }), { act: 'rearm' }],
  ['0단계 → 1 재무장', kk({ stage: 0 }), { act: 'rearm', stage: 1 }],
  ['1단계 → 2 재무장', kk({ stage: 1 }), { act: 'rearm', stage: 2 }],
  ['2단계 → 3 받아 보기', kk({ stage: 2 }), { act: 'probe', stage: 3 }],
  ['5단계 → 6 받아 보기', kk({ stage: 5 }), { act: 'probe', stage: 6 }],
  ['3단계 · 우리 UI 밖 클릭 → 받기 건너뜀(단계는 오름)', kk({ stage: 2, onUI: false }), { act: 'skip-offui', stage: 3 }],
  ['3단계 · 우리 UI 위 클릭 → 받아 보기', kk({ stage: 2, onUI: true }), { act: 'probe', stage: 3 }],
  ['3단계 · onUI 모름(구버전 main) → 받아 보기', kk({ stage: 2, onUI: undefined }), { act: 'probe', stage: 3 }],
  ['1·2단계는 UI 밖이어도 재무장(받기 아님)', kk({ stage: 0, onUI: false }), { act: 'rearm', stage: 1 }],
]);

/* ── 3. main ── */
say('── 3. main 표 — 상황 → 결정');
T('mainArmed — run 모드 · 클릭받기일 때만', P.mainArmed, [
  ['run · 받기', { configMode: false, ignoreRequested: false }, true], ['통과 중', { configMode: false, ignoreRequested: true }, false],
  ['런처', { configMode: true, ignoreRequested: false }, false],
]);
const st = (o) => Object.assign({ configMode: false, ignoreRequested: false, focused: false, boundsAt: 5, quietFor: 12001, forced: false }, o);
T('stallStep(ⓔ) — 하트비트 12000ms 경계', P.stallStep, [
  ['12001ms → 회수', st(), 'recall'], ['12000ms → 그대로', st({ quietFor: 12000 }), null],
  ['하트비트 한 번도 없음', st({ boundsAt: 0 }), null], ['포커스 있음', st({ focused: true }), null],
  ['이미 강제 전환 중', st({ forced: true }), null], ['통과 중', st({ ignoreRequested: true }), null], ['런처', st({ configMode: true }), null],
]);
const sc = (o) => Object.assign({ configMode: false, ignoreRequested: false, focused: false, onOverlay: true, moveAge: 1200,
  prev: { x: 0, y: 0 }, pt: { x: 60, y: 0 }, now: 10000, firedAt: 8000 }, o);
T('staleCaptureStep(ⓕ) — 굳음 · 커서 이동 · 연속 발동 경계', P.staleCaptureStep, [
  ['전부 만족 → 회수', sc(), 'recall'],
  ['moveAge 1199 → 그대로', sc({ moveAge: 1199 }), null], ['moveAge -1(모름) → 그대로', sc({ moveAge: -1 }), null],
  ['커서 59px → 그대로(가만히 누르려던 클릭)', sc({ pt: { x: 59, y: 0 } }), null], ['대각 60px 이상 → 회수', sc({ pt: { x: 43, y: 43 } }), 'recall'],
  ['첫 표본(prev 없음)', sc({ prev: null }), null], ['다른 모니터', sc({ onOverlay: false }), null], ['포커스 있음', sc({ focused: true }), null],
  ['1999ms 안에 또 → 그대로', sc({ firedAt: 8001 }), null], ['통과 중', sc({ ignoreRequested: true }), null],
]);
const fk = (o) => Object.assign({ kind: 'key', configMode: false, ignoreRequested: false, focused: false, cursor: { x: 1, y: 1 }, onOverlay: true,
  moveAge: 5000, haveBounds: true, boundsAge: 100, onOurUI: false, cx: 900, cy: 500, charDx: 300, charDy: 400, regionCount: 2,
  now: 50000, firedAt: 0, hitWhyAt: 0, lastHitWhy: '?', deferAt: 0 }, o);
const fc = (o) => fk(Object.assign({ kind: 'click' }, o));
T('foreignInputStep(ⓖ) — 키', P.foreignInputStep, [
  ['다른 앱에 키 · mousemove 굳음 → 회수', fk(), { act: 'recall', why: '다른 앱에 키 입력, mousemove 5000ms 없음', poke: null }],
  ['mousemove 1199 → 렌더러가 고친다', fk({ moveAge: 1199 }), { act: null }],
  ['moveAge -1 → 그대로', fk({ moveAge: -1 }), { act: null }],
  ['다른 모니터 → 판단 안 함', fk({ onOverlay: false }), { act: null }],
  ['커서 못 읽음(null) → 키는 그대로 판단', fk({ cursor: null, onOverlay: null }), { act: 'recall' }],
  ['키에는 dom: 유예가 없다', fk({ hitWhyAt: 49990, lastHitWhy: 'dom:chip' }), { act: 'recall' }],
  ['우리 창 포커스', fk({ focused: true }), { act: null }], ['통과 중', fk({ ignoreRequested: true }), { act: null }],
  ['1999ms 안에 또', fk({ firedAt: 48001 }), { act: null }], ['2000ms 뒤', fk({ firedAt: 48000 }), { act: 'recall' }],
]);
T('foreignInputStep(ⓖ) — 클릭 · 유예', P.foreignInputStep, [
  ['우리 UI 밖 클릭 → 회수', fc(), { act: 'recall', why: '다른 앱에서 우리 UI 밖 클릭(캐릭터와 500px, 창 2개)', poke: { x: 900, y: 500 } }],
  ['좌표 재료 없음 → 보류', fc({ haveBounds: false }), { act: null }],
  ['좌표 3000ms → 믿음', fc({ boundsAge: 3000 }), { act: 'recall' }], ['좌표 3001ms → 보류', fc({ boundsAge: 3001 }), { act: null }],
  ['커서 못 읽음 → 보류', fc({ cursor: null, onOverlay: null }), { act: null }], ['다른 모니터', fc({ onOverlay: false }), { act: null }],
  ['우리 UI 위 → 정상', fc({ onOurUI: true }), { act: null }],
  ['클릭은 mousemove 상태를 안 따진다', fc({ moveAge: 0 }), { act: 'recall' }],
  ['렌더러가 1999ms 전 dom: 으로 켬 → 재판정 유예', fc({ hitWhyAt: 50000 - 1999, lastHitWhy: 'dom:myStatusChip' }), { act: 'defer', poke: { x: 900, y: 500 } }],
  ['2000ms 전 → 유예 닫힘(회수)', fc({ hitWhyAt: 48000, lastHitWhy: 'dom:myStatusChip' }), { act: 'recall' }],
  ['char: 로 켬 → 유예 없음', fc({ hitWhyAt: 49990, lastHitWhy: 'char:me' }), { act: 'recall' }],
  ['직전 유예 2000ms 안 → 기다림(회수도 안 함)', fc({ hitWhyAt: 49990, lastHitWhy: 'dom:x', deferAt: 48000 }), { act: 'wait' }],
  ['직전 유예 2001ms → 다시 유예', fc({ hitWhyAt: 49990, lastHitWhy: 'dom:x', deferAt: 47999 }), { act: 'defer' }],
]);
T('deferExpiredStep(ⓖ 유예 끝)', P.deferExpiredStep, [
  ['렌더러가 스스로 통과로 갔다', { ignoreRequested: true, boundsAge: 99999 }, null],
  ['하트비트 3000ms → 살아 있음 · 물러남', { ignoreRequested: false, boundsAge: 3000 }, null],
  ['하트비트 3001ms → 회수', { ignoreRequested: false, boundsAge: 3001 }, 'recall'],
]);

/* ── 4. 연결 ── */
say('── 4. 연결 — 네 길이 모두 이 모듈을 부른다');
const RUNC = strip(RUN), MAINC = strip(MAIN);
chk(/^const clickPolicy = deps\.clickPolicy;/m.test(RUN), 'desktop-run.js — deps.clickPolicy 로 받는다(전역 직접 참조 없음)');
chk(!/TwClickThroughPolicy/.test(RUNC), '  desktop-run.js 는 window.TwClickThroughPolicy 를 직접 안 본다');
const CALLS = ['moveStep', 'hitStep', 'pointerDownStep', 'pokeStep', 'clickMayKick', 'kickStep'];
const miss = CALLS.filter(n => !new RegExp('clickPolicy\\.' + n + '\\(').test(RUNC));
chk(!miss.length, '① mousemove · ② 재판정 · ③ 사다리 · pointerdown · 전역 클릭이 정책을 부른다' + (miss.length ? ' — 빠짐: ' + miss.join(' · ') : ''));
chk(/  clickPolicy: TwClickThroughPolicy,\n/.test(APP), 'app.js — 만드는 줄이 clickPolicy: TwClickThroughPolicy 를 넘긴다');
const iP = HTML.indexOf('<script src="parts/launcher/click-through-policy.js"></script>'), iR = HTML.indexOf('<script src="parts/launcher/desktop-run.js"></script>');
chk(iP > 0 && iR > iP, 'html — click-through-policy.js 를 desktop-run.js 보다 먼저 싣는다');
chk(!SMOKE || SMOKE.indexOf("PRELOAD.push('click-through-policy.js');") >= 0 && SMOKE.indexOf("PRELOAD.push('click-through-policy.js');") < SMOKE.indexOf("PRELOAD.push('desktop-run.js');"), 'smoke.js PRELOAD 에 desktop-run.js 보다 먼저');
chk(/const ClickPolicy = require\('\.\/app\/parts\/launcher\/click-through-policy'\);/.test(MAINC), '④ main.js — 같은 파일을 require 한다(규칙표 사본 없음)');
const MCALLS = ['mainArmed', 'stallStep', 'staleCaptureStep', 'foreignInputStep', 'deferExpiredStep'];
const mmiss = MCALLS.filter(n => !new RegExp('ClickPolicy\\.' + n + '\\(').test(MAINC));
chk(!mmiss.length, '  ⓔ·ⓕ·ⓖ 가 정책을 부른다' + (mmiss.length ? ' — 빠짐: ' + mmiss.join(' · ') : ''));
let pkg = null; try{ pkg = JSON.parse(read('package.json')); }catch(_){}
chk(pkg && (pkg.build.files || []).includes('app/**/*'), '  설치본 build.files 에 app/**/* — main 이 require 하는 파일이 들어간다');

/* ── 5. 같은 조건을 다시 쓰지 않는다 ── */
say('── 5. 같은 조건을 다른 파일에 다시 쓰면 빨강');
const DUP = [
  ['끌기 붙잡기(holdForDrag)', /drag\(\)\s*&&\s*_ignoreSent/],
  ['사다리 첫 게이트(이미 받기)', /_ignoreSent\s*!==\s*true\s*\)\s*return/],
  ['다른 모니터 건너뛰기', /offOverlay\s*===\s*true/],
  ['휠 제외', /\.wheel\s*===\s*true/],
  ['UI 밖 클릭 3단계 건너뛰기', /\bonUI\s*===\s*false/],
  ['사다리 연타 방지', /now\s*-\s*_lastKickAt\s*</],
  ['mousemove 생존', /now\s*-\s*_lastMoveSeen\s*</],
  ['펜 재판정 생존', /now\s*-\s*_lastPokeAt\s*</],
  ['사다리 단계 문턱', /_kickStage\s*<=\s*\d/],
  ['main 상태 정정(pt.ig)', /typeof\s+pt\.ig\s*===/],
  ['mousemove 스로틀', /_ignoring\s*===\s*false\s*\)\s*\?\s*\d/],
  ['통과 예약 시간', /_sendIgnore\(true\);\s*\}\s*,\s*\d+\s*\)/],
  ['main 무장 조건', /_isConfigMode\s*\|\|\s*_lastIgnoreRequested|!_isConfigMode\s*&&\s*!_lastIgnoreRequested/],
  ['굳은 판정 나이', /_rendererMoveAge\s*<\s*(?:0|FWD_STALE_MS|\d)/],
  ['커서 이동 문턱', /FWD_MOVE_MIN_PX\s*\*/],
  ['연속 발동 하한', /now\s*-\s*_fwdFiredAt\s*</],
  ['유예 간격', /now\s*-\s*_fgnDeferAt\s*\)?\s*[<>]/],
  ['dom: 신뢰 시간', /_hitWhyAt\s*\)\s*</],
  ['렌더러 무응답', /_lastCharBoundsAt\s*>\s*0\s*&&\s*quietFor/],
  ['문턱 상수 두 벌', /\bconst\s+(?:FWD_[A-Z_]+|FGN_[A-Z_]+|KICK_GAP_MS|MOVE_ALIVE_MS|POKE_ALIVE_MS|PASS_DEBOUNCE_MS|KICK_PROBE_MS)\s*=|\bconst\s+RENDERER_STALL_MS\s*=\s*\d/],
];
function walk(dir, out){
  let es = []; try{ es = fs.readdirSync(dir, { withFileTypes: true }); }catch(_){ return out; }
  for(const e of es){
    const p = path.join(dir, e.name);
    if(e.isDirectory()){ if(e.name !== 'vendor' && e.name !== 'node_modules') walk(p, out); }
    else if(e.name.endsWith('.js') && e.name !== 'click-through-policy.js') out.push(p);
  }
  return out;
}
const partsDir = ['parts', 'app/parts', '../app/parts'].map(d => path.resolve(d)).find(d => fs.existsSync(path.join(d, 'launcher')));
const files = (partsDir ? walk(partsDir, []) : []).map(p => [path.relative(process.cwd(), p), fs.readFileSync(p, 'utf8')]);
files.push(['main.js', MAIN]);
function scan(list){
  const hits = [];
  for(const [f, src] of list){ const c = strip(src); for(const [name, re] of DUP) if(re.test(c)) hits.push(f + ': ' + name); }
  return hits;
}
chk(files.length > 50, '렌더러 파일 ' + (files.length - 1) + '개 + main.js 를 훑는다');
const hits = scan(files);
chk(!hits.length, '★ 정책 모듈 밖에 같은 판단 조건이 없다' + (hits.length ? ' — ' + hits.slice(0, 4).join(' / ') : ''));
/* ★ 목록에 없는 «새» 조건도 잡는다 — 사다리(__mouseKick) 몸통의 if 는 정책 결과(k.act)나 기록 간격 · 3단계 타이머만 둔다.
   새 판단을 여기 쓰면(예: 10-16 제보 13 의 onUI 를 처음 넣을 때처럼) 빨강 — 규칙은 kickStep 에 넣는다. */
const KICK_IF_OK = [/^k\.act === '[a-z-]+'$/, /^now - _[A-Za-z]+SkipLoggedAt > \d+$/, /^_probeTimer$/, /^_lastMoveSeen !== before$/];
function kickIfs(runSrc){
  const body = (strip(runSrc).match(/window\.__mouseKick = function\([^)]*\)\{[\s\S]*?\n    \};/) || [''])[0];
  const out = []; const re = /\bif\(/g; let m;
  while((m = re.exec(body))){
    let d = 1, i = m.index + 3; for(; i < body.length && d; i++){ if(body[i] === '(') d++; else if(body[i] === ')') d--; }
    out.push(body.slice(m.index + 3, i - 1).trim());
  }
  return { found: !!body, bad: out.filter((c) => !KICK_IF_OK.some((r) => r.test(c))) };
}
{ const r = kickIfs(RUN);
  chk(r.found && !r.bad.length, '★ 사다리 몸통에 정책 밖 판단이 없다(if 는 k.act · 기록 간격 · 3단계 타이머만)' + (r.bad.length ? ' — ' + r.bad.join(' / ') : ''));
  const r2 = kickIfs(RUN.replace("      if(k.act === 'none') return;", "      if(k.act === 'none') return;\n      if(offOverlay === 'x' || now < 0) return;"));
  chk(r2.bad.length > 0, '  깨 보기: 사다리에 목록에 없는 새 조건을 씀 → 빨강'); }
const broke = [
  ['desktop-run.js 에 끌기 조건을 다시 씀', 'desktop-run.js', (s) => s.replace('function _updateIgnore(cx, cy){', 'function _x(){ return drag() && _ignoreSent === false; }\n    function _updateIgnore(cx, cy){')],
  ['desktop-run.js 에 휠 조건을 다시 씀', 'desktop-run.js', (s) => s.replace('clickPolicy.clickMayKick(state)', '!(state && state.wheel === true)')],
  ['main.js 에 문턱 상수를 다시 둠', 'main.js', (s) => s.replace('let _fgnDeferAt = 0;', 'const FWD_STALE_MS = 1200;\nlet _fgnDeferAt = 0;')],
  ['main.js 에 무장 조건을 다시 씀', 'main.js', (s) => s.replace('function _fgnRecall(why){', 'function _fgnRecall(why){\n  if(_isConfigMode || _lastIgnoreRequested) return;')],
];
for(const [label, file, mut] of broke){
  const list = files.map(([f, s]) => [f, path.basename(f) === file ? mut(s) : s]);
  const changed = list.some(([f, s], i) => s !== files[i][1]);
  chk(changed && scan(list).length > 0, '  깨 보기: ' + label + ' → 빨강' + (changed ? '' : ' (바꿀 글을 못 찾음)'));
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

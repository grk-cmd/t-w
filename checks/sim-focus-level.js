/* ═══ ⭐ sim-focus-level.js — ⭐ 포커스 레벨 · 공유 · 태블릿 모듈 구조 (2026-10-14 신설 · 앱 FSD 26번) ═══════════════
   focus-level.js — 오늘치 쌓기 · 서버 레벨을 읽는 이름 · 별 문자열 · 태블릿. 레벨 · 회차 · 별 색의 값은 서버 진척(focus-progress.js — sim-focus-progress.js)이 맡는다.
   여기서는 모듈 모양 · app.js 연결 · 서버 밖으로 아무것도 안 보내는 것을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름 17개(STAR_PALETTE · _mobile… · addFocusSeconds · focusCycleOf · formatHMS · getFocusLevel · getStarColor · lvStarStr · myFocusShow · myStarOut · setStarColor · starFromRemote)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 줄 그대로 · 부르는 곳은 focusLevelMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · focus-level.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["focus-level.js","parts/focus/focus-level.js","app/parts/focus/focus-level.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — focus-level.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["addFocusToday","findMySeat","getMyUserId","toast"];
const VAL_DEPS = ["progress","FOCUS_CYCLE_CAP","FOCUS_CYCLE_SEC","FOCUS_LEVEL_CAP_HOURS","Presence","mobileDiag"];
const GET_DEPS = ["_focusTotalStarted","_acctDetached","_focusSessionSec","wdDraftDef"];
const SET_DEPS = ["setFocusSessionSec"];
const EXPORTS = ["STAR_PALETTE","_mobileBubbleText","_mobileCleanApp","_mobileOn","_mobileRoomLabel","_mobileStart","_seatMobileApp","addFocusSeconds","focusCycleOf","formatHMS","getFocusLevel","getStarColor","lvStarStr","myFocusShow","myStarOut","setStarColor","starFromRemote"];
const MOVED = ["_lastPushedLevel","_lastPushedStar","_pushLevelIfChanged","DANCE_NOTIFIED_KEY","DANCE_REPAIR_KEY","_dancePending","_danceNotifiedSet","_danceRepairSet","_markDanceNotified","_danceMailExists","_danceUnlockPending","_notifyDanceUnlocks","IDESK_NOTIFIED_KEY","_ideskNotifiedSet","_notifyDeskUnlocks","addFocusSeconds","getFocusLevel","STAR_COLOR_KEY","STAR_PALETTE","_starColorOk","getStarColor","_starPicked","setStarColor","focusCycleOf","lvStarStr","myFocusShow","myStarOut","myStarProfileOut","_adoptStarColorFromProfile","starFromRemote","FOCUS_SYNCED_KEY","_focusSyncing","_focusSyncFailStreak","_focusSyncNoticed","_focusSyncRetryTimer","_focusSyncFailed","_focusLastSyncedVal","_setFocusSyncedMark","_getFocusSyncedMark","_hasFocusSyncedMark","syncFocusTotalToServer","FOCUS_SYNC_INTERVAL_MS","formatHMS","MOBILE_MAX_ON_MS","MOBILE_KEY_LS","MOBILE_APP_MAX","_mobileFocus","_mobileStop","_mobileNow","_mobileOn","_seatMobileApp","_mobileRoomLabel","_mobileBubbleText","_mobileCleanApp","_mobileGetKey","_mobileNewKey","_mobileLinkUrl","_mobileApplyState","_mobileChanged","_mobileStart","_mobRenderPanel","_mobDrawQr","_mobFillWindow","_mobMakeKey","_mobOpenWindow","_mobCloseWindow","_mobArm","_mobileWasOnTick"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  progress: focusProgressMod,", "  _focusTotalStarted: ()=>focusTotalMod._focusTotalStarted(),", "  FOCUS_CYCLE_CAP: focusTotalMod.FOCUS_CYCLE_CAP,", "  FOCUS_CYCLE_SEC: focusTotalMod.FOCUS_CYCLE_SEC,", "  FOCUS_LEVEL_CAP_HOURS: focusTotalMod.FOCUS_LEVEL_CAP_HOURS,", "  Presence: Presence,", "  _acctDetached: ()=>acctStateMod._acctDetached(),", "  _focusSessionSec: ()=>focusTotalMod._focusSessionSec(),", "  addFocusToday: (...a)=>focusTotalMod.addFocusToday(...a),", "  findMySeat: (...a)=>findMySeat(...a),", "  getMyUserId: (...a)=>getMyUserId(...a),", "  mobileDiag: TwMobileDiag,", "  toast: (...a)=>toast(...a),", "  wdDraftDef: ()=>wardrobeMod.wdDraftDef(),", "  setFocusSessionSec: (v)=>{ focusTotalMod.setFocusSessionSec(v); },"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다.
   then 도 받는다 — 만들 때 부르는 서버 요청(.then 잇기)이 던지지 않게(풀리지는 않는다) */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
function build(src){
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps[n] = () => {}; });
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'module',
    src + '\nreturn window.TwFocusLevel;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, undefined);
  return api.createFocusLevel(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwFocusLevel = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwFocusLevel(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("FOCUS_LEVEL_MOD_OFF") && app.includes("const focusLevelMod = TwFocusLevel.createFocusLevel({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const focusLevelMod = TwFocusLevel\\.createFocusLevel\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = mk.split('\n').map(kindOf);
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => !["myFocusShow"].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const focusLevelMod = [\s\S]*?\n\}\);/, '')));
  t(!bare.length, '부르는 곳은 focusLevelMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/focus/focus-level.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/focus/focus-level.js 를 app.js 보다 먼저 싣는다');
  return r;
}

/* 쌓기 — addFocusSeconds 는 서버에 올릴 몫(progress.addSeconds)으로 넘길 뿐 firebaseAPI 를 부르지 않는다(프로필 · 마크 · 해금 우편 · 누적 쓰기 걷음) */
function runAdd(src, started){
  const any = anything(), calls = [], added = [], store = {};
  const fa = new Proxy({}, { get: (t, k) => (...a) => { calls.push(String(k)); return any; } });
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps[n] = () => {}; });
  deps.progress = { addSeconds: (x) => added.push(x), STAR_PALETTE: [['#ffd76a', '금']] };
  deps._focusTotalStarted = () => started;
  const today = []; deps.addFocusToday = (x) => today.push(x); deps._focusSessionSec = () => 0;
  const win = new Proxy({ firebaseAPI: fa }, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const ls = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const api = new Function('window', 'document', 'localStorage', 'firebaseAPI', 'module', src + '\nreturn window.TwFocusLevel;')(win, any, ls, fa, undefined);
  try{ api.createFocusLevel(deps).addFocusSeconds(3); }catch(_){ calls.push('throw'); }
  return { calls, added, today };
}
const judgeAdd = (src) => { const a = runAdd(src, true), b = runAdd(src, false); return a.calls.length === 0 && a.added.join() === '3' && a.today.join() === '3' && b.added.length === 0 && b.today.length === 0; };

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 2-2. 쌓기 — 서버에 올릴 몫으로만 넘긴다');
chk(judgeAdd(MOD), '계정 칸이 열린 뒤: 오늘 시간에 더하고 3초를 미전송분에 넘긴다 · firebaseAPI 호출 0 · 열리기 전엔 아무것도 안 쌓는다');
chk(!/sendInboxMessage|setMyProfile|syncFocusTotal|fetchProfileStarC|tw\.starColor|focusSyncedSec|danceNotified|ideskNotified/.test(strip(MOD)), '걷은 Firebase 길 · 해금 우편 · 옛 키 이름이 코드에 없다');
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
{
  const m1 = MOD.replace('progress.addSeconds(sec);', '');
  chk(m1 !== MOD && !judgeAdd(m1), '미전송분으로 안 넘기면 — 쌓기 판정이 빨강');
  const m2 = MOD.replace('  if(!_focusTotalStarted()) return;   // 계정 확인 전', '  // ');
  chk(m2 !== MOD && !judgeAdd(m2), '계정 확인 전 입구를 빼면 — 쌓기 판정이 빨강');
  const m3 = MOD.replace('progress.addSeconds(sec);', "progress.addSeconds(sec); firebaseAPI.syncFocusTotal(1);");
  chk(m3 !== MOD && !judgeAdd(m3), '쌓다가 Firebase 를 부르면 — 쌓기 판정이 빨강');
  const m4 = MOD.replace('function addFocusSeconds(sec){', 'function _x(){ firebaseAPI.sendInboxMessage(); }\nfunction addFocusSeconds(sec){');
  chk(m4 !== MOD && /sendInboxMessage/.test(strip(m4)), '해금 우편 코드가 되살아나면 — 글 판정이 빨강');
}
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/focus/focus-level.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  ['deps 하나 빠짐', null, a => { const i = a.indexOf("const focusLevelMod = TwFocusLevel.createFocusLevel({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }, null],
  ['전역 이름 안 걺', m => m.replace('window.TwFocusLevel = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const focusLevelMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('focusLevelMod.' + x)); if(n){ ls[i] = ls[i].replace('focusLevelMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createFocusLevel(deps){', 'function createFocusLevel(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

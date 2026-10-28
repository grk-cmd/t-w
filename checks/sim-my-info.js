/* ═══ 🪪 sim-my-info.js — 🪪 [내 정보] 화면 모듈 구조 (2026-10-14 신설 · 앱 FSD 17번) ═══════════════
   app.js 의 «🪪 [내 정보] — 런처 화면 전환» · «🏆 [내 정보] 전체 랭킹» 두 구역 본문(702줄) 을 parts/account/my-info.js 로 옮겼다(글자 그대로 · 바뀐 줄 15 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(sim-signup.js · sim-google-login.js).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(_acctRelaunchAfterDetach · _lbPush · _miIsOpen · _miSlotThumb · closeMyInfo · openMyInfo)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 53줄 그대로 · 부르는 곳은 myInfoMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · my-info.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["my-info.js","parts/account/my-info.js","app/parts/account/my-info.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — my-info.js'); process.exit(2); }
/* 🛰 네트워크 준비 기다리기(shared/net-ready.js — 모듈이 TwNetReady.whenNetReady 를 부른다) — 가짜 window 위에 진짜 파일을 먼저 싣는다 */
const NET = ["net-ready.js","parts/shared/net-ready.js","app/parts/shared/net-ready.js"].map(read).find(Boolean);
if(!NET){ say('  ? 원본 못 찾음 — net-ready.js'); process.exit(2); }
const NET_PRE = NET + '\nvar TwNetReady = window.TwNetReady;\n';
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_charsActive","_charsBoxGet","_charsBoxOnlyCount","_charsBoxToDesk","_charsBoxTrash","_charsBoxTrashMany","_charsCachedUid","_charsDeleteWords","_charsDeskGet","_charsIsTomb","_charsMoveMsg","_charsRestore","_charsSync","_charsTrashView","_loginDoLogout","_loginDoDeleteAccount","_pushLevelIfChanged","_slotsNow","closeGearMenu","commitUserName","focusCycleOf","getDisplayName","getFocusLevel","getMyUserId","getStarColor","getUserName","lvStarStr","myFocusShow","openCodeModal","refreshAccountTab","renderLauncher","saveCurSlot","setStarColor","toast","_acctRelaunchAfterDetach"];
const VAL_DEPS = ["MY_FRIEND_CODE_KEY","USER_NAME_MAX","plMod","slots","CHARS_LINKED_KEY"];
const GET_DEPS = ["CHARS_BOX_MAX","EXP_CELLS","EXP_SEC_PER_CELL","EXP_SEC_PER_LEVEL","FOCUS_CYCLE_SEC","FOCUS_LEVEL_CAP_HOURS","STAR_PALETTE","_acctDetached","_focusTotalSec","_myHomeData","curSlot","charsMod"];
const SET_DEPS = ["curSlot"];
const EXPORTS = ["_charsLinkedMaybeShow","_lbPush","_miIsOpen","_miSlotThumb","closeMyInfo","openMyInfo"];
const MOVED = ["MI_IMG_OK","_miTab","_miBusy","_miBoxAsk","_miTrashRows","_miTrashErr","_miTrashFullShown","_miPick","_miBulkAsk","openMyInfo","closeMyInfo","_miIsOpen","_miSetTab","LB_TOP_N","LB_CACHE_MS","rankOf","rankLabel","_lbSent","_miRankCache","_miRankSeq","_lbPush","_miApplyRank","_lbFetchRank","_miRenderRank","_miRenderHead","_miStarOpen","_miStarToggle","_miRenderStar","_miRenderAvatar","_miNameEditStart","_miNameEditEnd","_miNameSave","_miCopyCode","_miSlotThumb","_miBoxItems","_miRenderBox","_miTrashIcon","_miRenderBoxFull","_miBoxBulkStart","_miBoxTrashBulk","_miBoxTrash","_miTrashOn","_miTrashLoad","_miRenderTrashTab","_miRenderTrash","_miTrashRestore","_miBoxUp","_miCodeLoad","_acctRelaunchAfterDetach"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  CHARS_BOX_MAX: ()=>charsMod.CHARS_BOX_MAX,", "  EXP_CELLS: ()=>expBarMod.EXP_CELLS,", "  EXP_SEC_PER_CELL: ()=>expBarMod.EXP_SEC_PER_CELL,", "  EXP_SEC_PER_LEVEL: ()=>expBarMod.EXP_SEC_PER_LEVEL,", "  FOCUS_CYCLE_SEC: ()=>focusTotalMod.FOCUS_CYCLE_SEC,", "  FOCUS_LEVEL_CAP_HOURS: ()=>focusTotalMod.FOCUS_LEVEL_CAP_HOURS,", "  MY_FRIEND_CODE_KEY: MY_FRIEND_CODE_KEY,", "  STAR_PALETTE: ()=>focusLevelMod.STAR_PALETTE,", "  USER_NAME_MAX: userNameMod.USER_NAME_MAX,", "  _acctDetached: ()=>acctStateMod._acctDetached(),", "  _charsActive: (...a)=>charsMod._charsActive(...a),", "  _charsBoxGet: (...a)=>charsMod._charsBoxGet(...a),", "  _charsBoxOnlyCount: (...a)=>charsMod._charsBoxOnlyCount(...a),", "  _charsBoxToDesk: (...a)=>charsMod._charsBoxToDesk(...a),", "  _charsBoxTrash: (...a)=>charsMod._charsBoxTrash(...a),", "  _charsBoxTrashMany: (...a)=>charsMod._charsBoxTrashMany(...a),", "  _charsCachedUid: (...a)=>charsMod._charsCachedUid(...a),", "  _charsDeleteWords: (...a)=>charsMod._charsDeleteWords(...a),", "  _charsDeskGet: (...a)=>charsMod._charsDeskGet(...a),", "  _charsIsTomb: (...a)=>charsMod._charsIsTomb(...a),", "  _charsMoveMsg: (...a)=>charsMod._charsMoveMsg(...a),", "  _charsRestore: (...a)=>charsMod._charsRestore(...a),", "  _charsSync: (...a)=>charsMod._charsSync(...a),", "  _charsTrashView: (...a)=>charsMod._charsTrashView(...a),", "  _focusTotalSec: ()=>_focusTotalSec,", "  _loginDoLogout: (...a)=>accountMod._loginDoLogout(...a),", "  _loginDoDeleteAccount: (...a)=>accountMod._loginDoDeleteAccount(...a),", "  _myHomeData: ()=>mhStateMod._myHomeData(),", "  _pushLevelIfChanged: (...a)=>focusLevelMod._pushLevelIfChanged(...a),", "  _slotsNow: (...a)=>slotSyncMod._slotsNow(...a),", "  closeGearMenu: (...a)=>launcherCtlMod.closeGearMenu(...a),", "  commitUserName: (...a)=>userNameMod.commitUserName(...a),", "  curSlot: ()=>curSlot,", "  focusCycleOf: (...a)=>focusLevelMod.focusCycleOf(...a),", "  getDisplayName: (...a)=>getDisplayName(...a),", "  getFocusLevel: (...a)=>focusLevelMod.getFocusLevel(...a),", "  getMyUserId: (...a)=>getMyUserId(...a),", "  getStarColor: (...a)=>focusLevelMod.getStarColor(...a),", "  getUserName: (...a)=>getUserName(...a),", "  lvStarStr: (...a)=>focusLevelMod.lvStarStr(...a),", "  myFocusShow: (...a)=>focusLevelMod.myFocusShow(...a),", "  openCodeModal: (...a)=>charCodeMod.openCodeModal(...a),", "  plMod: plMod,", "  refreshAccountTab: (...a)=>accountMod.refreshAccountTab(...a),", "  renderLauncher: (...a)=>renderLauncher(...a),", "  saveCurSlot: (...a)=>saveCurSlot(...a),", "  setStarColor: (...a)=>focusLevelMod.setStarColor(...a),", "  slots: slots,", "  toast: (...a)=>toast(...a),", "  setCurSlot: (v)=>{ curSlot = v; },", "  CHARS_LINKED_KEY: accountMod.CHARS_LINKED_KEY,", "  charsMod: ()=>charsMod,", "  _acctRelaunchAfterDetach: (...a)=>acctStateMod._acctRelaunchAfterDetach(...a),"];

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
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'module',
    NET_PRE + src + '\nreturn window.TwMyInfo;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, undefined);
  return api.createMyInfo(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwMyInfo = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwMyInfo(Tw 접두사)');
  const A = strip(app);
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("MY_INFO_MOD_OFF") && app.includes("const myInfoMod = TwMyInfo.createMyInfo({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const myInfoMod = TwMyInfo\\.createMyInfo\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = mk.split('\n').map(kindOf);
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  const bare = EXPORTS.filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const myInfoMod = [\s\S]*?\n\}\);/, '')));
  t(!bare.length, '부르는 곳은 myInfoMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/account/my-info.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/account/my-info.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/account/my-info.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  ['deps 하나 빠짐', null, a => { const i = a.indexOf("const myInfoMod = TwMyInfo.createMyInfo({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }, null],
  ['전역 이름 안 걺', m => m.replace('window.TwMyInfo = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* app.js 에 남은 부르는 자리 하나를 옛 이름으로 되돌린다 — 첫 이름이 다른 모듈로 옮겨 가 app.js 에 없을 수 있어 남은 이름 중에서 고른다 */
  ['부르는 곳이 옛 이름', null, a => { const n = EXPORTS.find(x => a.includes('myInfoMod.' + x)); return n ? a.replace('myInfoMod.' + n, n) : a; }, null],
  ['만들 때 던짐', m => m.replace('function createMyInfo(deps){', 'function createMyInfo(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);

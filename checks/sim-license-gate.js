/* ═══ 🎟️ sim-license-gate.js — 🎟️ 초대장 모듈 구조 (2026-10-14 신설 · 앱 FSD 31번) ═══════════════
   app.js 의 🎟️ 초대장(앱 접근 제한) 구역 본문 을 parts/account/license-gate.js 로 옮겼다(글자 그대로 · 바뀐 줄 20 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(초대장 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(INVITE_GRANT_MAX · INVITE_PASS_KEY · LICENSE_KEY_STORAGE · LICENSE_OPTOUT_KEY · _existingSignupCheck · _genLicenseKey · _licenseSnapForPush · _markInvitePassed · _needLoginCheck · _rcStore · _setPremium · activateLicense · checkInviteGate · deactivateLicense · loadLicenseFromStorage · refreshInviteBtn · verifyLicense)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 33줄 그대로 · 부르는 곳은 licenseGateMod.이름 · html(app.js 앞)
   ・2-3절: 런처 초대장 버튼 — refreshInviteBtn 을 실제로 돌려 남은 장수를 읽어 1장 이상일 때만 켜지는지(못 읽음 · 0장 · 읽기 전엔 꺼짐)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · license-gate.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["license-gate.js","parts/account/license-gate.js","app/parts/account/license-gate.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — license-gate.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_loginDoFriendCode","_loginDoGoogle","_enterAccount","_wipeAccountLocal","applyDeskCatalogRefToSeat","applyDeskItemsTo","getMyUserId","pruneUnownedLicenseAssets","refreshAccountTab","refreshCustomStatusMenuItem","refreshLicenseUI","renderCrItems","restoreLicenseHeldAssets","setUserStatus","toast","_setPremium","_acctRelaunchAfterDetach","_rcStore"];
const VAL_DEPS = ["DEFAULT_DESK_OVERRIDE_ID","loginFlowMod","userApiMod","inviteIds","firstRunMod","seats","LICENSE_KEY_STORAGE","LICENSE_OPTOUT_KEY","onPremiumChanged"];
const GET_DEPS = ["FRIEND_CODE_LOGIN_RE","awayPicMod","creatorOpen","userStatus"];
const SET_DEPS = [];
const EXPORTS = ["INVITE_GRANT_MAX","_genLicenseKey","activateLicense","checkInviteGate","deactivateLicense","loadLicenseFromStorage","refreshInviteBtn","verifyLicense"];
const MOVED = ["_rcStore","inviteGateOn","INVITE_PASS_KEY","INVITE_TOKEN_KEY","_inviteTokenLoad","_inviteTokenFor","_inviteFinishPending","INVITE_GRANDFATHER_COUNT","INVITE_GRANT_MAX","_genInviteCode","SIGNUP_PENDING_KEY","_signupPendingLoad","_signupPendingSave","_signupPendingEnsure","_signupClaimCode","_signupFinishLocal","_signupDoPassword","_signupDoGoogle","existingSignupOn","_existingSignupCode","_existingSignupNeed","_existingSignupDoPassword","_existingSignupCheck","_showExistingSignup","_showSignupDone","_hideSignupDone","_needLoginNeed","_needLoginCheck","_showNeedLogin","checkInviteGate","_markInvitePassed","_showInviteGate","refreshInviteBtn","issueInviteAndShow","_inviteConfirmIssue","LICENSE_KEY_STORAGE","_setPremium","_genLicenseKey","verifyLicense","loadLicenseFromStorage","LICENSE_OPTOUT_KEY","_licenseSnapPushNow","_licenseSnapForPush","activateLicense","deactivateLicense","_refreshPremiumGatedUI"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  DEFAULT_DESK_OVERRIDE_ID: DEFAULT_DESK_OVERRIDE_ID,", "  FRIEND_CODE_LOGIN_RE: ()=>acctStateMod.FRIEND_CODE_LOGIN_RE,", "  _loginDoFriendCode: (...a)=>accountMod._loginDoFriendCode(...a),", "  _loginDoGoogle: (...a)=>accountMod._loginDoGoogle(...a),", "  _enterAccount: (...a)=>accountMod._enterAccount(...a),", "  _wipeAccountLocal: (...a)=>accountMod._wipeAccountLocal(...a),", "  loginFlowMod: loginFlowMod,", "  userApiMod: userApiMod,", "  inviteIds: TwRequestId.createPending(),", "  firstRunMod: firstRunMod,", "  applyDeskCatalogRefToSeat: (...a)=>deskVisualMod.applyDeskCatalogRefToSeat(...a),", "  applyDeskItemsTo: (...a)=>applyDeskItemsTo(...a),", "  awayPicMod: ()=>awayPicMod,", "  creatorOpen: ()=>creatorOpen,", "  getMyUserId: (...a)=>getMyUserId(...a),", "  pruneUnownedLicenseAssets: (...a)=>premiumMod.pruneUnownedLicenseAssets(...a),", "  refreshAccountTab: (...a)=>accountMod.refreshAccountTab(...a),", "  refreshCustomStatusMenuItem: (...a)=>refreshCustomStatusMenuItem(...a),", "  refreshLicenseUI: (...a)=>licenseUiMod.refreshLicenseUI(...a),", "  renderCrItems: (...a)=>deskSetupMod.renderCrItems(...a),", "  restoreLicenseHeldAssets: (...a)=>premiumMod.restoreLicenseHeldAssets(...a),", "  seats: seats,", "  setUserStatus: (...a)=>setUserStatus(...a),", "  toast: (...a)=>toast(...a),", "  userStatus: ()=>userStatus,", "  LICENSE_KEY_STORAGE: acctStateMod.LICENSE_KEY_STORAGE,", "  LICENSE_OPTOUT_KEY: acctStateMod.LICENSE_OPTOUT_KEY,", "  _setPremium: (...a)=>acctStateMod._setPremium(...a),", "  onPremiumChanged: acctStateMod.onPremiumChanged,", "  _acctRelaunchAfterDetach: (...a)=>acctStateMod._acctRelaunchAfterDetach(...a),", "  _rcStore: (...a)=>acctStateMod._rcStore(...a),"];

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
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'module',
    src + '\nreturn window.TwLicenseGate;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, undefined);
  return api.createLicenseGate(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwLicenseGate = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwLicenseGate(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("LICENSE_GATE_MOD_OFF") && app.includes("const licenseGateMod = TwLicenseGate.createLicenseGate({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const licenseGateMod = TwLicenseGate\\.createLicenseGate\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = mk.split('\n').map(kindOf);
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const licenseGateMod = [\s\S]*?\n\}\);/, '')));
  t(!bare.length, '부르는 곳은 licenseGateMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/account/license-gate.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/account/license-gate.js 를 app.js 보다 먼저 싣는다');
  return r;
}

/* 내 코드(getMyUserId)가 없는 기기 — 런처 초대장 버튼(refreshInviteBtn) 가 부르는 firebaseAPI 이름들 */
function callsWith(src, uid){
  const any = anything(), calls = [];
  const fa = new Proxy({}, { get: (t, k) => (...a) => { calls.push(String(k)); return any; } });   // 서버 provider(user-api.js) 흉내 — 부른 이름을 적는다
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  deps.getMyUserId = () => uid;
  deps.userApiMod = fa;
  const win = new Proxy({ firebaseAPI: fa }, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const ls = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const api = new Function('window', 'document', 'localStorage', 'firebaseAPI', 'module', src + '\nreturn window.TwLicenseGate;')(win, any, ls, fa, undefined);
  try{ api.createLicenseGate(deps).refreshInviteBtn(); }catch(_){}
  return calls;
}
const judgeNoUid = (src) => !callsWith(src, null).includes('myInvites') && callsWith(src, 'ME').includes('myInvites');

/* 런처 초대장 버튼 — 진짜 refreshInviteBtn 을 돌려 버튼이 켜졌는지 본다.
   o: { uid, api: 서버 provider(user-api.js) 흉내 — myInvites } → 버튼 { disabled, text } */
async function inviteBtnAfter(src, o){
  const any = anything();
  const btn = { textContent: '', disabled: false, title: '', style: {}, addEventListener: () => {} };
  const doc = new Proxy({}, { get: (t, k) => k === 'getElementById' ? (id => id === 'lcInviteIssueBtn' ? btn : any) : any });
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  deps.getMyUserId = () => o.uid;
  deps.userApiMod = o.api;
  const win = {};
  const ls = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const quiet = { warn: () => {}, log: () => {} };
  const api = new Function('window', 'document', 'localStorage', 'firebaseAPI', 'console', 'module', src + '\nreturn window.TwLicenseGate;')(win, doc, ls, o.api, quiet, undefined);
  await api.createLicenseGate(deps).refreshInviteBtn();
  return { disabled: btn.disabled === true, text: btn.textContent };
}
async function judgeInviteBtn(src, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const left = (n) => ({ myInvites: async () => ({ invitesLeft: n, invites: [] }) });
  try{
    const b3 = await inviteBtnAfter(src, { uid: 'ME', api: left(3) });
    t(!b3.disabled && b3.text === '🎟️ 초대장 (3)', '3장 남음 — 켜짐 «🎟️ 초대장 (3)»');
    const b0 = await inviteBtnAfter(src, { uid: 'ME', api: left(0) });
    t(b0.disabled, '0장 — 꺼짐');
    const bNeg = await inviteBtnAfter(src, { uid: 'ME', api: left(-1) });
    t(bNeg.disabled && bNeg.text === '🎟️ 초대장 (0)', '회수로 음수 — 0 으로 보이고 꺼짐');
    const bErr = await inviteBtnAfter(src, { uid: 'ME', api: { myInvites: async () => { throw Object.assign(new Error('x'), { kind: 'unavailable' }); } } });
    t(bErr.disabled, '★ 장수를 못 읽음(닿지 못함 · 거부) — 꺼짐');
    const bBad = await inviteBtnAfter(src, { uid: 'ME', api: { myInvites: async () => null } });
    t(bBad.disabled, '★ 모양이 틀린 답 — 꺼짐');
    const bNoUid = await inviteBtnAfter(src, { uid: null, api: left(3) });
    t(bNoUid.disabled, '★ 내 코드 없음(로그인 전) — 꺼짐');
    const bAdm = await inviteBtnAfter(src, { uid: 'ME', api: left(null) });
    t(!bAdm.disabled && /무제한/.test(bAdm.text), '관리자(서버가 null — 무제한) — 켜짐 «무제한»');
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 100)); }
  const tag = (html.match(/<button id="lcInviteIssueBtn"[^>]*>/) || [''])[0];
  t(/\sdisabled[\s>]/.test(tag), '★ html — 처음(장수를 읽기 전)엔 꺼진 채 그린다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 2-2. 내 코드 없음 — 그 요청 0');
chk(judgeNoUid(MOD), '내 코드 없음 → 내 초대 요청(myInvites) 0 · 코드 있으면 읽는다');
(async () => {
say('── 2-3. 런처 초대장 버튼');
(await judgeInviteBtn(MOD, HTML)).forEach(([ok, msg]) => chk(ok, msg));
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
{
  const m2 = MOD.replace("  if(!getMyUserId()){ _setInviteBtn(btn,", "  if(false){ _setInviteBtn(btn,");
  chk(m2 !== MOD && !judgeNoUid(m2), '내 코드 확인을 빼면 — 내 코드 없음 판정이 빨강');
}
const btnBreaks = [
  ['못 읽으면 버튼을 그대로 둠(예전)', m => m.replace("    _setInviteBtn(btn, '🎟️ 초대장', false, '초대장 수를 불러오지 못했어요');\n  }", "    btn.textContent = '🎟️ 초대장';\n  }"), h => h],
  ['서버 준비 전 · 내 코드 없음에 버튼을 그대로 둠(예전)', m => m.replace("){ _setInviteBtn(btn, '🎟️ 초대장', false, '초대장 수를 불러오지 못했어요'); return; }", "){ btn.textContent = '🎟️ 초대장'; return; }"), h => h],
  ['html 처음부터 켜짐(예전)', m => m, h => h.replace('<button id="lcInviteIssueBtn" disabled style=', '<button id="lcInviteIssueBtn" style=')],
];
for(const [name, fm, fh] of btnBreaks){
  const m2 = fm(MOD), h2 = fh(HTML);
  const changed = m2 !== MOD || h2 !== HTML;
  const rows2 = changed ? await judgeInviteBtn(m2, h2) : [];
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/account/license-gate.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  ['deps 하나 빠짐', null, a => { const i = a.indexOf("const licenseGateMod = TwLicenseGate.createLicenseGate({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }, null],
  ['전역 이름 안 걺', m => m.replace('window.TwLicenseGate = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const licenseGateMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('licenseGateMod.' + x)); if(n){ ls[i] = ls[i].replace('licenseGateMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createLicenseGate(deps){', 'function createLicenseGate(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})().catch(e => { say('  ✗ 검사가 던졌다: ' + (e && e.stack || e)); process.exit(1); });

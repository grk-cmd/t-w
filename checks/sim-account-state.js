/* sim-account-state.js — 🪪 계정 핵심 상태(account-state.js — 로그인 이메일 · 저장 키 · 친구코드 모양 · 라이선스 저장 키 · 초대 통과 · 프리미엄 깃발 · 신원 놓음 · 다시 켜기 · 원격 설정 한 벌)
   실행:  node sim-account-state.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 이 값들이 초대 게이트(license-gate) · 계정(account) · 내 정보(my-info)에 흩어져 있어서
     계정 ↔ 게이트 ↔ 내 정보 ↔ 포커스 레벨이 서로를 불렀다(sim-dep-cycles). 맨 아래 한 파일에 두고, 쓰는 모듈보다 먼저 싣는다.
   ・1절: 값 · 함수 — 저장 키 · 친구코드 모양 · 로그인 이메일 · 초대 통과 표시 · 프리미엄(같은 값이면 알림 없음 · 바뀌면 건 차례대로 한 번) · 신원 놓음 · 원격 설정
   ・2절: HTML 순서(쓰는 모듈 · app.js 보다 먼저) · 알림을 거는 곳 · 바꾸는 곳
   ・3절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('account/account-state.js'), HTML = read('desk-companion-prototype.html'), APP = read('app.js');
if (!MOD || !HTML || !APP) { say('  ? 원본 못 찾음 — account-state.js · desk-companion-prototype.html · app.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const USERS = ['account/license-gate.js', 'account/account.js', 'account/my-info.js', 'focus/focus-level.js', 'room/room-entry.js'];

function build(mod, win) {
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const companion = new Proxy({}, { get: (t, k) => win.companion && win.companion[k] });   // 진짜 앱처럼 전역 companion = window.companion
  const api = new Function('window', 'companion', 'localStorage', 'setTimeout', 'module', mod + '\nreturn window.TwAccountState;')(win, companion, ls, (fn) => fn(), undefined);
  let prem = false;
  const st = api.createAccountState({ isPremium: () => prem, setIsPremium: (v) => { prem = v; } });
  return { st, store, prem: () => prem };
}
function judge(mod, html, files, app) {
  const r = {};
  try {
    const win = {};
    const { st, store, prem } = build(mod, win);
    r.keys = st.LICENSE_KEY_STORAGE === 'tw.licenseKey' && st.INVITE_PASS_KEY === 'tw.invitePassed' && st.LICENSE_OPTOUT_KEY === 'tw.licenseOptOut'
      && st.LOGIN_EMAIL_KEY === 'tw.loginEmail' && st.LOGIN_UID_KEY === 'tw.loginAuthUid';
    r.re = st.FRIEND_CODE_LOGIN_RE.test('MATE-AB12') && !st.FRIEND_CODE_LOGIN_RE.test('mate-ab12') && !st.FRIEND_CODE_LOGIN_RE.test('MATE-AB123');
    r.email = st.getMyLoginEmail() === null && (store['tw.loginEmail'] = 'a@b.c', st.getMyLoginEmail() === 'a@b.c');
    st._markInvitePassed(); r.pass = store['tw.invitePassed'] === '1';
    const got = []; st.onPremiumChanged(() => got.push('a')); st.onPremiumChanged(() => got.push('b'));
    st._setPremium(false); const quiet = got.length === 0;
    st._setPremium(1); r.prem = quiet && prem() === true && got.join() === 'a,b';
    st._setPremium(true); r.premSame = got.length === 2;
    r.detach = st._acctDetached() === false && (st.setAcctDetached(true), st._acctDetached() === true);
    r.rcNull = st._rcStore() === null;
    win.TwRemoteConfig = { store: { maxPeople: () => 7 } }; r.rc = st._rcStore() && st._rcStore().maxPeople() === 7;
    let fell = 0; r.relaunch = st._acctRelaunchAfterDetach(() => { fell++; }) === false && fell === 1;
    let relaunched = 0; win.companion = { relaunchApp: () => { relaunched++; } };
    r.relaunch = r.relaunch && st._acctRelaunchAfterDetach(() => {}) === true && relaunched === 1;
  } catch (e) { r.err = String(e && e.message || e); }
  const order = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
  const at = order.indexOf('account/account-state.js');
  r.late = at < 0 ? ['(account-state.js 를 안 싣는다)'] : USERS.concat(['app.js']).filter(f => order.indexOf(f) >= 0 && order.indexOf(f) < at);
  /* 알림 · 쓰기 — 프리미엄 알림은 초대 게이트만 건다 · 신원 놓음은 계정만 바꾼다(만드는 줄이 쓰는 함수를 넘김) */
  const t = (f) => strip((files.find(([n]) => n === f) || [, ''])[1]);
  r.onPrem = files.filter(([f, s]) => f !== 'account/account-state.js' && /\bonPremiumChanged\(/.test(strip(s))).map(([f]) => f);
  r.gateHooks = /^onPremiumChanged\(_refreshPremiumGatedUI\);/m.test(t('account/license-gate.js'));
  const glue = (name) => { const i = app.indexOf('.' + name + '({'); return i < 0 ? '' : app.slice(i, app.indexOf('\n});', i)); };
  r.detachWriters = [...app.matchAll(/acctStateMod\.setAcctDetached\(/g)].length === 1 && /setAcctDetached: \(v\)=>\{ acctStateMod\.setAcctDetached\(v\); \}/.test(glue('createAccount'))
    && /^\s*setAcctDetached\(true\);/m.test(t('account/account.js'));
  r.made = /const acctStateMod = TwAccountState\.createAccountState\(\{\n  isPremium: \(\)=>isPremium,\n  setIsPremium: \(v\)=>\{ isPremium = v; \},\n\}\);/.test(app)
    && app.indexOf('const acctStateMod =') > app.search(/^let isPremium = false;/m) && app.indexOf('const acctStateMod =') < app.indexOf('const licenseGateMod =');
  return r;
}

const ORDER = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
const FILES = ORDER.map(f => [f, f === 'app.js' ? APP : read(f)]).filter(([, t]) => t);
const R = judge(MOD, HTML, FILES, APP);

say('── 1. 값 · 함수');
chk(!R.err && R.keys && R.re, '저장 키 다섯 · 친구코드 모양(MATE-XXXX)이 옮기기 전 값 그대로' + (R.err ? ' — ' + R.err : ''));
chk(R.email && R.pass, '로그인 이메일은 저장 키에서 읽는다(없으면 null) · 초대 통과 표시를 적는다');
chk(R.prem && R.premSame, '프리미엄 — 같은 값이면 알림 없음 · 바뀌면 건 차례대로 한 번 · 값은 쓰는 함수로');
chk(R.detach, '신원 놓음 — 처음 false · 쓰는 함수로 올린다');
chk(R.rcNull && R.rc, '원격 설정 한 벌 — 없으면(검사 · 옛 html) null · 있으면 그 store');
chk(R.relaunch, '다시 켜기 — companion 이 없으면 대신 할 일을 부르고 false · 있으면 앱을 다시 켠다');

say('── 2. 싣는 순서 · 거는 곳 · 바꾸는 곳');
chk(FILES.length >= 100 && !R.late.length, '쓰는 모듈(초대 게이트 · 계정 · 내 정보 · 포커스 레벨 · 방 입장) · app.js 보다 먼저 싣는다' + (R.late.length ? ' — 먼저 실리는 것: ' + R.late.join(' · ') : ''));
chk(R.gateHooks && R.onPrem.length === 1 && R.onPrem[0] === 'account/license-gate.js', '프리미엄 알림은 초대 게이트가 _refreshPremiumGatedUI 로 건다(그 밖엔 없다)' + (R.onPrem.length !== 1 ? ' — ' + R.onPrem.join(' · ') : ''));
chk(R.detachWriters, '신원 놓음을 바꾸는 곳은 계정(_wipeAccountLocal) 하나 — app.js 는 계정 만드는 줄에서만 쓰는 함수를 넘긴다');
chk(R.made, 'app.js 는 isPremium 바로 뒤 · 초대 게이트보다 먼저 계정 핵심 상태를 만든다');

say('── 3. 일부러 깨 보기');
const line = '<script src="parts/account/account-state.js"></script>';
const lateHtml = HTML.indexOf(line) < 0 ? HTML : HTML.replace(line, '').replace('<script src="parts/app.js"></script>', '<script src="parts/app.js"></script>\n' + line);
chk(judge(MOD, lateHtml, FILES, APP).late.length > 0, 'account-state.js 를 app.js 뒤로 옮기면 빨강');
chk(!judge(MOD.replace('  if(isPremium() === v) return;\n', ''), HTML, FILES, APP).premSame, '같은 값에도 알리면 빨강');
chk(!judge(MOD.replace("const LOGIN_EMAIL_KEY = 'tw.loginEmail';", "const LOGIN_EMAIL_KEY = 'tw.loginMail';"), HTML, FILES, APP).keys, '저장 키 글자가 바뀌면 빨강');
const extra = FILES.map(([f, t]) => [f, f === 'myhome/guestbook.js' ? t + '\nonPremiumChanged(()=>{});\n' : t]);
chk(judge(MOD, HTML, extra, APP).onPrem.includes('myhome/guestbook.js'), '다른 파일이 프리미엄 알림을 걸면 빨강(거는 곳을 여기 적고 이유를 주석에)');
chk(!judge(MOD, HTML, FILES, APP + '\nacctStateMod.setAcctDetached(false);\n').detachWriters, 'app.js 다른 자리에서 신원 놓음을 바꾸면 빨강');

say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 계정 핵심 상태는 account-state.js 한 곳'));
process.exit(fail ? 1 : 0);

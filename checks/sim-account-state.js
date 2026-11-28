/* sim-account-state.js — 🪪 계정 핵심 상태(account-state.js — 로그인 이메일 · 저장 키 · 친구코드 모양 · 라이선스 저장 키 · 프리미엄 깃발 · 신원 놓음 · 다시 켜기 · 원격 설정 한 벌)
   실행:  node sim-account-state.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 이 값들이 초대 게이트(license-gate) · 계정(account) · 내 정보(my-info)에 흩어져 있어서
     계정 ↔ 게이트 ↔ 내 정보 ↔ 포커스 레벨이 서로를 불렀다(sim-dep-cycles). 맨 아래 한 파일에 두고, 쓰는 모듈보다 먼저 싣는다.
   ・1절: 값 · 함수 — 저장 키 · 친구코드 모양 · 로그인 이메일 · 초대 통과 표시는 없음(0.13 — 서버가 가입을 판정) · 프리미엄(첫 확인은 알림 · 같은 값이면 알림 없음 · 바뀌면 건 차례대로 한 번) · «모름» · 신원 놓음 · 원격 설정
   ・2절: HTML 순서(쓰는 모듈 · app.js 보다 먼저) · 알림을 거는 곳 · 바꾸는 곳
   ・3절: mutation test */
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
  let prem = false, adm = false;
  const toasts = [];
  const st = api.createAccountState({ isPremium: () => prem, isAdmin: () => adm, setIsPremium: (v) => { prem = v; }, toast: (m) => toasts.push(m) });
  return { st, store, prem: () => prem, setAdmin: (v) => { adm = v; }, toasts };
}
function judge(mod, html, files, app) {
  const r = {};
  try {
    const win = {};
    const { st, store, prem, toasts } = build(mod, win);
    r.keys = st.LICENSE_KEY_STORAGE === 'tw.licenseKey' && !('LICENSE_OPTOUT_KEY' in st)
      && st.LOGIN_EMAIL_KEY === 'tw.loginEmail' && st.LOGIN_UID_KEY === 'tw.loginAuthUid';
    r.re = st.FRIEND_CODE_LOGIN_RE.test('MATE-AB12') && !st.FRIEND_CODE_LOGIN_RE.test('mate-ab12') && !st.FRIEND_CODE_LOGIN_RE.test('MATE-AB123');
    r.email = st.getMyLoginEmail() === null && (store['tw.loginEmail'] = 'a@b.c', st.getMyLoginEmail() === 'a@b.c');
    r.pass = !('INVITE_PASS_KEY' in st) && !('_markInvitePassed' in st);
    const got = []; st.onPremiumChanged(() => got.push('a')); st.onPremiumChanged(() => got.push('b'));
    const unknown0 = st.premiumKnown() === false && prem() === false;   // 서버가 확인해 주기 전 — false 는 «모름»
    const gate0 = st.premiumGate();
    st._setPremium(false); r.first = unknown0 && st.premiumKnown() === true && prem() === false && got.join() === 'a,b';   // 첫 확인은 값이 그대로여도(false → false) 한 번 알린다 — «확인 중» 으로 그린 칸이 지금 값으로 바뀌게
    const gateNo = st.premiumGate();
    st._setPremium(false); r.quiet = got.length === 2;
    st._setPremium(1); r.prem = prem() === true && got.join() === 'a,b,a,b';
    st._setPremium(true); r.premSame = got.length === 4;
    r.gate = gate0 === 'unknown' && gateNo === 'no' && st.premiumGate() === 'ok' && typeof st.PREMIUM_UNKNOWN_TEXT === 'string' && /확인 중/.test(st.PREMIUM_UNKNOWN_TEXT);
    st.resetPremium(); r.gate = r.gate && st.premiumGate() === 'unknown' && prem() === false;
    st.tellPremiumUnknown(); r.gate = r.gate && toasts.length === 1 && toasts[0] === st.PREMIUM_UNKNOWN_TEXT;
    r.detach = st._acctDetached() === false && (st.setAcctDetached(true), st._acctDetached() === true);
    r.rcNull = st._rcStore() === null;
    win.TwRemoteConfig = { store: { maxPeople: () => 7 } }; r.rc = st._rcStore() && st._rcStore().maxPeople() === 7;
    let fell = 0; r.relaunch = st._acctRelaunchAfterDetach(() => { fell++; }) === false && fell === 1;
    let relaunched = 0; win.companion = { relaunchApp: () => { relaunched++; } };
    r.relaunch = r.relaunch && st._acctRelaunchAfterDetach(() => {}) === true && relaunched === 1;
    /* 🚪 나감 안내 — 한 번짜리: 적고 → 읽으면 글을 주고 지운다 · 없으면 null · 모르는 까닭은 적지 못하고(던짐) 읽을 땐 경고하고 지운 뒤 null */
    r.left = st.takeLeft() === null && !('tw.leftNotice' in store);
    st.markLeft('logout'); r.left = r.left && store['tw.leftNotice'] === 'logout' && st.takeLeft() === '로그아웃했어요' && !('tw.leftNotice' in store) && st.takeLeft() === null;
    st.markLeft('withdraw'); r.left = r.left && st.takeLeft() === '탈퇴했어요' && st.takeLeft() === null;
    let thr = false; try{ st.markLeft('gone'); }catch(_){ thr = true; }
    store['tw.leftNotice'] = '몰라'; let unk = false; try{ st.takeLeft(); }catch(_){ unk = true; }
    r.left = r.left && thr && unk && !('tw.leftNotice' in store) && st.takeLeft() === null;   // 모르는 값은 지우고 던진다 — 다음 켜기엔 또 던지지 않는다
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
  r.made = /const acctStateMod = TwAccountState\.createAccountState\(\{\n  isPremium: \(\)=>isPremium,\n  isAdmin: \(\)=>isAdmin,\n  setIsPremium: \(v\)=>\{ isPremium = v; \},\n  toast: \(\.\.\.a\)=>toast\(\.\.\.a\),[^\n]*\n\}\);/.test(app)
    && app.indexOf('const acctStateMod =') > app.search(/^let isPremium = false;/m) && app.indexOf('const acctStateMod =') < app.indexOf('const licenseGateMod =');
  return r;
}

const ORDER = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
const FILES = ORDER.map(f => [f, f === 'app.js' ? APP : read(f)]).filter(([, t]) => t);
const R = judge(MOD, HTML, FILES, APP);

say('── 1. 값 · 함수');
chk(!R.err && R.keys && R.re, '저장 키 넷 · 친구코드 모양(MATE-XXXX)이 옮기기 전 값 그대로' + (R.err ? ' — ' + R.err : ''));
chk(R.email && R.pass, '로그인 이메일은 저장 키에서 읽는다(없으면 null) · 초대 통과 표시는 걷었다(0.13)');
chk(R.first && R.quiet, '프리미엄 «모름» — 확인 전 premiumKnown 은 false · 첫 확인은 같은 값이어도 한 번 알림(«확인 중» 을 지운다) · 그 뒤로는 값이 바뀔 때만');
chk(R.gate, '★ 프리미엄 문 — 확인 전 · reset 뒤 \'unknown\'(«아님» 이 아니다) · 거짓 \'no\' · 참 \'ok\' · «확인 중» 안내 글이 한 곳');
chk(R.prem && R.premSame, '프리미엄 — 같은 값이면 알림 없음 · 바뀌면 건 차례대로 한 번 · 값은 쓰는 함수로');
chk(R.detach, '신원 놓음 — 처음 false · 쓰는 함수로 올린다');
chk(R.rcNull && R.rc, '원격 설정 한 벌 — 없으면(검사 · 옛 html) null · 있으면 그 store');
chk(R.left, '나감 안내(S-Q4) — markLeft 가 까닭을 적고 takeLeft 가 한 번만 읽고 지운다 · 없으면 null(짐작 없음) · 모르는 까닭은 적을 때도 읽을 때도 던진다(읽을 땐 지운 뒤)');
chk(R.relaunch, '다시 켜기 — companion 이 없으면 대신 할 일을 부르고 false · 있으면 앱을 다시 켠다');

say('── 2. 싣는 순서 · 거는 곳 · 바꾸는 곳');
chk(FILES.length >= 100 && !R.late.length, '쓰는 모듈(초대 게이트 · 계정 · 내 정보 · 포커스 레벨 · 방 입장) · app.js 보다 먼저 싣는다' + (R.late.length ? ' — 먼저 실리는 것: ' + R.late.join(' · ') : ''));
chk(R.gateHooks && R.onPrem.length === 1 && R.onPrem[0] === 'account/license-gate.js', '프리미엄 알림은 초대 게이트가 _refreshPremiumGatedUI 로 건다(그 밖엔 없다)' + (R.onPrem.length !== 1 ? ' — ' + R.onPrem.join(' · ') : ''));
chk(R.detachWriters, '신원 놓음을 바꾸는 곳은 계정(_wipeAccountLocal) 하나 — app.js 는 계정 만드는 줄에서만 쓰는 함수를 넘긴다');
chk(R.made, 'app.js 는 isPremium 바로 뒤 · 초대 게이트보다 먼저 계정 핵심 상태를 만든다');

say('── 3. mutation test');
const line = '<script src="parts/account/account-state.js"></script>';
const lateHtml = HTML.indexOf(line) < 0 ? HTML : HTML.replace(line, '').replace('<script src="parts/app.js"></script>', '<script src="parts/app.js"></script>\n' + line);
chk(judge(MOD, lateHtml, FILES, APP).late.length > 0, 'account-state.js 를 app.js 뒤로 옮기면 빨강');
chk(!judge(MOD.replace(/  if\(wasKnown && isPremium\(\) === v\) return;[^\n]*\n/, ''), HTML, FILES, APP).premSame, '같은 값에도 알리면 빨강');
chk(!judge(MOD.replace(/  if\(wasKnown && isPremium\(\) === v\) return;/, '  if(isPremium() === v) return;'), HTML, FILES, APP).first, '첫 확인(같은 값)에 안 알리면 빨강(«확인 중» 이 남는다)');
chk(!judge(MOD.replace("  if(!_premiumKnown) return 'unknown';\n", ''), HTML, FILES, APP).gate, '★ 모르는 프리미엄을 \'no\' 로 보면 빨강');
chk(!judge(MOD.replace('  _premiumKnown = true;\n', ''), HTML, FILES, APP).first, '확인했는데도 «모름» 이면 빨강');
chk(!judge(MOD.replace("const LOGIN_EMAIL_KEY = 'tw.loginEmail';", "const LOGIN_EMAIL_KEY = 'tw.loginMail';"), HTML, FILES, APP).keys, '저장 키 글자가 바뀌면 빨강');
const extra = FILES.map(([f, t]) => [f, f === 'myhome/guestbook.js' ? t + '\nonPremiumChanged(()=>{});\n' : t]);
chk(judge(MOD, HTML, extra, APP).onPrem.includes('myhome/guestbook.js'), '다른 파일이 프리미엄 알림을 걸면 빨강(거는 곳을 여기 적고 이유를 주석에)');
chk(!judge(MOD.replace("  localStorage.removeItem(LEFT_NOTICE_KEY);\n", ''), HTML, FILES, APP).left, '읽고도 표시를 안 지우면 빨강(다음 켜기에 또 보인다)');
chk(!judge(MOD.replace("  localStorage.setItem(LEFT_NOTICE_KEY, why);", ''), HTML, FILES, APP).left, '까닭을 안 적으면 빨강');
chk(!judge(MOD, HTML, FILES, APP + '\nacctStateMod.setAcctDetached(false);\n').detachWriters, 'app.js 다른 자리에서 신원 놓음을 바꾸면 빨강');

say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 계정 핵심 상태는 account-state.js 한 곳'));
process.exit(fail ? 1 : 0);

/* sim-google-login.js — 🔑 구글 로그인이 계정을 잃지 않고 갈아타는가
   실행:  node sim-google-login.js
   (app.js · desk-companion-prototype.html · firebase-init.js · main.js · preload.js · smoke.js 와 같은 폴더)

   ★ 왜 이 검사가 있는가 — 로그인은 이 앱에서 **유일하게 유저 코드를 바꾸는 기능**이고,
     유저 코드는 친구·마이홈·인박스·친추코드가 전부 매달린 뿌리다. 여기서 순서 하나가 틀리면
     화면에는 아무 오류도 안 뜨는데 계정이 조용히 반쪽이 된다. 조용해서 제보도 늦다.

   ★ 이 검사가 지키는 규약 일곱

     ① **버린 uid 를 적지 않는다 · 기록은 한 입구로.** (개정 56 · 회원가입 설계 §6-②⑦) 예전엔 옛 uid 를
        `_rememberPrevUserId` 로 적어 두고 그 uid 의 코드·친구 요청을 조건 없이 끌어왔다. 이제 로그인은 확인된
        계정이라 이 기기의 이전 uid 는 **다른 계정**이다 — 적지 않는다. 새 uid 는 `_setMyUserId` 로만 기록하고,
        못 쓰면 Auth 세션을 놓고 실패로 돌려준다(«로그인은 됐는데 이 기기는 딴 사람» 을 남기지 않는다).

     ② **복원은 한 벌이다.** 로그인은 계정 연동과 같은 `_applyTransferSnapshot` 을 써야 한다.
        따로 만들면 "연동은 플레이리스트가 오는데 로그인은 안 온다" 같은 반쪽이 생긴다.

     ③ **갈아탄 판은 그 자리에서 계속 쓰지 않는다.** uid 를 바꾼 뒤 이어 쓰면 옛 uid 로 걸린
        구독이 살아 있어 두 계정이 섞인다. 재시작 안내로 멈춰야 한다(계정 연동의 선례와 같다).

     ④ **선점은 덮어쓰지 않는다.** `userAuth/{유저코드}` 는 runTransaction 으로 비어 있을 때만
        차지해야 한다. set 으로 바꾸면 한 기기에서 두 계정으로 로그인한 사람이 먼저 묶인
        계정의 데이터를 통째로 빼앗는다.

     ⑤ **묶기가 실패하면 로그인 상태로 남기지 않는다.** 남기면 "로그인은 됐는데 내 데이터가
        아닌" 상태가 된다. 로그아웃시켜 되돌려야 한다.

     ⑥ **로그인 창에 preload 를 붙이지 않는다.** companion API 가 구글 페이지에 노출되면
        main.js 의 will-navigate 방어선("메인 창은 file:// 밖으로 안 나간다")이 막으려던
        그 상황이 창 하나 옆에서 그대로 벌어진다.

     ⑦ **취소가 흐름을 끊지 않는다.** 유저가 창을 × 로 닫으면 invoke 가 반드시 끝나야 한다.
        안 끝나면 로그인 버튼이 '눌러도 반응 없는' 상태로 굳는다.

   ⚠ 이 검사는 **클라이언트만** 본다. 지금 DB 규칙에는 `auth` 조건이 없어서 로그인은
     자물쇠가 아니라 편의다. 규칙 파일을 받으면 `userAuth` 근거 규칙을 여기서 함께 볼 것.
   ⚠ smoke.js 의 스텁을 빌려 쓴다 — 같은 폴더에 있어야 한다. */
'use strict';
const fs = require('fs'), vm = require('vm');

const SRC  = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');
const pick = (...c) => { for (const p of c) if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8'); return null; };
const FB   = pick('firebase-init.js', 'parts/firebase-init.js');
const MAIN = pick('main.js', '../main.js');
const PRE  = pick('preload.js', '../preload.js');

const say = console.log;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

say('=== 🔑 구글 로그인 검사 ===');
say('');

/* ── §1. 마크업 — 계정 탭과 게이트 ─────────────────────────────────── */
say('· §1 마크업 — 계정 자리([내 정보 › 계정])가 참조하는 id 가 실제로 있는가');
/* ★ 개정 45(회원가입 설계 개정 16 · 시안 C4) — 계정 기능의 자리는 [내 정보 › 계정](#miPageAcct) 하나다.
     설정 › 계정 탭 · 로그인 전 얼굴([구글 계정으로 로그인]) · «연결됨 · 이메일» 상자 · 이전/연동/해제 · 되찾기는 걷었다
     (로그인은 게이트 H · I · K 가 한다 · 기기 이동은 친구 코드 + 비밀번호 로그인이 대신한다). */
['lcMyInfo','miPageAcct','acctLoggedIn','acctLogoutBtn','acctLogoutConfirm','acctLogoutCancel','acctLogoutYes',
 'acctLogoutDone','acctLogoutQuit','acctLoginMsg','inviteGateGoogleBtn']
  .forEach(id => chk(HTML.includes('id="' + id + '"'), '#' + id));
['progTabBtnAccount','progTabAccount','acctLoggedOut','acctLoginEmail','acctGoogleBtn',
 'acctTransferBtn','acctLinkBtn','acctTransferPanel','acctLinkPanel','acctUnlinkYes']
  .forEach(id => chk(!HTML.includes('id="' + id + '"'), '#' + id + ' 은 걷었다 (개정 45)'));
{
  const iAcc = HTML.indexOf('id="miPageAcct"'), iOv = HTML.indexOf('id="lcMyInfo"'), iIn = HTML.indexOf('id="acctLoggedIn"'), iMsg = HTML.indexOf('id="acctLoginMsg"');
  chk(iOv >= 0 && iAcc > iOv && iIn > iAcc && iMsg > iIn, '로그인 후 얼굴 · 안내 줄이 [내 정보 › 계정] 안에 있다');
}
/* 프로그램 정보(버전)는 유저 정보가 아니므로 시스템에 남아야 한다. */
{
  const iSys = HTML.indexOf('id="progTabSystem"'), iClose = HTML.indexOf('id="progSettingsCloseBtn"');
  chk(HTML.indexOf('id="progVersionText"') > iSys && HTML.indexOf('id="progVersionText"') < iClose,
      '프로그램 정보(버전)는 시스템 탭에 그대로 남아 있다');
}
say('');

/* ── §2. app.js — 갈아타는 순서 ────────────────────────────────────── */
say('· §2 소스 대조 — 갈아타는 순서가 지켜지는가');

function cutFn(src, name){
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++){
    if (src[k] === '{') d++;
    else if (src[k] === '}'){ d--; if (d === 0) return src.slice(i, k + 1); }
  }
  return '';
}
const F_IN  = cutFn(SRC, '_loginDoGoogle');
const F_OUT = cutFn(SRC, '_loginDoLogout');
chk(!!F_IN,  '_loginDoGoogle() 을 찾았다');
chk(!!F_OUT, '_loginDoLogout() 을 찾았다');

if (F_IN){
  const F_IN_C = F_IN.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/mg, '');
  chk(!/_rememberPrevUserId|tw\.myPrevUserIds/.test(F_IN_C) && !/_rememberPrevUserId|_isMyPrevUserId/.test(SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/mg, '')),
      '① 버린 uid 를 적지 않는다 — _rememberPrevUserId · _isMyPrevUserId 가 app.js 코드에 없다 (개정 56)');
  chk(/if\(!_setMyUserId\(r\.userCode\)\)\{[\s\S]{0,200}authSignOut/.test(F_IN_C) && !/setItem\(MY_USER_ID_KEY/.test(F_IN_C),
      '① 갈아끼우기는 _setMyUserId 하나로 · 못 쓰면 Auth 세션을 놓는다 (설계 §6-⑦ · 개정 56)');
  chk(F_IN.includes('_applyTransferSnapshot'),
      '② 복원이 계정 연동과 같은 _applyTransferSnapshot 을 쓴다');
  chk(!/function\s+_login(Restore|Apply)/.test(SRC),
      '② 로그인 전용 복원 함수를 따로 만들지 않았다');
  chk(/switched\s*:\s*true/.test(F_IN) && /switched\s*:\s*false/.test(F_IN),
      '③ 갈아탄 판과 아닌 판을 구분해 알려준다 (switched)');
  chk(/canceled/.test(F_IN), '⑦ 취소를 실패와 구분해 돌려준다');
}
/* ③ 갈아탄 뒤 안내에 재시작이 들어 있는가 */
const UI = SRC.slice(SRC.indexOf('(function initAccountLoginUI('), SRC.indexOf('📤 계정 이전 / 연동'));
chk(!!UI, 'initAccountLoginUI 를 찾았다');
chk(/r\.switched[\s\S]{0,400}(종료|다시 실행)/.test(UI),
    '③ 갈아탄 뒤 안내가 재시작을 말한다');
chk(/canceled\s*\?\s*''/.test(UI), '⑦ 취소했을 때는 빨간 오류를 띄우지 않는다');

/* 로그아웃이 연동 해제와 **같은 자리**를 지우는가 — 한쪽만 고치면 두 경로가 어긋난다
   [2026-09-16 제보 4] 지우는 목록이 함수 본문에서 ACCOUNT_LOCAL_KEYS 한 벌로 옮겨 갔다.
     예전 판정(«본문에 removeItem(키) 가 있다»)은 그 구조에서 거짓 빨강이 된다 — 목록에 있는지로 본다.
     상세(소지품·검문)는 sim-account-switch.js 가 본다. */
const KEYLIST = (SRC.match(/const ACCOUNT_LOCAL_KEYS = \(\)=>\[([\s\S]*?)\n\];/) || [])[1] || '';
if (F_OUT){
  chk(F_OUT.includes('_detachAccountLocal'), '로그아웃이 지움 한 벌(_detachAccountLocal)을 부른다');
  ['MY_USER_ID_KEY','INVITE_PASS_KEY','MY_FRIEND_CODE_KEY'].forEach(k =>
    chk(new RegExp('\\b' + k + '\\b').test(KEYLIST), '로그아웃이 ' + k + ' 를 지운다 (ACCOUNT_LOCAL_KEYS)'));
  chk(F_OUT.includes('authSignOut'), '로그아웃이 Auth 세션도 끊는다');
  chk(/\bFOCUS_SYNCED_KEY\b/.test(KEYLIST),
      '로그아웃이 집중 누적 마크를 지운다 (다음 계정으로 증분이 밀려들어가지 않게 — 마크 없음 = 증분 0)');
}
/* 부팅 스냅샷은 로그인된 기기에서만 — 조건 없이 돌리면 남의 유저 코드로 쓰기가 나갈 수 있다 */
chk(/if\(!getMyLoginEmail\(\)\)\s*return/.test(UI),
    '부팅 스냅샷 올리기가 로그인된 기기에서만 돈다');
/* 3탭이 전부 전환 목록에 있는가 — 빠지면 그 탭은 눌러도 안 열린다. 계정은 개정 45 에서 [내 정보]로 옮겨 없다. */
const TABS = cutFn(SRC, 'setProgSettingsTab');
['license','display','system'].forEach(k =>
  chk(TABS.includes("key:'" + k + "'"), '탭 전환 목록에 ' + k + ' 이 있다'));
chk(!TABS.includes("key:'account'"), '탭 전환 목록에 account 가 없다 (개정 45 — 계정은 [내 정보 › 계정])');
say('');

/* ── §3. firebase-init.js — 선점과 되돌리기 ────────────────────────── */
say('· §3 서버 API — 선점이 남의 것을 덮지 않는가');
if (!FB){ say('  (firebase-init.js 를 못 찾음 — 건너뜀)'); }
else {
  const i = FB.indexOf('async authSignInWithGoogle(');
  const body = i < 0 ? '' : FB.slice(i, FB.indexOf('\n    },', i));
  chk(!!body, 'authSignInWithGoogle() 을 찾았다');
  if (body){
    chk(/runTransaction\(\s*ref\(db,\s*`userAuth\//.test(body), '④ 선점을 runTransaction 으로 한다');
    chk(!/set\(\s*ref\(db,\s*`userAuth\//.test(body),          '④ userAuth 를 set 으로 덮지 않는다');
    chk(/cur\s*==\s*null\s*\?/.test(body),                      '④ 비어 있을 때만 차지한다');
    chk((body.match(/fbSignOut\(auth\)/g) || []).length >= 2,
        '⑤ 선점 실패·쓰기 실패 두 경우 모두 로그아웃시켜 되돌린다');
    chk(/authUsers\/\$\{uid\}/.test(body), '이미 묶인 계정이면 그 유저 코드를 그대로 쓴다');
    chk(!/userCode\s*:\s*String\(userCode\)[\s\S]{0,80}v\.userCode/.test(body),
        '기존 결속을 새 유저 코드로 덮어쓰지 않는다');
    chk(!/\{\s*email\s*\}/.test(body) && !/userCode:String\(userCode\), email/.test(body) && /\{ email: null \}/.test(body),
        '§9-2 authUsers 에 이메일 거울을 쓰지 않는다 · 예전 판이 남긴 거울은 로그인 때 걷는다 (개정 54)');
  }
  chk(/auth = null/.test(FB) && /catch[\s\S]{0,140}auth = null/.test(FB),
      'auth 초기화가 실패해도 firebaseAPI 는 살아남는다 (앱 본체가 안 죽는다)');
  chk(/signInWithCredential/.test(FB) && !/signInWithPopup|signInWithRedirect/.test(FB),
      '팝업·리다이렉트를 쓰지 않는다 (file:// 에서 둘 다 막힌다)');
}
say('');

/* ── §4. main.js / preload.js — 창과 채널 ──────────────────────────── */
say('· §4 창과 채널 — 로그인 창이 앱의 방어선을 뚫지 않는가');
if (!MAIN || !PRE){ say('  (main.js / preload.js 를 못 찾음 — 건너뜀)'); }
else {
  chk(/signInWithGoogle\(\)\s*\{[\s\S]{0,160}invoke\('companion:signInWithGoogle'\)/.test(PRE),
      'preload 가 invoke 로 결과를 돌려준다 (send 가 아니다)');
  const i = MAIN.indexOf("ipcMain.handle('companion:signInWithGoogle'");
  const body = i < 0 ? '' : MAIN.slice(i, i + 7000);
  chk(!!body, 'main 에 signInWithGoogle 핸들러가 있다');
  if (body){
    const winOpts = body.slice(body.indexOf('new BrowserWindow('), body.indexOf('setAlwaysOnTop'));
    /* ⚠ 주석을 걷어내고 본다 — 그 자리의 주석이 "preload 를 주지 않는다"라고 적혀 있어서,
       글자만 찾으면 **올바른 코드가 오답으로 잡힌다**(실제로 처음에 그렇게 걸렸다). */
    const winCode = winOpts.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*/g, '');
    chk(!!winOpts && !/preload/.test(winCode),
        '⑥ 로그인 창에 preload 를 붙이지 않는다 (companion API 비노출)');
    chk(/contextIsolation:\s*true/.test(winOpts) && /nodeIntegration:\s*false/.test(winOpts),
        '⑥ contextIsolation 켜짐 · nodeIntegration 꺼짐');
    chk(/on\('closed'[\s\S]{0,120}finish\(/.test(body),
        '⑦ 유저가 창을 닫아도 invoke 가 끝난다 (버튼이 죽지 않는다)');
    chk(/let settled = false|settled\s*=\s*true/.test(body),
        '⑦ 결과가 두 번 돌아가지 않는다 (한 번만 resolve)');
    chk(/code_challenge_method=S256/.test(body), 'PKCE(S256)를 쓴다');
    chk(/response_type=code/.test(body) && !/response_type=id_token/.test(body),
        '암묵적 흐름이 아니라 인가 코드 흐름을 쓴다');
    chk(/prompt=select_account/.test(body),
        '계정 선택 화면을 강제한다 (한 컴퓨터를 나눠 쓸 때 계정 전환이 된다)');
    chk(/state/.test(body) && /q\.get\('state'\)\s*!==\s*state/.test(body),
        'state 를 대조한다 (응답 바꿔치기 방지)');
    chk(/e\.preventDefault\(\)/.test(body),
        '리디렉션을 이동 전에 가로챈다 (127.0.0.1 오류 페이지가 안 뜬다)');
    chk(/setAlwaysOnTop\(true, 'screen-saver'\)/.test(body),
        '로그인 창이 메인 오버레이 뒤로 깔리지 않는다');
    chk(/googleAuthWin && !googleAuthWin\.isDestroyed\(\)/.test(body),
        '창이 둘 열리지 않는다 (먼저 연 invoke 가 미아가 되지 않는다)');
  }
  /* 설정 상수는 비어 있어도 된다(각자 채운다). 다만 비었을 때 조용히 실패하면 안 된다. */
  chk(/GOOGLE_OAUTH_CLIENT_ID[\s\S]{0,400}설정되지 않았어요/.test(MAIN),
      'OAuth 상수가 비어 있으면 그렇다고 말해준다');
  chk(/relaunchApp\(\)\s*\{[\s\S]{0,160}send\('companion:relaunchApp'\)/.test(PRE),
      'preload 에 재시작 채널이 있다');
  const REL_M = MAIN.slice(MAIN.indexOf("ipcMain.on('companion:relaunchApp'"), MAIN.indexOf("ipcMain.on('companion:relaunchApp'") + 600);
  chk(/app\.relaunch\(\)/.test(REL_M) && /app\.quit\(\)/.test(REL_M),
      'main 이 relaunch 뒤에 quit 을 반드시 이어 부른다 (안 그러면 안 꺼진다)');
}
say('');

/* ── §5. 런타임 — 정말 그 순서로 도는가 ───────────────────────────── */
say('· §5 런타임 — 다른 기기 계정으로 로그인하면');

let smokeSrc = fs.readFileSync('smoke.js', 'utf8');
smokeSrc = smokeSrc.slice(0, smokeSrc.indexOf('/* ── 실행'))
  .split('\n').filter(l => !/require\(|const FILE =|if \(!FILE\)|process\.exit/.test(l)).join('\n');
vm.runInThisContext(smokeSrc, { filename: 'smoke-stubs.js' });

const realST = require('timers').setTimeout;
globalThis.setTimeout = (fn, ms) => realST(fn, ms || 0);
globalThis.setInterval = () => 0;
globalThis.clearTimeout = require('timers').clearTimeout;
globalThis.HTMLCanvasElement = class {};
globalThis.Image = class {
  constructor(){ this.naturalWidth = 512; this.naturalHeight = 512; }
  set src(v){ this._src = v; realST(() => { if (this.onload) this.onload(); }, 0); }
  get src(){ return this._src; }
};
globalThis.HTMLImageElement = globalThis.Image;

const probe = `
;globalThis.__L = {
  login:  _loginDoGoogle,
  logout: _loginDoLogout,
  email:  getMyLoginEmail,
  MY_USER_ID_KEY, LOGIN_EMAIL_KEY, INVITE_PASS_KEY, MY_FRIEND_CODE_KEY,
};`;

const _log = console.log, _warn = console.warn;
console.log = () => {}; console.warn = () => {};
try { vm.runInThisContext(SRC + probe, { filename: 'app.js' }); }
catch (e) { console.log = _log; say('  ✗ app.js 평가 실패: ' + (e && e.stack || e)); process.exit(1); }
/* ⚠ 복구하지 않는다 — app.js 가 예약해 둔 타이머가 뒤늦게 로그를 뱉어 결과 사이에 끼어든다.
   say 는 위에서 원본 console.log 를 붙잡아 뒀으므로 이 검사의 출력만 남는다. */
void _log; void _warn;

const L = globalThis.__L;
const ls = globalThis.localStorage;
const order = [];

globalThis.window.companion = { signInWithGoogle: async () => ({ ok:true, idToken:'ID.TOKEN' }) };
globalThis.window.firebaseAPI = {
  async authSignInWithGoogle(tok, userCode){
    order.push('auth:' + tok + ':' + userCode);
    return { ok:true, uid:'AUTHUID', email:'hoya@gmail.com', userCode:'uOTHERACCOUNT9', bound:false };
  },
  async fetchAccountSnapshot(code){
    /* ★ 이 시점에 유저 코드가 이미 갈려 있어야 한다 — 아니면 옛 계정 것을 받아온다. */
    order.push('fetch:' + code);
    return { ok:true, license:'LIC-1', focusTotalSec:1234, name:'저쪽이름', friendCode:'MATE-ABCD' };
  },
  async setAccountSnapshot(code){ order.push('snap:' + code); return { ok:true }; },
  async authSignOut(){ order.push('signout'); },
};
globalThis._applyTransferSnapshot = async r => { order.push('apply:' + (r && r.name)); };
/* 개정 57 — 갈아타기 전 정리(_switchPrepare)는 sim-signup 14절이 떼어 와 돌린다. 여기서는 **부르는 자리와 순서**만 본다. */
let prepResult = { ok:true, mode:'none' };
globalThis._switchPrepare = async (b, t) => { order.push('prep:' + b + ':' + t); return prepResult; };

(async () => {
  ls.setItem(L.MY_USER_ID_KEY, 'uOLDDEVICE0001');
  ls.removeItem('tw.myPrevUserIds');
  /* 🔒 게이트를 지난 기기다 — 이 도장이 있어야 결속 자격이 선다(규약 ⑩).
     도장 없는 기기는 §6 에서 따로 본다. */
  ls.setItem(L.INVITE_PASS_KEY, '1');

  const r = await L.login();
  chk(!!r && r.ok, '로그인이 성공으로 끝난다');
  chk(!!r && r.switched === true, '다른 계정이므로 갈아탔다고 알린다 (switched)');
  chk(order[0] === 'auth:ID.TOKEN:uOLDDEVICE0001', '토큰과 **옛** 유저 코드를 함께 넘긴다');
  chk(ls.getItem(L.MY_USER_ID_KEY) === 'uOTHERACCOUNT9', '유저 코드가 그 계정 것으로 바뀌었다');
  chk(ls.getItem('tw.myPrevUserIds') === null, '① 버린 uid 를 적지 않는다 (개정 56 — 이전 uid 는 다른 계정이다)');
  chk(order[1] === 'prep:uOLDDEVICE0001:uOTHERACCOUNT9', '★ 갈아타기 **전에** 옛 uid → 새 uid 정리(_switchPrepare)를 부른다 (개정 57)');
  chk(order[2] === 'fetch:uOTHERACCOUNT9', '갈아탄 **뒤에** 그 계정 스냅샷을 받아온다');
  chk(order[3] === 'apply:저쪽이름', '받아온 스냅샷이 복원으로 넘어간다');
  chk(L.email() === 'hoya@gmail.com', '이 기기에 계정 이메일이 기록됐다');

  /* 같은 계정으로 다시 — 갈아탈 것이 없으니 복원도 돌지 않는다 */
  order.length = 0;
  const r2 = await L.login();
  chk(!!r2 && r2.ok && r2.switched === false, '이미 그 계정인 기기는 갈아타지 않는다');
  chk(order.filter(x => /^fetch:|^apply:/.test(x)).length === 0,
      '갈아탈 것이 없으면 복원이 돌지 않는다 (헛쓰기 없음)');

  /* 유저가 창을 닫은 경우 — 실패로 끝나되 '취소'로 표시되고, 아무것도 안 바뀐다 */
  order.length = 0;
  const before = ls.getItem(L.MY_USER_ID_KEY);
  globalThis.window.companion.signInWithGoogle = async () => ({ ok:false, reason:'로그인이 취소됐어요' });
  const r3 = await L.login();
  chk(!!r3 && !r3.ok && r3.canceled === true, '⑦ 창을 닫으면 취소로 끝난다');
  chk(ls.getItem(L.MY_USER_ID_KEY) === before, '⑦ 취소는 유저 코드를 건드리지 않는다');
  chk(order.length === 0, '⑦ 취소는 서버를 부르지 않는다');

  /* ① 기록을 못 하면 — 서버가 준 userCode 가 형식에 안 맞는 경우로 흉내 낸다(_setMyUserId 가 거절) */
  globalThis.window.companion.signInWithGoogle = async () => ({ ok:true, idToken:'ID.TOKEN' });
  const fa = globalThis.window.firebaseAPI.authSignInWithGoogle;
  globalThis.window.firebaseAPI.authSignInWithGoogle = async () => ({ ok:true, uid:'AUTHUID', email:'hoya@gmail.com', userCode:'bad code', bound:false });
  order.length = 0;
  const r4 = await L.login();
  chk(!!r4 && !r4.ok && /저장하지 못했어요/.test(r4.reason || ''), '① 이 기기에 uid 를 못 쓰면 실패로 돌려준다');
  chk(order.includes('signout') && ls.getItem(L.MY_USER_ID_KEY) === before && !L.email(), '① 그때는 Auth 세션과 계정 표시를 놓고, 유저 코드는 그대로다');
  chk(!order.some(x => /^fetch:|^apply:/.test(x)), '① 복원도 돌지 않는다');
  /* 정리가 실패하면 — 갈아타지 않는다(개정 57) */
  globalThis.window.firebaseAPI.authSignInWithGoogle = async () => ({ ok:true, uid:'AUTHUID', email:'hoya@gmail.com', userCode:'uTHIRDACCOUNT7', bound:false });
  prepResult = { ok:false, reason:'이 PC 의 캐릭터를 올리지 못했어요' };
  order.length = 0;
  const r5 = await L.login();
  chk(!!r5 && !r5.ok && /올리지 못했어요/.test(r5.reason || ''), '★ 정리가 실패하면 실패로 돌려준다 — 이유를 그대로');
  chk(order.includes('signout') && ls.getItem(L.MY_USER_ID_KEY) === before && !L.email() && !order.some(x => /^fetch:|^apply:/.test(x)),
      '★ 그때는 uid 를 안 바꾸고 · 세션과 계정 표시를 놓고 · 복원도 안 한다');
  prepResult = { ok:true, mode:'none' };
  globalThis.window.firebaseAPI.authSignInWithGoogle = fa;
  ls.setItem(L.LOGIN_EMAIL_KEY, 'hoya@gmail.com');   // 아래 로그아웃 판정의 전제(로그인된 기기)

  /* 로그아웃 — 신원을 놓고, 다음 부팅에 게이트로 돌아간다 */
  await L.logout();
  chk(order.indexOf('signout') >= 0, '로그아웃이 Auth 세션을 끊는다');
  chk(!ls.getItem(L.MY_USER_ID_KEY),     '로그아웃이 유저 코드를 놓는다');
  chk(!ls.getItem(L.INVITE_PASS_KEY),    '로그아웃이 게이트 통과 기록을 지운다 (다음 부팅에 시작 화면)');
  chk(!ls.getItem(L.MY_FRIEND_CODE_KEY), '로그아웃이 친추코드를 비운다 (남의 코드를 들고 있지 않게)');
  chk(!L.email(),                        '로그아웃이 계정 표시를 지운다');

  /* ⑧ 신원을 놓았으면 **앱이 껐다 켜져야** 한다 — 게이트는 부팅 때 한 번만 도는 검사라,
     그 자리에서 계속 쓰면 getMyUserId() 가 새 유저 코드를 만들어 기록이 붕 뜬 계정에 쌓인다. */
  chk(/companion\.relaunchApp/.test(SRC), '⑧ 재시작을 부르는 코드가 있다');
  const REL = cutFn(SRC, '_acctRelaunchAfterDetach');
  chk(!!REL, '⑧ 재시작이 한 함수(_acctRelaunchAfterDetach)로 모여 있다');
  chk(!!REL && /onFallback/.test(REL),
      '⑧ 재시작을 못 하는 구버전에서는 수동 종료로 물러난다 (버튼이 죽지 않는다)');
  /* 신원을 놓는 곳(로그아웃)과 게이트 로그인이 **같은 재시작 함수**를 쓰는가 — 따로 쓰면 한쪽만 고쳐진다.
     (개정 45: 옛 연동 해제는 걷었다 — 판정 대상에서 뺐다.) */
  chk((SRC.match(/_acctRelaunchAfterDetach\(/g) || []).length >= 3,
      '⑧ 로그아웃과 게이트 로그인이 같은 재시작 함수를 쓴다');
  chk(/_acctRelaunchAfterDetach\(null\)/.test(UI), '⑧ 로그아웃 완료가 자동 재시작으로 이어진다');
  chk(!/getElementById\('acctUnlinkYes'\)/.test(SRC), '⑧ 옛 연동 해제 입구는 없다 (개정 45)');

  /* ⑨ 게이트에서 계정을 되찾은 판도 자동 재시작이어야 한다 — 게이트 화면에는 종료 버튼이
     없어서, 안내만 띄우면 유저가 앱을 손으로 껐다 켜야 한다(나가는 길은 자동인데 돌아오는
     길만 수동인 상태였다). 그리고 결속 기록이 없는 계정에게 '다시 실행'을 시키면 안 된다 —
     재시작해도 못 들어가므로 껐다 켜기만 반복하게 된다. 그쪽엔 초대 코드가 필요하다. */
  const GATE = SRC.slice(SRC.indexOf("$('inviteGateGoogleBtn')"), SRC.indexOf('refreshAccountTab();', SRC.indexOf("$('inviteGateGoogleBtn')")));
  chk(!!GATE, '게이트 로그인 처리부를 찾았다');
  chk(/r\.switched[\s\S]{0,600}_acctRelaunchAfterDetach/.test(GATE),
      '⑨ 게이트에서 계정을 되찾으면 자동으로 재시작한다');
  chk(/_acctRelaunchAfterDetach\(\s*\(\)\s*=>/.test(GATE),
      '⑨ 재시작을 못 하는 판에서는 수동 안내로 물러난다');
  chk(/초대 코드로 먼저 입장/.test(GATE),
      '⑨ 연결 기록이 없는 계정에게는 초대 코드가 필요하다고 알려준다');
  chk(!/!r\.switched[\s\S]{0,80}다시 실행/.test(GATE),
      '⑨ 못 들어가는 사람에게 "다시 실행하라"고 하지 않는다');

  /* ── §6. 규약 ⑩ — 게이트 앞의 임시 코드를 묶지 않는다 ────────────────
     [경위] 2026-09 제보: 구글로 로그인했더니 마이홈과 친구 목록이 사라지고 친추 코드가 바뀌었다.
       원인은 로그인이 아니라 **그 전에 생긴 결속**이었다. _loginDoGoogle 이 getMyUserId() 를
       그대로 넘겼는데, 그 함수는 코드가 없으면 그 자리에서 만들어낸다. 그래서 새 컴퓨터가
       초대 게이트에서 [구글 로그인]을 누르면 방금 태어난 임시 코드가 그 계정에 영구히 묶였고
       (화면은 "연결된 기록이 없어요"라며 입장을 거부했다 — 묶임만 남았다), 원래 컴퓨터에서
       로그인하는 순간 서버가 그 빈 코드를 정답으로 돌려줘 계정이 통째로 갈렸다.
     ★ 결속은 한 번 생기면 그 계정의 정답이 된다. 그래서 '아직 계정이 아닌 코드'는 묶으면 안 된다. */
  say('');
  say('· §6 규약 ⑩ — 아직 계정이 아닌 코드를 묶지 않는가');
  chk(!/const before = getMyUserId\(\)/.test(F_IN),
      '⑩ 로그인이 getMyUserId() 로 코드를 **만들어내지** 않는다');
  chk(/getItem\(MY_USER_ID_KEY\)/.test(F_IN),
      '⑩ 이 기기에 코드가 있었는지를 날것으로 읽는다');
  chk(/_loginMayBind\(\)/.test(F_IN) && /function _loginMayBind\(/.test(SRC),
      '⑩ 묶어도 되는 코드인지 따로 판정한다');
  {
    const MB = cutFn(SRC, '_loginMayBind');
    chk(/HAD_USER_ID_AT_BOOT/.test(MB),
        '⑩ 부팅 전부터 있던 코드는 결속 자격이 있다 (오프라인 기존 유저가 막히지 않는다)');
    chk(/INVITE_PASS_KEY/.test(MB),
        '⑩ 이번 부팅에 초대 코드로 입장한 사람도 결속 자격이 있다');
  }
  order.length = 0;
  // ⚠ 위 ⑦ 검사가 창을 '취소'하는 스텁으로 바꿔놨다 — 되돌리지 않으면 여기서 서버까지 가지 않는다.
  globalThis.window.companion.signInWithGoogle = async () => ({ ok:true, idToken:'ID.TOKEN' });
  ls.setItem(L.MY_USER_ID_KEY, 'uJUSTBORN00001');   // 게이트 앞에서 방금 만들어진 코드
  ls.removeItem(L.INVITE_PASS_KEY);                  // 아직 게이트를 못 지났다
  {
    /* HAD_USER_ID_AT_BOOT 는 app.js 로드 시점에 굳는다(이 판에서는 false).
       그래서 여기서는 '도장 없는 새 기기'가 그대로 재현된다. */
    const r2 = await L.login();
    chk(order[0] === 'auth:ID.TOKEN:null',
        '⑩ 게이트 앞 기기는 유저 코드를 **넘기지 않는다** (서버가 묶을 수 없다)');
    chk(!!r2 && r2.ok === true && ls.getItem(L.MY_USER_ID_KEY) === 'uOTHERACCOUNT9',
        '⑩ 그래도 이미 묶여 있던 계정으로 돌아오는 길은 막지 않는다 (조회는 된다)');
  }

  /* ── §7. 결속 고쳐 매기 — 잘못 물렸을 때의 출구 ──────────────────────
     ★ 데이터를 옮기지 않는다. 잘못된 것은 users/{코드} 아래의 내용이 아니라
       "이 계정의 주인은 누구인가" 한 줄(authUsers/{authUid}.userCode)이다. */
  say('');
  say('· §7 되찾기 — 결속만 고치고 데이터는 제자리에 둔다');
  if (!FB){ say('  (firebase-init.js 를 못 찾음 — 건너뜀)'); }
  else {
    /* 개정 52 (회원가입 설계 §6-⑧): 결속 고쳐 매기 통로 authRebindUserCode 를 걷었다 — 부르는 곳이 없었고(되찾기 UI 개정 45 걷음),
       남겨 두면 «유저 코드 문자열 → 결속 교체» 통로가 앱 밖에서라도 불릴 수 있다. 계정 이전 통로 둘(setTransferHash · verifyTransfer)도 같이. */
    chk(FB.indexOf('async authRebindUserCode(') < 0, '★ firebase-init 에 authRebindUserCode 통로가 없다 (§6-⑧ 걷음)');
    chk(FB.indexOf('async setTransferHash(') < 0 && FB.indexOf('async verifyTransfer(') < 0, '  계정 이전 통로 둘(setTransferHash · verifyTransfer)도 없다');
    /* 개정 55 (설계 §9-12): 스냅샷 자리는 accountSnap/{코드}(주인만). 옛 transferData 는 옮기고 지우기만 — 아래 §9 가 돌려 본다. */
    chk(FB.indexOf('async setAccountSnapshot(') > 0 && FB.indexOf('async fetchAccountSnapshot(') > 0 && /accountSnap\/\$\{userCode\}/.test(FB), '  계정 스냅샷 통로는 남았다 — 자리는 accountSnap/{코드} (개정 55)');
    /* 되찾기 UI — 개정 45(회원가입 설계 §6-⑤ · 개정 16)에서 걷었다. 결속을 되돌릴 일(구글 로그인의 갈아타기)이
       게이트(H · K)로 닫혔고, «이 기기가 버린 uid» 로 계정을 옮기는 입구는 남겨 둘수록 통로다.
       firebase-init 통로 authRebindUserCode 는 §6-⑧ 묶음(개정 52)에서 걷었다(위 판정). */
    const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '');
    chk(!/firebaseAPI\.authRebindUserCode/.test(CODE), '되찾기가 authRebindUserCode 를 부르지 않는다 (입구 걷음)');
    ['acctRecoverBtn','acctRecoverBox','acctRecoverList','acctRecoverGo','acctRecoverMsg','acctCurCode','acctCurFriendCode']
      .forEach(id => chk(!HTML.includes('id="' + id + '"'), '#' + id + ' 은 걷었다'));
  }

  /* ── §8. 규칙 파일 — 서버가 이 흐름을 실제로 허락하는가 ────────────────
     ⚠ 규칙은 거부해도 **예외를 던지지 않는다.** 쓰기가 조용히 사라지고 화면은 성공한 것처럼
       보인다. 그래서 클라이언트 검사만으로는 아무것도 증명되지 않는다 — 여기서 같이 본다. */
  say('');
  say('· §8 규칙 파일 — 되찾기를 허락하고, 남의 계정은 막는가');
  const RULES_TXT = pick('firebase-database-rules.json', '../firebase-database-rules.json');
  if (!RULES_TXT){ say('  (firebase-database-rules.json 을 못 찾음 — 건너뜀)'); }
  else {
    let R = null;
    try { R = JSON.parse(RULES_TXT).rules; } catch (e) { chk(false, '규칙 파일이 올바른 JSON 이다'); }
    if (R){
      chk(true, '규칙 파일이 올바른 JSON 이다');
      const au = (R.authUsers && R.authUsers.$authUid) || {};
      const ua = (R.userAuth && R.userAuth.$userId) || {};
      /* 되찾기는 authUsers/{내}/userCode 를 **바꾼다.** userCode 가 불변으로 잠겨 있으면
         authRebindUserCode 의 2단계가 조용히 거부되고, 다음 로그인에 또 빈 계정으로 끌려간다. */
      chk(/root\.child\('userAuth\/'\+newData\.val\(\)\)\.val\(\) === auth\.uid/.test(String(au.userCode && au.userCode['.validate'])),
          '되찾기: 내가 선점한 코드로만 userCode 를 갈아끼울 수 있다 (순서를 서버가 강제한다)');
      /* 되찾기 3단계는 옛 코드를 **놓는다**(remove). 생성만 허용하면 그 자리가 영영 안 비고,
         그 코드는 다시는 어떤 계정에도 묶이지 못한다. */
      chk(/!newData\.exists\(\)/.test(String(ua['.write'])) && /data\.val\(\) === auth\.uid/.test(String(ua['.write'])),
          '되찾기: 내 자리인 옛 코드는 놓을 수 있다 (남의 자리는 못 건드린다)');
      chk(ua['.read'] === true,
          '로그인 안 한 기기도 userAuth 를 읽는다 (침묵 경고가 돌 수 있게)');

      /* users — 본인만 쓰는 가지에는 소유 조건이, 남이 쓰는 가지에는 없어야 한다.
         ⚠ 이 두 목록은 firebase-init.js 의 실제 쓰기 경로에서 나왔다. 새 기능이 남의 노드에
           쓰기 시작하면 여기 아래쪽 목록에 넣을 것 — 안 넣으면 그 기능이 조용히 죽는다. */
      const U = (R.users && R.users.$userId) || {};
      const OWN = /root\.child\('userAuth\/'\+\$userId\)\.val\(\) === auth\.uid/;
      /* ★ 개정 45 — transferHash 는 옛 이전 비밀번호(공개 읽기 · 소금 없는 해시)라 **지우기만** 받는다(아래 따로 본다). */
      chk(/^!newData\.exists\(\) && /.test(String(U.transferHash && U.transferHash['.write'])) && OWN.test(String(U.transferHash['.write'])),
          'users/transferHash 는 주인이 지우기만 한다 (새로 쓰지 못한다 · 개정 45)');
      /* ★ 개정 55 — transferData 도 transferHash 처럼 **지우기만**(공개 자리 · 라이선스 키가 보였다 · 설계 §9-12).
         스냅샷의 새 자리 accountSnap 은 users 밖(최상위)이라 읽기도 주인만이고, **미결속 코드는 못 쓴다.** */
      chk(/^!newData\.exists\(\) && /.test(String(U.transferData && U.transferData['.write'])) && OWN.test(String(U.transferData['.write'])) && U.transferData['.validate'] === 'false',
          'users/transferData 는 주인이 지우기만 한다 (새로 쓰지 못한다 · 개정 55)');
      {
        const AS = (R.accountSnap && R.accountSnap.$userId) || {};
        const OWN_ONLY = "auth != null && root.child('userAuth/'+$userId).val() === auth.uid";
        chk(R.accountSnap && R.accountSnap['.read'] === undefined && R.accountSnap['.write'] === undefined, 'accountSnap 모음 자체는 아무도 못 읽는다 (목록 없음)');
        chk(AS['.read'] === OWN_ONLY && AS['.write'] === OWN_ONLY, 'accountSnap/{코드} 는 결속된 주인만 읽고 쓴다 (미결속 갈래 없음)');
        chk(AS.license && /length <= 40/.test(AS.license['.validate']) && AS.friendCode && /length <= 12/.test(AS.friendCode['.validate'])
            && AS.name && /length <= 40/.test(AS.name['.validate']) && AS.focusTotalSec && /359640000/.test(AS.focusTotalSec['.validate'])
            && AS.$other && AS.$other['.validate'] === false && /hasChildren\(\['ts'\]\)/.test(AS['.validate']),
            '  accountSnap 모양: license ≤40 · name ≤40 · friendCode ≤12 · focusTotalSec 상한 · ts 필수 · 그 밖 거절');
        chk(!(R.users && R.users.$userId && R.users.$userId.accountSnap), '  users/{코드} 아래에 accountSnap 을 두지 않았다 (거기는 공개 읽기)');
      }
      ['profile','home','presence','friendCode','playlist','gacha',
       'chal','emojis','schedule','ddays','focus','secretRoom','advBg','mallang']
        .forEach(k => chk(!!U[k] && OWN.test(String(U[k]['.write'])), 'users/' + k + ' 은 주인만 쓴다'));
      /* 이쪽은 **열려 있어야 한다.** 잠그면 친구 수락·방명록·박수·선물이 조용히 전부 죽는다
         (전부 남의 users 노드에 쓰는 기능이다 — acceptFriendRequest, writeGuestbook,
          clapOnce, sendMallangGift, 일정 알림). */
      ['friends','guestbook','clap','mallangGifts','schedNotices','invite']
        .forEach(k => {
          const w = U[k] && (U[k]['.write'] !== undefined ? U[k]['.write'] : (U[k].$friendId||{})['.write']);
          chk(w === true, 'users/' + k + ' 은 남도 쓸 수 있다 (' + k + ' 기능이 죽지 않게)');
        });
      /* 잠근 가지는 **로그인 안 한 기기에서도** 돌아야 한다 — 아직 아무 계정에도 안 묶인 코드는
         첫 절에서 통과한다. 이 절이 빠지면 로그인 안 한 기존 유저 전원이 자기 마이홈에 못 쓴다. */
      chk(OWN.test(String(U.profile['.write'])) && /!root\.child\('userAuth\/'\+\$userId\)\.exists\(\)/.test(String(U.profile['.write'])),
          '아직 안 묶인 코드는 로그인 없이도 쓴다 (기존 유저가 잠기지 않는다)');
      chk(/function warnUnbound|const warnUnbound/.test(SRC) && /authOwnerOf/.test(SRC),
          '묶였는데 로그인 안 한 기기에게 그렇다고 알려준다 (거부가 침묵으로 끝나지 않게)');
    }
  }

  /* ── §9. 계정 스냅샷 자리 — accountSnap 으로 옮기기 (설계 §9-12 · 개정 55) ──────────────────
     firebase-init 의 두 함수와 _acctSnapClean 을 **떼어 와 돌린다**(가짜 get · update).
     지키는 것: 새 자리에서 읽는다 · 옛 자리만 있으면 옮기고 지운다(값은 이번에 돌려준다) · 새 자리를 못 읽으면 옛 자리로 ·
               쓸 때는 새 자리 + 옛 자리 지우기를 **한 번의** update 로 · 범위 밖 항목은 그 항목만 뺀다 · 돌려주는 모양은 그대로. */
  say('');
  say('· §9 계정 스냅샷 — accountSnap/{코드}(주인만) · 옛 transferData 는 옮기고 지운다');
  if (!FB){ say('  (firebase-init.js 를 못 찾음 — 건너뜀)'); }
  else {
    const grabM = (src, head) => { const i = src.indexOf(head); if (i < 0) return null; let k = src.indexOf('{', i), d = 0;
      for (; k < src.length; k++){ if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return null; };
    const fSet = grabM(FB, 'async setAccountSnapshot('), fGet = grabM(FB, 'async fetchAccountSnapshot('), fClean = grabM(FB, 'function _acctSnapClean(');
    if (!fSet || !fGet || !fClean){ chk(false, '두 함수와 _acctSnapClean 을 찾았다 — 이름이 바뀌었으면 이 절도 같이 고칠 것'); }
    else {
      const mk = (data, opts) => {
        opts = opts || {};
        const log = [];
        const at = p => p.split('/').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), data);
        const put = (p, v) => { const ks = p.split('/').filter(Boolean); let o = data; for (let i = 0; i < ks.length - 1; i++){ o[ks[i]] = o[ks[i]] || {}; o = o[ks[i]]; }
          if (v === null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v)); };
        const c = { db: {}, Date: { now: () => 5000 }, Number, JSON, String,
          ref: (db, p) => ({ p: p || '' }),
          get: async r => { log.push('get:' + r.p); if (opts.denyNew && /^accountSnap\//.test(r.p)) throw new Error('PERMISSION_DENIED'); const v = at(r.p); return { val: () => (v === undefined ? null : v) }; },
          update: async (r, patch) => { log.push('update:' + (r.p || '/') + ':' + Object.keys(patch).sort().join(',')); if (opts.denyUpdate) throw new Error('PERMISSION_DENIED'); for (const k in patch) put((r.p ? r.p + '/' : '') + k, patch[k]); } };
        vm.createContext(c);
        vm.runInContext(fClean + '\nconst api = {' + fSet + ',' + fGet + '};\nthis.api = api;', c);
        return { api: c.api, data, log };
      };
      /* ① 새 자리에서 읽는다 — 옛 자리는 보지 않는다 */
      let t = mk({ accountSnap: { U1: { license: 'NEW-KEY', name: '새', friendCode: 'MATE-AAAA', focusTotalSec: 10, ts: 9 } }, users: { U1: { transferData: { license: 'OLD' } } } });
      let r = await t.api.fetchAccountSnapshot('U1');
      chk(r.license === 'NEW-KEY' && r.name === '새' && r.friendCode === 'MATE-AAAA' && r.focusTotalSec === 10 && r.ok === true, '★ 새 자리(accountSnap)에서 읽는다');
      chk(!t.log.some(l => /transferData/.test(l)), '  새 자리가 있으면 옛 자리는 읽지도 않는다');
      chk(JSON.stringify(Object.keys(r).sort()) === JSON.stringify(['focusTotalSec','friendCode','license','name','ok']), '  돌려주는 모양은 그대로 (_applyTransferSnapshot 무변경)');
      /* ② 옛 자리만 → 옮기고 지운다 · 값은 이번에 돌려준다 */
      t = mk({ users: { U2: { transferData: { license: 'OLD-KEY', name: '옛', friendCode: 'MATE-BBBB', focusTotalSec: 7, ts: 3 } } } });
      r = await t.api.fetchAccountSnapshot('U2');
      chk(r.license === 'OLD-KEY' && r.name === '옛', '★ 옛 자리만 있으면 그 값으로 복원한다');
      chk(t.data.accountSnap && t.data.accountSnap.U2 && t.data.accountSnap.U2.license === 'OLD-KEY' && t.data.accountSnap.U2.ts === 3, '★ 옛 값을 새 자리로 옮긴다 (ts 유지)');
      chk(!t.data.users.U2.transferData, '★ 옛 자리는 지운다 — 공개 자리에 라이선스를 남기지 않는다');
      chk(t.log.filter(l => /^update:/.test(l)).length === 1 && t.log.some(l => l === 'update:/:accountSnap/U2,users/U2/transferData'), '  옮기기와 지우기는 **한 번의** update (원자적)');
      /* ③ 새 자리 읽기가 거절되면 옛 자리로 · 옮기기가 거절돼도 값은 돌려준다 */
      t = mk({ users: { U3: { transferData: { license: 'K3' } } } }, { denyNew: true, denyUpdate: true });
      r = await t.api.fetchAccountSnapshot('U3');
      chk(r.license === 'K3', '새 자리를 못 읽어도(결속 어긋남 등) 옛 자리로 복원한다 · 옮기기가 거절돼도 값은 돌려준다');
      /* ④ 둘 다 없음 → 폴백 */
      t = mk({ users: { U4: { profile: { name: '프로필' }, friendCode: 'MATE-CCCC' } } });
      r = await t.api.fetchAccountSnapshot('U4');
      chk(r.license === null && r.name === '프로필' && r.friendCode === 'MATE-CCCC' && !t.log.some(l => /^update:/.test(l)), '둘 다 없으면 profile · friendCode 폴백 · 쓰기 없음');
      const n4 = t.log.length;
      r = await t.api.fetchAccountSnapshot('');
      chk(r.ok === true && r.license === null && t.log.length === n4, '  빈 코드면 아무것도 읽지 않는다');
      /* ⑤ 쓰기 — 새 자리 + 옛 자리 지우기 한 번 · 범위 밖 항목만 뺀다 */
      t = mk({ users: { U5: { transferData: { license: 'OLD' } } } });
      let w = await t.api.setAccountSnapshot('U5', { license: 'L5', name: 'n'.repeat(50), friendCode: 'TOO-LONG-CODE-X', focusTotalSec: 400000000 });
      const s5 = t.data.accountSnap && t.data.accountSnap.U5;
      chk(w.ok === true && s5 && s5.license === 'L5' && s5.ts === 5000, '★ setAccountSnapshot 은 accountSnap/{코드} 에 쓴다 (ts 붙음)');
      chk(!t.data.users.U5.transferData && t.log.length === 1 && t.log[0] === 'update:/:accountSnap/U5,users/U5/transferData', '★ 같은 update 로 옛 transferData 를 지운다');
      chk(s5.name.length === 40 && s5.friendCode === null && s5.focusTotalSec === null, '  범위 밖 항목은 그 항목만 뺀다 (이름은 40자로 · 통째 거절 없음)');
      t = mk({}, { denyUpdate: true });
      w = await t.api.setAccountSnapshot('U6', { license: 'x' });
      chk(w.ok === false, '  거절되면 ok:false — 던지지 않는다');
      chk((await t.api.setAccountSnapshot('', { license: 'x' })).ok === false && (await t.api.setAccountSnapshot('U7', null)).ok === false, '  코드나 값이 없으면 쓰지 않는다');
      /* ⑥ 함수(functions/index.js moveAccountSnap)와 규칙이 같다 — 떼어 비교(파일이 스테이징에 없으면 건너뜀) */
      let IDX = null; for (const p of ['functions/index.js', '../functions/index.js', 'index.js']) { try { const t2 = fs.readFileSync(p, 'utf8'); if (/moveAccountSnap/.test(t2)) { IDX = t2; break; } } catch (_) {} }
      if (IDX){
        const norm = x => String(x || '').replace(/\/\/.*$/mg, '').replace(/\s+/g, ' ').replace(/^.*?const str/, 'const str').replace(/\}\s*$/, '');
        chk(norm(grabM(IDX, 'function snapClean(')) === norm(fClean), '  함수 snapClean = 앱 _acctSnapClean (같은 규칙)');
      } else say('  (functions/index.js 없음 — 함수 쪽 비교는 세션에서 떼어 돌린다)');
      /* ⑦ 부르는 쪽 — app.js 는 여전히 두 함수만 부르고, transferData 를 직접 만지지 않는다 */
      const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/mg, '');
      chk(!/transferData|accountSnap/.test(CODE), '  app.js 코드는 스냅샷 자리를 직접 만지지 않는다 (통로 두 함수뿐)');
    }
  }

  say('');
  if (fail) { say('문제 ' + fail + '건'); process.exit(1); }
  say('전부 통과 ✅ — 구글 로그인이 유저 코드를 잃지 않고 갈아탄다');
  say('⚠ 눈으로 볼 것: 두 대에서 같은 구글 계정으로 로그인해 친구·마이홈·플레이리스트가 따라오는지');
  say('⚠ main.js 의 OAuth 상수 두 개를 채우기 전에는 실제 로그인이 되지 않는다');
  /* app.js 가 걸어둔 타이머가 살아 있어 그냥 두면 프로세스가 안 끝난다 — 명시적으로 닫는다. */
  process.exit(0);
})();

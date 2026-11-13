/* ═══ 🪪 sim-signup.js — 회원가입 게이트 (design-signup-2026-09-20.md §3 · §6 · §8) ═══════════════
   CHECKS 개정 38 신설. 게이트를 조각마다 넣으면서 절을 늘린다 — 지금은 첫 조각(설계 개정 8)만.

   0.13 — 가입 · 로그인은 서버(GET /v1/me · POST /v1/users)로 옮겼다. 옛 3~7 · 9 · 10 · 14절(초대 토큰 · 익명 → 묶기 다섯 단계 · 기존 사용자 가입 I ·
   로그인 필요 K · 비밀번호 붙이기 함수 · 갈아타기 전 정리)은 대상이 없어 걷었다 — 새 흐름은 sim-login-flow.js · sim-user-api.js · sim-first-run-013.js.
   1절 정적      getMyUserId 는 읽기만 · 앱에 uid 를 만드는 곳이 없다 · 옛 가입 통로 없음 · firebase-init 안전망 배선
   2절 안전망    firebase-init `_noUidPath` · ref/sref/update 가 빈 uid 경로를 서버에 안 보낸다
   8절 ⑥         친구 코드 거울 정정 — 로컬만 · friendCodes 쓰기 0 · 거울 코드가 지금 내 것일 때만 · 발급 없음 · 세션당 한 번
  11절 내 정보   런처 안 페이지(개정 48) · 작은 머리 · 보관함 표제 · 톱니 G · 계정 C4 · 걷은 것 · transferHash 지우기만
                 (보관함 목록 · 슬롯에 올리기 · 휴지통 · 가득 참의 동작은 서버 원본 옷장으로 옮기며 sim-my-info-box.js 가 실제로 돌려 본다)
  15절 별 색     (개정 69) [내 정보] 레벨 배지 = 버튼 · 누르면 머리 아래 «별 색» 구획 · 999 전 잠김(남은 시간) · 회차면 미리보기 + 16칸 · 열 때마다 닫힘 · 재료 함수(별 문자열 · 회차 파생 · 팔레트만 받음)
  16절 랭킹      [내 정보] 순위 칸 · 왕관 · 후광 · 순위 올리기 · 읽기 · leaderboard 규칙을 걷었다(남으면 빨강 · 깨 보기) ·
                 옛 포커스 누적 동기화는 걷었다

   실행: node sim-signup.js   (app.js · firebase-init.js · desk-companion-prototype.html 과 같은 폴더에서 — run.js 가 맞춰 준다)
*/
'use strict';
globalThis.TwSafeHtml = require([__dirname, process.cwd()].flatMap(d => ['safe-html.js', 'parts/shared/safe-html.js', 'app/parts/shared/safe-html.js'].map(p => require('path').join(d, p))).find(p => require('fs').existsSync(p)));   // 🛡️ 모듈이 부르는 공용 씻기 — 진짜 파일
const { stripReadGate } = require('./sim-rules-src.js');   // 옛 앱 읽기 막기 조건을 걷고 본다(개정 375)
const fs = require('fs');

let pass = 0, fail = 0;
const say = s => console.log(s);
const chk = (c, m) => { if (c) { pass++; say('  ✓ ' + m); } else { fail++; say('  ✗ ' + m); } };

const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const APP = _joinRenderer(fs.readFileSync('app.js', 'utf8'));
const FI  = fs.readFileSync('firebase-init.js', 'utf8');
const FPROG = ['focus-progress.js', 'parts/focus/focus-progress.js', 'app/parts/focus/focus-progress.js'].map(f => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } }).find(Boolean) || '';   // 별 색 팔레트 · 색 고르기(서버 진척)

/* 함수 본문 떼어 오기 — `function 이름(` 부터 짝 맞는 `}` 까지. 문자열·주석 안의 괄호는 이 파일들에선 짝이 맞는다. */
function takeFn(src, head){
  const i = src.indexOf(head);
  if (i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for (; j < src.length; j++){
    const c = src[j];
    if (c === '{') d++;
    else if (c === '}'){ d--; if (d === 0) return src.slice(i, j + 1); }
  }
  return null;
}
const count = (s, re) => (s.match(re) || []).length;

/* ══ 1. 정적 ══ */
say('【1】 정적 — 앱은 uid 를 만들지 않는다(0.13 — 서버가 가입 때) · 안전망 배선');
const gm = takeFn(APP, 'function getMyUserId(');
chk(!!gm, 'getMyUserId 가 있다');
chk(gm && !/setItem/.test(gm), 'getMyUserId 본문에 setItem 이 없다(읽기만)');
chk(gm && !/Date\.now|Math\.random/.test(gm), 'getMyUserId 가 uid 를 만들지 않는다');
chk(!/function _inventMyUserId\(/.test(APP) && count(APP, /'u'\s*\+\s*Date\.now\(\)\.toString\(36\)/g) === 0, '앱에 uid 를 만드는 곳이 없다(서버가 가입 때 만든다 — account/user-api.js · login-flow.js)');
chk(!/redeemInvite|finishInviteSignup|authSignupEnsure|authSignupBind|authOwnerOf/.test(FI.replace(/\/\*[\s\S]*?\*\//g, '')), 'firebase-init 에 옛 가입 통로(초대 소진 · 익명 → 묶기 · 주인 묻기)가 없다');
chk(/ref as _dbRef/.test(FI) && /update as _dbUpdate/.test(FI) && /ref as _stRef/.test(FI), 'firebase-init: ref · update · storage ref 를 별칭으로 들여와 감싼다');
chk(/const ref\s*=\s*\(d, p\)/.test(FI) && /const sref\s*=/.test(FI) && /const update\s*=/.test(FI), 'firebase-init: ref · sref · update 가 안전망을 지난다');

/* ══ 2. 안전망 실행 ══ */
say('');
say('【2】 빈 uid 안전망 — 경로가 만들어지는 자리에서 막는다');
/* 안전망(_noUidPath · ref · sref)과 다중 경로 update 감쌈을 잘라 온다. 그 사이의 기본 동작 배선(점검 창 touch)은 빼고,
   update 감쌈이 넘기는 곳(_update)은 SDK update 를 그대로 부르는 가짜로 — 판정은 안전망 그대로. */
const g1 = FI.slice(FI.indexOf('  const _NOUID_SEG'), FI.indexOf('  const sref = (st, p) => _stRef(st, _noUidPath(p));') + '  const sref = (st, p) => _stRef(st, _noUidPath(p));'.length);
const g2 = FI.slice(FI.indexOf('  const update = (r, v) => {'), FI.indexOf('    return _update(r, v);\n  };') + '    return _update(r, v);\n  };'.length);
const guardSrc = g1 + '\n' + g2;
const _fakeUpdate = (r, v) => Promise.resolve({ r, v });
const G = (new Function('_dbRef', '_stRef', '_dbUpdate', '_update', 'console',
  guardSrc + '\nreturn { _noUidPath, ref, sref, update };'))(
  (d, p) => ({ db: d, path: p === undefined ? '/' : p }),
  (st, p) => ({ st, path: p }),
  _fakeUpdate,
  _fakeUpdate,
  { warn(){} });
const ok = p => G._noUidPath(p) === p;
chk(ok('users/u1abc/profile'), '정상 uid 경로는 그대로');
chk(ok('friendCodes/MATE-AB12') && ok('rooms/COZY-1234/members') && ok('users/u1abc/nullable'), "코드·방·'null' 로 시작하는 이름은 건드리지 않는다");
chk(!ok('users/null/profile') && G._noUidPath('users/null/profile').startsWith('_noUid/'), 'users/null/… → _noUid/ 아래로');
chk(!ok('users/undefined') && !ok('users//invite'), "users/undefined · 빈 세그먼트('//')도 잡는다");
chk(ok('https://x.firebasestorage.app/o/a.png'), 'URL 의 https:// 는 빈 세그먼트로 안 본다');
chk(G.ref('DB', 'users/null/x').path.startsWith('_noUid/') && G.ref('DB').path === '/', 'ref: 돌리고 · 루트 ref 는 그대로');
chk(G.sref('ST', 'users/null/avatar.jpg').path.startsWith('_noUid/'), 'sref(Storage): 돌린다');
(async () => {
  let rej = null;
  try { await G.update({ path:'/' }, { 'users/u1abc/friends/x': 1, 'users/null/friends/u1abc': 1 }); } catch (e) { rej = e; }
  chk(!!rej, '다중 경로 update: 한 줄이라도 빈 uid 면 통째로 거절');
  let okv = null; try { okv = await G.update({ path:'/' }, { 'users/u1abc/a': 1 }); } catch (_){}
  chk(okv && okv.v && okv.v['users/u1abc/a'] === 1, '다중 경로 update: 정상이면 그대로 보낸다');

  const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');
  say('');
  say('【8】 ⑥ 거울 정정 — 로컬만 고친다 · friendCodes 쓰기 0 · 내 것일 때만 · 발급보다 먼저');
  const EN = takeFn(APP, 'async function ensureMyFriendCode(') || '';
  const MF = takeFn(APP, 'async function _friendCodeMirrorFix(') || '';
  chk(!!MF && /_friendCodeMirrorFix\(\)/.test(EN) && !/registerFriendCode/.test(EN), '★ ensureMyFriendCode 첫머리에서 부른다 · 발급 · 등록은 없다(0.13 — 서버가 가입 때)');
  chk(count(APP, /(?<!function )_friendCodeMirrorFix\(\)/g) === 1, '부르는 곳은 하나');
  chk(MF && !/registerFriendCode|setUserFriendCode|friendCodes\//.test(MF), '★ 본문에 friendCodes · 거울 쓰기가 없다(로컬만)');
  if (MF){
    function mk6(o){
      const st = Object.assign({ 'tw.myUserId':'ume0000000001' }, o.store || {}); const log = [];
      const ls = { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { log.push('set:' + k); st[k] = String(v); }, removeItem: k => { delete st[k]; } };
      const api = {
        getUserFriendCode: async u => { log.push('mirror?'); if (o.mirrorThrow) throw new Error('net'); return o.mirror || null; },
        lookupFriendCode: async c => { log.push('owner?'); if (o.lookupThrow) throw new Error('net'); return (o.owners || {})[c] || null; },
        registerFriendCode: async (c, u) => { log.push('register:' + c); return true; },
        setUserFriendCode: async (u, c) => { log.push('setMirror:' + c); return true; },
      };
      const w = { firebaseAPI: api };
      Object.defineProperty(globalThis, 'firebaseAPI', { get: () => w.firebaseAPI, configurable: true });
      const src5 = [
        "const MY_USER_ID_KEY = 'tw.myUserId'; const MY_FRIEND_CODE_KEY = 'tw.myFriendCode';",
        "let _fcOwnerChecked = false; let _fcMirrorChecked = false;",
        "async function _healFriendCodeOwner(){ log.push('heal'); }",
        "function genFriendCodeCandidate(){ return 'MATE-NEW1'; }",
        takeFn(APP, 'function getMyUserId('), MF, EN,
        'return { fix:_friendCodeMirrorFix, ensure:ensureMyFriendCode, owned:()=>_fcOwnerChecked };',
      ].join('\n');
      const X = (new Function('localStorage', 'window', 'log', 'console', src5))(ls, w, log, { info(){}, warn(){} });
      return { X, st, log };
    }
    {
      const E = mk6({ store:{ 'tw.myFriendCode':'MATE-OLD1' }, mirror:'MATE-ACC1', owners:{ 'MATE-ACC1':'ume0000000001' } });
      const r = await E.X.fix();
      chk(r === 'fixed' && E.st['tw.myFriendCode'] === 'MATE-ACC1' && E.X.owned(), '★ 거울이 다르고 내 것 → 로컬만 고친다');
      chk(!E.log.some(x => x.startsWith('register') || x.startsWith('setMirror')), '★ 그때 friendCodes · 거울 쓰기 0');
    }
    {
      const E = mk6({ store:{ 'tw.myFriendCode':'MATE-OLD1' }, mirror:'MATE-ACC1', owners:{ 'MATE-ACC1':'usomeoneelse1' } });
      chk((await E.X.fix()) === 'not-mine' && E.st['tw.myFriendCode'] === 'MATE-OLD1', '★ 거울 코드가 지금 남의 것 → 그대로 둔다');
    }
    {
      const E = mk6({ store:{ 'tw.myFriendCode':'MATE-OLD1' } });
      chk((await E.X.fix()) === 'empty' && E.st['tw.myFriendCode'] === 'MATE-OLD1', '거울이 비었으면 아무것도 안 한다');
    }
    {
      const E = mk6({ store:{ 'tw.myFriendCode':'MATE-ACC1' }, mirror:'MATE-ACC1' });
      chk((await E.X.fix()) === 'same' && !E.log.includes('owner?'), '같으면 주인도 안 묻는다');
    }
    {
      const E = mk6({ store:{ 'tw.myFriendCode':'MATE-OLD1' }, mirror:'MATE-ACC1', lookupThrow:true });
      chk((await E.X.fix()) === 'unread' && E.st['tw.myFriendCode'] === 'MATE-OLD1', '주인을 못 읽으면 그대로');
      const F = mk6({ mirrorThrow:true });
      chk((await F.X.fix()) === 'unread', '거울을 못 읽으면 그대로');
      const G = mk6({ store:{ 'tw.myUserId':'' } }); delete G.st['tw.myUserId'];
      chk((await G.X.fix()) === 'no-uid' && !G.log.includes('mirror?'), 'uid 없으면 서버에 안 묻는다');
    }
    {
      const E = mk6({ mirror:'MATE-ACC1', owners:{ 'MATE-ACC1':'ume0000000001' } });   // 로컬 코드 없음
      const c = await E.X.ensure();
      chk(c === 'MATE-ACC1' && !E.log.some(x => x.startsWith('register')), '★ 로컬 코드가 없는 PC: 거울(내 것)을 따른다 · 새 코드를 안 뽑는다');
      const n0 = E.log.filter(x => x === 'mirror?').length;
      await E.X.ensure();
      chk(E.log.filter(x => x === 'mirror?').length === n0, '세션당 한 번만 묻는다');
    }
    {
      const E = mk6({ owners:{} });   // 로컬 없음 · 거울 없음 → 발급
      const c = await E.X.ensure();
      chk(c === null && !E.log.some(x => x.startsWith('register')), '거울도 없으면 뽑지 않는다(0.13 — 로그인 때 서버 코드를 적는다)');
    }
  }

  /* ══ 9. J · J2 가입 완료 · K 로그인 필요 (CHECKS 개정 43 · 설계 (가)) ══ */
  say('');
  say('【11】 [내 정보] — 런처 안 페이지 · 작은 머리 · 보관함(넣은 캐릭터만 · n/20 · 슬롯에 올리기) · 톱니 G · 계정(C4) · 걷은 것');
  {
    const noCm = s => String(s || '').replace(/<!--[\s\S]*?-->/g, '');
    const H = noCm(HTML), A = APP, Ac = A.replace(/\/\*[\s\S]*?\*\//g, '');
    /* 자리 — 런처 카드 안 겹 페이지(따로 창 · 겹창 아님 · 사용자 결정 개정 48) */
    const iCard = H.indexOf('<div class="lc-card">'), iPg = H.indexOf('<div id="lcMyInfo"'), iLcEnd = H.indexOf('<!-- 관리자 비밀번호 입력 모달');
    chk(iCard > 0 && iPg > iCard && (iLcEnd < 0 || iPg < iLcEnd), '★ [내 정보]는 런처 카드 안의 페이지(#lcMyInfo) — 런처 화면이 바뀐다');
    const pgStyle = (H.match(/<div id="lcMyInfo" style="([^"]*)"/) || [])[1] || '';
    chk(/display:none;/.test(pgStyle) && /position:absolute;/.test(pgStyle) && /top:22px;/.test(pgStyle), '  처음엔 숨김 · 제목줄(22px) 아래를 덮는다');
    chk(!/id="myInfoOverlay"/.test(HTML) && !/#myInfoOverlay|'myInfoOverlay'/.test(Ac) && !/window\.open\('', 'myInfo_/.test(A), '  옛 겹창 · 별개 창(개정 45 · 47)은 없다 — 팝업 목록에도 없다');
    const MI = H.slice(iPg, H.indexOf('<!-- 광고 배너', iPg) > 0 ? H.indexOf('<!-- 광고 배너', iPg) : iPg + 20000);
    ['miBack','miAvatar','miAvatarImg','miAvatarPh','miNick','miLv','miNameEdit','miNameInput','miNameSave','miCode','miCopy','miTabBox','miTabTrash','miTabAcct',
     'miPageBox','miBoxCount','miBoxList','miBoxEmpty','miCodeLoad','miPageAcct'].forEach(id => chk(MI.includes('id="' + id + '"'), '  #' + id));
    chk(/id="miAvatar" style="width:44px;height:44px;/.test(MI), '★ 머리는 작게 — 사진 44px(사용자 요청 · 면적 줄임)');
    chk(/<span id="miLv"><\/span>/.test(MI) && /const lv = \$e\('miLv'\); if\(lv\)\{[\s\S]*?plMod\.fillLv\(lv, n(, st)?\)/.test(A), '  레벨 배지는 친구 목록과 같은 _plFillLv(개정 46 · playlist.js 로 옮겨 plMod.fillLv — 앱 FSD 16번)');
    chk(/id="miAvatar" style="[^"]*border:1px solid;[^"]*var\(--win-lo-2\) var\(--win-hi\)/.test(MI) && !/id="miAvatar"[^>]*#111/.test(MI), '  사진 틀은 테마 베벨(개정 46)');
    chk(/id="miTabTrash"[^>]*display:none/.test(MI), '  휴지통 탭은 처음엔 숨김 — 보관함이 열린 PC 에서 코드가 연다(12절 · 개정 49)');
    /* 보관함 — 넣은 캐릭터만 */
    chk(/보관함 \(<span id="miBoxCount">/.test(MI) && !/마리/.test(noCm(MI)) && !/id="miSlots"|책상 \(/.test(MI), '★ 보관함 표제는 «보관함 (n/20)» — «마리» · 슬롯 격자 · «책상» 없음');
    /* 보관함 목록 · 슬롯에 올리기 · 휴지통의 동작은 sim-my-info-box.js 가 실제로 돌려 본다 */
    /* G 톱니 */
    const menu = (H.match(/<div class="lc-menu" id="lcGearMenu">([\s\S]*?)<\/div>/) || [])[1] || '';
    const order = ['lcToBox','lcEdit','lcExport','lcGearSep','lcDelete'].map(id => menu.indexOf('id="' + id + '"'));
    chk(order.every((v, k) => v >= 0 && (k === 0 || v > order[k - 1])) && /id="lcToBox">보관함 이동</.test(menu), '★ 런처 톱니(시안 G): [보관함 이동] · [캐릭터 수정] · [복제 코드 만들기] · 구분선 · [휴지통 이동]');
    chk(/getElementById\('lcToBox'\)\.onclick=\(\)=>\{ closeGearMenu\(\); doMoveCurSlotToBox\(\); \}/.test(A), '  [보관함 이동] → doMoveCurSlotToBox(되묻지 않음)');
    chk(/\['lcToBox','lcEdit','lcExport','lcGearSep','lcDelete'\]/.test(A), '  휴지통 되묻기 때 다른 줄(보관함 이동 · 구분선 포함)을 숨긴다');
    /* 걷은 것 — 마크업 · 코드 (개정 45 그대로) */
    const gone = ['progTabBtnAccount','progTabAccount','acctLoggedOut','acctGoogleBtn','acctLoginEmail','acctCurCode','acctCurFriendCode',
      'acctRecoverBtn','acctRecoverBox','acctRecoverGo','acctTransferBtn','acctTransferPanel','acctTransferPw','acctCodeBox','acctLinkBtn','acctLinkPanel','acctLinkSubmit','acctUnlinkBox','acctUnlinkYes'];
    const leftH = gone.filter(id => HTML.includes('id="' + id + '"'));
    const leftA = gone.filter(id => A.includes("getElementById('" + id + "')") || A.includes("$('" + id + "')"));
    chk(!leftH.length && !leftA.length, '★ 걷은 것(설정 › 계정 탭 · 로그인 전 얼굴 · 되찾기 · 이전/연동/해제)이 없다' + (leftH.concat(leftA).length ? ' — ' + leftH.concat(leftA).join(' ') : ''));
    chk(!/initAccountTransfer|firebaseAPI\.setTransferHash|firebaseAPI\.verifyTransfer|firebaseAPI\.authRebindUserCode|recCandidates/.test(Ac), '  이전 · 연동 · 되찾기 호출이 없다');
    /* _sha256Hex 는 관리자 모드와 함께 admin/admin-mode.js 로 옮겼다(관리자 코드 admin 폴더 7번) — app.js + 그 파일에서 한 벌 */
    const _AM = ['admin-mode.js', 'parts/admin/admin-mode.js', 'app/parts/admin/admin-mode.js'].map(f => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return ''; } }).find(Boolean) || '';
    const _AH = A + '\n' + _AM;
    chk(count(_AH, /async function _sha256Hex\(/g) === 1 && /async function _sha256Hex\(s\)\{[\s\S]{0,600}catch\(e\)\{ return null; \}/.test(_AH), '  _sha256Hex 는 한 벌 · 실패하면 null');
    const tabs = takeFn(A, 'function setProgSettingsTab(') || '';
    chk(!!tabs && !/account/.test(tabs.replace(/\/\/.*$/mg, '')) && !/설정 → 계정|설정 › 계정/.test(Ac), '  설정 탭에 계정 없음 · 없어진 [설정 › 계정]을 가리키는 안내 없음');
    const _iLU = A.indexOf('(function initAccountLoginUI(');   // 덩이 끝은 그 즉시 실행 함수의 닫는 줄(«다시 켜기» 도우미는 계정 핵심 상태로 옮겼다 — 모듈 순환 끊기 5)
    const gateUI = _iLU < 0 ? '' : A.slice(_iLU, A.indexOf('\n})();', _iLU));
    const _sg = A.indexOf('function _showInviteGate(');
    const gateFn = _sg < 0 ? '' : A.slice(_sg, A.indexOf('\n/* 런처의 🎟️ 초대장 버튼', _sg));
    chk(!/inviteGateGoogleBtn/.test(gateUI) && /getElementById\('inviteGateGoogleBtn'\)/.test(gateFn) && /_loginDoGoogle\(\)/.test(gateFn), '  게이트 H 의 구글 버튼은 게이트(_showInviteGate) 안에서 처리한다(0.13 — 내 정보 화면에서 옮김)');
    /* 계정 C4 순서 */
    const iPA = MI.indexOf('id="miPageAcct"'), iAM = MI.indexOf('<div id="acctMethods"'), iLO = MI.indexOf('<button id="acctLogoutBtn"'), iLD = MI.indexOf('id="acctLogoutDone"');
    chk(iPA > 0 && iAM > iPA && iLO > iAM && iLD > iLO && !/id="acctSyncBox"/.test(MI), '★ 계정 탭 순서: 로그인 수단·비밀번호 → 로그아웃 (기기 연동 구획은 걷었다 — 캐릭터는 서버가 원본이라 맞출 것이 없다)');
    /* 런처 · 닉네임 · 코드 불러오기 */
    chk(/<button class="lc-btn ghost" id="lcLoad">내 정보<\/button>/.test(HTML) && /getElementById\('lcLoad'\)\.onclick=\(\)=>openMyInfo\('box'\)/.test(A) && !/getElementById\('lcLoad'\)\.disabled/.test(A), '  런처 [내 정보] → openMyInfo · 늘 눌린다');
    const nameSave = takeFn(A, 'function _miNameSave(') || '', codeLoad = takeFn(A, 'function _miCodeLoad(') || '';
    chk(/commitUserName\(inp\.value\)/.test(nameSave) && !/setUserName/.test(nameSave), '  닉네임 저장은 commitUserName 하나');
    chk(/'캐릭터가 모두 찼습니다'/.test(codeLoad) && /openCodeModal\(\)/.test(codeLoad), '  [코드로 캐릭터 불러오기] → openCodeModal(슬롯 꽉 차면 옛 토스트)');
    /* 규칙 — 옛 이전 비밀번호 */
    const RJ = JSON.parse(stripReadGate(fs.readFileSync('firebase-database-rules.json', 'utf8'))).rules.users.$userId;
    chk(/^!newData\.exists\(\) && \(/.test(RJ.transferHash['.write']) && RJ.transferHash['.validate'] === 'false', '★ users/{uid}/transferHash — 지우기만(결정 12)');
    /* 개정 55 (설계 §9-12): 계정 스냅샷은 accountSnap/{코드}(주인만)로 옮겼다 — transferData 도 transferHash 처럼 지우기만. */
    chk(/^!newData\.exists\(\) && \(/.test(RJ.transferData['.write']) && RJ.transferData['.validate'] === 'false', '  users/{uid}/transferData — 지우기만(개정 55 · 스냅샷은 accountSnap 으로)');
  }

  /* ══ 14. 🧬 «다름» · F 캐릭터를 계정에 연동했어요 (설계 §3 · §7-F · 시안 F-1 · F-2 확정 · CHECKS 개정 57) ══ */
  say('');
  say('【15】 별 색 — 배지 = 버튼 · 머리 아래 · 자리비움 위 구획 · 999 전 잠김 · 회차면 미리보기 + 16칸 · 열 때마다 닫힘 · 재료 함수');
  {
    const noCm = x => String(x || '').replace(/<!--[\s\S]*?-->/g, '');
    const H = noCm(HTML), A = APP;
    const iPg = H.indexOf('<div id="lcMyInfo"');
    const MI = H.slice(iPg, H.indexOf('<!-- 광고 배너', iPg) > 0 ? H.indexOf('<!-- 광고 배너', iPg) : iPg + 20000);
    /* 마크업 */
    chk(/<button id="miLvBtn"[^>]*type="button"[^>]*aria-expanded="false"[^>]*aria-controls="miStar"[^>]*><span id="miLv"><\/span><span class="mi-lv-car"/.test(MI),
      '★ 레벨 배지(#miLv)를 버튼(#miLvBtn)이 감싼다 — aria-expanded · aria-controls · ▾ 표시');
    chk((H.match(/id="miLvBtn"/g) || []).length === 1 && !/class="mh-flv[^"]*"[^>]*onclick/.test(H), '  버튼은 [내 정보] 한 자리뿐 — 다른 배지는 누르는 물건이 아니다');
    const iName = MI.indexOf('id="miNameRow"'), iStar = MI.indexOf('<div id="miStar"'), iAway = MI.indexOf('id="miAway"');
    chk(iName > 0 && iStar > iName && iAway > iStar, '★ 구획 자리 — 머리 아래 · 자리비움 그림 위');
    chk(/<div id="miStar" class="mi-star" style="display:none;">/.test(MI), '  처음엔 닫혀 있다');
    ['miStarSub','miStarOn','miStarPal','miStarNpStar','miStarNpText','miStarFill','miStarLock','miStarLeft','miStarMeter'].forEach(id => chk(MI.includes('id="' + id + '"'), '  #' + id));
    const on = MI.slice(MI.indexOf('<div id="miStarOn"'), MI.indexOf('<div id="miStarLock"'));
    chk(/<span class="seat-nameplate"><span class="np-star" id="miStarNpStar">/.test(on) && /<div class="seat-exp lv-star lvx lvglow"><div class="exp-fill" id="miStarFill">/.test(on),
      '★ 미리보기는 진짜 좌석 클래스(.seat-nameplate .np-star · seat-exp lv-star lvx lvglow)를 쓴다 — 색을 따로 안 만든다');
    chk(/999시간을 채우면 별이 붙고, 여기서 색을 고를 수 있어요/.test(MI), '  잠김 글자');
    /* CSS */
    const css = (HTML.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
    const stageR = (css.match(/\.mi-star-stage \.seat-nameplate\{([^}]*)\}/) || [])[1] || '', expR = (css.match(/\.mi-star-stage \.seat-exp\{([^}]*)\}/) || [])[1] || '';
    chk(/position:static/.test(stageR) && /transform:none/.test(stageR) && /display:inline-block/.test(stageR) && /pointer-events:none/.test(stageR) && /position:static/.test(expR) && /display:block/.test(expR),
      '  미리보기는 좌석 CSS 의 자리만 푼다(absolute · translate · display:none · 우클릭)');
    chk(/\.mi-star-stage\{[^}]*--nameplate-size:15px/.test(css) && /\.mi-star-stage\{[^}]*--exp-bar-h:6px/.test(css), '★ 좌석 레이어(#seatLabelsLayer) 밖이라 두 변수를 여기서 준다 — 없으면 이름표 크기가 풀리고 바 높이가 0(채움이 안 보임)');
    const miCss = css.slice(css.indexOf('.mi-lv-btn{'), css.indexOf('.mi-star-meter i{'));
    chk(!/--pre-c\s*:/.test(miCss) && !/lv-bar|lv-badge/.test(miCss), '★ 이 CSS 는 별·바 색을 안 적는다 — --pre-c 는 JS 가 #miStar 한 곳에');
    /* app.js 정적 */
    const Ac = A.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    chk(/on\('miLvBtn', \(\) => _miStarToggle\(\)\);/.test(A), '  배선 — #miLvBtn → _miStarToggle');
    const om = takeFn(A, 'function openMyInfo(') || '', cm = takeFn(A, 'function closeMyInfo(') || '', hd = takeFn(A, 'function _miRenderHead(') || '';
    chk(/_miStarOpen = false;[\s\S]*_miRenderHead\(\)/.test(om) && /_miStarOpen = false;/.test(cm), '★ [내 정보]를 열 때마다 닫힌 채 시작(닫을 때도 접는다)');
    chk(/_miRenderStar\(\);/.test(hd), '  머리를 다시 그리면 구획도(닉네임이 미리보기에 들어간다)');
    /* 개정 70: 좌석·배지 쪽 칠하기(_starPaint)가 생겼다 — 칠하는 함수는 이 둘뿐이어야 한다. */
    chk((Ac.match(/setProperty\('--pre-c'/g) || []).length === 2 && /sec\.style\.setProperty\('--pre-c', col\)/.test(takeFn(A, 'function _miRenderStar(') || '') && /el\.style\.setProperty\('--pre-c', star\.color\)/.test(takeFn(A, 'function _starPaint(') || ''),
      '★ --pre-c 를 칠하는 곳은 둘 — 미리보기(#miStar 한 곳) · 좌석·배지(_starPaint 한 함수)');
    const keys = (A.match(/const ACCOUNT_LOCAL_KEYS = \(\)=>\[([\s\S]*?)\n\];/) || [])[1] || '';   // 개정 71: 목록 본문을 정확히 떼어 온다(옛 판은 엉뚱한 {…} 를 잡았다)
    chk(!/'tw\.starColor'/.test(keys), '  색은 서버 값(진척 starColor)이라 이 PC 에 두지 않는다 — 로그아웃 목록에도 없다(첫 실행이 옛 키를 지운다 · D5-2)');
    chk(/b\.onclick = \(\) => \{ if\(!setStarColor\(hex\)\) return; _miRenderHead\(\); \};/.test(A), '★ 색을 고르면 머리 배지 · 구획이 바로(서버 저장 실패면 이전 색으로 돌아온다) — 방 좌석은 좌석 루프가(개정 70)');
    /* 재료 — 떼어 와 돌린다 */
    const palSrc = FPROG.slice(FPROG.indexOf('const STAR_PALETTE = Object.freeze(['), FPROG.indexOf(']);', FPROG.indexOf('const STAR_PALETTE = Object.freeze([')) + 3);
    const fns = ['function focusCycleOf(', 'function lvStarStr(',
                 'function _miStarToggle(', 'function _miRenderStar('].map(h => takeFn(A, h));
    chk(palSrc.length > 30 && fns.every(Boolean), '  재료 · 그리기 함수를 떼어 왔다');
    if (palSrc.length > 30 && fns.every(Boolean)){
      const mkEl = (id) => { const el = { id, style: { _p: {}, setProperty(k, v){ this._p[k] = v; }, display: '' }, attrs: {}, dataset: {}, children: [], textContent: '',
        setAttribute(k, v){ this.attrs[k] = String(v); }, appendChild(c){ this.children.push(c); return c; } }; return el; };
      const mk = (total, color) => {
        const els = {}; ['miStar','miLvBtn','miStarOn','miStarLock','miStarSub','miStarNpStar','miStarNpText','miStarFill','miStarPal','miStarLeft','miStarMeter'].forEach(id => els[id] = mkEl(id));
        const LS = { st: {} };   // 색은 서버 진척 값(env.color) — 이 PC 칸에 안 쓴다
        const doc = { getElementById: id => els[id] || null, createElement: () => mkEl(null) };
        const f = new Function('document', 'localStorage', 'env', `
          const FOCUS_LEVEL_CAP_HOURS = 999, FOCUS_CYCLE_SEC = 999*3600, EXP_SEC_PER_LEVEL = 3600, EXP_SEC_PER_CELL = 300, EXP_CELLS = 12;
          const _focusTotalSec = () => env.total;
          const progress = { load: 'ready', cycle: Math.floor(env.total / FOCUS_CYCLE_SEC), cycleLevel: 1 + Math.floor((env.total % FOCUS_CYCLE_SEC) / 3600) };   // 옮기기 전 글로 되살린 모양 — 읽는 함수 deps(progress)는 값으로 선다(sim-renderer-src)
          const STAR_PALETTE = ${palSrc.replace(/^const STAR_PALETTE = /, '').replace(/;\s*$/, '')};
          function getFocusLevel(){ return Math.min(FOCUS_LEVEL_CAP_HOURS, 1 + Math.floor(env.total / 3600)); }
          const _starColorOk = (c) => STAR_PALETTE.some(p => p[0] === c);
          const getStarColor = () => (_starColorOk(env.color) ? env.color : STAR_PALETTE[0][0]);
          const setStarColor = (c) => { if(!_starColorOk(c)) return false; env.color = c; return true; };
          ${fns.join('\n')}
          function getDisplayName(){ return '키위'; }
          let _miStarOpen = false;
          function _miRenderHead(){ _miRenderStar(); }
          return { STAR_PALETTE, getStarColor, setStarColor, focusCycleOf, lvStarStr, toggle: _miStarToggle, render: _miRenderStar, isOpen: () => _miStarOpen };`);
        const env = { total, color }; return Object.assign(f(doc, LS, env), { els, LS, env });
      };
      let v = mk(0);
      /* 팔레트 — 16 · 겹침 없음 · 밝은 톤만 */
      const lum = hex => { const c = [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
      const P = v.STAR_PALETTE.map(p => p[0]);
      chk(P.length === 16 && new Set(P).size === 16 && P.every(h => /^#[0-9a-f]{6}$/.test(h)), '★ 팔레트 16색 · 겹침 없음 · #rrggbb');
      chk(P.every(h => lum(h) >= 0.35), `★ 밝은 톤만 — 상대 휘도 0.35 이상(가장 어두운 ${Math.min(...P.map(lum)).toFixed(2)}) · 어두운 색은 별 외곽선·6px 홈에서 먹힌다`);
      /* 별 문자열 */
      const want = { 0:'', 1:'☆', 2:'★', 3:'☆★', 4:'★★', 5:'☆★★', 12:'★★★★★★', 13:'★×13', 20:'★×20' };
      chk(Object.keys(want).every(n => v.lvStarStr(+n) === want[n]), '★ 별 문자열 — ☆=1 · ★=2 · 홀수면 맨 앞 ☆ 하나 · 13회차부터 «★×n» 으로 접는다');
      chk(v.lvStarStr(-3) === '' && v.lvStarStr('x') === '', '  0 이하 · 이상한 값은 빈 문자열');
      /* 회차 파생 */
      const C = 999 * 3600;
      const a = v.focusCycleOf(0), b = v.focusCycleOf(C - 1), c2 = v.focusCycleOf(C), d = v.focusCycleOf(2 * C + 341 * 3600 + 1800);
      chk(a.cycle === 0 && a.lv === 1 && a.leftSec === C && b.cycle === 0 && b.lv === 999 && b.leftSec === 1 && c2.cycle === 1 && c2.lv === 1 && d.cycle === 2 && d.lv === 342,
        '★ 회차는 누적초에서 파생 — 999시간이 한 바퀴 · 바퀴 안 레벨 1~999');
      /* 색 저장 — 팔레트만 받는다 */
      chk(v.getStarColor() === P[0] && !v.setStarColor('#000000') && !v.setStarColor('red') && v.env.color == null, '★ 팔레트 밖 색은 거절 · 기본은 첫 색(금)');
      chk(v.setStarColor(P[5]) && v.env.color === P[5] && v.getStarColor() === P[5], '  팔레트 색은 받는다');
      v = mk(0, '#123456');
      chk(v.getStarColor() === P[0], '  저장값이 팔레트 밖이면(손으로 고침 · 옛 판) 첫 색으로 떨어진다');
      /* 그리기 — 999 전 */
      v = mk(341 * 3600 + 1200);
      v.render();
      chk(v.els.miStar.style.display === 'none' && v.els.miLvBtn.attrs['aria-expanded'] === 'false', '  닫혀 있으면 구획 숨김 · aria-expanded=false');
      v.toggle();
      chk(v.isOpen() && v.els.miStar.style.display === 'block' && v.els.miLvBtn.attrs['aria-expanded'] === 'true', '★ 배지를 누르면 열린다');
      chk(v.els.miStarLock.style.display === 'flex' && v.els.miStarOn.style.display === 'none' && v.els.miStarSub.textContent === 'Lv.342 / 999' && v.els.miStarLeft.textContent === '658시간 남았어요' && v.els.miStarMeter.style.width === '34%',
        '★ 999 전 — 잠김 · «Lv.342 / 999» · 남은 시간(올림) · 막대');
      chk(!v.els.miStarPal.children.length && !('--pre-c' in v.els.miStar.style._p), '  999 전에는 색 칸을 안 만들고 --pre-c 도 안 얹는다');
      v.toggle();
      chk(!v.isOpen() && v.els.miStar.style.display === 'none' && v.els.miLvBtn.attrs['aria-expanded'] === 'false', '  다시 누르면 닫힌다');
      v = mk(C - 1800); v.toggle();
      chk(v.els.miStarLeft.textContent === '1시간 남았어요', '  30분 남아도 «1시간» — 0시간이라고 안 쓴다');
      /* 그리기 — 회차 */
      v = mk(2 * C + 341 * 3600 + 1800, P[12]); v.toggle();
      chk(v.els.miStarOn.style.display === 'flex' && v.els.miStarLock.style.display === 'none' && v.els.miStarSub.textContent === '2회차 · 이름표 별과 바가 같이 바뀌어요',
        '★ 회차 — 미리보기 + 색 칸 · «2회차»');
      chk(v.els.miStarNpStar.textContent === '★' && v.els.miStarNpText.textContent === '342 키위' && v.els.miStarFill.style.width === '50%', '  이름표 «★342 키위» · 바 50%(30분 = 6칸)');
      chk(v.els.miStar.style._p['--pre-c'] === P[12], '  고른 색이 #miStar 의 --pre-c');
      const sw = v.els.miStarPal.children;
      chk(sw.length === 16 && sw.every(b => b.attrs.role === 'radio' && b.attrs['aria-label'] && b.style._p['--sw'] === b.dataset.c) && sw.filter(b => b.attrs['aria-checked'] === 'true').length === 1 && sw[12].attrs['aria-checked'] === 'true',
        '★ 16칸 · radio · 이름 · 색은 CSS 변수로만 · 고른 것 하나만 checked');
      sw[3].onclick();
      chk(v.env.color === P[3] && v.els.miStar.style._p['--pre-c'] === P[3] && sw[3].attrs['aria-checked'] === 'true' && sw[12].attrs['aria-checked'] === 'false' && v.els.miStarPal.children.length === 16,
        '★ 색 칸을 누르면 바로 저장 · 미리보기 · 체크가 따라온다(칸을 다시 만들지 않는다)');
      v = mk(13 * C + 5 * 3600); v.toggle();
      chk(v.els.miStarNpStar.textContent === '★×13' && v.els.miStarNpText.textContent === '6 키위', '  13회차 — «★×13» 으로 접힌 채 미리보기');
    }
  }

  /* ══ 16. 🏆 전체 랭킹 — 화면 · 올리기 · 읽기 · 규칙을 모두 걷었다(되살아나면 빨강) ══ */
  say('');
  say('【16】 전체 랭킹 — [내 정보] 순위 칸 · 왕관 · 후광 · 순위 올리기 · 읽기 · leaderboard 규칙 없음');
  {
    const noCm = x => String(x || '').replace(/<!--[\s\S]*?-->/g, '');
    const H = noCm(HTML), A = APP;
    const iPg = H.indexOf('<div id="lcMyInfo"');
    const MI = H.slice(iPg, iPg + 20000);
    const css = (HTML.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
    let RU = null; try { RU = JSON.parse(stripReadGate(fs.readFileSync('firebase-database-rules.json', 'utf8'))).rules; } catch (_){}
    /* 걷은 것 — 한 군데라도 남으면 빨강 */
    const gone = (src) => [
      [/id="miRank"|id="miRankV"|전체 랭킹<\/span>/.test(src.mi), '순위 칸(#miRank)'],
      [/id="miHalo"|id="miCrown"|mi-ava-wrap/.test(src.mi), '왕관 · 후광 · 감싸개'],
      [/\.mi-rank|\.mi-halo|\.mi-crown|\.mi-ava-wrap/.test(src.css), '순위 CSS'],
      [/function (rankOf|rankLabel|_miApplyRank|_miRenderRank|_lbFetchRank|_lbPush)\(|_miRankCache|LB_CACHE_MS|onTotalSynced/.test(src.app), '순위 그리기 · 올리기 함수'],
      [/(fetchLeaderboardTop|fetchMyRank|setLeaderboardSec)\b/.test(src.app + '\n' + src.fi), '순위 읽기 · 쓰기 통로(firebaseAPI)'],
      [/['"`]leaderboard\b/.test(src.app + '\n' + src.fi), 'leaderboard 경로'],
      [!!(src.rules && src.rules.leaderboard), '규칙 leaderboard 블록'],
    ].filter(x => x[0]).map(x => x[1]);
    const cur = { mi: MI, css, app: A, fi: FI, rules: RU };
    const left = gone(cur);
    chk(iPg >= 0 && !!RU && !left.length, '★ 순위 칸 · 왕관 · 후광 · CSS · 올리기 · 읽기 · 규칙이 없다' + (left.length ? ' — 남음: ' + left.join(' · ') : '') + (RU ? '' : ' — 규칙 파일을 못 읽음'));
    chk(/<div id="miAvatar"/.test(MI) && /<span id="miAvatarPh">사진<\/span><\/div>/.test(MI), '  사진 칸은 그대로');
    /* 깨 보기 — 걷은 것을 하나씩 되살리면 잡혀야 한다 */
    const back = [
      Object.assign({}, cur, { mi: MI + '<div id="miRank" class="mi-rank"></div>' }),
      Object.assign({}, cur, { mi: MI + '<span id="miCrown"></span>' }),
      Object.assign({}, cur, { css: css + '\n  .mi-halo{top:0}' }),
      Object.assign({}, cur, { app: A + '\nfunction _lbPush(){}' }),
      Object.assign({}, cur, { fi: FI + '\n    async setLeaderboardSec(userId, sec){}' }),
      Object.assign({}, cur, { fi: FI + "\n    get(ref(db, 'leaderboard'));" }),
      Object.assign({}, cur, { rules: Object.assign({}, RU, { leaderboard: { '.read': true } }) }),
    ];
    chk(back.every(b => gone(b).length === 1), '  ↳ 깨 보기 — 칸 · 왕관 · CSS · 올리기 · 통로 · 경로 · 규칙을 하나씩 되살리면 각각 잡힌다');
    /* 옛 포커스 누적 동기화(Firebase)는 걷었다(D5-2) — 서버 올리기는 focus-progress.js(sim-focus-progress.js) */
    chk(!/syncFocusTotalToServer|_focusSyncFailed|_setFocusSyncedMark/.test(A), '  옛 포커스 누적 동기화(마크 · 재시도)는 걷었다 — 서버 올리기는 focus-progress.js');
  }

  say('');
  say(`통과 ${pass} · 실패 ${fail}`);
  say(fail ? `✗ 실패 ${fail}건` : '✓ 전부 통과');
  process.exit(fail ? 1 : 0);
})().catch(e => { say('  ✗ 예외: ' + (e && e.stack || e)); process.exit(1); });

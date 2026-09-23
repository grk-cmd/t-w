/* ═══ 🪪 sim-signup.js — 회원가입 게이트 (design-signup-2026-09-20.md §3 · §6 · §8) ═══════════════
   CHECKS 개정 38 신설. 게이트를 조각마다 넣으면서 절을 늘린다 — 지금은 첫 조각(설계 개정 8)만.

   1절 정적      getMyUserId 는 읽기만 · uid 발명은 _inventMyUserId 한 곳 · 부르는 곳도 한 곳 ·
                 redeemInvite 둘째 인자가 getMyUserId() 가 아니다 · firebase-init 안전망 배선
   2절 안전망    firebase-init `_noUidPath` · ref/sref/update 가 빈 uid 경로를 서버에 안 보낸다
   3절 초대 토큰 redeemInvite(토큰) 는 usedBy 만 · finishInviteSignup 이 uid 로 바꾸고 딸린 두 쓰기를 한 번
   4절 app.js    uid 없는 기기: getMyUserId null · 쓰지 않음 · _setMyUserId 모양 검사 · 토큰 재사용 ·
                 _inviteFinishPending 성공/실패/uid 없음 · ensureMyFriendCode 가 코드를 안 뽑는다
   5절 H         초대 게이트 세 문(시안 글자·같은 크기) · 옛 계정 이전 줄 없음 · 친구 코드 로그인(app · firebase-init)
   6절 A         계정 만들기 시안 · 익명 → ② → ③ → ④ → ⑤ 순서 · 끊겨도 같은 uid·코드 · 구글 가입·기존 구글 · firebase-init 가입 통로 셋
   7절 I         기존 사용자 가입 시안 · 닫기 없음 · 클릭 통과 등록 · 판정(묶이지 않은 uid만 · 오프라인 쉼) · 코드(이 기기 → 거울 → 새 후보) · uid 그대로
   8절 ⑥         친구 코드 거울 정정 — 로컬만 · friendCodes 쓰기 0 · 거울 코드가 지금 내 것일 때만 · 발급보다 먼저 · 세션당 한 번
   9절 J·J2·K    가입 완료(되찾기 코드 없음 · A 재시작 · I 닫기 · 구글 붙이기) · 로그인 필요(묶였는데 다른 세션일 때만 · 닫기 없음)
  10절 C3·C2     계정 탭 로그인 수단 · 비밀번호 만들기(지금 세션에 붙이기 · 오래됐으면 구글 재인증 · 내 코드만) · 바꾸기(함수 changePassword · 지금 비밀번호 안 물음 · 다시 로그인) · CSP 함수 호스트
  11절 내 정보   런처 안 페이지(개정 48) · 작은 머리 · 보관함 = 슬롯 밖 산 항목만 · n/20 · [슬롯에 올리기] · 톱니 G · 보관함 이동(지우지 않음 · 못 올린 고침은 먼저 올림) · 스위치 켬 · 계정 C4 · 걷은 것 · transferHash 지우기만
  12절 휴지통    (개정 49 · 69) 탭 순서 보관함 · 휴지통 · 계정 · 보관함이 열린 PC 에서만 · E 줄(옮김/연동 교체 · 사라지는 날 · [복원] 폭 고정) · 20 이면 붉은 상자 · 보관함 줄 붉은 아이콘 + 줄 안 되묻기 · 가짜 DOM 그리기
  13절 D2        (개정 51) 보관함 가득 참 — 20 이상일 때만 경고(n/20 · 몇 개) · 체크칸 · 고른 수 · [선택한 캐릭터 휴지통으로 (k)] → 되묻기 → 한꺼번에 · 19 면 다 접힘
  15절 별 색     (개정 69) [내 정보] 레벨 배지 = 버튼 · 누르면 머리 아래 «별 색» 구획 · 999 전 잠김(남은 시간) · 회차면 미리보기 + 16칸 · 열 때마다 닫힘 · 재료 함수(별 문자열 · 회차 파생 · 팔레트만 받음)
  16절 랭킹      (개정 73) [내 정보] 전체 랭킹 1~100위 — 머리 오른쪽 글자만(B안) · 100위 밖 비움 · 메달 셋 · 1위만 왕관·후광·간격 · 감싸개(overflow) ·
                 rankOf(누적초 · 동점 먼저 도달 · 100 경계 · 없음) · 동기화 성공 뒤 서버 총합 · 같은 값 안 씀 · 60초 캐시 · 실패 비움 · 규칙(소유권 · $other · 목록 읽기 제한)

   실행: node sim-signup.js   (app.js · firebase-init.js · desk-companion-prototype.html 과 같은 폴더에서 — run.js 가 맞춰 준다)
*/
'use strict';
const fs = require('fs');

let pass = 0, fail = 0;
const say = s => console.log(s);
const chk = (c, m) => { if (c) { pass++; say('  ✓ ' + m); } else { fail++; say('  ✗ ' + m); } };

const APP = fs.readFileSync('app.js', 'utf8');
const FI  = fs.readFileSync('firebase-init.js', 'utf8');

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
say('【1】 정적 — uid 를 만드는 곳 · 초대 토큰 · 안전망 배선');
const gm = takeFn(APP, 'function getMyUserId(');
chk(!!gm, 'getMyUserId 가 있다');
chk(gm && !/setItem/.test(gm), 'getMyUserId 본문에 setItem 이 없다(읽기만)');
chk(gm && !/Date\.now|Math\.random/.test(gm), 'getMyUserId 가 uid 를 만들지 않는다');
const inv = takeFn(APP, 'function _inventMyUserId(');
chk(!!inv && /'u'\s*\+\s*Date\.now\(\)/.test(inv), '_inventMyUserId 가 uid 를 만든다');
chk(count(APP, /'u'\s*\+\s*Date\.now\(\)\.toString\(36\)/g) === 1, "uid 모양('u'+Date.now…) 생성은 app.js 에서 한 곳");
const invCalls = count(APP, /(?<!function )_inventMyUserId\(\)/g);   // 선언 줄은 부르는 곳이 아니다
chk(invCalls === 1, `_inventMyUserId() 를 부르는 곳은 하나 (${invCalls})`);
const gateFn = takeFn(APP, 'function _showInviteGate(');
const ensF = takeFn(APP, 'function _signupPendingEnsure(');
chk(ensF && /_inventMyUserId\(\)/.test(ensF), '그 한 곳은 가입 상태 준비(_signupPendingEnsure · 새 사람 갈래) 안이다 (개정 40)');
chk(!/redeemInvite\([^)]*getMyUserId\(\)/.test(APP), 'redeemInvite( 둘째 인자가 getMyUserId() 가 아니다');
chk(/redeemInvite\(code,\s*_inviteTokenFor\(code\)\)/.test(APP), 'redeemInvite 는 기기 토큰으로 부른다');
chk(/ref as _dbRef/.test(FI) && /update as _dbUpdate/.test(FI) && /ref as _stRef/.test(FI), 'firebase-init: ref · update · storage ref 를 별칭으로 들여와 감싼다');
chk(/const ref\s*=\s*\(d, p\)/.test(FI) && /const sref\s*=/.test(FI) && /const update\s*=/.test(FI), 'firebase-init: ref · sref · update 가 안전망을 지난다');
const redeem = FI.slice(FI.indexOf('    async redeemInvite('), FI.indexOf('    async finishInviteSignup('));
chk(redeem.length > 50 && !/users\//.test(redeem.replace(/\/\*[\s\S]*?\*\//g, '')) && !/stats\/userCount/.test(redeem.replace(/\/\*[\s\S]*?\*\//g, '')),
  'redeemInvite 는 users/ · stats/ 에 쓰지 않는다(토큰 자리 유령 노드 없음)');
chk(/async finishInviteSignup\(code, token, userId\)/.test(FI), 'finishInviteSignup 이 있다');

/* ══ 2. 안전망 실행 ══ */
say('');
say('【2】 빈 uid 안전망 — 경로가 만들어지는 자리에서 막는다');
const guardSrc = FI.slice(FI.indexOf('  const _NOUID_SEG'), FI.indexOf('    return _dbUpdate(r, v);\n  };') + '    return _dbUpdate(r, v);\n  };'.length);
const G = (new Function('_dbRef', '_stRef', '_dbUpdate', 'console',
  guardSrc + '\nreturn { _noUidPath, ref, sref, update };'))(
  (d, p) => ({ db: d, path: p === undefined ? '/' : p }),
  (st, p) => ({ st, path: p }),
  (r, v) => Promise.resolve({ r, v }),
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

  /* ══ 3. 초대 토큰 ══ */
  say('');
  say('【3】 초대 토큰 — 소진은 토큰으로 · uid 는 가입 뒤에 한 번');
  const methods = FI.slice(FI.indexOf('    async redeemInvite('), FI.indexOf('    // 초대장 발급 — 유저는 invitesLeft를 1 차감'));
  function makeServer(seed){
    const T = JSON.parse(JSON.stringify(seed || {}));
    const writes = [];
    const at = p => p.split('/').reduce((o, k) => (o == null ? undefined : o[k]), T);
    const put = (p, v) => { const ks = p.split('/'); let o = T; ks.slice(0, -1).forEach(k => { o[k] = o[k] || {}; o = o[k]; }); if (v === undefined) delete o[ks.at(-1)]; else o[ks.at(-1)] = v; };
    const api = {
      db: {},
      ref: (d, p) => ({ path: p }),
      get: async r => { const v = at(r.path); return { val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))), exists: () => v !== undefined }; },
      runTransaction: async (r, fn) => {
        const cur = at(r.path); const nv = fn(cur === undefined ? null : JSON.parse(JSON.stringify(cur)));
        if (nv === undefined) return { committed:false, snapshot:{ val: () => (cur === undefined ? null : cur) } };
        put(r.path, nv); writes.push(r.path); return { committed:true, snapshot:{ val: () => nv } };
      },
      update: async (r, v) => { const base = at(r.path) || {}; put(r.path, Object.assign({}, base, v)); writes.push(r.path); },
    };
    const o = (new Function('db', 'ref', 'get', 'runTransaction', 'update', 'return ({\n' + methods + '\n});'))(api.db, api.ref, api.get, api.runTransaction, api.update);
    return { o, T, writes };
  }
  const INV = { invites: { 'INVT-AAAA-BBBB': { issuedBy:'uissuer0001', createdAt:1 } }, stats: { userCount: 10 } };
  {
    const S = makeServer(INV);
    const r1 = await S.o.redeemInvite('INVT-AAAA-BBBB', 'tdevice00000000001');
    chk(r1.ok && r1.issuedBy === 'uissuer0001', '토큰으로 소진 → ok · issuedBy 돌려줌');
    chk(S.T.invites['INVT-AAAA-BBBB'].usedBy === 'tdevice00000000001', 'usedBy = 토큰');
    chk(!S.writes.some(p => p.startsWith('users/')) && S.T.stats.userCount === 10, '소진 단계에서 users/ 쓰기 0 · 카운터 그대로');
    const r2 = await S.o.redeemInvite('INVT-AAAA-BBBB', 'tdevice00000000001');
    chk(r2.ok, '같은 토큰의 재시도는 통과');
    const r3 = await S.o.redeemInvite('INVT-AAAA-BBBB', 'tother0000000000002');
    chk(!r3.ok && /이미 사용된/.test(r3.reason), '다른 토큰은 «이미 사용된 초대 코드»');
    const r0 = await S.o.redeemInvite('INVT-AAAA-BBBB', null);
    chk(!r0.ok, '토큰이 비면 거절');
    const bad = await S.o.finishInviteSignup('INVT-AAAA-BBBB', 'tother0000000000002', 'unewuser0001');
    chk(!bad.ok && S.T.invites['INVT-AAAA-BBBB'].usedBy === 'tdevice00000000001', '남의 토큰으로 마무리 → 안 바뀐다');
    const f1 = await S.o.finishInviteSignup('INVT-AAAA-BBBB', 'tdevice00000000001', 'unewuser0001');
    chk(f1.ok && S.T.invites['INVT-AAAA-BBBB'].usedBy === 'unewuser0001', '마무리 → usedBy = uid');
    const iv = S.T.users && S.T.users.unewuser0001 && S.T.users.unewuser0001.invite;
    chk(iv && iv.invitesLeft === 0 && iv.invitedBy === 'uissuer0001' && typeof iv.joinedAt === 'number', 'users/{uid}/invite = 0장 · invitedBy · joinedAt');
    chk(S.T.stats.userCount === 11, '가입 카운터 +1');
    const f2 = await S.o.finishInviteSignup('INVT-AAAA-BBBB', 'tdevice00000000001', 'unewuser0001');
    chk(f2.ok && S.T.stats.userCount === 11, '다시 불러도 ok · 카운터는 한 번만');
    chk(!Object.keys(S.T.users || {}).some(k => k.startsWith('t')), 'users/ 아래에 토큰 모양 키가 없다');
  }
  {
    const S = makeServer(INV);
    const r = await S.o.redeemInvite('INVT-ZZZZ-ZZZZ', 'tdevice00000000001');
    chk(!r.ok && /존재하지 않는/.test(r.reason), '없는 코드 → «존재하지 않는 초대 코드»');
  }

  /* ══ 4. app.js — uid 없는 기기 ══ */
  say('');
  say('【4】 app.js — uid 없는 기기 · 기록 한 곳 · 토큰');
  const store = {}; const sets = [];
  const LS = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { sets.push(k); store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  const pick = h => { const f = takeFn(APP, h); if (!f) throw new Error('못 찾음: ' + h); return f; };
  const src = [
    "const MY_USER_ID_KEY = 'tw.myUserId';",
    "const INVITE_TOKEN_KEY = 'tw.inviteToken';",
    "const MY_FRIEND_CODE_KEY = 'tw.myFriendCode';",
    "let _fcOwnerChecked = false; let _fcMirrorChecked = false;",
    "async function _healFriendCodeOwner(){}",
    "function genFriendCodeCandidate(){ return 'MATE-TEST'; }",
    pick('function getMyUserId('), pick('function _inventMyUserId('), pick('function _setMyUserId('),
    pick('function _inviteTokenLoad('), pick('function _inviteTokenFor('), pick('async function _inviteFinishPending('),
    /* 개정 42 — ensureMyFriendCode 가 부르는 이웃. 없는 판(옛 코드)은 빈 함수로 — 그 판의 빨강은 8절이 낸다. */
    takeFn(APP, 'async function _friendCodeMirrorFix(') || 'async function _friendCodeMirrorFix(){}', pick('async function ensureMyFriendCode('),
    'return { getMyUserId, _inventMyUserId, _setMyUserId, _inviteTokenLoad, _inviteTokenFor, _inviteFinishPending, ensureMyFriendCode };',
  ].join('\n');
  const win = { firebaseAPI: null };
  /* 떼어 온 함수는 `window.firebaseAPI` 와 맨 이름 `firebaseAPI` 를 둘 다 쓴다 — 같은 것을 보게 한다. */
  Object.defineProperty(globalThis, 'firebaseAPI', { get: () => win.firebaseAPI, configurable: true });
  const A = (new Function('localStorage', 'window', src))(LS, win);
  chk(A.getMyUserId() === null, '빈 기기: getMyUserId() → null');
  chk(!sets.includes('tw.myUserId'), '빈 기기: 부르기만 해서는 tw.myUserId 를 안 쓴다');
  const u = A._inventMyUserId();
  chk(/^u[0-9a-z]{12,24}$/.test(u), `_inventMyUserId 모양 (${u})`);
  chk(A.getMyUserId() === null, '만들기만 해서는 기록되지 않는다');
  chk(A._setMyUserId('') === false && A._setMyUserId('MATE-AB12') === false && A._setMyUserId(null) === false, '_setMyUserId: 빈 값 · 친구 코드 모양 · null 거절');
  chk(A.getMyUserId() === null && !sets.includes('tw.myUserId'), '거절한 값은 안 쓴다');

  win.firebaseAPI = { registerFriendCode: async () => { throw new Error('불리면 안 된다'); }, setUserFriendCode: async () => {} };
  let fcCalled = false; win.firebaseAPI.registerFriendCode = async () => { fcCalled = true; return true; };
  const fc = await A.ensureMyFriendCode();
  chk(fc === null && !fcCalled && !('tw.myFriendCode' in store), 'uid 없으면 ensureMyFriendCode 가 코드를 안 뽑는다');

  const t1 = A._inviteTokenFor('INVT-AAAA-BBBB');
  chk(/^t[a-z0-9]{16}$/.test(t1), `토큰 모양 (${t1})`);
  chk(A._inviteTokenFor('INVT-AAAA-BBBB') === t1, '같은 코드 → 같은 토큰(재시도)');
  const t2 = A._inviteTokenFor('INVT-CCCC-DDDD');
  chk(t2 !== t1 && A._inviteTokenLoad().code === 'INVT-CCCC-DDDD', '다른 코드 → 새 토큰으로 바꿔 적는다');

  let finCalls = 0;
  win.firebaseAPI = { finishInviteSignup: async (c, t, uid) => { finCalls++; return { ok: win._finOk !== false }; } };
  chk((await A._inviteFinishPending()) === false && finCalls === 0, 'uid 없으면 마무리를 부르지 않는다');
  chk(A._setMyUserId(u) === true && A.getMyUserId() === u, '_setMyUserId: 모양 맞으면 기록 · 읽힌다');
  win._finOk = false;
  chk((await A._inviteFinishPending()) === false && !!A._inviteTokenLoad(), '마무리 실패 → 토큰을 남긴다(다음 부팅에 다시)');
  win._finOk = true;
  chk((await A._inviteFinishPending()) === true && A._inviteTokenLoad() === null, '마무리 성공 → 토큰 키를 지운다');

  /* ══ 5. H · 초대 게이트의 로그인 두 길 (CHECKS 개정 39) ══ */
  say('');
  say('【5】 H — 초대 게이트: 세 문 · 옛 계정 이전 줄 없음 · 친구 코드 로그인');
  const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');
  const hs = HTML.indexOf('<div id="inviteGateOverlay"'), he = HTML.indexOf('<!-- 🖥️ 한 계정 한 기기', hs);
  const H = hs > 0 && he > hs ? HTML.slice(hs, he) : '';
  chk(!!H, 'H 마크업을 찾았다');
  const btn = id => (new RegExp('<button id="' + id + '" class="([^"]*)"[^>]*>([\\s\\S]*?)</button>')).exec(H);
  const bOk = btn('inviteGateOk'), bG = btn('inviteGateGoogleBtn'), bF = btn('inviteGateFcBtn');
  chk(bOk && /입장하기/.test(bOk[2]) && bG && /구글로 로그인/.test(bG[2]) && bF && /친구 코드로 로그인/.test(bF[2]), '세 문: 입장하기 · 구글로 로그인 · 친구 코드로 로그인 (시안 글자)');
  chk([bOk, bG, bF].every(b => b && b[1] === 'lc-btn'), '★ 세 버튼 같은 크기 — 셋 다 lc-btn(ghost 아님)');
  chk(/이미 계정이 있어요/.test(H) && /초대 코드 없이 로그인하면 돼요/.test(H), '«이미 계정이 있어요» 구분선 · 아래 안내 한 줄');
  chk(/id="inviteGateFc"/.test(H) && /id="inviteGatePw" type="password"/.test(H) && /id="inviteGateLoginMsg"/.test(H), '친구 코드 · 비밀번호 칸 · 로그인 안내 줄');
  chk(H.indexOf('inviteGateGoogleBtn') < H.indexOf('id="inviteGateFc"') && H.indexOf('id="inviteGateOk"') < H.indexOf('이미 계정이 있어요'), '순서: 초대 코드 → 구분선 → 구글 → 친구 코드');
  chk(!/inviteGatePwRow|이전 비밀번호|계정 이전/.test(H), '★ 옛 «유저 코드 + 이전 비밀번호» 줄이 없다');
  const SG = takeFn(APP, 'function _showInviteGate(') || '';
  const SG2 = () => SG;
  chk(!/isUserCode|verifyTransfer|inviteGatePwRow|MY_USER_ID_KEY/.test(SG), '★ 게이트 본문에 옛 계정 이전 갈래 · uid 직접 기록이 없다');
  chk(/_loginDoFriendCode\(/.test(SG) && /_acctRelaunchAfterDetach\(\s*\(\)\s*=>/.test(SG), '친구 코드 로그인 → uid 가 바뀌면 재시작(못 하면 수동 안내)');
  const GG = APP.slice(APP.indexOf("const gate = $('inviteGateGoogleBtn')"), APP.indexOf('refreshAccountTab();', APP.indexOf("const gate = $('inviteGateGoogleBtn')")));
  chk(/inviteGateLoginMsg/.test(GG) && !/inviteGateMsg'/.test(GG), '구글 문의 안내도 로그인 안내 줄에 쓴다');

  const reM = /const FRIEND_CODE_LOGIN_RE = (\/.*\/);/.exec(APP);
  const FRE = reM ? eval(reM[1]) : null;
  chk(FRE && FRE.test('MATE-AB12') && FRE.test('COZY-1234') && !FRE.test('INVT-AAAA-BBBB') && !FRE.test('ulqz0abc123def') && !FRE.test('MATE-AB1'),
    '친구 코드 모양: MATE-XXXX · 옛 COZY-XXXX 통과 · 초대 코드 · uid · 짧은 것 거절');

  /* _loginDoFriendCode — 스텁 서버 */
  const fnL = takeFn(APP, 'async function _loginDoFriendCode(');
  chk(!!fnL, '_loginDoFriendCode 가 있다');
  function runLogin(storeInit, server){
    const st = Object.assign({}, storeInit); const calls = [];
    const ls = { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
    const w = { firebaseAPI: {
      authSignInWithFriendCode: async (c, p) => { calls.push('signin:' + c); return server(c, p); },
      authSignOut: async () => { calls.push('signout'); },
      fetchAccountSnapshot: async u => { calls.push('snap:' + u); return { userCode: u }; },
    } };
    Object.defineProperty(globalThis, 'firebaseAPI', { get: () => w.firebaseAPI, configurable: true });
    const src2 = [
      "const MY_USER_ID_KEY = 'tw.myUserId'; const LOGIN_EMAIL_KEY = 'tw.loginEmail'; const LOGIN_UID_KEY = 'tw.loginUid'; const INVITE_PASS_KEY = 'tw.invitePassed';",
      "function _markInvitePassed(){ localStorage.setItem(INVITE_PASS_KEY, '1'); }",
      "function _rememberPrevUserId(u){ calls.push('prev:' + u); }",   // (개정 56) 걷었다 — 불리면 안 된다
      "async function _switchPrepare(b, t){ calls.push('prep:' + b + ':' + t); return (globalThis.__prep || { ok:true, mode:'none' }); }",   // 개정 57 — 본체는 14절
      "async function _applyTransferSnapshot(s, o){ calls.push('apply:' + (s && s.userCode) + ':' + ((o && o.typedCode) || '')); }",
      takeFn(APP, 'function getMyUserId('), takeFn(APP, 'function _setMyUserId('), fnL,
      'return _loginDoFriendCode;',
    ].join('\n');
    const f = (new Function('localStorage', 'window', 'calls', 'console', src2))(ls, w, calls, { warn(){} });
    return { f, st, calls };
  }
  {
    const L = runLogin({}, async () => ({ ok:false, reason:'친구 코드나 비밀번호가 맞지 않아요' }));
    const r = await L.f('MATE-AB12', 'secret1');
    chk(!r.ok && /맞지 않아요/.test(r.reason) && !('tw.myUserId' in L.st) && !('tw.invitePassed' in L.st), '틀림 → 실패 · uid·도장 안 씀');
  }
  {
    const L = runLogin({}, async () => ({ ok:true, uid:'A1', email:'mate-ab12@tw.local', userCode:'uacct00000001' }));
    const r = await L.f('MATE-AB12', 'secret1');
    chk(r.ok && r.switched === true, '★ 처음 쓰는 PC → switched(재시작 대상)');
    chk(L.st['tw.myUserId'] === 'uacct00000001' && L.st['tw.invitePassed'] === '1', 'uid = 서버의 userCode · 게이트 도장');
    chk(L.st['tw.loginEmail'] === 'mate-ab12@tw.local' && L.st['tw.loginUid'] === 'A1', '로그인 표시 두 키');
    chk(L.calls.includes('snap:uacct00000001') && L.calls.some(c => c.startsWith('apply:uacct00000001:')), '스냅샷 복원(구글·연동과 같은 함수)');
    chk(!L.calls.some(c => c.startsWith('prev:')), '옛 uid 가 없으면 «버린 uid» 기록도 없다');
  }
  {
    const L = runLogin({ 'tw.myUserId':'uacct00000001' }, async () => ({ ok:true, uid:'A1', email:'mate-ab12@tw.local', userCode:'uacct00000001' }));
    const r = await L.f('MATE-AB12', 'secret1');
    chk(r.ok && r.switched === false && !L.calls.some(c => c.startsWith('snap:')), '이미 이 기기의 계정 → 재시작 없음 · 복원 없음');
  }
  {
    globalThis.__prep = { ok:false, reason:'이 PC 의 캐릭터를 올리지 못했어요' };
    const L0 = runLogin({ 'tw.myUserId':'uold000000001' }, async () => ({ ok:true, uid:'A1', email:'mate-ab12@tw.local', userCode:'uacct00000001' }));
    const r0 = await L0.f('MATE-AB12', 'secret1');
    chk(!r0.ok && /올리지 못했어요/.test(r0.reason) && L0.st['tw.myUserId'] === 'uold000000001' && L0.calls.includes('signout') && !L0.calls.some(c => c.startsWith('snap:')),
        '★ 정리가 실패하면 갈아타지 않는다 — uid 그대로 · 세션 놓음 · 복원 없음 (개정 57)');
    globalThis.__prep = null;
    const L = runLogin({ 'tw.myUserId':'uold000000001' }, async () => ({ ok:true, uid:'A1', email:'mate-ab12@tw.local', userCode:'uacct00000001' }));
    const r = await L.f('MATE-AB12', 'secret1');
    chk(r.ok && r.switched && L.st['tw.myUserId'] === 'uacct00000001' && !L.calls.some(c => c.startsWith('prev:')), '다른 uid 가 있던 기기 → 갈아탐 · 옛 uid 는 적지 않는다(개정 56 · 다른 계정이다)');
    chk(L.calls.includes('apply:uacct00000001:MATE-AB12'), '  복원에 **입력한 코드**를 넘긴다 — 계정에 코드 기록이 없을 때 쓴다(개정 56 (가))');
    chk(L.calls.indexOf('prep:uold000000001:uacct00000001') >= 0 && L.calls.indexOf('prep:uold000000001:uacct00000001') < L.calls.indexOf('snap:uacct00000001'), '  갈아타기 전에 옛 uid 정리(_switchPrepare)를 부른다 (개정 57)');
  }
  {
    const L = runLogin({}, async () => ({ ok:true, uid:'A1', email:'x@tw.local', userCode:'MATE-AB12' }));
    const r = await L.f('MATE-AB12', 'secret1');
    chk(!r.ok && !('tw.myUserId' in L.st) && L.calls.includes('signout') && !('tw.loginEmail' in L.st), '★ uid 모양이 아니면 기록 안 함 · Auth 세션도 놓음 · 로그인 표시 없음');
  }

  /* firebase-init authSignInWithFriendCode — 스텁 Auth */
  /* 다음 메서드 머리까지만 — 개정 40 에서 가입 통로 셋이 이 뒤(authSignOut 앞)에 들어왔다. */
  const fiA0 = FI.indexOf('    async authSignInWithFriendCode(');
  const fiA1 = ['    /* ✍️ [회원가입 설계 §3 A · §9-6 (a) · 개정 10]', '    async authSignOut()'].map(m => FI.indexOf(m, fiA0 + 1)).filter(i => i > fiA0).sort((x, y) => x - y)[0];
  const fiA = fiA0 >= 0 && fiA1 ? FI.slice(fiA0, fiA1) : '';
  chk(/signInWithEmailAndPassword/.test(FI.slice(0, 3000)) && fiA.length > 100, 'firebase-init: 이메일/비밀번호 로그인을 들여오고 통로가 있다');
  chk(!/runTransaction|\bset\(|update\(/.test(fiA), '★ 통로는 읽기만 한다(결속·쓰기 없음)');
  async function runFA(authResult, rows){
    const log = [];
    const env = {
      auth: {}, db: {},
      signInWithEmailAndPassword: async (a, email, pw) => { log.push('in:' + email); if (authResult.err) { const e = new Error('x'); e.code = authResult.err; throw e; } return { user:{ uid: authResult.uid } }; },
      fbSignOut: async () => { log.push('out'); },
      ref: (d, p) => ({ path: p }),
      get: async r => ({ val: () => (rows[r.path] === undefined ? null : rows[r.path]) }),
    };
    const o = (new Function(...Object.keys(env), 'return ({\n' + fiA + '\n});'))(...Object.values(env));
    const r = await o.authSignInWithFriendCode('mate-ab12', 'secret1');
    return { r, log };
  }
  {
    const X = await runFA({ uid:'A1' }, { 'authUsers/A1': { userCode:'uacct00000001' } });
    chk(X.r.ok && X.r.userCode === 'uacct00000001' && X.log[0] === 'in:mate-ab12@tw.local', '이메일 = {코드 소문자}@tw.local · userCode 를 돌려준다');
    const Y = await runFA({ uid:'A2' }, {});
    chk(!Y.r.ok && Y.log.includes('out'), '★ authUsers 줄이 없으면 로그아웃시키고 거절');
    const Z = await runFA({ err:'auth/invalid-credential' }, {});
    chk(!Z.r.ok && /맞지 않아요/.test(Z.r.reason), '틀린 비밀번호 → «친구 코드나 비밀번호가 맞지 않아요»');
    const Q = await runFA({ err:'auth/operation-not-allowed' }, {});
    chk(!Q.r.ok && /이메일\/비밀번호/.test(Q.r.reason), '콘솔 설정 꺼짐 → 켜라는 안내');
  }

  /* ══ 6. A · 계정 만들기 (CHECKS 개정 40) ══ */
  say('');
  say('【6】 A — 계정 만들기: 시안 · 익명 → ② → ③ → ④ → ⑤ · 끊겨도 같은 uid·코드 · 구글');
  const aS = HTML.indexOf('<div id="signupCard"'), aE = HTML.indexOf('<!-- 🖥️ 한 계정 한 기기', aS);
  const AM = aS > 0 && aE > aS ? HTML.slice(aS, aE) : '';
  chk(!!AM && aS > HTML.indexOf('<div id="inviteGateOverlay"') && aS < HTML.indexOf('<!-- 🖥️ 한 계정 한 기기'), 'A 카드가 게이트 오버레이 안에 있다');
  chk(/계정 만들기/.test(AM) && /구글로 가입하기/.test(AM) && /또는 친구 코드로/.test(AM) && /내 아이디 \(친구 코드\)/.test(AM) && /바뀌지 않아요/.test(AM), '시안 글자: 제목 · 구글로 가입하기 · 또는 친구 코드로 · 내 아이디 · 바뀌지 않아요');
  chk(/id="signupPw" type="password" placeholder="6자 이상"/.test(AM) && /id="signupPw2" type="password" placeholder="한 번 더"/.test(AM) && /id="signupOk" class="lc-btn"[^>]*>가입하기</.test(AM), '비밀번호 · 확인 · [가입하기]');
  chk(/<span id="signupCode"/.test(AM) && !/<input[^>]*id="signupCode"/.test(AM), '★ 아이디는 고정 표시(입력 칸 없음)');
  chk(/되찾기 코드/.test(AM) && /이메일은 받지 않아요/.test(AM), '아래 안내 한 줄(시안)');
  chk(/id="signupGoogleBtn" class="lc-btn"/.test(AM), '구글 버튼도 같은 크기(lc-btn)');

  const need = ['function getMyUserId(', 'function _inventMyUserId(', 'function _setMyUserId(', 'function _inviteTokenLoad(',
    'async function _inviteFinishPending(', 'function genFriendCodeCandidate(', 'function _signupPendingLoad(', 'function _signupPendingSave(',
    'function _signupPendingEnsure(', 'async function _signupClaimCode(', 'async function _signupFinishLocal(',
    'async function _signupDoPassword(', 'async function _signupDoGoogle('];
  const miss = need.filter(h => !takeFn(APP, h));
  chk(miss.length === 0, 'A 함수들이 있다' + (miss.length ? ' — 없음: ' + miss.join(', ') : ''));
  chk(/const SIGNUP_PENDING_KEY = 'tw\.signupPending';/.test(APP), '가입 도중 상태 키 tw.signupPending');
  const ensureFn = takeFn(APP, 'function _signupPendingEnsure(') || '';
  chk(/_inventMyUserId\(\)/.test(ensureFn), '★ uid 발명은 _signupPendingEnsure(새 사람 갈래) 안에서만');
  chk(/if\(_signupPendingLoad\(\) && _inviteTokenLoad\(\) && !getMyUserId\(\)\) openSignup\(\);/.test(SG2()), '끊긴 가입은 부팅 때 A 로 곧장(초대 코드를 다시 안 묻는다)');
  chk(!/redeemInvite[\s\S]{0,900}_inventMyUserId/.test(SG2()), '초대 통과 뒤 곧바로 uid 를 만들지 않는다(임시 블록 걷음)');

  if (miss.length === 0){
    function mkA(opt){
      opt = opt || {};
      const st = Object.assign({}, opt.store || {}); const log = [];
      const ls = { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
      const taken = new Set(opt.taken || []);
      const fc = {};  // friendCodes 흉내
      const api = {
        authSignupEnsure: async email => { log.push('ensure'); return opt.ensure || { ok:true, authUid:'ANON1', anonymous:true }; },
        registerFriendCode: async (code, uid) => { log.push('claim:' + code); if (opt.claimThrow) throw new Error('net'); if (taken.has(code)) return false; if (fc[code] && fc[code] !== uid) return false; fc[code] = uid; return true; },
        authSignupLinkPassword: async (code, pw) => { log.push('link:' + code); const q = opt.link && opt.link.shift ? opt.link.shift() : null; return q || { ok:true, authUid:'ANON1', email: code.toLowerCase() + '@tw.local' }; },
        authSignupBind: async uid => { log.push('bind:' + uid); return opt.bind || { ok:true, authUid:'ANON1' }; },
        setUserFriendCode: async (uid, code) => { log.push('mirror:' + uid + '=' + code); return true; },
        finishInviteSignup: async (c, t, uid) => { log.push('finish:' + uid); return { ok:true }; },
        authSignInWithGoogle: async (tok, uid) => { log.push('google:' + uid); return opt.google ? opt.google(uid) : { ok:true, uid:'G1', email:'me@gmail.com', userCode:uid, bound:true }; },
        fetchAccountSnapshot: async u => { log.push('snap:' + u); return { userCode:u }; },
      };
      const w = { firebaseAPI: api, companion: { signInWithGoogle: async () => opt.gcancel ? { ok:false } : { ok:true, idToken:'TOK' } } };
      Object.defineProperty(globalThis, 'firebaseAPI', { get: () => w.firebaseAPI, configurable: true });
      Object.defineProperty(globalThis, 'companion', { get: () => w.companion, configurable: true });
      const src3 = [
        "const MY_USER_ID_KEY = 'tw.myUserId'; const MY_FRIEND_CODE_KEY = 'tw.myFriendCode'; const LOGIN_EMAIL_KEY = 'tw.loginEmail'; const LOGIN_UID_KEY = 'tw.loginUid';",
        "const INVITE_TOKEN_KEY = 'tw.inviteToken'; const INVITE_PASS_KEY = 'tw.invitePassed'; const SIGNUP_PENDING_KEY = 'tw.signupPending';",
        "function _markInvitePassed(){ localStorage.setItem(INVITE_PASS_KEY, '1'); }",
        "async function _applyTransferSnapshot(s){ log.push('apply:' + (s && s.userCode)); }",
        ...need.map(h => takeFn(APP, h)),
        'return { _signupDoPassword, _signupDoGoogle, _signupPendingEnsure, _signupPendingLoad };',
      ].join('\n');
      const A = (new Function('localStorage', 'window', 'log', 'console', src3))(ls, w, log, { warn(){} });
      return { A, st, log, fc };
    }
    const TOKEN = JSON.stringify({ code:'INVT-AAAA-BBBB', token:'tdevice00000000001' });
    {
      const E = mkA({ store: { 'tw.inviteToken': TOKEN } });
      const p0 = E.A._signupPendingEnsure();
      chk(/^u[0-9a-z]{12,24}$/.test(p0.uid) && /^MATE-[A-Z0-9]{4}$/.test(p0.code), 'A 를 열면 uid·코드 후보가 가입 상태에만 적힌다');
      chk(!('tw.myUserId' in E.st) && E.log.length === 0, '★ 열기만 해서는 tw.myUserId · 서버 쓰기 0');
      const r = await E.A._signupDoPassword('secret1');
      chk(r.ok && r.code === p0.code && !r.changed, '★ 비밀번호 가입 성공 · 보여 준 코드 그대로');
      const order = E.log.map(x => x.split(':')[0]).join(' → ');
      chk(order === 'ensure → claim → link → bind → mirror → finish', '★ 순서: 익명 → ③ 선점 → ④ 연결 → ⑤ 결속 → 거울 → 초대 마무리 (' + order + ')');
      chk(E.st['tw.myUserId'] === p0.uid && E.st['tw.myFriendCode'] === p0.code, 'uid · 친구 코드가 이 기기에 적힌다');
      chk(E.st['tw.loginEmail'] === p0.code.toLowerCase() + '@tw.local' && E.st['tw.loginUid'] === 'ANON1', '로그인 표시 = {코드}@tw.local · 같은 authUid');
      chk(!('tw.signupPending' in E.st) && E.st['tw.invitePassed'] === '1', '가입 상태 지움 · 게이트 도장');
      chk(E.log.includes('finish:' + p0.uid) && E.fc[p0.code] === p0.uid, '초대 토큰 → uid · friendCodes/{코드} = uid');
    }
    {
      const E = mkA({ store: { 'tw.inviteToken': TOKEN } });
      const p0 = E.A._signupPendingEnsure();
      const E2 = mkA({ store: Object.assign({}, E.st), taken: [p0.code] });
      const r = await E2.A._signupDoPassword('secret1');
      chk(r.ok && r.changed && r.code !== p0.code && E2.st['tw.myFriendCode'] === r.code, '★ 보여 준 코드를 그 사이 누가 가져갔으면 새 코드로 · changed 로 알림');
    }
    {
      const E = mkA({ store: { 'tw.inviteToken': TOKEN }, link: [{ ok:false, reason:'네트워크 오류 — 연결을 확인해주세요' }] });
      const p0 = E.A._signupPendingEnsure();
      const r1 = await E.A._signupDoPassword('secret1');
      chk(!r1.ok && !('tw.myUserId' in E.st), '④ 에서 끊김 → 실패 · uid 안 적음');
      const p1 = E.A._signupPendingLoad();
      chk(p1 && p1.uid === p0.uid && p1.code === p0.code, '★ 가입 상태가 같은 uid·코드로 남는다');
      const r2 = await E.A._signupDoPassword('secret1');
      chk(r2.ok && E.st['tw.myUserId'] === p0.uid && r2.code === p0.code && !r2.changed, '★ 다시 누르면 같은 uid·코드로 끝난다(선점은 내 것이라 통과)');
    }
    {
      const E = mkA({ store: { 'tw.inviteToken': TOKEN }, link: [{ ok:false, taken:true, reason:'x' }] });
      const p0 = E.A._signupPendingEnsure();
      const r = await E.A._signupDoPassword('secret1');
      const p1 = E.A._signupPendingLoad();
      chk(!r.ok && r.codeChanged && p1.code !== p0.code && p1.uid === p0.uid, 'Auth 에 같은 코드가 이미 있으면 새 코드로 바꿔 두고 다시 누르게 한다(uid 는 그대로)');
    }
    {
      const E = mkA({ store: { 'tw.inviteToken': TOKEN }, ensure: { ok:false, reason:'Firebase 콘솔에서 [익명] 로그인을 켜주세요' } });
      const r = await E.A._signupDoPassword('secret1');
      chk(!r.ok && /익명/.test(r.reason) && !E.log.some(x => x.startsWith('claim')), '익명 로그인이 꺼져 있으면 → 안내 · 선점도 안 한다');
    }
    {
      const E = mkA({ store: { 'tw.inviteToken': TOKEN }, bind: { ok:false, taken:true, reason:'이 아이디는 이미 다른 계정에 연결돼 있어요' } });
      const r = await E.A._signupDoPassword('secret1');
      chk(!r.ok && !('tw.myUserId' in E.st) && !!E.A._signupPendingLoad(), '⑤ 결속 실패 → uid 안 적음 · 가입 상태 남김');
    }
    {
      const E = mkA({ store: { 'tw.inviteToken': TOKEN } });
      const p0 = E.A._signupPendingEnsure();
      const r = await E.A._signupDoGoogle();
      chk(r.ok && !r.existing && E.log[0] === 'google:' + p0.uid, '★ 구글 가입: 가입 상태의 uid 를 결속에 건넨다');
      chk(E.st['tw.myUserId'] === p0.uid && E.st['tw.myFriendCode'] === p0.code && E.st['tw.loginEmail'] === 'me@gmail.com', '구글 가입: uid · 코드 · 구글 이메일');
      chk(!E.log.some(x => x.startsWith('link') || x.startsWith('ensure')), '구글 가입엔 ④(비밀번호) · 익명 세션이 없다');
    }
    {
      const E = mkA({ store: { 'tw.inviteToken': TOKEN }, google: () => ({ ok:true, uid:'G9', email:'old@gmail.com', userCode:'uexisting0001', bound:false }) });
      E.A._signupPendingEnsure();
      const r = await E.A._signupDoGoogle();
      chk(r.ok && r.existing && E.st['tw.myUserId'] === 'uexisting0001', '★ 이미 가입된 구글 계정 → 새로 안 만들고 그 계정으로');
      chk(!E.log.some(x => x.startsWith('claim')) && E.log.includes('apply:uexisting0001') && !('tw.signupPending' in E.st), '그때는 코드 선점 없음 · 스냅샷 복원 · 가입 상태 지움');
    }
    {
      const E = mkA({ store: { 'tw.inviteToken': TOKEN }, gcancel: true });
      E.A._signupPendingEnsure();
      const r = await E.A._signupDoGoogle();
      chk(!r.ok && r.canceled && !('tw.myUserId' in E.st) && !!E.A._signupPendingLoad(), '구글 창을 닫으면 조용히 · 가입 상태 그대로');
    }
  }

  /* firebase-init 가입 통로 셋 — 스텁 Auth */
  const fiS0 = FI.indexOf('    async authSignupEnsure(');
  const fiS = fiS0 >= 0 ? FI.slice(fiS0, FI.indexOf('    async authSignOut()', fiS0)) : '';
  chk(fiS.length > 100, 'firebase-init: 가입 통로 셋이 있다');
  chk(/signInAnonymously, linkWithCredential, EmailAuthProvider/.test(FI.slice(0, 3000)), 'firebase-init: 익명 로그인 · 연결 · 이메일 자격을 들여온다');
  async function runFS(cu, opt){
    opt = opt || {}; const log = [];
    const auth = { currentUser: cu };
    const rows = Object.assign({}, opt.rows || {});
    const env = {
      auth, db: {},
      _whenAuthReady: async () => {},
      fbSignOut: async () => { log.push('out'); auth.currentUser = null; },
      signInAnonymously: async () => { log.push('anon'); if (opt.anonErr){ const e = new Error('x'); e.code = opt.anonErr; throw e; } auth.currentUser = { uid:'ANON2', isAnonymous:true }; return { user: auth.currentUser }; },
      linkWithCredential: async (u, c) => { log.push('link:' + c.email); if (opt.linkErr){ const e = new Error('x'); e.code = opt.linkErr; throw e; } u.email = c.email; u.isAnonymous = false; return { user:u }; },
      EmailAuthProvider: { credential: (email, pw) => ({ email, pw }) },
      ref: (d, p) => ({ path:p }),
      runTransaction: async (r, fn) => { const nv = fn(rows[r.path] === undefined ? null : rows[r.path]); if (nv !== undefined) rows[r.path] = nv; return { snapshot:{ val: () => rows[r.path] === undefined ? null : rows[r.path] } }; },
      set: async (r, v) => { log.push('set:' + r.path); rows[r.path] = v; },
    };
    const o = (new Function(...Object.keys(env), 'return ({\n' + fiS + '\n});'))(...Object.values(env));
    return { o, log, rows, auth };
  }
  if (fiS) {
    const X = await runFS({ uid:'ANON1', isAnonymous:true });
    const r = await X.o.authSignupEnsure('mate-ab12@tw.local');
    chk(r.ok && r.authUid === 'ANON1' && !X.log.includes('anon'), '★ 남아 있는 익명 세션을 이어 쓴다(같은 authUid)');
    const Y = await runFS({ uid:'P1', isAnonymous:false, email:'mate-ab12@tw.local' });
    const r2 = await Y.o.authSignupEnsure('mate-ab12@tw.local');
    chk(r2.ok && r2.authUid === 'P1' && !Y.log.includes('out'), '이미 그 코드로 승격된 세션(⑤ 에서 끊긴 판)도 이어 쓴다');
    const Z = await runFS({ uid:'G1', isAnonymous:false, email:'me@gmail.com' });
    const r3 = await Z.o.authSignupEnsure('mate-ab12@tw.local');
    chk(r3.ok && r3.authUid === 'ANON2' && Z.log.join(',') === 'out,anon', '★ 다른 세션(구글)은 놓고 익명으로 — 남의 계정에 비밀번호를 붙이지 않는다');
    const N = await runFS(null, { anonErr:'auth/admin-restricted-operation' });
    const r4 = await N.o.authSignupEnsure('x@tw.local');
    chk(!r4.ok && /익명/.test(r4.reason), '콘솔 [익명] 꺼짐 → 켜라는 안내');
  }
  if (fiS) {
    const X = await runFS({ uid:'ANON1', isAnonymous:true });
    const l = await X.o.authSignupLinkPassword('MATE-AB12', 'secret1');
    chk(l.ok && l.authUid === 'ANON1' && l.email === 'mate-ab12@tw.local', '★ ④ 익명 → {코드}@tw.local 승격 · authUid 그대로');
    const l2 = await X.o.authSignupLinkPassword('MATE-AB12', 'secret1');
    chk(l2.ok && X.log.filter(x => x.startsWith('link')).length === 1, '다시 불러도 한 번만 연결(재시도 안전)');
    const T = await runFS({ uid:'ANON1', isAnonymous:true }, { linkErr:'auth/email-already-in-use' });
    const l3 = await T.o.authSignupLinkPassword('MATE-AB12', 'secret1');
    chk(!l3.ok && l3.taken, '이미 가입된 코드 → taken');
    const W = await runFS({ uid:'ANON1', isAnonymous:true }, { linkErr:'auth/weak-password' });
    chk(/6자 이상/.test((await W.o.authSignupLinkPassword('MATE-AB12', '12345')).reason), '약한 비밀번호 → 안내');
  }
  if (fiS) {
    const X = await runFS({ uid:'ANON1', isAnonymous:true });
    const b = await X.o.authSignupBind('unew0000000001');
    chk(b.ok && X.rows['userAuth/unew0000000001'] === 'ANON1' && X.rows['authUsers/ANON1'].userCode === 'unew0000000001', '★ ⑤ userAuth 선점 → authUsers 줄');
    chk(!('email' in X.rows['authUsers/ANON1']), 'authUsers 에 이메일 거울을 두지 않는다(§9-2)');
    const b2 = await X.o.authSignupBind('unew0000000001');
    chk(b2.ok, '다시 불러도 내 것이면 통과');
    const Y = await runFS({ uid:'ANON1', isAnonymous:true }, { rows: { 'userAuth/unew0000000001':'SOMEONE' } });
    const b3 = await Y.o.authSignupBind('unew0000000001');
    chk(!b3.ok && b3.taken && !Y.log.some(x => x.startsWith('set:')), '남의 것이면 거절 · authUsers 안 씀');
  }

  /* ══ 7. I · 기존 사용자 가입 (CHECKS 개정 41) ══ */
  say('');
  say('【7】 I — 기존 사용자: 묶이지 않은 uid 만 · 오프라인은 쉼 · 지금 코드가 아이디 · uid 그대로');
  /* 끝은 다음 덩어리 머리까지 — 개정 43 에서 J · K 마크업이 I 와 «한 계정 한 기기» 사이에 들어왔다. */
  const iS = HTML.indexOf('<div id="existingSignupOverlay"');
  const iE = ['<!-- 🎉 J · J2', '<!-- 🖥️ 한 계정 한 기기'].map(m => HTML.indexOf(m, iS + 1)).filter(i => i > iS).sort((x, y) => x - y)[0] || -1;
  const IM = iS > 0 && iE > iS ? HTML.slice(iS, iE) : '';
  chk(!!IM, 'I 오버레이가 있다');
  chk(/친구 코드 가입이 필요해요/.test(IM) && /그대로 <b>아이디<\/b>가 되고, 비밀번호만 정하면 끝이에요/.test(IM) && /내 아이디/.test(IM), '시안 글자: 제목 · 안내 · 내 아이디');
  chk(/구글 계정으로 연결하기/.test(IM) && /하나도 바뀌지 않아요/.test(IM) && /id="exSignupOk" class="lc-btn"[^>]*>가입하기</.test(IM), '[가입하기] · [구글 계정으로 연결하기] · «하나도 바뀌지 않아요»');
  chk(/<span id="exSignupCode"/.test(IM) && !/<input[^>]*id="exSignupCode"/.test(IM), '아이디는 고정 표시');
  chk(!/닫기|취소|✕|×|id="exSignup(Close|Cancel)/.test(IM), '★ 닫기 없음');
  chk(/rgba\(0,0,0,\.45\)/.test(IM), '배경 반투명(뒤의 앱은 그대로)');
  chk(/#deviceSessionOverlay, #existingSignupOverlay,/.test(APP), '★ 클릭 통과 목록(UI_HIT_SEL)에 등록 — 없으면 투명 창에서 클릭이 빠진다');
  chk(/checkInviteGate\(\)\s*\.then\(\(\)=>\{ refreshInviteBtn\(\); return _existingSignupCheck\(\); \}\)/.test(APP), '초대 게이트를 지난 뒤 한 번 판정한다');
  chk(/const EXISTING_SIGNUP_ENABLED = true;/.test(APP), '스위치 켜짐');
  const needI = ['function getMyUserId(', 'function genFriendCodeCandidate(', 'function _signupPendingSave(', 'async function _signupClaimCode(',
    'async function _existingSignupCode(', 'async function _existingSignupNeed(', 'async function _existingSignupDoPassword('];
  const missI = needI.filter(h => !takeFn(APP, h));
  chk(missI.length === 0, 'I 함수들이 있다' + (missI.length ? ' — 없음: ' + missI.join(', ') : ''));
  if (missI.length === 0){
    function mkI(o){
      o = o || {};
      const st = Object.assign({ 'tw.myUserId':'uold00000000001', 'tw.myFriendCode':'MATE-OLD1' }, o.store || {}); const log = [];
      if (o.noUid) delete st['tw.myUserId'];
      const ls = { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
      const fc = Object.assign({ 'MATE-OLD1':'uold00000000001' }, o.fc || {});
      const api = {
        authReady: async () => {},
        authOwnerOf: async u => { log.push('owner'); return 'owner' in o ? o.owner : null; },
        lookupFriendCode: async c => { if (o.lookupThrow) throw new Error('net'); return fc[c] || null; },
        getUserFriendCode: async u => o.mirror || null,
        authSignupEnsure: async e => { log.push('ensure:' + e); return { ok:true, authUid:'ANON7', anonymous:true }; },
        registerFriendCode: async (c, u) => { log.push('claim:' + c); if (fc[c] && fc[c] !== u) return false; fc[c] = u; return true; },
        authSignupLinkPassword: async (c, p) => { log.push('link:' + c); return { ok:true, authUid:'ANON7', email:c.toLowerCase() + '@tw.local' }; },
        authSignupBind: async u => { log.push('bind:' + u); return o.bind || { ok:true, authUid:'ANON7' }; },
        setUserFriendCode: async (u, c) => { log.push('mirror:' + c); return true; },
        setAccountSnapshot: async (u, s) => { log.push('snap:' + u); return true; },
      };
      const w = { firebaseAPI: api };
      Object.defineProperty(globalThis, 'firebaseAPI', { get: () => w.firebaseAPI, configurable: true });
      const src4 = [
        "const MY_USER_ID_KEY = 'tw.myUserId'; const MY_FRIEND_CODE_KEY = 'tw.myFriendCode'; const LOGIN_EMAIL_KEY = 'tw.loginEmail'; const LOGIN_UID_KEY = 'tw.loginUid'; const SIGNUP_PENDING_KEY = 'tw.signupPending';",
        "const EXISTING_SIGNUP_ENABLED = " + (o.off ? 'false' : 'true') + ";",
        "function _loginLocalSnapshot(){ return { v:1 }; }",
        ...needI.map(h => takeFn(APP, h)),
        'return { need:_existingSignupNeed, go:_existingSignupDoPassword };',
      ].join('\n');
      const X = (new Function('localStorage', 'window', 'log', src4))(ls, w, log);
      return { X, st, log, fc };
    }
    chk((await mkI({ noUid:true }).X.need()) === null, 'uid 없는 기기(처음 쓰는 PC) → 안 띄운다(H·A 몫)');
    chk((await mkI({ off:true }).X.need()) === null, '스위치를 끄면 안 띄운다');
    chk((await mkI({ owner:undefined }).X.need()) === null, '★ userAuth 를 못 읽으면(오프라인) 이번엔 안 띄운다');
    chk((await mkI({ owner:'SOMEAUTH' }).X.need()) === null, '★ 이미 어떤 계정에 묶인 uid → I 아님');
    const n1 = await mkI().X.need();
    chk(n1 && n1.uid === 'uold00000000001' && n1.code === 'MATE-OLD1' && n1.mine === true, '★ 묶이지 않은 uid → 띄운다 · 이 기기 코드(내 것)가 아이디');
    const n2 = await mkI({ fc:{ 'MATE-OLD1':'usomeoneelse01', 'MATE-MIR1':'uold00000000001' }, mirror:'MATE-MIR1' }).X.need();
    chk(n2 && n2.code === 'MATE-MIR1' && n2.mine, '이 기기 코드가 남의 것이면 계정 거울 코드(내 것)');
    const n3 = await mkI({ fc:{ 'MATE-OLD1':'usomeoneelse01' } }).X.need();
    chk(n3 && /^MATE-[A-Z0-9]{4}$/.test(n3.code) && n3.mine === false, '내 코드가 없으면 새 후보(가입 때 선점)');
    chk((await mkI({ lookupThrow:true }).X.need()) === null, '코드 주인을 못 읽으면 이번엔 쉰다');
    {
      const E = mkI(); const s0 = await E.X.need();
      const r = await E.X.go(s0, 'secret1');
      const ord = E.log.filter(x => x !== 'owner').map(x => x.split(':')[0]).join(' → ');
      chk(r.ok && ord === 'ensure → link → bind → mirror → snap', '★ 순서: 익명 → ④ → ⑤ → 거울 → 스냅샷 · 선점 없음(이미 내 코드) (' + ord + ')');
      chk(E.log.includes('bind:uold00000000001') && E.st['tw.myUserId'] === 'uold00000000001', '★ 이 uid 를 결속 · uid 는 그대로');
      chk(E.st['tw.loginEmail'] === 'mate-old1@tw.local' && E.st['tw.loginUid'] === 'ANON7', '로그인 표시 = {코드}@tw.local');
      chk(!('tw.signupPending' in E.st), 'I 는 가입 상태 키를 안 쓴다');
    }
    {
      const E = mkI({ fc:{ 'MATE-OLD1':'usomeoneelse01' } }); const s0 = await E.X.need();
      E.fc[s0.code] = 'uthief0000001';   // 보여 준 후보를 그 사이 누가 가져감
      const r = await E.X.go(s0, 'secret1');
      chk(r.ok && r.changed && r.code !== 'MATE-OLD1' && E.st['tw.myFriendCode'] === r.code && E.fc[r.code] === 'uold00000000001', '내 코드가 없던 판: 선점 · 뺏기면 새 코드 · 이 기기 코드도 고친다');
      chk(!('tw.signupPending' in E.st), '★ 그때도 가입 상태 키를 안 쓴다(persist=false)');
    }
    {
      const E = mkI({ bind:{ ok:false, taken:true, reason:'이 아이디는 이미 다른 계정에 연결돼 있어요' } }); const s0 = await E.X.need();
      const r = await E.X.go(s0, 'secret1');
      chk(!r.ok && !('tw.loginEmail' in E.st) && !E.log.some(x => x.startsWith('snap')), '결속 실패 → 로그인 표시·스냅샷 없음');
    }
  }

  /* ══ 8. ⑥ 친구 코드 거울 정정 (CHECKS 개정 42) ══ */
  say('');
  say('【8】 ⑥ 거울 정정 — 로컬만 고친다 · friendCodes 쓰기 0 · 내 것일 때만 · 발급보다 먼저');
  const EN = takeFn(APP, 'async function ensureMyFriendCode(') || '';
  const MF = takeFn(APP, 'async function _friendCodeMirrorFix(') || '';
  chk(!!MF && /_friendCodeMirrorFix\(\)/.test(EN) && EN.indexOf('_friendCodeMirrorFix') < EN.indexOf('registerFriendCode'), '★ ensureMyFriendCode 첫머리에서 부른다(발급보다 먼저)');
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
      chk(c === 'MATE-NEW1' && E.log.includes('register:MATE-NEW1'), '거울도 없으면 예전처럼 발급한다');
    }
  }

  /* ══ 9. J · J2 가입 완료 · K 로그인 필요 (CHECKS 개정 43 · 설계 (가)) ══ */
  say('');
  say('【9】 J · J2 · K — 되찾기 코드 없음 · [시작하기] A 재시작 · I 닫기 · K 는 묶였는데 다른 세션일 때만');
  const cut = (startMark, ends) => { const a = HTML.indexOf(startMark); if (a < 0) return ''; const b = ends.map(m => HTML.indexOf(m, a + 1)).filter(i => i > a).sort((x, y) => x - y)[0]; return b ? HTML.slice(a, b) : ''; };
  const JM = cut('<div id="signupDoneOverlay"', ['<!-- 🔐 K ·', '<!-- 🖥️ 한 계정 한 기기']);
  const KM = cut('<div id="needLoginOverlay"', ['<!-- 🖥️ 한 계정 한 기기']);
  chk(!!JM && /가입 완료/.test(JM) && /id="sdCode"/.test(JM) && /로그인돼 있는 PC<\/b>의 \[내 정보 › 계정\]에서 새로 바꿀 수 있어요/.test(JM), 'J: 제목 · 아이디 · «로그인돼 있는 PC 에서 바꾸기» (시안)');
  chk(/⚠ 구글 연결 없이 비밀번호를 잊으면 계정을 되찾을 수 없어요\.<br>구글도 연결해 두면 안전해요\./.test(JM), 'J: 경고 두 줄 — 시안에서 고친 글자 그대로');
  chk(/id="sdStart" class="lc-btn"[^>]*>시작하기</.test(JM) && /id="sdGoogle" class="lc-btn ghost"/.test(JM) && /구글도 연결하기/.test(JM), 'J: [시작하기] · 보조 [구글도 연결하기]');
  chk(/id="sdGoogleNote"[\s\S]*비밀번호는 아직 없어요\. 계정 탭에서 비밀번호를 붙이면/.test(JM), 'J2: «비밀번호는 아직 없어요» 줄');
  chk(!/되찾기 코드/.test(JM.replace(/<!--[\s\S]*?-->/g, '')) && !/되찾기 코드/.test((AM || '').replace(/<!--[\s\S]*?-->/g, '')), '★ (가) — A · J 화면에 «되찾기 코드» 글자가 없다');
  chk(!!KM && /이 PC는 로그인이 필요해요/.test(KM) && /다른 PC에서 비밀번호를 바꿨다면 새 비밀번호로 로그인해 주세요/.test(KM) && /<span id="nlCode"/.test(KM), 'K: 제목 · 두 안내 · 아이디 고정');
  chk(/구글로 로그인/.test(KM) && /또는 비밀번호로/.test(KM) && /id="nlPw" type="password"/.test(KM) && /친구 코드로 로그인/.test(KM) && /비밀번호를 잊었어요/.test(KM) && /id="nlForgotBox" style="display:none;/.test(KM), 'K: 구글 · 비밀번호 · [친구 코드로 로그인] · 잊었어요(접힌 안내)');
  chk(!/닫기|취소|✕|×/.test(KM.replace(/<!--[\s\S]*?-->/g, '')) && /rgba\(0,0,0,\.45\)/.test(KM), '★ K: 닫기 없음 · 반투명');
  chk(/#signupDoneOverlay, #needLoginOverlay,/.test(APP), '★ 두 오버레이가 클릭 통과 목록(UI_HIT_SEL)에');
  chk(/\.then\(shownI => \(shownI \? true : _needLoginCheck\(\)\)\)/.test(APP), 'I 가 안 떴을 때만 K 를 본다');
  const Adone = (SG.match(/const done = async \(r, how\) => \{[\s\S]*?\n      \};/) || [''])[0];
  chk(/_showSignupDone\(\{ code:r\.code, google: how === 'google'/.test(Adone) && Adone.indexOf('_showSignupDone') < Adone.lastIndexOf('_acctRelaunchAfterDetach'), '★ A: 완료 화면 → [시작하기] 뒤 재시작 · 구글이면 J2');
  chk(/done\(r, 'password'\)/.test(SG) && /done\(r, 'google'\)/.test(SG), 'A: 두 길이 각자 알린다');
  const Ish = takeFn(APP, 'function _showExistingSignup(') || '';
  const Igo = (Ish.match(/const goPw = async \(\)=>\{[\s\S]*?\n    \};/) || [''])[0];
  chk(/_showSignupDone\(\{ code:r\.code, google:false, changed:!!r\.changed, dim:true \}\)/.test(Igo) && !/_acctRelaunchAfterDetach/.test(Igo), '★ I: 완료 화면(반투명) → 닫기 · 재시작 없음(uid 그대로)');
  const fiL0 = FI.indexOf('    async authLinkGoogle(');
  const fiL = fiL0 >= 0 ? FI.slice(fiL0, FI.indexOf('    async authSignOut()', fiL0)) : '';
  chk(/linkWithCredential\(auth\.currentUser, GoogleAuthProvider\.credential\(idToken\)\)/.test(fiL) && !/signInWithCredential/.test(fiL), '★ [구글도 연결하기] = 지금 세션에 붙이기(로그인을 바꾸지 않는다)');

  const nlF = takeFn(APP, 'async function _needLoginNeed(');
  chk(!!nlF, '_needLoginNeed 가 있다');
  if (nlF){
    async function runNL(o){
      const st = Object.assign({ 'tw.myUserId':'ume0000000001', 'tw.myFriendCode':'MATE-LOC1' }, o.store || {});
      if (o.noUid) delete st['tw.myUserId'];
      const ls = { getItem: k => (k in st ? st[k] : null), setItem(){}, removeItem(){} };
      const api = { authReady: async () => {}, authOwnerOf: async () => o.owner, authCurrentUid: () => o.cur || null, getUserFriendCode: async () => o.mirror || null };
      const w = { firebaseAPI: api };
      Object.defineProperty(globalThis, 'firebaseAPI', { get: () => w.firebaseAPI, configurable: true });
      const f = (new Function('localStorage', 'window', "const MY_USER_ID_KEY='tw.myUserId'; const MY_FRIEND_CODE_KEY='tw.myFriendCode';\n" + takeFn(APP, 'function getMyUserId(') + '\n' + nlF + '\nreturn _needLoginNeed;'))(ls, w);
      return await f();
    }
    chk((await runNL({ noUid:true, owner:'A1' })) === null, 'uid 없음 → K 아님(H 몫)');
    chk((await runNL({ owner:undefined })) === null, '★ 못 읽음(오프라인) → 안 띄운다');
    chk((await runNL({ owner:null })) === null, '안 묶인 uid → K 아님(I 몫)');
    chk((await runNL({ owner:'A1', cur:'A1' })) === null, '★ 이미 그 계정으로 로그인 → 안 띄운다');
    const k1 = await runNL({ owner:'A1', cur:null, mirror:'MATE-ACC1' });
    chk(k1 && k1.code === 'MATE-ACC1', '★ 묶였는데 로그인 안 됨 → 띄운다 · 아이디 = 계정 거울');
    const k2 = await runNL({ owner:'A1', cur:'OTHER', mirror:null });
    chk(k2 && k2.code === 'MATE-LOC1', '다른 세션(끊긴 판) → 띄운다 · 거울이 없으면 이 기기 코드');
  }

  const sdF = takeFn(APP, 'function _showSignupDone(');
  chk(!!sdF, '_showSignupDone 이 있다');
  if (sdF){
    function fakeDom(){
      const els = {};
      const mk = () => ({ style:{ display:'' }, textContent:'', innerHTML:'', disabled:false, onclick:null, focus(){} });
      ['signupDoneOverlay','sdIntro','sdCode','sdPwNote','sdWarn','sdGoogleNote','sdMsg','sdStart','sdGoogle'].forEach(i => els[i] = mk());
      return { els, doc:{ getElementById: i => els[i] || null } };
    }
    const runSD = (opts, win) => {
      const D = fakeDom();
      const f = (new Function('document', 'window', 'setTimeout', sdF + '\nreturn _showSignupDone;'))(D.doc, win || {}, () => {});
      Object.defineProperty(globalThis, 'companion', { get: () => (win || {}).companion, configurable: true });
      Object.defineProperty(globalThis, 'firebaseAPI', { get: () => (win || {}).firebaseAPI, configurable: true });
      const p = f(opts);
      return { D, p };
    };
    {
      const { D, p } = runSD({ code:'MATE-WXYZ', google:false, dim:false });
      const e = D.els;
      chk(e.signupDoneOverlay.style.display === 'flex' && e.sdCode.textContent === 'MATE-WXYZ' && e.signupDoneOverlay.style.background === '#3a6ea5', 'J: 뜬다 · 아이디 · A 는 불투명');
      chk(e.sdPwNote.style.display === 'block' && e.sdWarn.style.display === 'block' && e.sdGoogle.style.display === 'block' && e.sdGoogleNote.style.display === 'none', 'J: 비밀번호 안내 · 경고 · [구글도 연결하기] 보이고 J2 줄은 숨김');
      let done = false; p.then(() => { done = true; });
      await Promise.resolve(); chk(!done, '[시작하기] 전에는 안 풀린다');
      e.sdStart.onclick(); await new Promise(r => setImmediate(r));
      chk(done && e.sdStart.disabled, '★ [시작하기] 를 누르면 풀린다(부르는 쪽이 재시작 · 닫기)');
    }
    {
      const { D } = runSD({ code:'MATE-WXYZ', google:true, dim:true });
      const e = D.els;
      chk(e.sdGoogleNote.style.display === 'block' && e.sdWarn.style.display === 'none' && e.sdGoogle.style.display === 'none' && e.sdPwNote.style.display === 'none', 'J2: «비밀번호는 아직 없어요» 만 · 경고 · 구글 버튼 없음');
      chk(/구글로 로그인/.test(e.sdIntro.innerHTML) && e.signupDoneOverlay.style.background === 'rgba(0,0,0,.45)', 'J2 안내 · dim 이면 반투명(I)');
    }
    {
      let linked = null;
      const win = { companion:{ signInWithGoogle: async () => ({ ok:true, idToken:'TOK' }) }, firebaseAPI:{ authLinkGoogle: async t => { linked = t; return { ok:true, email:'me@gmail.com' }; } } };
      const { D } = runSD({ code:'MATE-WXYZ' }, win);
      await D.els.sdGoogle.onclick(); 
      chk(linked === 'TOK' && D.els.sdWarn.style.display === 'none' && /구글 연결됨/.test(D.els.sdGoogle.textContent), '[구글도 연결하기] 성공 → 경고를 거두고 «연결됨»');
      const win2 = { companion:win.companion, firebaseAPI:{ authLinkGoogle: async () => ({ ok:false, reason:'이 구글 계정은 이미 다른 계정에 쓰이고 있어요' }) } };
      const R = runSD({ code:'MATE-WXYZ' }, win2);
      await R.D.els.sdGoogle.onclick();
      chk(/이미 다른 계정/.test(R.D.els.sdMsg.textContent) && R.D.els.sdWarn.style.display === 'block' && !R.D.els.sdGoogle.disabled, '실패 → 안내 · 경고 그대로 · 다시 누를 수 있다');
    }
  }

  /* ══ 10. C3 · C2 ══ */
  say('');
  say('【10】 C3 · C2 — 로그인 수단 · 비밀번호 만들기(함수 없음) · 바꾸기(함수 changePassword · 지금 비밀번호 안 물음)');
  {
    const noCm = s => String(s || '').replace(/<!--[\s\S]*?-->/g, '');
    /* ★ 개정 45 — 계정 탭이 [내 정보 › 계정](#miPageAcct · C4)으로 옮겨 갔다. 자리 판정만 새 집으로(나머지 무변경). */
    const iTab = HTML.indexOf('id="miPageAcct"'), iIn = HTML.indexOf('<div id="acctLoggedIn"'), iAM = HTML.indexOf('<div id="acctMethods"'), iLo = HTML.indexOf('<button id="acctLogoutBtn"');
    chk(iTab > 0 && iIn > iTab && iAM > iIn && iLo > iAM, '구획 자리: [내 정보 › 계정] › 로그인 후 얼굴 안 · [로그아웃] 위(시안 순서)');
    const AC = noCm(HTML.slice(iAM, HTML.indexOf('<div id="acctMOff"', iAM)));
    chk(/로그인 수단/.test(AC) && /<span>구글<\/span>/.test(AC) && /친구 코드 <b id="acctMCode"/.test(AC) && /id="acctMGoogleLink"[^>]*>연결하기</.test(AC), '로그인 수단: 구글(연결됨 · [연결하기]) · 친구 코드 줄');
    chk(/비밀번호를 만들면 구글 없이도 친구 코드로 로그인할 수 있어요\./.test(AC), 'C3 안내 한 줄(시안)');
    chk(/⚠ 구글이 연결돼 있지 않아요\. 이 PC의 로그인이 풀린 채로 비밀번호를 잊으면 계정을 되찾을 수 없어요\./.test(AC), 'C2 경고(시안)');
    chk(/지금 비밀번호는 묻지 않아요 — 이 PC가 로그인돼 있는 것으로 확인해요\. 바꾸면 <b>다른 PC는 새 비밀번호로 다시 로그인<\/b>해야 해요\./.test(AC), 'C2 안내(시안)');
    chk(count(AC, /type="password"/g) === 2 && /id="acctPw1" type="password" placeholder="6자 이상" maxlength="40"/.test(AC) && /id="acctPw2" type="password" placeholder="한 번 더" maxlength="40"/.test(AC), '★ 비밀번호 칸은 둘뿐(새 비밀번호 · 확인) — 지금 비밀번호 칸 없음');
    chk(!/되찾기 코드/.test(AC), '★ (가) — «되찾기 코드» 글자 없음');
    const csp = HTML.match(/<meta http-equiv="Content-Security-Policy" content="[^"]*"/g) || [];
    const reg = (FI.match(/const FUNCTIONS_REGION = '([a-z0-9-]+)'/) || [])[1];
    chk(csp.length === 2 && reg && csp.every(m => m.includes(`https://${reg}-together-working.cloudfunctions.net`)) && !csp.some(m => /\*\.cloudfunctions\.net/.test(m)), `★ CSP 두 줄 connect-src 에 함수 호스트(${reg}) · 와일드카드 아님`);
    chk(reg === 'asia-southeast1', '함수 리전 = RTDB 리전(asia-southeast1 · firebase-config databaseURL)');

    const pos = n => FI.indexOf(n);
    const iSO = pos('    async authSignOut()'), iFC = pos('    async authSignInWithFriendCode(');
    const iPv = pos('    authProviders(){'), iLP = pos('    async authLinkPassword('), iRG = pos('    async authReauthGoogle('), iCP = pos('    async authChangePassword(');
    chk(iFC > 0 && iSO > iFC && iPv > iSO && iLP > iPv && iRG > iLP && iCP > iRG, '★ 새 통로 넷은 authSignOut 뒤(5·6·9절 떼어 오기 경계 무변경)');
    chk(!/from "https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-functions\.js"/.test(FI), '★ 함수 SDK 는 머리에서 import 하지 않는다(오프라인 첫 부팅에 모듈 전체가 죽지 않게)');
    const vApp = (FI.match(/firebasejs\/([\d.]+)\/firebase-app\.js/) || [])[1];
    chk(!!vApp && FI.includes(`const FUNCTIONS_SDK_URL = 'https://www.gstatic.com/firebasejs/${vApp}/firebase-functions.js'`), `함수 SDK 판 = firebase-app 판(${vApp})`);
    const fLP = takeFn(FI, 'async authLinkPassword('), fRG = takeFn(FI, 'async authReauthGoogle('), fCP = takeFn(FI, 'async authChangePassword('), fPO = takeFn(FI, 'function _providersOf(');
    chk(fLP && /linkWithCredential\(cu, EmailAuthProvider\.credential\(email/.test(fLP) && !/signIn/.test(fLP), 'C3 = 지금 세션에 붙이기(linkWithCredential · 로그인 안 바꿈)');
    chk(fRG && /reauthenticateWithCredential\(auth\.currentUser, GoogleAuthProvider\.credential\(idToken\)\)/.test(fRG) && !/signInWithCredential/.test(fRG), '재인증은 세션을 바꾸지 않는다');
    chk(/reauthenticateWithCredential/.test(FI.slice(0, FI.indexOf('from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"'))), 'reauthenticateWithCredential 를 들여온다');

    if (fLP && fRG && fCP && fPO){
      const mkFI = (o) => {
        const L = { links:[], reauth:[], calls:[], signs:[], imports:0 };
        const auth = { currentUser: o.cu === undefined ? null : o.cu };
        const env = {
          auth, fbApp:{ app:1 }, FUNCTIONS_REGION:'asia-southeast1', FUNCTIONS_SDK_URL:'SDK',
          EmailAuthProvider:{ credential:(e, p) => ({ e, p }) },
          GoogleAuthProvider:{ credential:t => ({ t }) },
          linkWithCredential: async (u, c) => { L.links.push(c); if (o.linkErr) { const x = o.linkErr.shift(); if (x) throw { code:x }; } return { user:u }; },
          reauthenticateWithCredential: async (u, c) => { L.reauth.push(c.t); if (o.reErr) throw { code:o.reErr }; return {}; },
          signInWithEmailAndPassword: async (a, e, p) => { L.signs.push([e, p]); if (o.signErr) throw { code:'x' }; return { user:{ uid:(auth.currentUser || {}).uid } }; },
          __import: async u => { L.imports++; if (o.impErr) throw new Error('offline'); return {
            getFunctions:(app, reg) => ({ app, reg }),
            httpsCallable:(fns, name) => async data => { L.calls.push({ reg:fns.reg, name, data }); if (o.callErr) throw { code:'functions/' + o.callErr }; return { data:{ ok:true } }; } }; },
        };
        const names = Object.keys(env);
        const body = fPO + '\nreturn { ' + [fLP, fRG, fCP].map(s => s.replace(/import\(FUNCTIONS_SDK_URL\)/g, '__import(FUNCTIONS_SDK_URL)')).join(',\n') + ' };';
        const api = (new Function(...names, body))(...names.map(n => env[n]));
        return { api, L };
      };
      const gU = { uid:'AU1', isAnonymous:false, providerData:[{ providerId:'google.com', email:'me@gmail.com' }] };
      const pU = { uid:'AU1', isAnonymous:false, providerData:[{ providerId:'password', email:'mate-wxyz@tw.local' }] };
      let T = mkFI({});
      chk(!(await T.api.authLinkPassword('MATE-WXYZ', 'abcdef')).ok && T.L.links.length === 0, 'C3 통로: 세션 없음 → 거절');
      T = mkFI({ cu:{ uid:'A', isAnonymous:true, providerData:[] } });
      chk(!(await T.api.authLinkPassword('MATE-WXYZ', 'abcdef')).ok && T.L.links.length === 0, '익명 세션 → 거절');
      T = mkFI({ cu:pU });
      const r0 = await T.api.authLinkPassword('MATE-WXYZ', 'abcdef');
      chk(!r0.ok && r0.already && T.L.links.length === 0, '이미 비밀번호 있음 → already(C2 몫) · 붙이지 않음');
      T = mkFI({ cu:gU });
      const r1 = await T.api.authLinkPassword('MATE-WXYZ', 'abcdef');
      chk(r1.ok && r1.email === 'mate-wxyz@tw.local' && T.L.links[0].e === 'mate-wxyz@tw.local' && T.L.links[0].p === 'abcdef', '★ C3 성공 → {코드 소문자}@tw.local + 비밀번호를 붙인다');
      T = mkFI({ cu:gU, linkErr:['auth/requires-recent-login'] });
      const r2 = await T.api.authLinkPassword('MATE-WXYZ', 'abcdef');
      chk(!r2.ok && r2.needReauth, '★ 오래된 로그인 → needReauth');
      T = mkFI({ cu:gU, linkErr:['auth/email-already-in-use'] });
      chk((await T.api.authLinkPassword('MATE-WXYZ', 'abcdef')).taken, '그 이메일이 남의 계정 → taken');
      T = mkFI({ cu:gU, reErr:'auth/user-mismatch' });
      const r3 = await T.api.authReauthGoogle('TOK');
      chk(!r3.ok && /연결된 구글/.test(r3.reason) && T.L.reauth[0] === 'TOK', '재인증: 다른 구글 → 안내');

      T = mkFI({});
      chk(!(await T.api.authChangePassword('abcdef')).ok && T.L.imports === 0, 'C2 통로: 세션 없음 → 거절 · 함수 안 부름');
      T = mkFI({ cu:gU });
      chk(/먼저 비밀번호를 만들어/.test((await T.api.authChangePassword('abcdef')).reason) && T.L.imports === 0, '비밀번호 없는 계정 → 거절(C3 먼저) · 함수 안 부름');
      T = mkFI({ cu:pU });
      chk(!(await T.api.authChangePassword('abc')).ok && T.L.imports === 0, '6자 미만 → 함수 안 부름');
      T = mkFI({ cu:pU, impErr:true });
      chk(/네트워크/.test((await T.api.authChangePassword('abcdef')).reason), 'SDK 못 받음 → 네트워크 안내');
      T = mkFI({ cu:pU, callErr:'not-found' });
      const r4 = await T.api.authChangePassword('abcdef');
      chk(!r4.ok && /함수 배포 전/.test(r4.reason) && T.L.signs.length === 0, '★ 함수 없음(not-found) → «배포 전» · 다시 로그인 안 함');
      T = mkFI({ cu:pU });
      const r5 = await T.api.authChangePassword('newpw1');
      chk(r5.ok && r5.relogged && T.L.calls.length === 1 && T.L.calls[0].name === 'changePassword' && T.L.calls[0].reg === 'asia-southeast1' && T.L.calls[0].data.password === 'newpw1' && Object.keys(T.L.calls[0].data).length === 1,
        '★ 성공 → changePassword(asia-southeast1) 에 새 비밀번호만 보낸다(지금 비밀번호 없음)');
      chk(T.L.signs.length === 1 && T.L.signs[0][0] === 'mate-wxyz@tw.local' && T.L.signs[0][1] === 'newpw1', '★ 뒤이어 password 제공자 이메일 + 새 비밀번호로 다시 로그인');
      T = mkFI({ cu:pU, signErr:true });
      const r6 = await T.api.authChangePassword('newpw1');
      chk(r6.ok && r6.relogged === false, '다시 로그인 실패해도 바꾸기는 성공(relogged:false)');
    }

    const fMode = takeFn(APP, 'function _acctMethodsMode('), fChk = takeFn(APP, 'function _acctPwCheck('), fCode = takeFn(APP, 'async function _acctPwCode('),
          fCreate = takeFn(APP, 'async function _acctCreatePassword('), fChange = takeFn(APP, 'async function _acctChangePassword('), fRender = takeFn(APP, 'async function _acctMethodsRender(');
    chk(fMode && fChk && fCode && fCreate && fChange && fRender, 'app.js: _acctMethodsMode · _acctPwCheck · _acctPwCode · _acctCreatePassword · _acctChangePassword · _acctMethodsRender');
    chk(/_acctMethodsRender\(\)/.test(takeFn(APP, 'function refreshAccountTab(') || ''), '계정 탭을 열 때마다 다시 그린다(refreshAccountTab)');
    if (fMode && fChk && fCode && fCreate && fChange && fRender){
      const M = (new Function(fMode + '\nreturn _acctMethodsMode;'))();
      chk(M(null).mode === 'off', '세션 없음 → off(«다시 시작하면 로그인 화면» 한 줄)');
      chk(M({ anonymous:true }).mode === 'none', '익명 → 숨김');
      const m3 = M({ google:true, password:false });
      chk(m3.mode === 'c3' && !m3.warn, '★ 구글만 → C3');
      const m2 = M({ google:false, password:true, passwordEmail:'mate-9k2m@tw.local' });
      chk(m2.mode === 'c2' && m2.warn && !m2.google && m2.code === 'MATE-9K2M', '★ 비밀번호만 → C2 · 경고 · 아이디 = 로그인 이메일에서');
      const m22 = M({ google:true, password:true, passwordEmail:'mate-9k2m@tw.local' });
      chk(m22.mode === 'c2' && !m22.warn && m22.google, '둘 다 → C2 · 경고 없음');
      const C = (new Function(fChk + '\nreturn _acctPwCheck;'))();
      chk(!C('abc', 'abc').ok && C('abc', 'abc').focus === 1 && !C('abcdef', 'abcdeg').ok && C('abcdef', 'abcdeg').focus === 2 && C('abcdef', 'abcdef').ok, '입력 검사: 6자 · 서로 같음');

      const mkApp = (o) => {
        const L = { link:[], reauth:[], google:0, change:[] };
        const st = Object.assign({ 'tw.myUserId':'ume0000000001', 'tw.myFriendCode':'MATE-LOC1' }, o.store || {});
        if (o.noUid) delete st['tw.myUserId'];
        const ls = { getItem:k => (k in st ? st[k] : null), setItem(){}, removeItem(){} };
        const owners = o.owners || {};
        const api = {
          getUserFriendCode: async () => o.mirror || null,
          lookupFriendCode: async c => { if (o.lookupThrow) throw new Error('x'); return owners[c] || null; },
          authLinkPassword: async (c, p) => { L.link.push([c, p]); return (o.linkSeq && o.linkSeq.length) ? o.linkSeq.shift() : { ok:true, email:c.toLowerCase() + '@tw.local' }; },
          authReauthGoogle: async t => { L.reauth.push(t); return o.reauth || { ok:true }; },
          authChangePassword: async p => { L.change.push(p); return o.change || { ok:true, relogged:true }; },
        };
        const w = { firebaseAPI:api, companion:{ signInWithGoogle: async () => { L.google++; return o.g || { ok:true, idToken:'GT' }; } } };
        Object.defineProperty(globalThis, 'firebaseAPI', { get: () => w.firebaseAPI, configurable: true });
        Object.defineProperty(globalThis, 'companion', { get: () => w.companion, configurable: true });
        const src = "const MY_USER_ID_KEY='tw.myUserId'; const MY_FRIEND_CODE_KEY='tw.myFriendCode'; const FRIEND_CODE_LOGIN_RE=/^[A-Z]{4}-[A-Z0-9]{4}$/;\n"
          + takeFn(APP, 'function getMyUserId(') + '\n' + fCode + '\n' + fCreate + '\n' + fChange + '\nreturn { _acctPwCode, _acctCreatePassword, _acctChangePassword };';
        return { F:(new Function('localStorage', 'window', src))(ls, w), L };
      };
      let A = mkApp({ mirror:'MATE-ACC1', owners:{ 'MATE-ACC1':'ume0000000001' } });
      chk((await A.F._acctPwCode()).code === 'MATE-ACC1', 'C3 아이디: 계정 거울이 내 것 → 그 코드');
      A = mkApp({ mirror:'MATE-OTH1', owners:{ 'MATE-OTH1':'uother', 'MATE-LOC1':'ume0000000001' } });
      chk((await A.F._acctPwCode()).code === 'MATE-LOC1', '거울이 남의 것 → 이 기기 코드(내 것일 때)');
      A = mkApp({ mirror:'MATE-OTH1', owners:{ 'MATE-OTH1':'uother', 'MATE-LOC1':'uother' } });
      const rc = await A.F._acctCreatePassword('abcdef');
      chk(!rc.ok && A.L.link.length === 0, '★ 내 코드를 못 찾음 → 붙이지 않는다(남의 코드로 @tw.local 을 만들지 않음)');
      A = mkApp({ store:{ 'tw.myFriendCode':'bad' }, owners:{ bad:'ume0000000001' } });
      chk(!(await A.F._acctPwCode()).ok, '모양이 틀린 코드는 건너뛴다');
      A = mkApp({ lookupThrow:true });
      chk(/네트워크/.test((await A.F._acctPwCode()).reason), '못 읽음 → 네트워크 안내');
      A = mkApp({ noUid:true });
      chk(!(await A.F._acctPwCode()).ok, 'uid 없음 → 거절');
      A = mkApp({ owners:{ 'MATE-LOC1':'ume0000000001' } });
      const c1 = await A.F._acctCreatePassword('abcdef');
      chk(c1.ok && c1.code === 'MATE-LOC1' && A.L.link.length === 1 && A.L.link[0][0] === 'MATE-LOC1' && A.L.google === 0, 'C3 성공 — 한 번에 붙임 · 구글 창 안 엶');
      A = mkApp({ owners:{ 'MATE-LOC1':'ume0000000001' }, linkSeq:[{ ok:false, needReauth:true }, { ok:true, email:'mate-loc1@tw.local' }] });
      const c2 = await A.F._acctCreatePassword('abcdef');
      chk(c2.ok && A.L.link.length === 2 && A.L.google === 1 && A.L.reauth[0] === 'GT', '★ 오래된 로그인 → 구글 재인증 → 한 번 더 붙임');
      A = mkApp({ owners:{ 'MATE-LOC1':'ume0000000001' }, linkSeq:[{ ok:false, needReauth:true }], g:{ ok:false, reason:'' } });
      const c3r = await A.F._acctCreatePassword('abcdef');
      chk(!c3r.ok && c3r.canceled && A.L.reauth.length === 0 && A.L.link.length === 1, '구글 창을 닫음 → 조용히 멈춤(재인증·재시도 없음)');
      A = mkApp({ owners:{ 'MATE-LOC1':'ume0000000001' }, linkSeq:[{ ok:false, needReauth:true }], reauth:{ ok:false, reason:'이 계정에 연결된 구글 계정으로 골라 주세요' } });
      const c4 = await A.F._acctCreatePassword('abcdef');
      chk(!c4.ok && /연결된 구글/.test(c4.reason) && A.L.link.length === 1, '재인증 실패 → 다시 붙이지 않음');
      A = mkApp({ change:{ ok:true, relogged:false } });
      const c5 = await A.F._acctChangePassword('newpw1');
      chk(c5.ok && c5.relogged === false && A.L.change[0] === 'newpw1', 'C2 — 함수 통로 결과를 그대로 넘긴다');

      /* 그리기(가짜 DOM) */
      const ids = ['acctMethods','acctMOff','acctPw1','acctPw2','acctPwMsg','acctMGoogleOk','acctMGoogleLink','acctMCode','acctMPwState','acctMNote','acctMWarn','acctPwTitle','acctPwL1','acctPwL2','acctPwBtn','acctPwHint'];
      const runR = async (pv, logged, keep) => {
        const els = {}; ids.forEach(i => els[i] = { style:{ display:'' }, textContent:'', value:'x', disabled:true });
        const doc = { getElementById:i => els[i] || null };
        const w = { firebaseAPI:{ authReady: async () => {}, authProviders: () => pv } };
        Object.defineProperty(globalThis, 'firebaseAPI', { get: () => w.firebaseAPI, configurable: true });
        const ls = { getItem:k => (k === 'tw.myFriendCode' ? 'MATE-LOC1' : null) };
        const f = (new Function('document', 'window', 'localStorage', "const MY_FRIEND_CODE_KEY='tw.myFriendCode'; let _acctMethodsLast=null; const getMyLoginEmail=()=>" + JSON.stringify(logged ? 'me@gmail.com' : null) + ';\n' + fMode + '\n' + fRender + '\nreturn _acctMethodsRender;'))(doc, w, ls);
        const m = await f(keep);
        return { m, e:els };
      };
      let R = await runR({ google:true, password:false }, true);
      chk(R.e.acctMethods.style.display === 'block' && R.e.acctPwTitle.textContent === '비밀번호 만들기' && R.e.acctPwBtn.textContent === '비밀번호 만들기' && R.e.acctPwL1.textContent === '비밀번호' && R.e.acctMPwState.textContent === '비밀번호 없음' && R.e.acctMNote.style.display === 'block' && R.e.acctPwHint.style.display === 'none' && R.e.acctMCode.textContent === 'MATE-LOC1', '★ C3 그림: 제목·버튼 «비밀번호 만들기» · «비밀번호 없음» · 안내 줄');
      chk(R.e.acctMGoogleOk.style.display === 'inline' && R.e.acctMGoogleLink.style.display === 'none' && R.e.acctMWarn.style.display === 'none', 'C3: 구글 연결됨 · 경고 없음');
      chk(R.e.acctPw1.value === '' && R.e.acctPw1.disabled === false && R.e.acctPwMsg.style.display === 'none', '탭을 열면 입력·안내를 비운다');
      R = await runR({ google:false, password:true, passwordEmail:'mate-9k2m@tw.local' }, true);
      chk(R.e.acctPwTitle.textContent === '비밀번호 바꾸기' && R.e.acctPwL1.textContent === '새 비밀번호' && R.e.acctPwL2.textContent === '새 비밀번호 확인' && R.e.acctPwHint.style.display === 'block' && R.e.acctMPwState.textContent === '연결됨' && R.e.acctMCode.textContent === 'MATE-9K2M', '★ C2 그림: «비밀번호 바꾸기» · 새 비밀번호 · 안내 · 아이디 = 로그인 이메일');
      chk(R.e.acctMWarn.style.display === 'block' && R.e.acctMGoogleLink.style.display === 'inline-block' && R.e.acctMGoogleOk.style.display === 'none', '★ C2 구글 없음: 경고 + [연결하기]');
      R = await runR(null, true);
      chk(R.e.acctMethods.style.display === 'none' && R.e.acctMOff.style.display === 'block', '세션 풀림 → 구획 숨기고 한 줄');
      R = await runR({ google:true }, false);
      chk(R.e.acctMethods.style.display === 'none' && R.e.acctMOff.style.display === 'none', '로그인 안 한 PC → 아무것도 안 보임');
    }
  }

  /* ══ 11. [내 정보] — 런처 화면 전환 · G 톱니 · 보관함 = 넣은 캐릭터만 (설계 §7 B2 · C4 · D · G · CHECKS 개정 45 → 48) ══ */
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
    chk(/<span id="miLv"><\/span>/.test(MI) && /const lv = \$e\('miLv'\); if\(lv\)\{[^\n]*_plFillLv\(lv, n(, st)?\)/.test(A), '  레벨 배지는 친구 목록과 같은 _plFillLv(개정 46)');
    chk(/id="miAvatar" style="[^"]*border:1px solid;[^"]*var\(--win-lo-2\) var\(--win-hi\)/.test(MI) && !/id="miAvatar"[^>]*#111/.test(MI), '  사진 틀은 테마 베벨(개정 46)');
    chk(/id="miTabTrash"[^>]*display:none/.test(MI), '  휴지통 탭은 처음엔 숨김 — 보관함이 열린 PC 에서 코드가 연다(12절 · 개정 49)');
    /* 보관함 — 넣은 캐릭터만 */
    chk(/보관함 \(<span id="miBoxCount">/.test(MI) && !/마리/.test(noCm(MI)) && !/id="miSlots"|책상 \(/.test(MI), '★ 보관함 표제는 «보관함 (n/20)» — «마리» · 슬롯 격자 · «책상» 없음');
    const items = takeFn(A, 'function _miBoxItems(') || '', rb = takeFn(A, 'function _miRenderBox(') || '';
    chk(/on\.has\(cid\)/.test(items) && /_charsDeskGet\(\)/.test(items) && /_charsIsTomb\(e\)/.test(items), '★ 보관함 목록 = 슬롯 표 밖의 산 항목만(슬롯 캐릭터는 안 들어간다)');
    chk(/'슬롯에 올리기'/.test(rb) && /_miBoxUp\(it\.cid/.test(rb) && /'\/' \+ CHARS_BOX_MAX/.test(rb), '  줄마다 [슬롯에 올리기] · 개수 n/20');
    chk(!/책상/.test(rb.replace(/\/\/.*$/mg, '')) && !/마리/.test(rb), '  글자에 «책상» · «마리» 없음');
    /* G 톱니 */
    const menu = (H.match(/<div class="lc-menu" id="lcGearMenu">([\s\S]*?)<\/div>/) || [])[1] || '';
    const order = ['lcToBox','lcEdit','lcExport','lcGearSep','lcDelete'].map(id => menu.indexOf('id="' + id + '"'));
    chk(order.every((v, k) => v >= 0 && (k === 0 || v > order[k - 1])) && /id="lcToBox">보관함 이동</.test(menu), '★ 런처 톱니(시안 G): [보관함 이동] · [캐릭터 수정] · [복제 코드 만들기] · 구분선 · [휴지통 이동]');
    chk(/'휴지통 이동'/.test(takeFn(A, 'function _charsDeleteWords(') || '') && /getElementById\('lcToBox'\)\.onclick=\(\)=>\{ closeGearMenu\(\); doMoveCurSlotToBox\(\); \}/.test(A), '  [보관함 이동] → doMoveCurSlotToBox(되묻지 않음) · 마지막 줄은 스위치에 묶인 글자');
    chk(/\['lcToBox','lcEdit','lcExport','lcGearSep','lcDelete'\]/.test(A), '  휴지통 되묻기 때 다른 줄(보관함 이동 · 구분선 포함)을 숨긴다');
    /* 옮기기 — 떼어 와서 돌린다 */
    const fns = ['function _charsIsTomb(', 'function _charsBoxOnlyCount(', 'async function _charsDeskToBox(', 'function _charsMoveMsg(', 'function _miSlotThumb('].map(h => takeFn(A, h));
    chk(fns.every(Boolean), 'app.js: _charsBoxOnlyCount · _charsDeskToBox · _charsMoveMsg');
    if (fns.every(Boolean)){
      const mk = (box, desk, active, syncFix) => {
        const LS = { 'B': JSON.stringify(box), 'D': JSON.stringify(desk) };
        const env = { syncs: 0 };
        const F = new Function('LS', 'env', 'syncFix', "const CHAR_SLOT_MAX=5, CHARS_BOX_MAX=20, CHARS_BOX_KEY='B', CHARS_DESK_KEY='D'; let _charsGen=0;" +
          "const localStorage={ getItem:k=>LS[k]==null?null:LS[k], setItem:(k,v)=>{ LS[k]=String(v); } };" +
          "const _charsActive=()=>" + (active ? 'true' : 'false') + ";" +
          "const _charsBoxGet=()=>JSON.parse(LS.B); const _charsDeskGet=()=>JSON.parse(LS.D);" +
          "const _charsSync=async()=>{ env.syncs++; if(syncFix){ const b=JSON.parse(LS.B); for(const c in b) if(b[c].dirty){ b[c]={def:'{}',mtime:b[c].mtime}; } LS.B=JSON.stringify(b); } };" +
          fns.join('\n') + '\nreturn { toBox:_charsDeskToBox, count:_charsBoxOnlyCount, msg:_charsMoveMsg, thumb:_miSlotThumb };');
        return { F: F(LS, env, !!syncFix), LS, env };
      };
      await (async () => {
        let t = mk({ a:{def:'{}',mtime:1}, b:{def:'{}',mtime:2}, c:{def:'{}',mtime:3} }, ['a','b','c',null,null], true);
        let r = await t.F.toBox(1);
        chk(r.ok && t.LS.D === JSON.stringify(['a','c',null,null,null]) && Object.keys(JSON.parse(t.LS.B)).length === 3, '★ [보관함 이동] — 슬롯 표에서만 빠지고 뒤 칸이 당겨진다 · 보관함 항목은 그대로(지우지 않는다)');
        chk(t.F.count() === 1, '  보관함 수 = 슬롯 밖만(1)');
        t = mk({ a:{def:null,mtime:1,dirty:true} }, ['a',null,null,null,null], true, true);
        r = await t.F.toBox(0);
        chk(r.ok && t.env.syncs === 1, '★ 못 올린 고침은 먼저 올리고(_charsSync) 옮긴다');
        t = mk({ a:{def:null,mtime:1,dirty:true} }, ['a',null,null,null,null], true, false);
        r = await t.F.toBox(0);
        chk(!r.ok && r.why === 'dirty' && t.LS.D === JSON.stringify(['a',null,null,null,null]), '  올리지 못하면 옮기지 않는다(그림이 사라지지 않게)');
        const full = {}; for (let k = 0; k < 20; k++) full['x' + k] = { def:'{}', mtime:k }; full.a = { def:'{}', mtime:99 };
        t = mk(full, ['a',null,null,null,null], true);
        r = await t.F.toBox(0);
        chk(!r.ok && r.why === 'full' && /\(20\/20\)/.test(t.F.msg(r)) && !/마리/.test(t.F.msg(r)), '  보관함 20칸이 차면 막는다 — «(20/20)»');
        t = mk({ a:{def:'{}',mtime:1} }, ['a',null,null,null,null], false);
        r = await t.F.toBox(0);
        chk(!r.ok && r.why === 'off' && t.LS.D === JSON.stringify(['a',null,null,null,null]), '  보관함이 안 열렸으면(첫 채택 전) 아무것도 안 바꾼다');
        chk(/슬롯이 꽉 차서 이동할 수 없어요/.test(t.F.msg({ why:'slotsfull' })), '  [슬롯에 올리기] 슬롯 꽉 참 = 시안 D3 문구');
      })().catch(e => chk(false, '11절 옮기기 예외: ' + (e && e.message)));
    }
    const up = takeFn(A, 'async function _charsBoxToDesk(') || '';
    chk(/!slots\[k\] && !desk\[k\]/.test(up) && /_slotFromServerObj\(JSON\.parse\(e\.def\)\)/.test(up) && /delete b2\[cid\]\.h/.test(up) && /await loadSlots\(\)/.test(up),
      '★ [슬롯에 올리기] — 빈 슬롯 첫 칸에 서버 표현을 그림째 받아 앉힌다 · 기준(h)을 다시 잡는다');
    const mv = takeFn(A, 'async function doMoveCurSlotToBox(') || '';
    chk(/await _charsDeskToBox\(i\)/.test(mv) && mv.indexOf('_charsDeskToBox') < mv.indexOf('slots[k] = slots[k + 1]') && /extraSeatSlots/.test(mv) && /'보관함으로 옮겼어요'/.test(mv),
      '  런처 쪽은 보관함 기록이 끝난 뒤에만 칸을 당긴다 · 자리 추가 번호도 같이 · 토스트 «보관함으로 옮겼어요»');
    chk(/const CHARS_SYNC_ENABLED = true;/.test(A), '★ 보관함 스위치 켬(개정 48) — 규칙 게시 뒤 배포');
    chk(!/마리\)'/.test(A) && /'보관함이 가득 찼어요 \(' \+ n \+ '\/' \+ CHARS_BOX_MAX \+ '\)'/.test(A), '  «보관함이 가득 찼어요 (n/20)» — «마리» 없음');
    /* 걷은 것 — 마크업 · 코드 (개정 45 그대로) */
    const gone = ['progTabBtnAccount','progTabAccount','acctLoggedOut','acctGoogleBtn','acctLoginEmail','acctCurCode','acctCurFriendCode',
      'acctRecoverBtn','acctRecoverBox','acctRecoverGo','acctTransferBtn','acctTransferPanel','acctTransferPw','acctCodeBox','acctLinkBtn','acctLinkPanel','acctLinkSubmit','acctUnlinkBox','acctUnlinkYes'];
    const leftH = gone.filter(id => HTML.includes('id="' + id + '"'));
    const leftA = gone.filter(id => A.includes("getElementById('" + id + "')") || A.includes("$('" + id + "')"));
    chk(!leftH.length && !leftA.length, '★ 걷은 것(설정 › 계정 탭 · 로그인 전 얼굴 · 되찾기 · 이전/연동/해제)이 없다' + (leftH.concat(leftA).length ? ' — ' + leftH.concat(leftA).join(' ') : ''));
    chk(!/initAccountTransfer|firebaseAPI\.setTransferHash|firebaseAPI\.verifyTransfer|firebaseAPI\.authRebindUserCode|recCandidates/.test(Ac), '  이전 · 연동 · 되찾기 호출이 없다');
    chk(count(A, /async function _sha256Hex\(/g) === 1 && /async function _sha256Hex\(s\)\{[\s\S]{0,600}catch\(e\)\{ return null; \}/.test(A), '  _sha256Hex 는 한 벌 · 실패하면 null');
    const tabs = takeFn(A, 'function setProgSettingsTab(') || '';
    chk(!!tabs && !/account/.test(tabs.replace(/\/\/.*$/mg, '')) && !/설정 → 계정|설정 › 계정/.test(Ac), '  설정 탭에 계정 없음 · 없어진 [설정 › 계정]을 가리키는 안내 없음');
    const gateUI = A.slice(A.indexOf('(function initAccountLoginUI('), A.indexOf('function _acctRelaunchAfterDetach('));
    chk(/const gate = \$\('inviteGateGoogleBtn'\)/.test(gateUI) && /const runLogin =/.test(gateUI), '  게이트 H 의 구글 버튼 처리는 남았다');
    /* 계정 C4 순서 */
    const iPA = MI.indexOf('id="miPageAcct"'), iAM = MI.indexOf('<div id="acctMethods"'), iSB = MI.indexOf('id="acctSyncBox"'), iLO = MI.indexOf('<button id="acctLogoutBtn"'), iLD = MI.indexOf('id="acctLogoutDone"');
    chk(iPA > 0 && iAM > iPA && iSB > iAM && iLO > iSB && iLD > iLO, '★ 계정 탭 C4 순서: 로그인 수단·비밀번호 → 기기 연동 → 로그아웃');
    /* 런처 · 닉네임 · 코드 불러오기 */
    chk(/<button class="lc-btn ghost" id="lcLoad">내 정보<\/button>/.test(HTML) && /getElementById\('lcLoad'\)\.onclick=\(\)=>openMyInfo\('box'\)/.test(A) && !/getElementById\('lcLoad'\)\.disabled/.test(A), '  런처 [내 정보] → openMyInfo · 늘 눌린다');
    const nameSave = takeFn(A, 'function _miNameSave(') || '', codeLoad = takeFn(A, 'function _miCodeLoad(') || '';
    chk(/commitUserName\(inp\.value\)/.test(nameSave) && !/setUserName/.test(nameSave), '  닉네임 저장은 commitUserName 하나');
    chk(/'캐릭터가 모두 찼습니다'/.test(codeLoad) && /openCodeModal\(\)/.test(codeLoad), '  [코드로 캐릭터 불러오기] → openCodeModal(슬롯 꽉 차면 옛 토스트)');
    /* 규칙 — 옛 이전 비밀번호 */
    const RJ = JSON.parse(fs.readFileSync('firebase-database-rules.json', 'utf8')).rules.users.$userId;
    chk(/^!newData\.exists\(\) && \(/.test(RJ.transferHash['.write']) && RJ.transferHash['.validate'] === 'false', '★ users/{uid}/transferHash — 지우기만(결정 12)');
    /* 개정 55 (설계 §9-12): 계정 스냅샷은 accountSnap/{코드}(주인만)로 옮겼다 — transferData 도 transferHash 처럼 지우기만. */
    chk(/^!newData\.exists\(\) && \(/.test(RJ.transferData['.write']) && RJ.transferData['.validate'] === 'false', '  users/{uid}/transferData — 지우기만(개정 55 · 스냅샷은 accountSnap 으로)');
  }

  /* ══ 12. 🗑️ 휴지통 탭 · 보관함 줄 [휴지통 이동] (시안 E · D2 아이콘 · CHECKS 개정 49) ══ */
  say('');
  say('【12】 휴지통 — 탭 순서(보관함 · 휴지통 · 계정) · 보관함이 열린 PC 에서만 · E 줄(옮김/연동 교체 · 사라지는 날 · [복원] 폭 고정) · 20 이면 붉은 상자 · 보관함 줄 붉은 아이콘 + 줄 안 되묻기');
  {
    const noCm = s => String(s || '').replace(/<!--[\s\S]*?-->/g, '');
    const H = noCm(HTML), A = APP;
    const iPg = H.indexOf('<div id="lcMyInfo"');
    const MI = H.slice(iPg, H.indexOf('<!-- 광고 배너', iPg) > 0 ? H.indexOf('<!-- 광고 배너', iPg) : iPg + 20000);
    /* 개정 69: 사용자가 순서를 다시 정했다 — 보관함 · 휴지통 · 계정(옛 개정 49 는 보관함 · 계정 · 휴지통). */
    const tb = ['miTabBox', 'miTabTrash', 'miTabAcct'].map(id => MI.indexOf('<button id="' + id + '"'));
    chk(tb.every((v, k) => v > 0 && (k === 0 || v > tb[k - 1])), '★ 탭 순서 보관함 · 휴지통 · 계정(사용자 결정 · 개정 69)');
    chk(/<button id="miTabTrash"[^>]*color:#B22222/.test(MI), '  휴지통 탭 글자는 붉게(#B22222 · 설계 §7)');
    chk(/#lcMyInfo\.mi-noscroll\{scrollbar-width:none;\}/.test(HTML) && /#lcMyInfo\.mi-noscroll::-webkit-scrollbar\{display:none;/.test(HTML) && /pg\.classList\.toggle\('mi-noscroll', _miTab === 'acct'\)/.test(takeFn(A, 'function _miSetTab(') || ''),
      '  계정 탭에서만 스크롤바 숨김(개정 53 · 스크롤은 그대로)');
    { const cb = A.slice(A.indexOf("const closeBtn=document.getElementById('lcCloseBtn');"), A.indexOf('(function bindLauncherDim('));
      chk(/if\(typeof _miIsOpen === 'function' && _miIsOpen\(\)\)\{ closeMyInfo\(\); return; \}/.test(cb) && cb.indexOf('_miIsOpen()') < cb.indexOf('companion.quitApp()'),
        '★ [내 정보]가 열려 있으면 런처 X 는 [내 정보]만 닫고 런처로(앱 종료보다 먼저 · 개정 53)'); }
    ['miPageTrash', 'miTrashCount', 'miTrashFull', 'miTrashFullN', 'miTrashList', 'miTrashEmpty', 'miTrashNote'].forEach(id => chk(MI.includes('id="' + id + '"'), '  #' + id));
    const pt = MI.slice(MI.indexOf('<div id="miPageTrash"'), MI.indexOf('<div id="miPageAcct"'));
    chk(/<div id="miPageTrash" style="display:none;/.test(MI) && /휴지통 \(<span id="miTrashCount">/.test(pt) && /보관함이 가득 찼어요 \(<span id="miTrashFullN">/.test(pt), '  휴지통 페이지 — 처음엔 숨김 · 표제 «휴지통 (n)» · 가득 참 상자(시안 ③)');
    chk(/복원하면 보관함으로 가요/.test(pt) && /«연동 교체»를 복원하면 지금 모습은 그대로 두고 하나가 더 생겨요/.test(pt) && !/마리|책상|되살리기|맞바꾸기/.test(pt), '★ 안내 글자 — 복원은 보관함으로 · 연동 교체는 하나 더 · «마리»·«책상»·옛 E 글자 없음');
    const st = takeFn(A, 'function _miSetTab(') || '';
    chk(/const trashOn = _miTrashOn\(\);/.test(st) && /tab === 'trash' && trashOn/.test(st) && /tt\.style\.display = trashOn \? '' : 'none'/.test(st) && /\['miTabTrash','trash'\]/.test(st) && /_miRenderTrash\(\)/.test(st),
      '★ 휴지통 탭은 보관함이 열린 PC 에서만 보이고 열린다(스위치 · 첫 채택 뒤) — 아니면 보관함으로');
    chk(/function _miTrashOn\(\)\{ return typeof _charsActive === 'function' && _charsActive\(\); \}/.test(A), '  «열림» 판정은 _charsActive 하나');
    const ld = takeFn(A, 'async function _miTrashLoad(') || '';
    chk(/firebaseAPI\.loadCharsTrashAll\(uid\)/.test(ld) && /_charsTrashView\(t, _charsBoxGet\(\), _slotsNow\(\)\)/.test(ld) && /_miTrashErr = \(t === null\)/.test(ld), '  읽기는 loadCharsTrashAll · 고르기는 _charsTrashView(보관함 사본 기준) · 읽기 실패는 따로 알린다');
    chk(/_miTrashLoad\(\);/.test(takeFn(A, 'function openMyInfo(') || '') && /on\('miTabTrash', \(\) => \{[^\n]*_miSetTab\('trash'\); _miTrashLoad\(\); \}\)/.test(A), '  [내 정보]를 열 때 · 탭을 누를 때 다시 읽는다(«휴지통 N»)');
    const rt = takeFn(A, 'function _miRenderTrash(') || '', rs = takeFn(A, 'async function _miTrashRestore(') || '';
    chk(/'연동 교체' : '옮김'/.test(rt) && /' 사라져요'/.test(rt) && /rb\.textContent = '복원'/.test(rt) && /width:48px;/.test(rt) && /_miTrashRestore\(it, rb\)/.test(rt), '★ E 줄 — 이름표 «옮김»/«연동 교체» · «M/D 사라져요» · [복원] 하나(폭 고정)');
    chk(!/마리|책상|되살리기|이 모습으로/.test(rt + rs), '  글자에 «마리»·«책상»·옛 E 버튼 글자 없음');
    chk(rs.indexOf('_charsBoxOnlyCount() >= CHARS_BOX_MAX') > 0 && rs.indexOf('_charsBoxOnlyCount() >= CHARS_BOX_MAX') < rs.indexOf('_charsRestore(row)') && /full\.style\.display = 'block'/.test(rs) && /'보관함으로 복원했어요'/.test(rs),
      '★ [복원] — 20 이면 먼저 붉은 상자(시안 ③ · 쓰지 않음) · 되면 «보관함으로 복원했어요»');
    const rb = takeFn(A, 'function _miRenderBox(') || '';
    chk(/tb\.setAttribute\('aria-label', '휴지통 이동'\)/.test(rb) && /_miTrashIcon\(14\)/.test(rb) && /_charsDeleteWords\(\)\.ask/.test(rb) && /yes\.onclick = \(\) => _miBoxTrash\(it\.cid\)/.test(rb) && /up\.disabled = true/.test(rb),
      '★ 보관함 줄 끝 붉은 아이콘(시안 D2) → 그 줄 안 되묻기(«3일 뒤 사라져요» — 런처와 같은 글자) · [옮기기] · 되묻는 동안 [슬롯에 올리기] 잠금');
    chk(/stroke', '#B22222'/.test(takeFn(A, 'function _miTrashIcon(') || '') && /M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13/.test(A), '  아이콘은 D2 와 같은 선 · 붉게');
    const bt = takeFn(A, 'async function _miBoxTrash(') || '';
    chk(/const r = _charsBoxTrash\(cid\)/.test(bt) && bt.indexOf('_charsBoxTrash(cid)') < bt.indexOf("_charsSync('box-trash')") && /_miTrashLoad\(\)/.test(bt), '  [옮기기] → _charsBoxTrash 후 바로 한 번 동기화(휴지통 줄이 서버에 생기게) · 탭 글자 다시');
    chk(/_miBoxAsk = null; _miTrashFullShown = false;/.test(takeFn(A, 'function closeMyInfo(') || ''), '  ◀ 로 나가면 되묻기·가득 참 상자를 접는다');
    /* 그리기 — 떼어 와 돌린다(가짜 DOM) */
    const fns = ['function _miRenderTrash(', 'function _miSlotThumb('].map(h => takeFn(A, h));
    if (fns.every(Boolean)){
      const mkEl = (tag) => { const e = { tag, style: {}, children: [], textContent: '', attrs: {}, appendChild(c){ this.children.push(c); return c; }, setAttribute(k, v){ this.attrs[k] = v; } };
        Object.defineProperty(e, 'innerHTML', { set(){ e.children = []; } }); return e; };
      const ids = {}; ['miTrashList','miTrashEmpty','miTrashCount','miTrashFull'].forEach(id => ids[id] = mkEl('div'));
      const doc = { getElementById: id => ids[id] || null, createElement: mkEl, createTextNode: t => ({ tag: '#text', textContent: t }) };
      const text = e => e.tag === '#text' ? e.textContent : (e.textContent || '') + (e.children || []).map(text).join('');
      const run = (rows, err) => new Function('document', 'rows', 'err', "const MI_IMG_OK=/^(data:image\\/|https?:)/i; let _miTrashRows=rows, _miTrashErr=err, _miTrashFullShown=false; const _miTrashRestore=()=>{};" + fns.join('\n') + '\n_miRenderTrash();')(doc, rows, err);
      const D = new Date(2026, 8, 25).getTime();
      run([{ cid: 'ca', mtime: 1, def: '{"thumbUrl":"https://x/t.png"}', why: 'deleted', at: D - 3*864e5, until: D }, { cid: 'cb', mtime: 2, def: '{}', why: 'overwritten', at: D, until: new Date(2026, 9, 1).getTime() }], false);
      const rows = ids.miTrashList.children;
      chk(rows.length === 2 && text(rows[0]).includes('옮김9/25 사라져요') && text(rows[1]).includes('연동 교체10/1 사라져요') && ids.miTrashCount.textContent === '2', '  그리기: 두 줄 · «옮김 9/25 사라져요» · «연동 교체 10/1 사라져요» · 개수 2');
      chk(rows[0].children[0].children[0] && rows[0].children[0].children[0].tag === 'img' && rows[0].children[0].children[0].src === 'https://x/t.png', '  섬네일은 thumbUrl(보관함과 같은 _miSlotThumb)');
      run([], true);
      chk(ids.miTrashList.children.length === 0 && ids.miTrashEmpty.style.display === 'block' && /읽지 못했어요/.test(ids.miTrashEmpty.textContent), '  읽기 실패 → 빈 줄이 아니라 «읽지 못했어요»');
      run([], false);
      chk(/휴지통이 비어 있어요/.test(ids.miTrashEmpty.textContent) && /3일/.test(ids.miTrashEmpty.textContent) && /10일/.test(ids.miTrashEmpty.textContent), '  비었을 때 — 3일 · 10일 안내');
    } else chk(false, '12절 그리기 함수를 못 찾음');
  }

  /* ══ 13. 🧺 D2 보관함 가득 참 (시안 D2 를 [내 정보] 모양으로 · CHECKS 개정 51) ══ */
  say('');
  say('【13】 D2 보관함 가득 참 — 20 이상일 때만 노란 경고(n/20 · 몇 개) · 체크칸 · «고른 캐릭터 k» · [선택한 캐릭터 휴지통으로 (k)] → 되묻기 → 한꺼번에');
  {
    const noCm = s => String(s || '').replace(/<!--[\s\S]*?-->/g, '');
    const H = noCm(HTML), A = APP;
    const iPg = H.indexOf('<div id="lcMyInfo"');
    const MI = H.slice(iPg, H.indexOf('<!-- 광고 배너', iPg) > 0 ? H.indexOf('<!-- 광고 배너', iPg) : iPg + 20000);
    const pb = MI.slice(MI.indexOf('<div id="miPageBox"'), MI.indexOf('<div id="miPageTrash"'));
    const at = id => pb.indexOf('id="' + id + '"');
    ['miBoxFull','miBoxFullHead','miBoxFullText','miBoxPicked','miBoxBulk','miBoxBulkBtn','miBoxBulkAsk','miBoxBulkAskText','miBoxBulkYes','miBoxBulkNo'].forEach(id => chk(at(id) > 0, '  #' + id + ' (보관함 페이지 안)'));
    chk(at('miBoxFull') < at('miBoxCount') && at('miBoxCount') < at('miBoxList') && at('miBoxList') < at('miBoxBulk') && at('miBoxBulk') < at('miCodeLoad'), '★ 순서(시안 D2): 경고 → «보관함 (n/20)» · 고른 수 → 목록 → [선택한 캐릭터 휴지통으로] → [코드로 캐릭터 불러오기]');
    chk(/<div id="miBoxFull" style="display:none;/.test(pb) && /<div id="miBoxBulk" style="display:none;/.test(pb) && /<span id="miBoxPicked" style="display:none;/.test(pb), '  처음엔 다 숨김(가득 찼을 때만 코드가 켠다)');
    chk(/3일 동안 복원할 수 있어요/.test(pb) && !/마리|책상|슬롯의 캐릭터는 여기서 고를 수 없어요/.test(pb), '  안내 «3일 동안 복원» · «마리»·«책상» 없음 · 옛 «슬롯의 캐릭터는 고를 수 없어요» 없음(슬롯 캐릭터는 보관함 목록에 아예 없다)');
    const rb = takeFn(A, 'function _miRenderBox(') || '';
    chk(/const full = _miRenderBoxFull\(items\);/.test(rb) && rb.indexOf('_miRenderBoxFull(items)') < rb.indexOf('if(!items || !items.length)') && /if\(full\)\{/.test(rb) && /_miPick\.has\(it\.cid\)/.test(rb) && /if\(_miBulkAsk\) up\.disabled = true;/.test(rb),
      '★ 목록 — 가득 찼을 때만 줄마다 체크칸 · 빈 목록 전에 경고를 먼저 정리(열리지 않은 PC 에서 경고가 남지 않게) · 되묻는 동안 [슬롯에 올리기] 잠금');
    const bt = takeFn(A, 'async function _miBoxTrashBulk(') || '';
    chk(/_charsBoxTrashMany\(Array\.from\(_miPick\)\)/.test(bt) && bt.indexOf('_charsBoxTrashMany') < bt.indexOf("_charsSync('box-trash')") && /_miPick\.clear\(\)/.test(bt) && /_miTrashLoad\(\)/.test(bt), '  [옮기기] → 한꺼번에 묘비 → 고른 것 비움 → 한 번 동기화 → 휴지통 탭 글자');
    chk(/_miPick\.clear\(\); _miBulkAsk = false;/.test(takeFn(A, 'function closeMyInfo(') || ''), '  ◀ 로 나가면 고른 것·되묻기를 접는다');
    chk(/on\('miBoxBulkBtn', \(\) => _miBoxBulkStart\(\)\)/.test(A) && /on\('miBoxBulkYes', \(\) => _miBoxTrashBulk\(\)\)/.test(A) && /on\('miBoxBulkNo',/.test(A), '  버튼 셋 배선');
    /* 떼어 와 돌리기 — 가짜 DOM */
    const fns = ['function _miRenderBoxFull(', 'function _miTrashIcon('].map(h => takeFn(A, h));
    if (fns.every(Boolean)){
      const mkEl = (tag) => { const e = { tag, style: {}, children: [], textContent: '', attrs: {}, appendChild(c){ this.children.push(c); return c; }, setAttribute(k, v){ this.attrs[k] = v; } }; return e; };
      const ids = {}; ['miBoxFull','miBoxFullHead','miBoxFullText','miBoxPicked','miBoxBulk','miBoxBulkBtn','miBoxBulkAsk','miBoxBulkAskText'].forEach(id => ids[id] = mkEl('div'));
      const doc = { getElementById: id => ids[id] || null, createElement: mkEl, createElementNS: (ns, t) => mkEl(t), createTextNode: t => ({ tag: '#text', textContent: t }) };
      const text = e => e.tag === '#text' ? e.textContent : (e.textContent || '') + (e.children || []).map(text).join('');
      const F = new Function('document', 'CHARS_BOX_MAX', "const _miPick=new Set(); let _miBulkAsk=false;" + fns.join('\n') + '\nreturn { full:_miRenderBoxFull, pick:_miPick, ask:v=>{ _miBulkAsk=v; }, asking:()=>_miBulkAsk };')(doc, 20);
      const its = n => Array.from({ length: n }, (_, k) => ({ cid: 'c' + k }));
      F.pick.add('c1'); F.pick.add('c2'); F.pick.add('gone');
      let full = F.full(its(22));
      chk(full && ids.miBoxFull.style.display === 'block' && ids.miBoxFullHead.textContent === '보관함이 가득 찼어요 · 22/20' && /^3개 이상 휴지통으로/.test(ids.miBoxFullText.textContent), '★ 22/20 → 경고 «22/20» · «3개 이상»(20 문턱이 ≥20 이라 19 까지 내려가야 풀린다)');
      chk(F.pick.size === 2 && ids.miBoxPicked.textContent === '고른 캐릭터 2' && text(ids.miBoxBulkBtn).includes('선택한 캐릭터 휴지통으로 (2)'), '  목록에 없는 고른 것은 버린다 · «고른 캐릭터 2» · 버튼 (2)');
      F.ask(true); F.full(its(22));
      chk(ids.miBoxBulkAsk.style.display === 'block' && ids.miBoxBulkBtn.style.display === 'none' && ids.miBoxBulkAskText.textContent === '2개를 휴지통으로 옮길까요? 3일 뒤 사라져요', '  되묻기 — «2개를 휴지통으로 옮길까요? 3일 뒤 사라져요» · 버튼 자리 대신');
      full = F.full(its(20));
      chk(full && /^1개 이상/.test(ids.miBoxFullText.textContent), '  딱 20 → 가득 참 · «1개 이상»');
      full = F.full(its(19));
      chk(!full && ids.miBoxFull.style.display === 'none' && ids.miBoxBulk.style.display === 'none' && ids.miBoxPicked.style.display === 'none' && F.pick.size === 0 && !F.asking(), '★ 19 → 경고 · 체크 · 버튼 다 접히고 고른 것·되묻기 비움');
      full = F.full(null);
      chk(!full && ids.miBoxFull.style.display === 'none', '  보관함이 안 열린 PC(null) → 경고 없음');
    } else chk(false, '13절 함수를 못 찾음');
  }

  /* ══ 14. 🧬 «다름» · F 캐릭터를 계정에 연동했어요 (설계 §3 · §7-F · 시안 F-1 · F-2 확정 · CHECKS 개정 57) ══ */
  say('');
  say('【14】 «다름» — 갈아타기 전 정리(못 읽음 = 실패 · 안 묶임 = 올리고 옮기고 캐릭터 키만 내려놓음 · 남의 계정 = 전부 내려놓음) · F 창');
  {
    const A = APP;
    const noCm = x => String(x || '').replace(/<!--[\s\S]*?-->/g, '');
    const H = noCm(fs.readFileSync('desk-companion-prototype.html', 'utf8'));
    const fPlan = takeFn(A, 'function _charsLinkPlan('), fPrep = takeFn(A, 'async function _switchPrepare('), fShow = takeFn(A, 'function _charsLinkedMaybeShow(');
    const fTomb = takeFn(A, 'function _charsIsTomb('), fTime = takeFn(A, 'function _charsEntryTime(');
    chk(!!(fPlan && fPrep && fShow && fTomb && fTime), '함수 다섯을 찾았다 (_charsLinkPlan · _switchPrepare · _charsLinkedMaybeShow)');
    /* 부르는 자리 — 두 로그인이 uid 기록 전에 부른다 */
    const G = takeFn(A, 'async function _loginDoGoogle(') || '', FC = takeFn(A, 'async function _loginDoFriendCode(') || '';
    chk(G.indexOf('_switchPrepare(before, r.userCode)') > 0 && G.indexOf('_switchPrepare(before, r.userCode)') < G.indexOf('if(!_setMyUserId(r.userCode))'), '★ 구글 로그인: 정리 → uid 기록 순서');
    chk(FC.indexOf('_switchPrepare(before, r.userCode)') > 0 && FC.indexOf('_switchPrepare(before, r.userCode)') < FC.indexOf('_setMyUserId(r.userCode)'), '★ 친구 코드 로그인: 정리 → uid 기록 순서');
    chk(/'tw\.charsLinked'/.test((A.match(/const ACCOUNT_LOCAL_KEYS = \(\)=>\[([\s\S]*?)\n\];/) || [])[1] || ''), '  F 표시는 로그아웃 목록에 (다음 사람에게 띄우지 않는다)');
    chk(/_charsBoot\('boot'\)\.then\(r => \{ if\(r && r\.ok\) _charsLinkedMaybeShow\(\); \}/.test(A), '  F 는 부팅 _charsBoot 가 성공한 뒤에만');
    chk(/#needLoginOverlay, #charsLinkedOverlay/.test(A), '  F 창이 클릭 통과 목록(UI_HIT_SEL)에');
    /* 마크업 */
    const ids = ['charsLinkedOverlay','clCount','clCodeWrap','clCode','clThumbs','clCnt','clBox','clSplit','clFull','clNote','clOpen','clOk'];
    chk(ids.every(id => H.includes('id="' + id + '"')), '★ F 마크업 id 열둘');
    const FM = H.slice(H.indexOf('<div id="charsLinkedOverlay"'), H.indexOf('<div id="needLoginOverlay"'));
    chk(/캐릭터를 계정에 연동했어요/.test(FM) && !/마리/.test(FM) && /아무것도 지워지지 않았어요/.test(FM), '  제목 · «마리» 없음 · 안내 줄');
    chk(/z-index:94/.test(FM), '  게이트(96~97)보다 아래');
    if (fPlan && fPrep && fShow && fTomb && fTime){
      /* _charsLinkPlan — 순수 */
      const P = new Function(fTomb + '\n' + fTime + '\n' + fPlan + '\nreturn _charsLinkPlan;')();
      const pl = P({ cabc1234: { def:'{"a":1}', mtime: 10 }, cdef5678: { def:'{"b":1}', mtime: 10 }, cghi9012: { del: 30 }, cjkl3456: { def:'{"c":1}', mtime: 50 }, BAD: { def:'x', mtime: 1 }, cmno7890: { def:'{"d":1}', mtime: 5 } },
                   { cdef5678: { def:'{"b":2}', mtime: 20 }, cjkl3456: { del: 40 }, cmno7890: { del: 90 } });
      chk(pl.cids.sort().join(',') === 'cabc1234,cjkl3456', '★ 옮길 것: 새 계정에 없는 것 · 새 계정 것보다 새것(더 오래된 묘비 위 포함)');
      chk(!pl.entries.cdef5678 && !pl.entries.cmno7890 && !pl.entries.cghi9012 && !pl.entries.BAD, '  새 계정 쪽이 더 새것(산 것·지운 것)이면 안 옮긴다 · 묘비 · 모양 틀린 cid 는 안 옮긴다');
      chk(pl.entries.cabc1234.def === '{"a":1}' && pl.entries.cabc1234.mtime === 10, '  같은 cid · 같은 def · 같은 mtime 으로');
      /* _switchPrepare — 가짜 환경 */
      const mkPrep = (o) => {
        const st = Object.assign({ 'tw.myUserId':'uold000000001', 'deskFriends.chars.v1':'{"cabc1234":{"def":"{}","mtime":1}}', 'deskFriends.chars.desk':'[]', 'deskFriends.chars.trashPend':'[]', 'deskFriends.slots.v2':'[{"skin":1}]' }, o.st || {});
        const log = [];
        const ls = { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
        const api = {
          authOwnerOf: async () => { if (o.ownerThrow) throw new Error('x'); return o.owner; },
          loadCharsRemote: async u => { log.push('load:' + u); return o.load === false ? null : { chars: u === 'uold000000001' ? (o.fromChars || { cabc1234: { def:'{}', mtime: 5 } }) : (o.toChars || {}) }; },
          saveCharsEntries: async (u, e) => { log.push('save:' + u + ':' + Object.keys(e).sort().join('|')); return o.save !== false; },
        };
        const F = new Function('localStorage', 'window', 'log', 'o',
          "const firebaseAPI = window.firebaseAPI; const LS_KEY='deskFriends.slots.v2'; const CHARS_SYNC_ENABLED = o.sync !== false; const CHARS_LINKED_KEY='tw.charsLinked';" +
          "function _slotsBackupSave(p){ log.push('backup:' + p); return true; } function _wipeAccountLocal(){ log.push('wipe'); localStorage.removeItem('tw.myUserId'); localStorage.removeItem('deskFriends.chars.v1'); }" +
          "async function _charsBoot(r){ log.push('boot:' + r + ':' + localStorage.getItem('tw.myUserId')); return o.boot || { ok:true }; }" +
          "function _charsBoxGet(){ return o.dirty ? { cabc1234:{ def:null, mtime:1, dirty:true } } : {}; }" +
          fTomb + '\n' + fTime + '\n' + fPlan + '\n' + fPrep + '\nreturn _switchPrepare;')(ls, { firebaseAPI: api }, log, o);
        return { F, st, log };
      };
      let e = mkPrep({ owner: undefined });
      let r = await e.F('uold000000001', 'unew00000001');
      chk(!r.ok && /읽지 못했어요/.test(r.reason) && e.log.length === 0 && e.st['deskFriends.chars.v1'], '★ 옛 uid 주인을 못 읽으면 실패 — 아무것도 안 바꾼다');
      e = mkPrep({ ownerThrow: true }); r = await e.F('uold000000001', 'unew00000001');
      chk(!r.ok && e.log.length === 0, '  조회가 던져도 같다');
      e = mkPrep({ owner: 'AUTH-OTHER' }); r = await e.F('uold000000001', 'unew00000001');
      chk(r.ok && r.mode === 'detach' && e.log.join(',') === 'backup:[{"skin":1}],wipe' && !e.log.some(x => /^load:|^save:|^boot:/.test(x)), '★ 남의 계정(K) — 책상 칸을 백업에 남기고 **전부 내려놓는다** · 아무것도 안 옮긴다');
      chk(!e.st['tw.charsLinked'], '  F 표시 없음');
      e = mkPrep({ owner: null }); r = await e.F('uold000000001', 'unew00000001');
      chk(r.ok && r.mode === 'import' && r.n === 1, '★ 안 묶임(I) — 옮겼다 (1)');
      chk(e.log[0] === 'boot:switch:uold000000001', '★ 먼저 **옛 uid 로** 끝까지 올린다(_charsBoot 가 옛 uid 로 돈다)');
      chk(e.log.includes('save:unew00000001:cabc1234') && !e.log.includes('wipe'), '  새 계정에 같은 cid 로 쓴다 · 전부 내려놓지는 않는다(같은 사람)');
      chk(!('deskFriends.chars.v1' in e.st) && !('deskFriends.chars.desk' in e.st) && !('deskFriends.chars.trashPend' in e.st) && e.st['deskFriends.slots.v2'] === '[{"skin":1}]', '★ 캐릭터 로컬 키 셋만 내려놓는다 — 책상 칸(LS_KEY)은 둔다(재시작 뒤 새 계정으로 첫 채택)');
      const mk = JSON.parse(e.st['tw.charsLinked'] || 'null');
      chk(mk && mk.to === 'unew00000001' && mk.cids.join() === 'cabc1234', '  F 표시를 남긴다 { to · cids }');
      e = mkPrep({ owner: null, boot: { ok:false, reason:'x' } }); r = await e.F('uold000000001', 'unew00000001');
      chk(!r.ok && /올리지 못했어요/.test(r.reason) && e.st['deskFriends.chars.v1'] && !e.log.some(x => /^save:/.test(x)), '★ 옛 uid 로 못 올리면 실패 — 로컬 그대로 · 새 계정에 안 쓴다');
      e = mkPrep({ owner: null, dirty: true }); r = await e.F('uold000000001', 'unew00000001');
      chk(!r.ok && e.st['deskFriends.chars.v1'], '  올린 뒤에도 못 올린 칸(dirty)이 남았으면 실패');
      e = mkPrep({ owner: null, save: false }); r = await e.F('uold000000001', 'unew00000001');
      chk(!r.ok && /옮기지 못했어요/.test(r.reason) && e.st['deskFriends.chars.v1'] && !e.st['tw.charsLinked'], '★ 새 계정에 못 쓰면 실패 — 로컬 그대로 · 표시 없음');
      e = mkPrep({ owner: null, load: false }); r = await e.F('uold000000001', 'unew00000001');
      chk(!r.ok && e.st['deskFriends.chars.v1'], '  서버 chars 를 못 읽으면 실패');
      e = mkPrep({ owner: null, fromChars: {} }); r = await e.F('uold000000001', 'unew00000001');
      chk(r.ok && r.n === 0 && !e.st['tw.charsLinked'] && !e.log.some(x => /^save:/.test(x)) && !('deskFriends.chars.v1' in e.st), '  옮길 것이 없으면 쓰지 않고 · 표시 없이 · 캐릭터 키만 내려놓는다');
      e = mkPrep({ owner: null, sync: false }); r = await e.F('uold000000001', 'unew00000001');
      chk(r.ok && r.mode === 'plain' && !e.log.length, '  캐릭터 스위치가 꺼졌으면 옮기지 않고 키만 내려놓는다');
      e = mkPrep({ owner: 'AUTH-OTHER' }); r = await e.F('', 'unew00000001');
      chk(r.ok && r.mode === 'none' && !e.log.length, '  옛 uid 가 없으면(처음 쓰는 PC) 할 일 없음');
      /* _charsLinkedMaybeShow — 가짜 DOM */
      const mkShow = (o) => {
        const st = Object.assign({ 'tw.myUserId':'unew00000001', 'tw.myFriendCode':'MATE-9K2M' }, o.st || {});
        const ls = { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
        const el = {}; const mkEl = t => ({ tag:t, style:{}, children:[], textContent:'', classList:{ s:new Set(), toggle(c, on){ on ? this.s.add(c) : this.s.delete(c); }, contains(c){ return this.s.has(c); } }, appendChild(c){ this.children.push(c); return c; } });
        ids.forEach(id => el[id] = mkEl('div')); el.launcher = mkEl('div'); if (o.launcherOn) el.launcher.classList.s.add('on');
        const calls = [];
        const doc = { getElementById: id => el[id] || null, createElement: mkEl };
        const F = new Function('localStorage', 'document', 'o', 'calls',
          "const CHARS_LINKED_KEY='tw.charsLinked', MY_FRIEND_CODE_KEY='tw.myFriendCode', CHARS_BOX_MAX=20, MI_IMG_OK=/^(data:image\\/|https?:)/i;" +
          "function getMyUserId(){ return localStorage.getItem('tw.myUserId'); } function _charsActive(){ return o.active !== false; }" +
          "function _charsBoxGet(){ return o.box; } function _charsDeskGet(){ return o.desk || [null,null,null,null,null]; }" +
          "function _charsBoxOnlyCount(box, desk){ const on=new Set(desk.filter(Boolean)); let n=0; for(const c in box) if(box[c] && !_charsIsTomb(box[c]) && !on.has(c)) n++; return n; }" +
          "function _miSlotThumb(d){ return d && d.thumbUrl || null; } function openMyInfo(t){ calls.push('open:' + t); } function toast(m){ calls.push('toast'); }" +
          fTomb + '\n' + fShow + '\nreturn _charsLinkedMaybeShow;')(ls, doc, o, calls);
        return { F, st, el, calls };
      };
      const boxN = (n, extra) => { const b = {}; for (let k = 0; k < n; k++) b['cold' + String(k).padStart(4, '0')] = { def:'{}', mtime:1 }; return Object.assign(b, extra || {}); };
      const moved = { cnew0001: { def:'{"thumbUrl":"https://x/t1.png"}', mtime:2 }, cnew0002: { def:'{"thumbUrl":"https://x/t2.png"}', mtime:2 }, cnew0003: { def:'{}', mtime:2 } };
      let v = mkShow({ st: { 'tw.charsLinked': JSON.stringify({ to:'unew00000001', cids:['cnew0001','cnew0002','cnew0003'] }) }, box: boxN(7, moved) });
      let shown = v.F();
      chk(shown && v.el.charsLinkedOverlay.style.display === 'flex' && v.el.clCount.textContent === '3개' && v.el.clBox.textContent === '10 / 20' && v.el.clSplit.textContent === '7 + 3', '★ F-1 — 3개 · 보관함 10 / 20 · 7 + 3');
      chk(v.el.clThumbs.children.length === 3 && v.el.clThumbs.children[0].children[0].src === 'https://x/t1.png' && v.el.clThumbs.children[2].children.length === 0, '  섬네일 셋(없는 것은 빈 칸) · 이름 없음');
      chk(v.el.clFull.style.display === 'none' && v.el.clNote.style.display === 'block' && v.el.clOpen.classList.contains('ghost') && !v.el.clOk.classList.contains('ghost'), '  여유 있으면 경고 없음 · [확인]이 기본 버튼');
      chk(v.el.clCode.textContent === 'MATE-9K2M' && v.el.clCodeWrap.style.display === 'inline', '  계정 친구 코드');
      chk(!('tw.charsLinked' in v.st), '★ 띄우면 표시를 지운다 — 두 번 안 뜬다');
      v.el.clOpen.onclick(); chk(v.calls.includes('toast') && v.el.charsLinkedOverlay.style.display === 'none', '  [보관함 열기] — 런처가 안 보이면 닫고 안내');
      v = mkShow({ st: { 'tw.charsLinked': JSON.stringify({ to:'unew00000001', cids:['cnew0001','cnew0002','cnew0003'] }) }, box: boxN(17, Object.assign({}, moved, { cnew0004:{ def:'{}', mtime:2 }, cnew0005:{ def:'{}', mtime:2 }, cnew0006:{ def:'{}', mtime:2 } })), launcherOn: true });
      v.F(); /* cids 셋만 적었으니 셋을 센다 */
      chk(v.el.clBox.textContent === '23 / 20' && v.el.clCnt.classList.contains('full') && v.el.clFull.style.display === 'block' && /^보관함이 가득 찼어요\. 4개 이상 휴지통으로 옮겨야 새 캐릭터 만들기 · 보관함 이동 · 복원을 할 수 있어요/.test(v.el.clFull.textContent),
          '★ F-2 — 23 / 20 · D2 와 같은 문구 «4개 이상»');
      chk(!v.el.clOpen.classList.contains('ghost') && v.el.clOk.classList.contains('ghost') && v.el.clNote.style.display === 'none', '  가득 차면 [보관함 열기]가 기본 버튼');
      v.el.clOpen.onclick(); chk(v.calls.includes('open:box'), '  런처가 보이면 [내 정보] › 보관함을 연다');
      v = mkShow({ st: { 'tw.charsLinked': JSON.stringify({ to:'uSOMEONEELSE1', cids:['cnew0001'] }) }, box: boxN(1, moved) });
      chk(!v.F() && !('tw.charsLinked' in v.st), '  다른 uid 의 표시는 버린다');
      v = mkShow({ st: { 'tw.charsLinked': JSON.stringify({ to:'unew00000001', cids:['cnew0001'] }) }, box: boxN(1, moved), active: false });
      chk(!v.F() && ('tw.charsLinked' in v.st), '  보관함이 아직 안 열렸으면 표시를 두고 다음 부팅에');
      v = mkShow({ st: { 'tw.charsLinked': JSON.stringify({ to:'unew00000001', cids:['cnew0001'] }) }, box: { cnew0001: { del: 9 } } });
      chk(!v.F() && !('tw.charsLinked' in v.st), '  옮긴 것이 그새 다 지워졌으면 안 띄우고 표시만 지운다');
      v = mkShow({ st: { 'tw.charsLinked': JSON.stringify({ to:'unew00000001', cids:['cnew0001','cnew0002'] }) }, box: boxN(3, { cnew0001: moved.cnew0001, cnew0002: moved.cnew0002 }), desk: ['cnew0002', null, null, null, null] });
      v.F();
      chk(v.el.clCount.textContent === '2개' && v.el.clBox.textContent === '4 / 20' && v.el.clSplit.textContent === '3 + 1', '  책상에 올라간 것은 보관함 수에서 뺀다 (2개 옮김 · 보관함 3 + 1)');
    }
  }

  /* ══ 15. 🌟 [내 정보] 별 색 — 레벨 배지를 누르면 머리 아래에 열린다 (시안 v2 확정 · CHECKS 개정 69) ══ */
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
    chk(/'tw\.starColor'/.test(keys), '  색은 프로필 starC 로 돌아온다 — 그래서 로그아웃 목록에 있다(개정 71)');
    chk(/b\.onclick = \(\) => \{ if\(!setStarColor\(hex\)\) return; _miRenderHead\(\); _pushLevelIfChanged\(\); \};/.test(A), '★ 색을 고르면 머리 배지 · 프로필(친구 목록)까지 바로 — 방 좌석은 좌석 루프가(개정 70)');
    /* 재료 — 떼어 와 돌린다 */
    const palSrc = A.slice(A.indexOf('const STAR_PALETTE = ['), A.indexOf('];', A.indexOf('const STAR_PALETTE = [')) + 2);
    const fns = ['function _starColorOk(', 'function getStarColor(', 'function setStarColor(', 'function focusCycleOf(', 'function lvStarStr(',
                 'function _miStarToggle(', 'function _miRenderStar('].map(h => takeFn(A, h));
    chk(palSrc.length > 30 && fns.every(Boolean), '  재료 · 그리기 함수를 떼어 왔다');
    if (palSrc.length > 30 && fns.every(Boolean)){
      const mkEl = (id) => { const el = { id, style: { _p: {}, setProperty(k, v){ this._p[k] = v; }, display: '' }, attrs: {}, dataset: {}, children: [], textContent: '',
        setAttribute(k, v){ this.attrs[k] = String(v); }, appendChild(c){ this.children.push(c); return c; } }; return el; };
      const mk = (total, stored) => {
        const els = {}; ['miStar','miLvBtn','miStarOn','miStarLock','miStarSub','miStarNpStar','miStarNpText','miStarFill','miStarPal','miStarLeft','miStarMeter'].forEach(id => els[id] = mkEl(id));
        const LS = { st: Object.assign({}, stored || {}), getItem(k){ return k in this.st ? this.st[k] : null; }, setItem(k, v){ this.st[k] = String(v); } };
        const doc = { getElementById: id => els[id] || null, createElement: () => mkEl(null) };
        const f = new Function('document', 'localStorage', 'env', `
          const FOCUS_LEVEL_CAP_HOURS = 999, FOCUS_CYCLE_SEC = 999*3600, EXP_SEC_PER_LEVEL = 3600, EXP_SEC_PER_CELL = 300, EXP_CELLS = 12;
          let _focusTotalSec = env.total;
          const STAR_COLOR_KEY = 'tw.starColor';
          ${palSrc}
          ${fns.join('\n')}
          function getFocusLevel(){ return Math.min(FOCUS_LEVEL_CAP_HOURS, 1 + Math.floor(_focusTotalSec / 3600)); }
          function getDisplayName(){ return '키위'; }
          let _miStarOpen = false;
          function _pushLevelIfChanged(){} function _miRenderHead(){ _miRenderStar(); }
          return { STAR_PALETTE, getStarColor, setStarColor, focusCycleOf, lvStarStr, toggle: _miStarToggle, render: _miRenderStar, isOpen: () => _miStarOpen };`);
        return Object.assign(f(doc, LS, { total }), { els, LS });
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
      chk(v.getStarColor() === P[0] && !v.setStarColor('#000000') && !v.setStarColor('red') && !('tw.starColor' in v.LS.st), '★ 팔레트 밖 색은 거절 · 기본은 첫 색(금)');
      chk(v.setStarColor(P[5]) && v.LS.st['tw.starColor'] === P[5] && v.getStarColor() === P[5], '  팔레트 색은 저장된다');
      v = mk(0, { 'tw.starColor': '#123456' });
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
      v = mk(2 * C + 341 * 3600 + 1800, { 'tw.starColor': P[12] }); v.toggle();
      chk(v.els.miStarOn.style.display === 'flex' && v.els.miStarLock.style.display === 'none' && v.els.miStarSub.textContent === '2회차 · 이름표 별과 바가 같이 바뀌어요',
        '★ 회차 — 미리보기 + 색 칸 · «2회차»');
      chk(v.els.miStarNpStar.textContent === '★' && v.els.miStarNpText.textContent === '342 키위' && v.els.miStarFill.style.width === '50%', '  이름표 «★342 키위» · 바 50%(30분 = 6칸)');
      chk(v.els.miStar.style._p['--pre-c'] === P[12], '  고른 색이 #miStar 의 --pre-c');
      const sw = v.els.miStarPal.children;
      chk(sw.length === 16 && sw.every(b => b.attrs.role === 'radio' && b.attrs['aria-label'] && b.style._p['--sw'] === b.dataset.c) && sw.filter(b => b.attrs['aria-checked'] === 'true').length === 1 && sw[12].attrs['aria-checked'] === 'true',
        '★ 16칸 · radio · 이름 · 색은 CSS 변수로만 · 고른 것 하나만 checked');
      sw[3].onclick();
      chk(v.LS.st['tw.starColor'] === P[3] && v.els.miStar.style._p['--pre-c'] === P[3] && sw[3].attrs['aria-checked'] === 'true' && sw[12].attrs['aria-checked'] === 'false' && v.els.miStarPal.children.length === 16,
        '★ 색 칸을 누르면 바로 저장 · 미리보기 · 체크가 따라온다(칸을 다시 만들지 않는다)');
      v = mk(13 * C + 5 * 3600); v.toggle();
      chk(v.els.miStarNpStar.textContent === '★×13' && v.els.miStarNpText.textContent === '6 키위', '  13회차 — «★×13» 으로 접힌 채 미리보기');
    }
  }

  /* ══ 16. 🏆 [내 정보] 전체 랭킹 1~100위 · 1위 왕관 후광 (시안 v2 B안 + 후광 ② 확정 · CHECKS 개정 73) ══ */
  say('');
  say('【16】 전체 랭킹 — 머리 오른쪽 글자만 · 100위 밖 비움 · 메달 · 1위 왕관·후광 · rankOf · 서버 총합 · 캐시 · 규칙');
  {
    const noCm = x => String(x || '').replace(/<!--[\s\S]*?-->/g, '');
    const H = noCm(HTML), A = APP;
    const iPg = H.indexOf('<div id="lcMyInfo"');
    const MI = H.slice(iPg, iPg + 20000);
    /* 마크업 */
    const iAv = MI.indexOf('<div id="miAvatar"'), iWrap = MI.lastIndexOf('<div class="mi-ava-wrap">', iAv);
    const iHalo = MI.indexOf('id="miHalo"'), iCrown = MI.indexOf('id="miCrown"'), iAvEnd = MI.indexOf('<span id="miAvatarPh">');
    chk(iWrap > 0 && iAv > iWrap && iAv - iWrap < 40, '★ 사진 칸(#miAvatar)을 감싸개(.mi-ava-wrap)가 한 겹 싼다');
    chk(iAvEnd > 0 && iHalo > iAvEnd && iCrown > iHalo && /<span id="miAvatarPh">사진<\/span><\/div>\s*<span id="miHalo"/.test(MI),
      '★ 후광·왕관은 #miAvatar(overflow:hidden) **밖** · 감싸개 안 · 순서 사진 → 후광 → 왕관(안에 넣으면 잘린다)');
    chk(/<span id="miHalo" class="mi-halo" aria-hidden="true" style="display:none;"><\/span><span id="miCrown" class="mi-crown" aria-hidden="true" style="display:none;">&#128081;<\/span><\/div>/.test(MI),
      '  후광·왕관은 처음엔 숨김 · aria-hidden · 👑');
    const iCode = MI.indexOf('id="miCopy"'), iRank = MI.indexOf('<div id="miRank"'), iStar = MI.indexOf('<div id="miStar"');
    chk(iRank > iCode && iStar > iRank, '★ 자리 — 친구 코드 줄 뒤 · 별 색 구획 앞(= 머리 flex 줄의 마지막 자식)');
    chk(/<div id="miRank" class="mi-rank" style="display:none;"><span class="t">전체 랭킹<\/span><span id="miRankV" class="v"><\/span><\/div>/.test(MI),
      '★ B안 — 칸 없이 «전체 랭킹» + 굵은 순위 · 처음엔 숨김(100위 밖과 같은 모양)');
    chk(/<div id="miTopBar" style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">\s*<button id="miBack"/.test(MI), '  «◀ 내 정보» 줄에 id — 1위일 때만 간격을 넓힌다');
    chk(!/100위 밖/.test(MI), '★ «100위 밖» 같은 글자는 없다(사용자 결정)');
    /* CSS — 시안 값 그대로 */
    const css = (HTML.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
    const R = sel => (css.match(new RegExp('\\n\\s*' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}')) || [])[1] || '';
    chk(/margin-left:auto/.test(R('.mi-rank')) && /text-align:right/.test(R('.mi-rank')) && /flex-shrink:0/.test(R('.mi-rank')), '  .mi-rank — 오른쪽 빈자리(margin-left:auto) · 오른쪽 맞춤');
    chk(/font-size:9\.5px/.test(R('.mi-rank .t')) && /font-size:15px/.test(R('.mi-rank .v')) && /font-size:17px/.test(R('.mi-rank .v.top')), '★ 글자 9.5 / 15 · 1~3위 17px');
    chk(/position:relative/.test(R('.mi-ava-wrap')) && /overflow:visible/.test(R('.mi-ava-wrap')), '★ 감싸개 position:relative · overflow:visible');
    chk(/top:-30px;width:54px;height:46px/.test(R('.mi-halo')) && /radial-gradient\(closest-side, rgba\(255,250,200,1\)/.test(R('.mi-halo')) && /pointer-events:none/.test(R('.mi-halo')),
      '  후광 ② — 둥근 방사형 · 54×46 · 위 30px · 누를 수 없음');
    chk(/rotate\(-12deg\)/.test(R('.mi-crown')) && /top:-15px/.test(R('.mi-crown')) && /drop-shadow\(0 0 4px rgba\(255,200,40,\.9\)\)/.test(R('.mi-crown')), '  왕관 −12° · 윤곽 빛');
    const rkCss = css.slice(css.indexOf('.mi-ava-wrap{'), css.indexOf('.lc-card{position:relative'));
    chk(rkCss.length > 50 && !/animation|@keyframes|transition/.test(rkCss), '★ 움직임 없음(③ 폐기 — reduced-motion 목록이 안 는다)');
    /* app.js 정적 */
    const hd = takeFn(A, 'function _miRenderHead(') || '';
    chk(/_miRenderRank\(\);/.test(hd), '★ 머리를 그릴 때 순위도(비동기)');
    const sy = takeFn(A, 'async function syncFocusTotalToServer(') || '';
    const iOk = sy.indexOf("if(!r || !r.ok){ _focusSyncFailed(reason, r, delta); return; }"), iPush = sy.indexOf('_lbPush(uid, server)');
    chk(iOk > 0 && iPush > iOk && !/_lbPush\([^)]*(_focusTotalSec|mine)/.test(sy), '★ 동기화가 **성공한 뒤** · 로컬값이 아니라 서버 총합(server)을 올린다');
    chk((A.match(/_lbPush\(/g) || []).length === 2, '  올리는 곳은 한 곳(정의 + 동기화 뒤 한 줄)');
    const rk = takeFn(A, 'function rankOf(') || '', rl = takeFn(A, 'function rankLabel(') || '', rr = takeFn(A, 'function _miRenderRank(') || '', ap = takeFn(A, 'function _miApplyRank(') || '', lp = takeFn(A, 'function _lbPush(') || '';
    chk(rk && rl && rr && ap && lp && ![rk, rl, rr, ap, lp].some(f => /myFocusShow|getFocusLevel|focusCycleOf/.test(f)),
      '★ 순위는 누적초 하나 — 표시 레벨·해금 레벨·회차를 안 쓴다');
    /* firebase-init */
    const sl = takeFn(FI, 'async setLeaderboardSec(') || '', ft = takeFn(FI, 'async fetchLeaderboardTop(') || '';
    chk(/await _whenAuthReady\(\);/.test(sl) && /set\(r, \{ sec: v, ts: serverTimestamp\(\) \}\)/.test(sl) && !/name|photo|nick/.test(sl.replace(/\/\*[\s\S]*?\*\//g, '')),
      '★ setLeaderboardSec — 대기선 뒤 · {sec, ts} 만(이름·사진 없음) · ts 는 서버 시각');
    chk(/Number\(cur\.sec\) === v\) return \{ ok:true, sec: v, same:true \}/.test(sl), '★ 서버 줄과 같은 sec 면 안 쓴다 — 부팅·기기마다 ts 가 새로 찍혀 동점에서 밀리지 않게');
    chk(/const CAP = 999\*3600\*100;/.test(sl), '  어댑터 상한 = 누적 상한');
    chk(/query\(ref\(db, 'leaderboard'\), orderByChild\('sec'\), limitToLast\(100\)\)/.test(ft) && /return null;/.test(ft), '★ fetchLeaderboardTop — sec 정렬 상위 100줄 · 실패는 null');
    /* 규칙 */
    let RU = null; try { RU = JSON.parse(fs.readFileSync('firebase-database-rules.json', 'utf8')).rules; } catch (_){}
    if (!RU) say('  · 규칙 파일이 없다 — 규칙 대조 건너뜀');
    else {
      const lb = RU.leaderboard || {}, row = lb.$userId || {};
      const own = ((RU.users || {}).$userId || {}).focus || {};
      chk(lb['.read'] === "query.orderByChild == 'sec' && query.limitToLast <= 100" && lb['.indexOn'] === 'sec', '★ 목록 읽기는 sec 정렬 · 100줄 이하만 · 색인 sec');
      chk(!!row['.write'] && row['.write'] === String(own['.write'] || '').replace(/\$userId/g, '$userId'), '★ 쓰기는 본인만 — users/$userId/focus 와 같은 소유권 식');
      chk(row.$other && row.$other['.validate'] === false && /hasChildren\(\['sec','ts'\]\)/.test(row['.validate'] || ''), '  sec·ts 둘 다 · 다른 키 거부($other)');
      chk(/<= 359640000$/.test((row.sec || {})['.validate'] || '') && /newData\.val\(\) >= 0/.test((row.sec || {})['.validate'] || ''), '  sec 0 ~ 누적 상한');
      chk(/newData\.val\(\) <= now \+ 60000/.test((row.ts || {})['.validate'] || ''), '  ts ≤ now + 60초');
    }
    /* 떼어 와 돌린다 — rankOf · rankLabel · 그리기 */
    if (rk && rl && rr && ap && lp){
      const mkEl = () => { const cl = new Set(); return { style: { display: 'none', marginBottom: '8px' }, textContent: '', classList: { toggle(c, on){ on ? cl.add(c) : cl.delete(c); }, has: c => cl.has(c) } }; };
      const mk = (opts) => {
        const els = {}; ['miRank','miRankV','miHalo','miCrown','miTopBar'].forEach(id => els[id] = mkEl());
        const env = { calls: 0, sets: [], rows: opts.rows, open: true, uid: opts.uid, now: 1e12 };
        const fb = {
          fetchLeaderboardTop(){ env.calls++; return Promise.resolve(typeof env.rows === 'function' ? env.rows() : env.rows); },
          setLeaderboardSec(u, v){ env.sets.push([u, v]); return Promise.resolve({ ok: true, same: false }); },
        };
        const f = new Function('document', 'window', 'env', `
          const firebaseAPI = window.firebaseAPI; const Date = { now: () => env.now };
          const _acctDetached = false;
          function getMyUserId(){ return env.uid; }
          function _miIsOpen(){ return env.open; }
          const LB_TOP_N = 100, LB_CACHE_MS = 60*1000;
          ${rk}\n${rl}
          let _lbSent = null, _miRankCache = null, _miRankSeq = 0;
          ${lp}\n${ap}\n${rr}
          return { rankOf, rankLabel, render: _miRenderRank, push: _lbPush, cache: () => _miRankCache };`);
        return Object.assign(f({ getElementById: id => els[id] || null }, { firebaseAPI: fb }, env), { els, env });
      };
      const flush = () => new Promise(r => setImmediate(r));
      const v0 = mk({ rows: [], uid: 'uMe' });
      /* rankOf */
      const R100 = Array.from({ length: 100 }, (_, i) => ({ uid: 'u' + i, sec: 100000 - i, ts: 5 }));
      chk(v0.rankOf(R100, 'u0') === 1 && v0.rankOf(R100, 'u56') === 57 && v0.rankOf(R100, 'u99') === 100, '★ 누적초 내림차순 — 1 · 57 · 100위');
      chk(v0.rankOf(R100, 'uX') === null && v0.rankOf(null, 'u0') === null && v0.rankOf(R100, null) === null, '  표에 없으면 · 이상한 입력이면 null');
      const R101 = R100.concat([{ uid: 'uLow', sec: 1, ts: 1 }]);
      chk(v0.rankOf(R101, 'uLow') === null, '★ 101번째는 null — 100위 밖');
      const tie = [{ uid: 'uA', sec: 500, ts: 30 }, { uid: 'uB', sec: 500, ts: 10 }, { uid: 'uC', sec: 900, ts: 99 }, { uid: 'uD', sec: 500, ts: 20 }];
      chk(v0.rankOf(tie, 'uC') === 1 && v0.rankOf(tie, 'uB') === 2 && v0.rankOf(tie, 'uD') === 3 && v0.rankOf(tie, 'uA') === 4, '★ 동점은 먼저 도달(ts 작은) 사람이 위 — 키 순이 아니다');
      chk(v0.rankOf([{ uid: 'uA', sec: 5, ts: 0 }, { uid: 'uB', sec: 5, ts: 7 }], 'uB') === 1, '  ts 가 없으면(0) 동점에서 뒤로');
      /* rankLabel */
      const L = [1, 2, 3, 4, 57, 100].map(n => v0.rankLabel(n));
      chk(L[0].text === '🥇 1위' && L[1].text === '🥈 2위' && L[2].text === '🥉 3위' && L[3].text === '4위' && L[4].text === '57위' && L[5].text === '100위', '★ 메달 🥇🥈🥉 은 1~3위 앞에만');
      chk(L.slice(0, 3).every(x => x.top) && !L[3].top && L[0].crown && !L[1].crown && !L[2].crown, '★ 1~3위 큰 글자 · 왕관은 1위만');
      chk([0, 101, null, 'x', 2.5, -1].every(n => v0.rankLabel(n) === null), '  1~100 밖 · 이상한 값은 null(자리 비움)');
      /* 그리기 */
      const show = (v) => ({ rank: v.els.miRank.style.display !== 'none', txt: v.els.miRankV.textContent, top: v.els.miRankV.classList.has('top'),
        halo: v.els.miHalo.style.display !== 'none', crown: v.els.miCrown.style.display !== 'none', gap: v.els.miTopBar.style.marginBottom });
      let v = mk({ rows: tie.concat([{ uid: 'uMe', sec: 99999, ts: 1 }]), uid: 'uMe' });
      v.render(); await flush();
      let s1 = show(v);
      chk(s1.rank && s1.txt === '🥇 1위' && s1.top && s1.halo && s1.crown && s1.gap === '22px', '★ 1위 — «🥇 1위» 큰 글자 · 왕관 · 후광 · 위 간격 22px');
      v = mk({ rows: tie.concat([{ uid: 'uMe', sec: 600, ts: 1 }]), uid: 'uMe' }); v.render(); await flush(); s1 = show(v);
      chk(s1.rank && s1.txt === '🥈 2위' && s1.top && !s1.halo && !s1.crown && s1.gap === '8px', '★ 2위 — 메달 · 큰 글자 · 왕관·후광 없음 · 간격 그대로(8px)');
      v = mk({ rows: R100.map(r => r.uid === 'u56' ? Object.assign({}, r, { uid: 'uMe' }) : r), uid: 'uMe' }); v.render(); await flush(); s1 = show(v);
      chk(s1.rank && s1.txt === '57위' && !s1.top && !s1.halo, '  57위 — 메달 없음 · 보통 글자');
      v = mk({ rows: R100, uid: 'uMe' }); v.render(); await flush(); s1 = show(v);
      chk(!s1.rank && s1.txt === '' && !s1.halo && !s1.crown && s1.gap === '8px', '★ 100위 밖 — 자리를 통째로 비운다(글자 없음)');
      v = mk({ rows: null, uid: 'uMe' }); v.render(); await flush(); s1 = show(v);
      chk(!s1.rank && !s1.halo && v.cache() === null, '★ 읽기 실패(null) — 조용히 비운다 · 캐시에 안 남긴다');
      v = mk({ rows: [{ uid: 'uMe', sec: 9, ts: 1 }], uid: null }); v.render(); await flush();
      chk(v.env.calls === 0 && !show(v).rank, '  uid 없으면 읽지도 않는다');
      /* 캐시 60초 */
      v = mk({ rows: [{ uid: 'uMe', sec: 9, ts: 1 }], uid: 'uMe' }); v.render(); await flush();
      v.env.rows = [{ uid: 'uX', sec: 99, ts: 1 }, { uid: 'uMe', sec: 9, ts: 1 }];
      v.env.now += 30000; v.render(); await flush();
      chk(v.env.calls === 1 && show(v).txt === '🥇 1위', '★ 60초 안에 다시 열면 읽지 않고 캐시 그대로');
      v.env.now += 31000; v.els.miRankV.textContent = ''; v.render();
      chk(show(v).txt === '🥇 1위', '  캐시가 지나도 새 값이 오기 전엔 옛 값을 먼저 그린다(깜빡임 없음)');
      await flush();
      chk(v.env.calls === 2 && show(v).txt === '🥈 2위', '★ 60초가 지나면 새로 읽는다');
      v.env.uid = 'uOther'; v.env.rows = [{ uid: 'uMe', sec: 9, ts: 1 }]; v.render();
      chk(!show(v).rank, '  계정이 바뀌면 남의 캐시를 안 보인다');
      await flush();
      v.env.open = false; v.env.uid = 'uMe'; v.env.now += 61000; v.env.rows = [{ uid: 'uMe', sec: 9, ts: 1 }]; v.render(); v.els.miRankV.textContent = '닫힘'; await flush();
      chk(v.env.calls === 4 && show(v).txt === '닫힘', '  [내 정보]가 닫힌 뒤 도착한 응답은 안 그린다');
      /* 올리기 — 같은 값이면 다시 안 부른다 · 바뀌면 캐시를 버린다 */
      v = mk({ rows: [{ uid: 'uMe', sec: 9, ts: 1 }], uid: 'uMe' }); v.render(); await flush();
      v.push('uMe', 3600.7); await flush(); v.push('uMe', 3600); await flush();
      chk(v.env.sets.length === 1 && v.env.sets[0][0] === 'uMe' && v.env.sets[0][1] === 3600, '★ 같은 값은 한 번만 올린다(정수 초)');
      chk(v.cache() === null, '  내 값이 바뀌면 순위 캐시를 버린다(다음에 열 때 새로)');
      v.push('uMe', 4000); await flush(); v.push('uOther', 4000); await flush();
      chk(v.env.sets.length === 3, '  값이 바뀌거나 계정이 바뀌면 다시 올린다');
    }
  }

  say('');
  say(`통과 ${pass} · 실패 ${fail}`);
  say(fail ? `✗ 실패 ${fail}건` : '✓ 전부 통과');
  process.exit(fail ? 1 : 0);
})().catch(e => { say('  ✗ 예외: ' + (e && e.stack || e)); process.exit(1); });

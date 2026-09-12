/* sim-invite-gate.js — 🎟️ 초대 게이트에 갇히는 경로
   실행: node sim-invite-gate.js   (app.js · smoke.js 와 같은 폴더에서)

   ⚠️ 이 검사가 생긴 이유 (2026-08 제보)
     "업데이트하니 갑자기 로그아웃됐다" — 실제로는 로그아웃이 아니라 **게이트에 갇힌 것**이었다.
     localStorage 는 멀쩡했고 tw.invitePassed 하나만 없었다. 원인 둘:
       ① 게이트가 꺼져 있던 기간에 통과 도장을 안 찍어서, 켜는 순간 그 시절 유저가 전원 떨어졌다
       ② 게이트의 구글 버튼이 "이 uid 는 이미 그 계정 것"(bound=false)을 **연결된 기록 없음**으로
          읽고 막았다 — 본인 확인이 끝났는데 실패로 뒤집혔다

   재는 것 넷:
   【1】 게이트가 꺼져 있어도 기존 기기에는 도장이 찍힌다 (신규 기기에는 안 찍힌다)
   【2】 이미 묶인 계정으로 로그인하면 alreadyOwner 로 답하고 도장을 찍는다
   【3】 첫 결속(bound=true)은 자격이 아니다 — 도장이 안 찍힌다
   【4】 게이트를 밖에서 닫는 문(_inviteGatePass)이 열려 있다
*/
'use strict';
const fs = require('fs'), vm = require('vm');

let smokeSrc = fs.readFileSync('smoke.js', 'utf8');
const cut = smokeSrc.indexOf('/* ── 실행');
smokeSrc = smokeSrc.slice(0, cut).split('\n')
  .filter(l => !/require\(|const FILE =|if \(!FILE\)|process\.exit/.test(l)).join('\n');
vm.runInThisContext(smokeSrc, { filename: 'smoke-stubs.js' });

globalThis.setTimeout = () => 0;
globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};

let fail = 0;
const say = console.log;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

/* ── 소스에서 직접 보는 것 — 실행으로는 재기 어려운 부팅 분기 ── */
const src = fs.readFileSync('app.js', 'utf8');

say('\n【1】 게이트가 꺼져 있을 때');
const offBlock = /if\(!INVITE_GATE_ENABLED\)\{[\s\S]{0,1400}?\n  \}/.exec(src);
chk(!!offBlock, '게이트 꺼짐 분기를 찾았다');
chk(!!offBlock && /_markInvitePassed\(\)/.test(offBlock[0]),
    '**통과 도장을 찍는다** — 이게 없으면 나중에 켤 때 그 시절 유저가 전원 갇힌다');
chk(!!offBlock && /HAD_USER_ID_AT_BOOT/.test(offBlock[0]),
    '이미 쓰던 기기에만 찍는다 (방금 깐 사람은 대상이 아니다)');

/* ── 실행해서 재는 것 ── */
const probe = `
;globalThis.__G = {
  login: () => _loginDoGoogle(),
  passed: () => { try{ return localStorage.getItem(INVITE_PASS_KEY); }catch(_){ return null; } },
  clearPass: () => { try{ localStorage.removeItem(INVITE_PASS_KEY); }catch(_){} },
  myId: () => getMyUserId(),
};`;

const quiet = console.log; console.log = () => {}; console.warn = () => {};
try { vm.runInThisContext(src + probe, { filename: 'app.js' }); }
catch (e) { console.log = quiet; say('✗ app.js 평가 실패: ' + (e && e.stack || e).toString().split('\n').slice(0, 4).join('\n')); process.exit(1); }
console.log = quiet;

const G = globalThis.__G;
const ME = G.myId();

globalThis.window = globalThis.window || globalThis;
window.companion = { signInWithGoogle: () => Promise.resolve({ ok: true, idToken: 'tok' }) };
let SERVER = null;   // authSignInWithGoogle 이 돌려줄 값
const api = {
  authSignInWithGoogle: () => Promise.resolve(SERVER),
  setAccountSnapshot: () => Promise.resolve(),
  fetchAccountSnapshot: () => Promise.resolve(null),
};
window.firebaseAPI = api; globalThis.firebaseAPI = api;

(async () => {
  say('\n【2】 이미 묶인 계정으로 로그인 (제보자의 경우)');
  G.clearPass();
  SERVER = { ok: true, uid: 'g-1', email: '7@gmail.com', userCode: ME, bound: false };
  let r = await G.login();
  chk(r.ok && r.switched === false, '갈아탈 것은 없다고 답한다');
  chk(r.alreadyOwner === true, '**정식 주인으로 인정한다** (예전에는 이 구분 자체가 없었다)');
  chk(G.passed() === '1', '통과 도장이 찍힌다 — 다음 부팅부터는 게이트가 안 뜬다');

  say('\n【3】 이 구글 계정의 첫 결속');
  G.clearPass();
  SERVER = { ok: true, uid: 'g-2', email: 'new@gmail.com', userCode: ME, bound: true };
  r = await G.login();
  chk(r.ok && r.alreadyOwner === false, '자격으로 치지 않는다');
  chk(G.passed() === null, '**도장이 안 찍힌다** — 방금 깐 사람이 로그인만으로 들어오면 안 된다');

  say('\n【4】 게이트를 밖에서 닫는 문');
  chk(/window\._inviteGatePass\s*=/.test(src), '_showInviteGate 가 문을 열어둔다');
  const handler = /if\(r\.alreadyOwner\)\{[\s\S]{0,900}?\n      \}/.exec(src);
  chk(!!handler && /window\._inviteGatePass/.test(handler[0]), '게이트의 구글 버튼이 그 문을 쓴다');
  chk(!!handler && !/relaunch|다시 실행/i.test(handler[0].split('else')[0]),
      'uid 가 안 바뀌었으므로 **재시작을 요구하지 않는다**');
  const stuck = /이 계정에는 아직 연결된 기록이 없어요/.test(src);
  chk(stuck, '첫 결속용 안내 문구는 그대로 남아 있다 (그 경우엔 맞는 말이다)');

  say(fail ? '\n✗ ' + fail + '개 실패' : '\n✓ 전부 통과');
  process.exit(fail ? 1 : 0);
})();

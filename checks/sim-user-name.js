/* sim-user-name.js — 🏷️ 닉네임 저장(user-name.js — commitUserName · USER_NAME_MAX)
   실행:  node sim-user-name.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 닉네임 저장은 마이홈 이름 · 내 정보 두 제자리 편집이 같이 부르는 한 벌이다. 설정 창(program-settings.js)에 같이
     있어서 두 화면이 설정 창을 바라봤고, 설정 창은 다른 기능을 많이 부르는 위층이라 순환이 됐다(sim-dep-cycles · 모듈 순환 끊기 7).
   ・1절: 저장 — 12자로 자른다 · 비우면 «나» · 운영진처럼 보이는 이름은 막는다(관리자 · 이미 그 이름이면 예외) · 프로필 · 방 이름표 · 마이홈 표시 갱신
   ・2절: 연결 — HTML 순서(name-guard.js 뒤 · app.js 앞) · app.js 는 설정 창 만드는 줄 바로 앞에서 만든다 · 부르는 곳은 userNameMod.이름
   ・3절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('account/user-name.js'), GUARD = read('account/name-guard.js'), HTML = read('desk-companion-prototype.html'), APP = read('app.js');
if (!MOD || !GUARD || !HTML || !APP) { say('  ? 원본 못 찾음 — user-name.js · name-guard.js · desk-companion-prototype.html · app.js'); process.exit(2); }

function build(mod, o) {
  const env = { name: o.name || '', toasts: [], profiles: [], plates: [], errs: [], admin: !!o.admin, active: o.active !== false };
  const win = { firebaseAPI: {} };
  const nameEl = { textContent: '' };
  const document = { getElementById: (id) => id === 'mhMyName' ? nameEl : null };
  const isStaffName = new Function(GUARD + '\nreturn isStaffName;')();   // name-guard.js 는 맨 위 함수 선언(app.js 앞 classic script)
  const api = new Function('window', 'document', 'firebaseAPI', 'isStaffName', 'module', mod + '\nreturn window.TwUserName;')(win, document, win.firebaseAPI, isStaffName, undefined);
  const m = api.createUserName({
    Presence: { active: () => env.active, setName: (n) => env.plates.push(n) },
    getDisplayName: () => env.name || '나', getMyUserId: () => ('uid' in o ? o.uid : 'u1'), getUserName: () => env.name,
    isAdmin: () => env.admin, setUserName: (v) => { env.name = v; }, toast: (t) => env.toasts.push(t),
    saveNameOnServer: (n) => { env.profiles.push([n]); return Promise.resolve(o.reject ? { ok: false, err: { kind: 'request', code: o.reject } } : { ok: true }); },
    notifyError: (code, e) => { env.errs.push(code); },
  });
  return { m, env, win, nameEl };
}
function judge(mod, html, app) {
  const r = {};
  try {
    let b = build(mod, {});
    r.max = b.m.USER_NAME_MAX === 12;
    b.m.commitUserName('  가나다라마바사아자차카타파하  ');
    r.cut = b.env.name === '가나다라마바사아자차카타' && b.env.toasts[0] === '이름이 저장됐어요';
    r.side = b.env.profiles.length === 1 && b.env.profiles[0].join() === '가나다라마바사아자차카타' && b.env.plates[0] === '가나다라마바사아자차카타' && b.nameEl.textContent === '가나다라마바사아자차카타';
    b.m.commitUserName('   '); r.empty = b.env.name === '나';
    b = build(mod, {}); b.m.commitUserName('운영자'); r.staff = b.env.name === '' && /운영진/.test(b.env.toasts[0] || '') && !b.env.profiles.length;
    b = build(mod, { admin: true }); b.m.commitUserName('운영자'); r.admin = b.env.name === '운영자';
    b = build(mod, { name: '운영자' }); b.m.commitUserName('운영자'); r.same = b.env.toasts[0] === '이름이 저장됐어요';
    b = build(mod, { active: false }); b.m.commitUserName('아무개'); r.noRoom = b.env.plates.length === 0 && b.env.name === '아무개';
    r.win = typeof b.win.commitUserName === 'function';
    b = build(mod, { uid: null }); b.m.commitUserName('아무개'); r.noUid = b.env.profiles.length === 0 && b.env.name === '아무개' && b.env.toasts[0] === '이름이 저장됐어요';
  } catch (e) { r.err = String(e && e.message || e); }
  const order = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
  const at = order.indexOf('account/user-name.js');
  r.order = at > order.indexOf('account/name-guard.js') && order.indexOf('account/name-guard.js') >= 0 && at < order.indexOf('app.js');
  const iU = app.indexOf('const userNameMod = TwUserName.'), iP = app.indexOf('const progSettingsMod = TwProgramSettings.');
  r.made = iU > 0 && iP > iU && iP - iU < 1200;
  r.callers = (app.match(/userNameMod\.(commitUserName|USER_NAME_MAX)\b/g) || []).length;
  r.old = (app.match(/progSettingsMod\.(commitUserName|USER_NAME_MAX)\b/g) || []).length;
  return r;
}
const R = judge(MOD, HTML, APP);

say('── 1. 저장');
chk(!R.err && R.max && R.cut, '앞뒤 빈칸을 지우고 12자로 자른다 · «이름이 저장됐어요»' + (R.err ? ' — ' + R.err : ''));
chk(R.side, '저장 뒤 서버 계정 이름(PATCH /v1/me) · 방 이름표 · 마이홈 표시를 같은 값으로 갱신');
chk(R.empty, '비우면 «나»');
chk(R.staff && R.admin && R.same, '운영진처럼 보이는 이름은 막는다 — 관리자 · 이미 그 이름인 사람은 예외(name-guard.js)');
chk(R.noRoom, '방에 없으면 이름표는 안 건드린다');
chk(R.win, 'window.commitUserName 도 예전처럼 건다');
chk(R.noUid, '내 코드 없음(로그인 전) — 서버 요청 0 · 이름은 이 기기에 저장 · «이름이 저장됐어요» 그대로');
const REJ = (async () => {
  /* 서버가 거절하면 — 쓸 수 없는 이름은 그 문구, 그 밖은 번호 토스트(E-ACC-01) · 잡히지 않은 오류 없음 */
  const caught = []; const onU = (e) => caught.push(e);
  process.on('unhandledRejection', onU);
  let b1, b2;
  try {
    b1 = build(MOD, { reject: 'NETWORK' }); b1.m.commitUserName('아무개');
    b2 = build(MOD, { reject: 'USER_RESERVED_NAME' }); b2.m.commitUserName('아무개');
    await new Promise(r => setTimeout(r, 20));
  } finally { process.off('unhandledRejection', onU); }
  chk(!caught.length && b1.env.errs.join() === 'E-ACC-01' && b1.env.name === '아무개', '서버 저장 실패 — 번호 토스트(E-ACC-01) · 이름은 이 PC 에 남음');
  chk(b2.env.errs.length === 0 && b2.env.toasts.some(t => /운영진/.test(t)), '서버가 쓸 수 없는 이름(USER_RESERVED_NAME)으로 거절 — 그 문구');
})();

say('── 2. 연결');
chk(R.order, 'html — name-guard.js 뒤 · app.js 앞에 싣는다');
chk(R.made, 'app.js 는 설정 창 만드는 줄 바로 앞(원래 자리)에서 만든다');
chk(R.callers >= 3 && R.old === 0, '부르는 곳은 userNameMod.이름(' + R.callers + '곳) · 설정 창 이름으로 부르는 곳 없음');

say('── 3. 일부러 깨 보기');
chk(!judge(MOD.replace('.slice(0, USER_NAME_MAX)', ''), HTML, APP).cut, '자르기를 빼면 빨강');
chk(!judge(MOD.replace("  if(isStaffName(v) && v !== getUserName().trim() && !(typeof isAdmin() !== 'undefined' && isAdmin())){", '  if(false){'), HTML, APP).staff, '운영진 이름 막기를 빼면 빨강');
chk(!judge(MOD.replace('if(getMyUserId()) Promise.resolve(saveNameOnServer(', 'if(true) Promise.resolve(saveNameOnServer('), HTML, APP).noUid, '내 코드 확인을 빼면 빨강');
chk(!judge(MOD, HTML.replace('<script src="parts/account/user-name.js"></script>', ''), APP).order, 'html 줄이 빠지면 빨강');
chk(judge(MOD, HTML, APP + '\nprogSettingsMod.commitUserName("x");\n').old > 0, '설정 창 이름으로 부르면 빨강');

REJ.then(() => {
  say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 닉네임 저장은 user-name.js 한 벌'));
  process.exit(fail ? 1 : 0);
});

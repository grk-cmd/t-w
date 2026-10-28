/* sim-user-api.js — 🪪 계정 provider(account/user-api.js) 검사 — 진짜 API 통로(api-client.js) · 가짜 fetch 로 그대로 돌린다
   ・1절: 내 계정 — GET /v1/me 에 토큰 · 기기 머리 · 모양 맞추기(빠진 칸이면 null) · 401 USER_CODE_NOT_BOUND 는 던진다(없음 ≠ 실패)
   ・2절: 가입 — 비밀번호 길은 토큰 없이 { password, requestId, inviteCode? } · 구글 길은 토큰으로 { inviteCode? } · 빈 초대 코드는 안 실음
   ・3절: 고치기 · 비밀번호 · 탈퇴 — PATCH /v1/me · password-login · password · withdrawal-preview(파일 수 모름 = null) · withdrawal { confirm:'탈퇴' }
   ・4절: 초대 · 찾기 — 모양이 틀린 코드는 묻지 않음 · 토큰 없이 확인 · usable · 까닭 · 내 초대 · 새 초대 requestId · 친구코드 찾기
   ・5절: 방문 기록 — 토큰이 있으면 싣고 · 토큰이 없거나 거절되면 토큰 없이 한 번 더 · 닿지 못함은 던짐
   ・6절: 문구 표 — 아는 code · 닿지 못함 · 그 밖 · 초대 까닭
   ・7절: 배선 — window.TwUserApi.store · html 차례(api-client · request-id 다음 · app.js 앞)
   ・8절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find((v) => v != null);
const at = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f];
const SRC0 = {
  UA: pick(at('user-api.js', 'account')),
  AC: pick(at('api-client.js', 'shared')),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src, win) => { const m = { exports: {} }; new Function('module', 'window', src)(win ? undefined : m, win); return win || m.exports; };

const TOKEN = 'h.' + Buffer.from(JSON.stringify({ sub: 'auth1' })).toString('base64') + '.s';
const ME = { userCode: 'u1234567890', friendCode: 'MATE-AB12', displayName: '나', awayImage: null, presencePref: { locked: true, online: false },
  hasPasswordLogin: true, admin: false, premium: true, premiumGraceSec: 86400, version: 3 };

/* 가짜 fetch — 경로마다 답을 정하고 보낸 것을 적는다 */
function mkEnv(S, answer, opt){
  const AC = load(S.AC), UA = load(S.UA);
  const sent = [];
  let token = (opt && 'token' in opt) ? opt.token : TOKEN;
  const fetch = async (url, init) => {
    const path = url.replace('https://api.test', '');
    const rec = { path, method: init.method, auth: init.headers.Authorization || null, dev: init.headers['X-Device-Id'] || null,
      body: init.body === undefined ? undefined : JSON.parse(init.body) };
    sent.push(rec);
    const a = answer(rec) || { status: 404, body: { success: false, code: 'NOT_FOUND' } };
    return { status: a.status, ok: a.status >= 200 && a.status < 300, headers: { get: () => null }, json: async () => a.body };
  };
  const api = AC.createApiClient({ baseUrl: 'https://api.test', fetch, backoffMs: 0, getToken: async () => token, deviceId: () => 'dev-0001' });
  const ua = UA.createUserApi({ api: () => api, newId: () => 'req-00000001' });
  return { AC, UA, ua, sent, setToken: (t) => { token = t; } };
}
const ok = (data) => ({ status: 200, body: { success: true, data } });
const err = (status, code) => ({ status, body: { success: false, code, message: '서버 문구' } });
const threw = async (p) => { try{ await p; return null; }catch(e){ return e; } };

async function judge(S){
  say('── 1. 내 계정');
  {
    const e = mkEnv(S, (r) => (r.path === '/v1/me' && r.method === 'GET') ? ok(ME) : null);
    const me = await e.ua.me();
    const s = e.sent[0];
    chk(s && s.auth === 'Bearer ' + TOKEN && s.dev === 'dev-0001', 'GET /v1/me 에 토큰 · 기기 머리(X-Device-Id)');
    chk(me && me.userCode === 'u1234567890' && me.friendCode === 'MATE-AB12' && me.version === 3 && me.premium === true && me.premiumGraceSec === 86400,
      '  ↳ 받은 값을 그대로 · 버전 · 프리미엄 · 유예');
    chk(me && me.presencePref.locked === true && me.presencePref.online === false && me.hasPasswordLogin === true, '  ↳ 접속 고정 · 비밀번호 로그인 여부');
    const bad = [null, {}, Object.assign({}, ME, { userCode: 'x' }), Object.assign({}, ME, { version: '3' }), Object.assign({}, ME, { friendCode: '' })];
    chk(bad.every((b) => e.UA.meFrom(b) === null), '  ↳ 꼭 있어야 할 칸이 빠지거나 모양이 틀리면 null(받은 값을 믿지 않음)');
    const e2 = mkEnv(S, () => err(401, 'USER_CODE_NOT_BOUND'));
    const x = await threw(e2.ua.me());
    chk(x && x.kind === 'auth' && x.code === 'USER_CODE_NOT_BOUND', '가입 전(401 USER_CODE_NOT_BOUND)은 던진다 — 없음과 실패를 가른다');
    const e3 = mkEnv(S, () => null, { token: null });
    const y = await threw(e3.ua.me());
    chk(y && y.code === 'NO_TOKEN' && e3.sent.length === 0, '토큰이 없으면 보내지 않고 NO_TOKEN');
  }

  say('── 2. 가입');
  {
    const e = mkEnv(S, (r) => (r.path === '/v1/users' && r.method === 'POST') ? ok(ME) : null);
    const me = await e.ua.joinWithPassword({ password: 'pw1234', inviteCode: 'INVT-AAAA-BBBB', requestId: 'req-join-0001' });
    const s = e.sent[0];
    chk(s && s.auth === null && s.dev === null, '비밀번호 가입은 토큰 없이(서버가 로그인 계정까지 만든다)');
    chk(s && s.body.password === 'pw1234' && s.body.requestId === 'req-join-0001' && s.body.inviteCode === 'INVT-AAAA-BBBB', '  ↳ { password · requestId · inviteCode }');
    chk(me && me.friendCode === 'MATE-AB12', '  ↳ 답의 친구코드(그 코드로 로그인)');
    await e.ua.joinWithPassword({ password: 'pw1234' });
    const s2 = e.sent[1];
    chk(s2 && !('inviteCode' in s2.body) && s2.body.requestId === 'req-00000001', '  ↳ 초대 코드가 없으면 안 싣고 · 요청 번호가 없으면 새로');
    await e.ua.joinWithGoogle({ inviteCode: 'INVT-CCCC-DDDD' });
    const s3 = e.sent[2];
    chk(s3 && s3.auth === 'Bearer ' + TOKEN && s3.body.inviteCode === 'INVT-CCCC-DDDD' && !('password' in s3.body) && !('requestId' in s3.body),
      '구글 가입은 토큰으로 { inviteCode } 만(password · requestId 를 실으면 서버가 거절)');
    await e.ua.joinWithGoogle({});
    chk(e.sent[3] && Object.keys(e.sent[3].body).length === 0, '  ↳ 초대 코드가 없으면 빈 본문');
  }

  say('── 3. 고치기 · 비밀번호 · 탈퇴');
  {
    const e = mkEnv(S, (r) => {
      if(r.path === '/v1/me' && r.method === 'PATCH') return ok(Object.assign({}, ME, { displayName: r.body.displayName || ME.displayName, version: 4 }));
      if(r.path === '/v1/me/password-login') return ok(ME);
      if(r.path === '/v1/me/password') return ok(null);
      if(r.path === '/v1/me/withdrawal-preview') return ok({ items: 12, files: null, byContext: [{ context: 'avatar', count: 3 }] });
      if(r.path === '/v1/me/withdrawal') return { status: 202, body: { success: true, data: null } };
      return null;
    });
    const m = await e.ua.updateMe({ version: 3, displayName: '새이름' });
    chk(e.sent[0].method === 'PATCH' && e.sent[0].body.version === 3 && e.sent[0].body.displayName === '새이름' && m.version === 4, 'PATCH /v1/me { version · displayName } → 새 버전');
    await e.ua.attachPasswordLogin('pw9999');
    chk(e.sent[1].path === '/v1/me/password-login' && e.sent[1].body.password === 'pw9999' && e.sent[1].auth, '비밀번호 붙이기 POST /v1/me/password-login { password }');
    await e.ua.changePassword('pw7777');
    chk(e.sent[2].path === '/v1/me/password' && e.sent[2].body.newPassword === 'pw7777', '비밀번호 바꾸기 POST /v1/me/password { newPassword }');
    const p = await e.ua.withdrawalPreview();
    chk(p && p.items === 12 && p.files === null && p.byContext.length === 1, '탈퇴 미리보기 { items · files(셀 수 없으면 null) · byContext }');
    await e.ua.withdraw();
    chk(e.sent[4].path === '/v1/me/withdrawal' && e.sent[4].body.confirm === '탈퇴', '탈퇴 POST /v1/me/withdrawal { confirm:«탈퇴» } (202)');
    const e2 = mkEnv(S, () => err(403, 'USER_REAUTH_REQUIRED'));
    const x = await threw(e2.ua.withdraw());
    chk(x && x.code === 'USER_REAUTH_REQUIRED', '  ↳ 오래된 로그인은 던진다(부르는 쪽이 다시 확인 뒤 한 번 더)');
  }

  say('── 4. 초대 · 찾기');
  {
    const e = mkEnv(S, (r) => {
      if(r.path === '/v1/invites/INVT-AAAA-BBBB') return ok({ usable: true });
      if(r.path === '/v1/invites/INVT-FULL-0000') return ok({ usable: false, reason: 'FULL' });
      if(r.path === '/v1/me/invites' && r.method === 'GET') return ok({ invitesLeft: 2, invites: [{ code: 'INVT-X', used: false, createdAt: 'x' }] });
      if(r.path === '/v1/me/invites' && r.method === 'POST') return ok({ code: 'INVT-NEW1-0000' });
      if(r.path.indexOf('/v1/users?friendCode=') === 0) return ok([{ userCode: 'u9999999999', displayName: '친구' }]);
      return null;
    });
    const a = await e.ua.checkInvite(' invt-aaaa-bbbb ');
    chk(a.usable === true && e.sent[0].auth === null && e.sent[0].path === '/v1/invites/INVT-AAAA-BBBB', '초대 확인 — 대문자 · 토큰 없이 · usable');
    const b = await e.ua.checkInvite('INVT-FULL-0000');
    chk(b.usable === false && b.reason === 'FULL', '  ↳ 못 쓰면 까닭');
    const before = e.sent.length;
    const c = await e.ua.checkInvite('../v1/me');
    chk(c.usable === false && e.sent.length === before, '  ↳ 모양이 틀린 입력은 서버에 묻지 않는다(경로에 싣지 않음)');
    const mi = await e.ua.myInvites();
    chk(mi && mi.invitesLeft === 2 && mi.invites.length === 1, '내 초대 { invitesLeft · invites }');
    const ni = await e.ua.createInvite('req-inv-00001');
    const last = e.sent[e.sent.length - 1];
    chk(ni.code === 'INVT-NEW1-0000' && last.body.requestId === 'req-inv-00001', '새 초대장 { requestId } → { code }');
    const f = await e.ua.findByFriendCode('mate-ab12');
    chk(f.length === 1 && f[0].userCode === 'u9999999999' && e.sent[e.sent.length - 1].path === '/v1/users?friendCode=MATE-AB12', '친구코드 찾기 — 대문자 · [{ userCode · displayName }]');
  }

  say('── 5. 방문 기록');
  {
    const e = mkEnv(S, (r) => (r.path === '/v1/metrics/visits') ? { status: 204, body: null } : null);
    const r1 = await e.ua.visit();
    chk(r1 === true && e.sent.length === 1 && e.sent[0].auth === 'Bearer ' + TOKEN, '로그인돼 있으면 토큰을 싣고 한 번(204)');
    const e2 = mkEnv(S, (r) => (r.path === '/v1/metrics/visits') ? { status: 204, body: null } : null, { token: null });
    await e2.ua.visit();
    chk(e2.sent.length === 1 && e2.sent[0].auth === null, '토큰이 없으면 토큰 없이(익명 방문)');
    const e3 = mkEnv(S, (r) => (r.path === '/v1/metrics/visits') ? (r.auth ? err(401, 'INVALID_TOKEN') : { status: 204, body: null }) : null);
    await e3.ua.visit();
    chk(e3.sent.length === 2 && e3.sent[1].auth === null, '토큰이 거절되면 토큰 없이 한 번 더');
    const e4 = mkEnv(S, () => ({ status: 503, body: null }));
    const x = await threw(e4.ua.visit());
    chk(x && x.kind === 'unavailable' && e4.sent.length === 1, '닿지 못하면 한 번만 보내고 던진다(부르는 쪽이 삼킨다)');
  }

  say('── 6. 문구 표');
  {
    const U = load(S.UA);
    chk(U.reasonOf({ kind: 'request', code: 'USER_WEAK_PASSWORD' }).indexOf('6자') >= 0, '아는 code — 표의 문구');
    chk(U.reasonOf({ kind: 'unavailable', code: 'NETWORK' }) === U.OFFLINE_REASON && U.reasonOf(null) === U.OFFLINE_REASON, '닿지 못함 · 오류 없음 — 연결 확인 문구');
    chk(U.reasonOf({ kind: 'request', code: 'SOMETHING_NEW' }) === U.UNKNOWN_REASON, '모르는 code — 처리 못 함 문구(서버 message 를 그대로 쓰지 않음)');
    chk(U.inviteReasonOf('EXPIRED').indexOf('기한') >= 0 && U.inviteReasonOf('???') !== '', '초대 까닭 — 기한 · 모르는 까닭도 한 줄');
  }

  say('── 7. 배선');
  {
    const win = { TwApi: { authed: null }, TwRequestId: { newId: () => 'x' } };
    load(S.UA, win);
    chk(win.TwUserApi && win.TwUserApi.store && typeof win.TwUserApi.store.me === 'function', 'window.TwUserApi.store — 앱 한 벌(통로는 부를 때 찾음)');
    const H = S.HTML;
    const iUA = H.indexOf('<script src="parts/account/user-api.js"></script>');
    const iAC = H.indexOf('<script src="parts/shared/api-client.js"></script>');
    const iRI = H.indexOf('<script src="parts/shared/request-id.js"></script>');
    const iApp = H.indexOf('<script src="parts/app.js"');
    chk(iUA > iAC && iUA > iRI && iApp > iUA && iAC > 0, 'html — api-client · request-id 다음 · app.js 앞');
  }
}

(async () => {
await judge(SRC0);

say('── 8. 일부러 깨 보기');
const BREAKS = [
  ['UA', "return meFrom(await api().post('/v1/users', body, { auth: false }));", "return meFrom(await api().post('/v1/users', body));", '비밀번호 가입에 토큰을 실음'],
  ['UA', "    if(o.inviteCode) body.inviteCode = o.inviteCode;\n    return meFrom(await api().post('/v1/users', body, { auth: false }));", "    body.inviteCode = o.inviteCode || '';\n    return meFrom(await api().post('/v1/users', body, { auth: false }));", '빈 초대 코드를 실음'],
  ['UA', "const WITHDRAW_CONFIRM = '탈퇴';", "const WITHDRAW_CONFIRM = '삭제';", '탈퇴 확인 글자가 서버와 다름'],
  ['UA', "  if(!/^u[0-9a-z]{8,40}$/i.test(userCode) || !friendCode || typeof d.version !== 'number') return null;", '', '모양이 틀린 계정을 믿음'],
  ['UA', "    if(!INVITE_RE.test(c)) return { usable: false, reason: 'NOT_FOUND', code: c };", '', '틀린 입력을 경로에 실음'],
  ['UA', "      if(!(e && e.kind === 'auth')) throw e;", "      throw e;", '토큰 거절 방문을 버림'],
  ['UA', "      if(!(e && e.kind === 'auth')) throw e;", "", '닿지 못한 방문을 두 번 보냄'],
  ['UA', "  if(code && Object.prototype.hasOwnProperty.call(REASONS, code)) return REASONS[code];", "  if(err && err.message) return err.message;", '서버 message 를 그대로 보여 줌'],
  ['UA', "{ password: String(password || '') })); }", "{ pw: String(password || '') })); }", '비밀번호 붙이기 칸 이름이 다름'],
  ['HTML', '<script src="parts/account/user-api.js"></script>', '', 'html 에 안 실음'],
];
const caught = [];
for(const [where, from, to, what] of BREAKS){
  if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
  quiet = true; qfail = 0;
  try{ await judge(S); }catch(_){ qfail++; }
  quiet = false;
  caught.push([what, qfail]);
}
const missed = caught.filter(([, k]) => k === 0).map(([w]) => w);
chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

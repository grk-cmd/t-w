/* ═══ 🔑 sim-password-reset.js — 비밀번호 초기화(adminResetPassword · functions/password-reset.js · 2026-10-17 신설) ═══════════════
   [왜] 비밀번호를 잊은 사용자(🐞 제보로 연락)를 관리자가 웹 관리자 사용자 상세에서 임시 비밀번호로 풀어 준다.
     남의 로그인 계정을 바꾸는 일이라 «관리자만 · 근거(메모 — 제보 번호 · 연락 경로) · 기록 · 비밀번호는 어디에도 안 남김» 을 지켜야 한다.
   ・1절: 임시 비밀번호 — 8자 · 헷갈리는 글자 없음 · 넘치는 바이트 버림(치우침 없음) · 매번 다름
   ・2절: 막기 — 로그인 없음 · 익명 · 관리자 아님 · 메모 없음/빈칸 · 없는 사용자 · 관리자 계정 · 친구 코드 확인 안 됨 · 남에게 묶인 이메일 계정 · 연결 경합 → 아무것도 안 바꾼다(경합은 만든 계정을 지움)
   ・3절: 초기화 — 친구 코드 · 뒤 4자리 · 사용자 코드로 찾기 · 비밀번호 바꾸기 → 다른 PC 로그인 끊기 순서 · 작업 기록(비밀번호 없음) · 돌려주는 값
   ・3-2절: 로그인 계정이 없는 옛 계정은 만들어 앱 가입과 같은 모양으로 묶고 · 끊긴 빈 계정은 다시 쓴다 · 구글 전용은 안 건드림
   ・4절: 배선 — index.js 내보내기 · 웹 관리자 함수 이름 · 작업 기록 이름표
   [실행] 러너 스테이징(평평한 폴더) 또는 저장소 루트에서. */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const FX = read('functions/index.js');
if(!FX || !read('functions/password-reset.js') || !read('functions/account-delete.js')){ say('  ? 원본 못 찾음 — functions/index.js · password-reset.js · account-delete.js'); process.exit(2); }
const M = require(path.resolve('functions/password-reset.js'));
const WA_FN = read('web-admin/src/features/user/reset-password/model/resetPassword.ts');
const WA_AUDIT = read('web-admin/src/shared/api/audit.ts');
const clone = (v) => JSON.parse(JSON.stringify(v));

const ADMIN = 'authAdmin', ME = 'uabc0000001', ADM_CODE = 'uadm0000002', GOO = 'ugoo0000003', NOAUTH = 'unoa0000004',
  OLD = 'uold0000005', ORPH = 'uorp0000006', STOLE = 'usto0000007', NOFC = 'unof0000008';
function world(opts = {}){
  const tree = {
    admins: { [ADMIN]: true, authAdm2: true },
    users: { [ME]: { friendCode: 'MATE-PW11', profile: { name: '잊은이' } }, [ADM_CODE]: { profile: { name: '관리' } },
      [GOO]: { friendCode: 'COZY-GO22' }, [OLD]: { friendCode: 'MATE-OLD1', profile: { name: '옛사람' } },
      [ORPH]: { friendCode: 'MATE-ORP1' }, [STOLE]: { friendCode: 'MATE-STO1' }, [NOFC]: { friendCode: 'MATE-NOF1' } },
    accountSnap: { [ME]: { friendCode: 'MATE-PW11', name: '잊은이' } },
    userAuth: { [ME]: 'authMe', [ADM_CODE]: 'authAdm2', [GOO]: 'authGoo' },
    authUsers: { authMe: { userCode: ME }, authAdm2: { userCode: ADM_CODE }, authGoo: { userCode: GOO }, authSomeoneElse: { userCode: 'uzzz0000099' } },
    // MATE-NOF1 은 friendCodes 에 다른 사람으로 — 이 사람 것으로 확인되지 않는다
    friendCodes: { 'MATE-PW11': { userId: ME }, 'COZY-GO22': { userId: GOO }, 'MATE-OLD1': { userId: OLD }, 'MATE-ORP1': { userId: ORPH }, 'MATE-STO1': { userId: STOLE }, 'MATE-NOF1': { userId: 'uzzz0000099' } },
  };
  const writes = [];
  const at = (p) => p.split('/').filter(Boolean).reduce((n, k) => (n && typeof n === 'object' ? n[k] : undefined), tree);
  const setAt = (p, v) => { const ks = p.split('/'); let n = tree; for (const k of ks.slice(0, -1)){ if (!n[k] || typeof n[k] !== 'object') n[k] = {}; n = n[k]; } n[ks[ks.length - 1]] = v; };
  const db = { ref: (p) => ({
    get: async () => ({ val: () => { const v = at(p); return v === undefined ? null : clone(v); } }),
    set: async (v) => { writes.push([p, clone(v)]); setAt(p, clone(v)); },
    transaction: async (fn) => {
      const cur = opts.raceUserAuth ? 'authRacer' : (at(p) === undefined ? null : at(p));
      const next = fn(cur);
      if (next === undefined) return { committed: false, snapshot: { val: () => cur } };
      writes.push([p, next]); setAt(p, next);
      return { committed: true, snapshot: { val: () => next } };
    },
  }) };
  const calls = [];
  const users = { authMe: { provider: 'password', hasPassword: true }, authAdm2: { provider: 'password', hasPassword: true }, authGoo: { provider: 'google.com', hasPassword: false } };
  // 이메일로 이미 있는 로그인 계정 — 가입하다 끊긴 빈 계정(묶이지 않음) · 남에게 묶인 계정
  const byEmail = { 'mate-orp1@tw.local': 'authOrphan', 'mate-sto1@tw.local': 'authSomeoneElse' };
  let seq = 0;
  const deps = {
    getAuthUser: async (uid) => { calls.push(['get', uid]); return users[uid] || null; },
    getUserByEmail: async (email) => { calls.push(['byEmail', email]); return byEmail[email] ? { uid: byEmail[email] } : null; },
    createUser: async (email, pw) => { calls.push(['create', email, pw]); return 'authNew'; },
    setPassword: async (uid, pw) => { calls.push(['set', uid, pw]); },
    deleteAuthUser: async (uid) => { calls.push(['delete', uid]); },
    revokeTokens: async (uid) => { calls.push(['revoke', uid]); },
    randomBytes: (n) => Buffer.from(Array.from({ length: n }, () => (seq++ * 37 + 11) % 256)),
    serverNow: () => 'TS',
  };
  return { db, deps, calls, writes, tree };
}
const changed = (w) => w.calls.some((c) => ['set', 'add', 'create', 'revoke'].includes(c[0])) || w.writes.length > 0;
const req = (data, uid = ADMIN, prov = 'google.com') => ({ auth: uid ? { uid, token: { firebase: { sign_in_provider: prov } } } : null, data });
const tryRun = async (w, r) => { try{ return { ok: await M.handleAdminResetPassword(w.db, r, w.deps, 1760000000000) }; }catch(e){ return { code: e.httpsCode, msg: e.message }; } };

(async () => {
  say('── 1. 임시 비밀번호');
  {
    const crypto = require('crypto');
    const many = Array.from({ length: 400 }, () => M.tempPassword((n) => crypto.randomBytes(n)));
    chk(many.every((p) => p.length === M.TEMP_PW_LEN && /^[a-zA-Z2-9]+$/.test(p) && !/[0O1lI]/.test(p)), '8자 · 대소문자 · 숫자 · 헷갈리는 0 O 1 l I 없음');
    chk(new Set(many).size === many.length, '  ↳ 400번 만들어 겹치는 것 없음(매번 다름)');
    let k = 0; const only255 = (n) => Buffer.from(Array.from({ length: n }, () => (k++ % 3 === 0 ? 255 : 0)));
    const p = M.tempPassword(only255);
    chk(p === 'a'.repeat(8), '  ↳ 글자 수로 나눠 넘치는 바이트(255)는 버린다 — 앞 글자로 치우치지 않게');
  }

  say('── 2. 막기 — 아무것도 안 바꾼다');
  {
    const cases = [
      ['로그인 없음', req({ code: ME, memo: 'B-1017-3' }, null), 'unauthenticated'],
      ['익명', req({ code: ME, memo: 'B-1017-3' }, ADMIN, 'anonymous'), 'permission-denied'],
      ['관리자 아님', req({ code: ME, memo: 'B-1017-3' }, 'authSomeone'), 'permission-denied'],
      ['메모 없음', req({ code: ME }), 'invalid-argument'],
      ['메모가 공백뿐', req({ code: ME, memo: '  \n ' }), 'invalid-argument'],
      ['없는 친구 코드', req({ code: 'MATE-ZZZZ', memo: 'B-1017-3' }), 'not-found'],
      ['관리자 계정', req({ code: ADM_CODE, memo: 'B-1017-3' }), 'failed-precondition'],
      ['로그인 계정 없고 친구 코드도 이 사람 것으로 확인 안 됨', req({ code: NOFC, memo: 'B-1017-3' }), 'failed-precondition'],
      ['로그인 계정 없고 사용자 노드에 친구 코드도 없음', req({ code: NOAUTH, memo: 'B-1017-3' }), 'failed-precondition'],
      ['같은 이메일 로그인 계정이 다른 사용자에 묶여 있음', req({ code: 'MATE-STO1', memo: 'B-1017-3' }), 'failed-precondition'],
    ];
    for (const [nm, r, code] of cases){
      const w = world(); const out = await tryRun(w, r);
      chk(out.code === code && !changed(w), nm + ' → ' + code + ' · 비밀번호 · 로그인 · 기록 그대로');
    }
    const w = world({ raceUserAuth: true }); const out = await tryRun(w, req({ code: 'MATE-OLD1', memo: 'B-1017-3' }));
    chk(out.code === 'aborted' && w.calls.some((c) => c[0] === 'create') && w.calls.some((c) => c[0] === 'delete' && c[1] === 'authNew') && !w.writes.some((x) => x[0].startsWith('authUsers/') || x[0].startsWith('adminLog/')),
      '그 사이 다른 계정이 묶이면 → aborted · 방금 만든 로그인 계정은 지우고 · 연결 · 기록 없음');
  }

  say('── 3. 초기화');
  {
    for (const [nm, code] of [['친구 코드', 'MATE-PW11'], ['뒤 4자리(소문자)', 'pw11'], ['사용자 코드', ME]]){
      const w = world(); const out = await tryRun(w, req({ code, memo: '  오픈채팅\n  10/17 ' }));
      const r = out.ok || {};
      const set = w.calls.find((c) => c[0] === 'set'), iSet = w.calls.findIndex((c) => c[0] === 'set'), iRev = w.calls.findIndex((c) => c[0] === 'revoke');
      chk(r.ok === true && r.code === ME && r.friendCode === 'MATE-PW11' && r.name === '잊은이' && set && set[1] === 'authMe' && set[2] === r.tempPassword && r.tempPassword.length === 8,
        nm + '로 찾아 그 로그인 계정 비밀번호를 임시 비밀번호로 · 돌려주는 값(코드 · 친구 코드 · 이름 · 임시 비밀번호)');
      chk(iRev > iSet && w.calls[iRev][1] === 'authMe', '  ↳ 바꾼 뒤 그 계정의 모든 PC 로그인을 끊는다');
      const log = w.writes.find((x) => x[0].startsWith('adminLog/'));
      chk(log && log[1].by === ADMIN && log[1].action === M.LOG_ACTION && log[1].target === ME && log[1].detail.startsWith('메모: 오픈채팅 10/17 ·') && log[1].at === 'TS' && r.logId === log[0].slice('adminLog/'.length),
        '  ↳ 작업 기록 — 누가 · 무엇을 · 누구를 · 메모(공백 · 줄바꿈은 한 칸으로)');
      chk(!JSON.stringify(w.writes).includes(r.tempPassword), '  ↳ ★ 임시 비밀번호는 기록 어디에도 없다');
    }
  }

  say('── 3-2. 로그인 계정 만들어 주기 · 구글 전용은 그대로');
  {
    let w = world(); let out = (await tryRun(w, req({ code: 'MATE-OLD1', memo: '오픈채팅 10/18' }))).ok || {};
    const cr = w.calls.find((c) => c[0] === 'create');
    chk(out.kind === 'createLogin' && cr && cr[1] === 'mate-old1@tw.local' && cr[2] === out.tempPassword && out.friendCode === 'MATE-OLD1' && out.name === '옛사람',
      '★ 로그인 계정이 없는 옛 계정 — `{친구 코드 소문자}@tw.local` + 임시 비밀번호로 새로 만든다(앱 친구 코드 로그인과 같은 이메일)');
    chk(w.tree.userAuth[OLD] === 'authNew' && w.tree.authUsers.authNew && w.tree.authUsers.authNew.userCode === OLD && typeof w.tree.authUsers.authNew.ts === 'number',
      '  ↳ 앱 가입과 같은 모양으로 묶는다 — userAuth/{코드} = uid · authUsers/{uid} = { userCode, ts }');
    const log = w.writes.find((x) => x[0].startsWith('adminLog/'));
    chk(log && /로그인 계정 새로 만듦/.test(log[1].detail) && !JSON.stringify(w.writes).includes(out.tempPassword), '  ↳ 기록에 «새로 만듦» · 비밀번호는 없음');

    w = world(); out = (await tryRun(w, req({ code: 'MATE-ORP1', memo: 'x' }))).ok || {};
    chk(out.kind === 'createLogin' && !w.calls.some((c) => c[0] === 'create') && w.calls.some((c) => c[0] === 'set' && c[1] === 'authOrphan') && w.tree.userAuth[ORPH] === 'authOrphan' && w.tree.authUsers.authOrphan.userCode === ORPH,
      '가입하다 끊겨 묶이지 않은 같은 이메일 계정이 있으면 새로 안 만들고 그 계정에 비밀번호 · 연결');

    w = world(); const g = await tryRun(w, req({ code: 'COZY-GO22', memo: 'x' }));
    chk(g.code === 'failed-precondition' && /구글로 로그인/.test(g.msg) && !changed(w), '★ 구글로만 로그인하는 계정은 건드리지 않는다(안내만 — 이메일 칸이 바뀌는 덧붙이기는 뺐다)');
  }

  say('── 4. 배선');
  {
    chk(/exports\.adminResetPassword = onCall\(/.test(FX) && /require\('\.\/password-reset'\)/.test(FX) && /handleAdminResetPassword\(getDatabase\(\), request, mod\.adminDeps\(\), Date\.now\(\)\)/.test(FX), 'functions/index.js — adminResetPassword 내보내기 · 모듈 연결');
    chk(!/console\.\w+\([^)]*tempPassword|console\.\w+\([^)]*\bpw\b/.test(read('functions/password-reset.js')), '  ↳ 로그에 비밀번호를 찍지 않는다');
    if (WA_FN) chk(/RESET_PASSWORD_FN = 'adminResetPassword'/.test(WA_FN), '웹 관리자 — 같은 함수 이름을 부른다');
    else say('  · web-admin 이 스테이징에 없어 웹 관리자 배선은 건너뜀(웹 관리자 테스트가 본다)');
    if (WA_AUDIT) chk(WA_AUDIT.includes("'" + M.LOG_ACTION + "'"), '  ↳ 작업 기록 이름표에 ' + M.LOG_ACTION);
  }

  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { say('  ✗ 예외: ' + (e && e.stack || e)); process.exit(1); });

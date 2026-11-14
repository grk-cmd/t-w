/* ═══ 🔁 sim-google-change.js — 구글 계정 바꾸기(parts/account/google-change-net.js) ═══════════════
   ・1절: 막는 경우 — 로그인 없음 · 익명 · 비밀번호 없음 · 구글 없음 · 토큰 없음 (아무것도 끊지 않는다)
   ・2절: 지금 구글 확인 — 다른 구글을 고르면 끊지 않고 «지금 연결된 구글로»
   ・3절: 바꾸기 — 확인 → 끊기 → 새로 붙이기 · 새 주소를 돌려준다
   ・4절: 새 구글을 못 붙이면 — 지금 구글을 다시 붙여 되돌린다(이미 남의 계정 · 그 밖) · 되돌리기도 실패하면 비밀번호 안내
   ・5절: 연결 — firebase-init 이 불러와 authChangeGoogle 로 내놓는다 · unlink 를 들여온다
   ・6절: 일부러 깨 보기
   [실행] node checks/run.js sim-google-change */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const anyOf = (...fs_) => fs_.map(read).find(s => s != null);
const MOD = anyOf('google-change-net.js', 'parts/account/google-change-net.js', 'app/parts/account/google-change-net.js');
const FI = anyOf('firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js');
if(!MOD || !FI){ say('  ? 원본 못 찾음 — google-change-net.js · firebase-init.js'); process.exit(2); }

const load = (src) => new Function(src.replace(/^export (function|const) /mg, '$1 ') + '\nreturn { createGoogleChange };')();
/* 가짜 Auth — 붙은 제공자 목록을 들고, 부른 차례를 적는다 */
function mk(src, o){
  o = o || {};
  const log = [];
  const pd = (o.pd || ['password', 'google.com']).map(id => ({ providerId: id, email: id === 'google.com' ? (o.oldEmail || 'old@gmail.com') : 'mate-ab12@tw.local' }));
  const user = o.user === null ? null : Object.assign({ uid: 'A1', isAnonymous: !!o.anon, providerData: pd }, o.user || {});
  const err = (c) => Object.assign(new Error(c), { code: c });
  const api = load(src).createGoogleChange({
    currentUser: () => user,
    credential: (t) => ({ t }),
    reauth: async (u, c) => { log.push('reauth:' + c.t); if(o.reauthErr) throw err(o.reauthErr); },
    unlink: async (u, id) => { log.push('unlink:' + id); if(o.unlinkErr) throw err(o.unlinkErr); u.providerData = u.providerData.filter(p => p.providerId !== id); },
    link: async (u, c) => {
      log.push('link:' + c.t);
      if(c.t === 'NEW' && o.linkErr) throw err(o.linkErr);
      if(c.t === 'OLD' && o.relinkErr) throw err(o.relinkErr);
      u.providerData.push({ providerId: 'google.com', email: c.t === 'NEW' ? 'new@gmail.com' : 'old@gmail.com' });
      return { user: u };
    },
  });
  return { api, log, user };
}
const google = (u) => (u.providerData.find(p => p.providerId === 'google.com') || {}).email || null;

async function judgeAll(src){
  const r = [];
  const t = (ok, m) => r.push([!!ok, m]);
  /* 1 */
  for(const [name, o, re] of [
    ['로그인 없음', { user: null }, /로그인이 풀려/],
    ['익명 세션', { anon: true }, /로그인이 풀려/],
    ['구글 없음', { pd: ['password'] }, /연결된 구글이 없어요/],
  ]){
    const x = mk(src, o); const res = await x.api.change('OLD', 'NEW');
    t(!res.ok && re.test(res.reason) && x.log.length === 0, '1   ' + name + ' — 막고 아무것도 안 부른다');
  }
  let x = mk(src, { pd: ['google.com'] }); let res = await x.api.change('OLD', 'NEW');
  t(!res.ok && res.needPassword && /먼저 비밀번호/.test(res.reason) && x.log.length === 0 && google(x.user) === 'old@gmail.com', '1 ★ 비밀번호가 없는 계정 — 막는다(needPassword) · 지금 구글 그대로');
  x = mk(src); res = await x.api.change('OLD', '');
  t(!res.ok && x.log.length === 0, '1   새 토큰이 없으면 막는다');
  /* 2 */
  x = mk(src, { reauthErr: 'auth/user-mismatch' }); res = await x.api.change('OLD', 'NEW');
  t(!res.ok && /지금 연결된 구글/.test(res.reason) && x.log.join(' ') === 'reauth:OLD' && google(x.user) === 'old@gmail.com', '2 ★ 지금 구글이 아닌 것을 고르면 — 끊지 않는다 · «지금 연결된 구글로»');
  /* 3 */
  x = mk(src); res = await x.api.change('OLD', 'NEW');
  t(res.ok && res.email === 'new@gmail.com' && x.log.join(' → ') === 'reauth:OLD → unlink:google.com → link:NEW' && google(x.user) === 'new@gmail.com' && x.user.uid === 'A1',
    '3 ★ 확인 → 끊기 → 새로 붙이기 · 같은 계정(uid 그대로)에 새 구글 · 새 주소를 돌려준다');
  /* 4 */
  x = mk(src, { linkErr: 'auth/credential-already-in-use' }); res = await x.api.change('OLD', 'NEW');
  t(!res.ok && res.restored && /이미 다른 계정/.test(res.reason) && /원래 구글 그대로/.test(res.reason) && google(x.user) === 'old@gmail.com' && x.log[x.log.length - 1] === 'link:OLD',
    '4 ★ 새 구글이 이미 남의 계정 — 지금 구글을 다시 붙여 되돌린다 · «원래 구글 그대로»');
  x = mk(src, { linkErr: 'auth/network-request-failed' }); res = await x.api.change('OLD', 'NEW');
  t(!res.ok && res.restored && /네트워크/.test(res.reason) && google(x.user) === 'old@gmail.com', '4   그 밖의 실패도 되돌린다');
  x = mk(src, { linkErr: 'auth/internal-error', relinkErr: 'auth/internal-error' }); res = await x.api.change('OLD', 'NEW');
  t(!res.ok && res.restored === false && /친구 코드 \+ 비밀번호로 로그인/.test(res.reason) && /\[연결하기\]/.test(res.reason), '4   되돌리기도 실패 — 비밀번호로 로그인 · [연결하기] 안내');
  x = mk(src, { unlinkErr: 'auth/no-such-provider' }); res = await x.api.change('OLD', 'NEW');
  t(!res.ok && !x.log.some(l => l.startsWith('link')) && google(x.user) === 'old@gmail.com', '4   끊기가 실패하면 — 새로 붙이지 않고 그대로');
  return r;
}

(async () => {
  say('── 1~4. 막기 · 확인 · 바꾸기 · 되돌리기');
  (await judgeAll(MOD)).forEach(([ok, m]) => chk(ok, m));

  say('── 5. 연결');
  chk(/import \{ createGoogleChange \} from "\.\/account\/google-change-net\.js";/.test(FI), 'firebase-init 이 google-change-net.js 를 불러온다');
  chk(/getAdditionalUserInfo, deleteUser, unlink\n/.test(FI), '  Firebase Auth 의 unlink 를 들여온다');
  chk(/authChangeGoogle: createGoogleChange\(\{ currentUser: \(\) => auth && auth\.currentUser, credential: t => GoogleAuthProvider\.credential\(t\), reauth: reauthenticateWithCredential, unlink, link: linkWithCredential \}\)\.change,/.test(FI), '  firebaseAPI.authChangeGoogle 로 내놓는다(진짜 reauth · unlink · link)');

  say('── 6. 일부러 깨 보기');
  for(const [name, a, b] of [
    ['비밀번호 없어도 바꿈', "    if(!pd.some(p => p && p.providerId === 'password')) return { ok:false, needPassword:true, reason:'구글을 바꾸려면 먼저 비밀번호를 만들어 주세요' };\n", ''],
    ['본인 확인 없이 끊음', '    try{ await reauth(cu, oldCred); }\n', '    try{ }\n'],
    ['되돌리지 않음', '      try{ await link(cu, oldCred); restored = true; }catch(_){}\n', ''],
    ['끊기 실패에도 붙임', "    catch(e){ return { ok:false, reason:'구글 연결을 바꾸지 못했어요 (' + (code(e) || '알 수 없음') + ')' }; }", '    catch(e){ }'],
  ]){
    const m2 = MOD.replace(a, b);
    let rows; try{ rows = await judgeAll(m2); }catch(_){ rows = [[false, '던짐']]; }
    chk(m2 !== MOD && rows.some(([ok]) => !ok), '깨 보기 — ' + name + (m2 !== MOD ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();

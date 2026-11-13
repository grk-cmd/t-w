/* sim-friendreq-rules.js — 🔐 친구 요청(friendRequests · sentFriendRequests) 쓰기 · 지우기를 로그인 신원으로
   실행:  node checks/run.js sim-friendreq-rules
   ★ 왜 이 검사가 있는가 — 예전엔 두 칸 모두 `.write: true` 라서 누구든 남의 이름으로 요청을 넣거나, 남의 요청을 지울 수 있었다.
     지금은 «보낸 사람 = 로그인한 본인» 만 넣고 · 고치고 · 취소하고, 받는 사람은 수락 · 거절로 지우기만 한다.
     신원 판정은 방명록 · 선물함(#771)과 같은 모양 — `userAuth/{코드}` 가 없거나(로그인에 안 묶인 옛 계정) = auth.uid.
   ・1절: 규칙 글의 `.write` 식을 실제로 돌린다(가짜 root · data · newData · auth) — 보내기 · 남의 이름 · 로그인 없음 · 취소 · 수락 · 거절 · 남이 지우기 · 없는 칸 지우기
   ・2절: 앱이 쓰는 모양이 그대로 통과하는지(보내기 update 한 번 · 수락 · 거절 · 취소 · 죽은 미러 치우기) — firebase-init.js 의 경로와 맞춘다
   ・3절: 일부러 깨 보기
   실제 서버 판정은 에뮬레이터(firebase/scripts/rules-emu-check.js)에서 본다 — CI 에는 없다. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const RP = ['firebase-database-rules.json', '../firebase-database-rules.json', 'firebase/firebase-database-rules.json'].find(p => fs.existsSync(p));
const FP = ['firebase-init.js', 'app/parts/firebase-init.js', 'apps/desktop/app/parts/firebase-init.js'].find(p => fs.existsSync(p));
if (!RP || !FP) { say('  ? 원본 못 찾음 — firebase-database-rules.json · firebase-init.js'); process.exit(2); }
const RULES = JSON.parse(fs.readFileSync(RP, 'utf8')).rules;
const FBI = fs.readFileSync(FP, 'utf8');

/* 아주 작은 규칙 실행기 — 이 두 칸이 쓰는 것(root/data/newData.child().exists()/val() · auth.uid · $변수)만 */
function snap(tree, path){
  const parts = String(path).split('/').filter(Boolean);
  let v = tree; for (const p of parts) v = (v && typeof v === 'object') ? v[p] : undefined;
  return { exists: () => v !== undefined && v !== null, val: () => (v === undefined ? null : v), child: (p) => snap(tree, path + '/' + p) };
}
function evalWrite(expr, env){
  if (expr === true || expr === false) return expr;
  const f = new Function('root', 'data', 'newData', 'auth', '$fromId', '$toId', '"use strict"; return (' + expr + ');');   // 규칙의 $변수는 JS 이름으로도 그대로 쓸 수 있다
  /* 실제 서버처럼 — 로그인 없이(auth == null) auth.uid 를 읽으면 식 전체가 오류 → 거절 */
  const auth = env.auth || { get uid(){ throw new Error('auth 없음'); } };
  try { return !!f(snap(env.root, ''), snap(env.root, env.path), snap(env.after, env.path), auth, env.vars.fromId, env.vars.toId); }
  catch (_) { return false; }
}
const WRITE_FR = (r) => r.friendRequests.$toId.$fromId['.write'];
const WRITE_SFR = (r) => r.sentFriendRequests.$fromId.$toId['.write'];

const A = 'ufromaaaa001', B = 'utoobbbb001', X = 'uthirdxx001', OLD = 'uoldlegacy01';   // OLD = 로그인에 안 묶인 옛 계정
const AUTH = { [A]: 'authA', [B]: 'authB', [X]: 'authX' };
const baseRoot = (extra) => Object.assign({ userAuth: { [A]: 'authA', [B]: 'authB', [X]: 'authX' } }, extra || {});
const withReq = (from, to) => ({ friendRequests: { [to]: { [from]: { name: 'n', ts: 1 } } }, sentFriendRequests: { [from]: { [to]: { ts: 1 } } } });
function deep(a, b){ return JSON.parse(JSON.stringify(Object.assign({}, a, b))); }

/* 한 쓰기 판정 — which: 'fr' | 'sfr', from · to, 쓴 뒤 값(null = 지우기), 지금 있음?, 누가(auth uid 또는 null) */
function canWrite(rules, which, from, to, newVal, existing, who){
  const before = baseRoot(existing ? withReq(from, to) : {});
  const after = deep(before, {});
  const path = which === 'fr' ? `friendRequests/${to}/${from}` : `sentFriendRequests/${from}/${to}`;
  const [k1, k2, k3] = path.split('/');
  after[k1] = after[k1] || {}; after[k1][k2] = after[k1][k2] || {};
  if (newVal === null) delete after[k1][k2][k3]; else after[k1][k2][k3] = newVal;
  const expr = which === 'fr' ? WRITE_FR(rules) : WRITE_SFR(rules);
  return evalWrite(expr, { root: before, after, path, auth: who ? { uid: who } : null, vars: { fromId: from, toId: to } });
}

function judge(rules){
  const r = {};
  try {
    for (const w of ['fr', 'sfr']) {
      const REQ = w === 'fr' ? { name: 'n', ts: 2 } : { ts: 2 };
      r[w] = {
        sendSelf: canWrite(rules, w, A, B, REQ, false, AUTH[A]),
        sendAsOther: canWrite(rules, w, A, B, REQ, false, AUTH[X]),
        sendNoAuth: canWrite(rules, w, A, B, REQ, false, null),
        recvForges: canWrite(rules, w, A, B, REQ, false, AUTH[B]),
        resendSelf: canWrite(rules, w, A, B, REQ, true, AUTH[A]),
        overwriteOther: canWrite(rules, w, A, B, REQ, true, AUTH[X]),
        cancelSelf: canWrite(rules, w, A, B, null, true, AUTH[A]),
        recvDelete: canWrite(rules, w, A, B, null, true, AUTH[B]),
        thirdDelete: canWrite(rules, w, A, B, null, true, AUTH[X]),
        noAuthDelete: canWrite(rules, w, A, B, null, true, null),
        goneDelete: canWrite(rules, w, A, B, null, false, AUTH[X]),
        legacySend: canWrite(rules, w, OLD, B, REQ, false, 'authOld'),
      };
    }
  } catch (e) { r.err = e && e.message; }
  return r;
}
const okAll = (o) => o && o.sendSelf && !o.sendAsOther && !o.sendNoAuth && !o.recvForges && o.resendSelf && !o.overwriteOther
  && o.cancelSelf && o.recvDelete && !o.thirdDelete && !o.noAuthDelete && o.goneDelete && o.legacySend;

say('── 1. 규칙 식을 실제로 돌린다');
const R = judge(RULES);
if (R.err) chk(false, '돌리다 멈춤 — ' + R.err);
for (const [w, label] of [['fr', 'friendRequests'], ['sfr', 'sentFriendRequests(미러)']]) {
  const o = R[w] || {};
  chk(o.sendSelf && o.resendSelf, label + ' — 보낸 사람 본인이 넣기 · 다시 보내기');
  chk(!o.sendAsOther && !o.recvForges && !o.overwriteOther, '  남의 이름으로 넣기 · 받는 사람이 보낸 척 넣기 · 남이 덮어쓰기는 막힘');
  chk(!o.sendNoAuth, '  로그인 없이 묶인 사람 이름으로 넣기는 막힘');
  chk(o.cancelSelf && o.recvDelete, '  보낸 사람 취소 · 받는 사람 수락 / 거절로 지우기');
  chk(!o.thirdDelete && !o.noAuthDelete, '  남 · 로그인 없이 지우기는 막힘');
  chk(o.goneDelete, '  이미 없는 칸 지우기는 받아 준다(두 번 지움 · 겹친 정리)');
  chk(o.legacySend, '  로그인에 안 묶인 옛 계정(userAuth 없음)은 예전처럼 — 방명록 · 선물함(#771)과 같은 판정');
}

say('── 2. 앱이 쓰는 모양(firebase-init.js)');
{
  chk(/\[`friendRequests\/\$\{toId\}\/\$\{fromId\}`\]: \{ name: fromName \|\| '\(이름 없음\)', ts: now/.test(FBI) && /\[`sentFriendRequests\/\$\{fromId\}\/\$\{toId\}`\]: mirror,/.test(FBI),
    '보내기 — 요청 + 미러를 update 한 번(보낸 사람 = 내 코드)');
  const acc = (FBI.match(/async acceptFriendRequest\(myId, fromId\)\{[\s\S]*?\n    \},/) || [''])[0];
  chk(/\[`friendRequests\/\$\{myId\}\/\$\{fromId\}`\]: null/.test(acc) && /\[`sentFriendRequests\/\$\{fromId\}\/\$\{myId\}`\]: null/.test(acc), '수락 — 받는 사람이 요청 · 상대 미러를 지운다(1절 recvDelete)');
  const rej = (FBI.match(/async rejectFriendRequest\(myId, fromId\)\{[\s\S]*?\n    \},/) || [''])[0];
  chk(/\[`friendRequests\/\$\{myId\}\/\$\{fromId\}`\]: null/.test(rej) && /\[`sentFriendRequests\/\$\{fromId\}\/\$\{myId\}`\]: null/.test(rej), '거절 — 같은 두 칸');
  const can = (FBI.match(/async cancelFriendRequest\(myId, toId\)\{[\s\S]*?\n    \},/) || [''])[0];
  chk(/\[`friendRequests\/\$\{toId\}\/\$\{myId\}`\]: null/.test(can) && /\[`sentFriendRequests\/\$\{myId\}\/\$\{toId\}`\]: null/.test(can), '취소 — 보낸 사람이 두 칸을 지운다(1절 cancelSelf)');
  chk(/remove\(ref\(db, `sentFriendRequests\/\$\{myId\}\/\$\{toId\}`\)\)/.test(FBI), '죽은 미러 치우기 — 내 미러만');
}

say('── 3. 깨 보기');
{
  const mut = (fn) => { const c = JSON.parse(JSON.stringify(RULES)); fn(c); return judge(c); };
  const b1 = mut(c => { c.friendRequests.$toId.$fromId['.write'] = true; });
  chk(!okAll(b1.fr), '옛 모양(.write: true)으로 되돌리면 빨강');
  const b2 = mut(c => { c.sentFriendRequests.$fromId.$toId['.write'] = c.sentFriendRequests.$fromId.$toId['.write'].replace(/ \|\| \(data\.exists\(\) && !newData\.exists\(\) && .*\)$/, ''); });
  chk(!okAll(b2.sfr), '받는 사람 지우기 갈래를 빼면(수락 · 거절 때 상대 미러가 남음) 빨강');
  const b3 = mut(c => { c.friendRequests.$toId.$fromId['.write'] = c.friendRequests.$toId.$fromId['.write'].replace('(data.exists() && !newData.exists() && ', '('); });
  chk(!okAll(b3.fr), '받는 사람이 지우기 말고 써도 되게 풀면 빨강');
  const b4 = mut(c => { c.friendRequests.$toId.$fromId['.write'] = c.friendRequests.$toId.$fromId['.write'].replace('(!data.exists() && !newData.exists()) || ', ''); });
  chk(!okAll(b4.fr), '«이미 없는 칸 지우기» 갈래를 빼면 빨강');
}

say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);

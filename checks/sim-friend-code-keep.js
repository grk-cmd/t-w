/* ═══ 🔗 sim-friend-code-keep.js — 친추코드는 바뀌지 않는다 · 로그인하면 서버 계정의 코드 (2026-09-20 · 0.13) ═══
   [무엇을 지키나]
     [제보 3-2 · 결정 2026-09-20] **자동 재발급을 하지 않는다.** 처음 코드가 유지된다 — 친구들이 적어 둔 코드가 죽지 않게.
       _healFriendCodeOwner 는 이 기기 코드의 주인이 내가 아니어도 코드도 소유권도 그대로 두고 경고만 한다.
     [0.13] 친구 코드는 서버가 가입 때 정한다(다시 발급하지 않음 — ADR-0005). 앱은 코드를 뽑지도 등록하지도 않고,
       로그인 · 켤 때 서버 계정(GET /v1/me)의 코드를 이 PC 에 적는다(account.js _enterAccount). 계정 사본(accountSnap) 복원은 걷었다.

   ・1절: _healFriendCodeOwner 를 **떼어 와 실행한다** — 내 것이면 끝 · 그 밖(주인 없음 · 버린 uid 였던 것 · 오래 조용함 · 활동 중인 남)은
          **코드 그대로 · 소유권 그대로 · 등록 없음 · 경고만**. ensureMyFriendCode 는 코드가 없어도 뽑지 않는다.
   ・2절: 정적 — 소유권 강제 지정 · 재발급 UI · 코드 후보 뽑기(genFriendCodeCandidate) 없음.
   ・3절: _enterAccount 를 **떼어 와 실행한다** — 서버 코드를 적고 옛 코드는 진단 기록 · 이름 · 로그인 표시 · 같은 계정이면 그대로 ·
          다른 계정 — 로그인했던 PC 면 전부 내려놓고 · 로그인 없이 쓰던 PC 면 신원 키만(캐릭터는 첫 실행 legacy-sync 몫) · 못 적으면 실패.
   [실행] app.js 가 있는 폴더에서. 판정 줄은 맨 끝. */
'use strict';
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
const SRC = _joinRenderer(fs.readFileSync('app.js', 'utf8'));
let HTML = ''; try{ HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8'); }catch(_){}

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };

function grabFn(name, kw){
  const i = SRC.indexOf((kw || 'function ') + name + '(');
  if(i < 0) return null;
  let k = SRC.indexOf('{', i), d = 0;
  for(; k < SRC.length; k++){
    if(SRC[k] === '{') d++;
    else if(SRC[k] === '}' && --d === 0) return SRC.slice(i, k + 1);
  }
  return null;
}
const fHeal   = grabFn('_healFriendCodeOwner', 'async function ');
const fEnsure = grabFn('ensureMyFriendCode', 'async function ');
const fRemOld = grabFn('_rememberOldFriendCode');
const fEnter  = grabFn('_enterAccount');

/* ── 공용 스텁 ── */
function mkLS(){
  const m = new Map();
  return { m, getItem:k=>m.has(k)?m.get(k):null, setItem:(k,v)=>m.set(k,String(v)), removeItem:k=>m.delete(k) };
}

(async () => {
/* ═══ 1. _healFriendCodeOwner ═══ */
say('── 1. _healFriendCodeOwner — 내 것이면 끝 · 그 밖은 코드도 소유권도 그대로 · 등록 없음');
if(!fHeal || !fEnsure || !fRemOld){
  chk(false, '★ 함수를 못 떼어 옴');
}else{
  const mkHeal = (opt) => {
    const LS = mkLS();
    LS.setItem('tw.myUserId', 'me');
    LS.setItem('tw.myFriendCode', 'MATE-AB12');
    if(opt.prev) LS.setItem('tw.myPrevUserIds', JSON.stringify(opt.prev));   // 예전 판이 남긴 값 — 이제 아무도 안 읽는다
    const rec = { registered: [], ownerSet: [], toasts: [], warns: [], ensureCalls: 0, migrated: [], seenReads: 0 };
    const api = {
      lookupFriendCode: async () => opt.owner,
      registerFriendCode: async (c, u) => { rec.registered.push([c, u]); return true; },
      setFriendCodeOwner: async (c, u) => { rec.ownerSet.push([c, u]); return true; },
      getUserLastSeen: async () => { rec.seenReads++; return opt.seen; },
      setUserFriendCode: async () => true,
      migrateFriendRequests: async (a, b) => { rec.migrated.push([a, b]); },
    };
    const f = new Function('localStorage', 'firebaseAPI', 'rec', [
      "const window={ firebaseAPI };",
      "const console={ warn:(...a)=>rec.warns.push(a.join(' ')), log:()=>{}, info:()=>{} };",
      "const toast=(m)=>rec.toasts.push(m);",
      "const document={ getElementById:()=>null };",
      "const MY_USER_ID_KEY='tw.myUserId', MY_FRIEND_CODE_KEY='tw.myFriendCode', MY_FRIEND_CODE_PREV_KEY='tw.myFriendCodePrev';",
      "let _fcOwnerChecked=false;",
      "function getMyUserId(){ return localStorage.getItem(MY_USER_ID_KEY); }",
      fRemOld,
      fEnsure.replace('async function ensureMyFriendCode(', 'async function ensureMyFriendCode_real('),
      "async function ensureMyFriendCode(){ rec.ensureCalls++; return ensureMyFriendCode_real(); }",
      fHeal,
      "let _fcMirrorChecked=true; async function _friendCodeMirrorFix(){}",
      "return { heal:_healFriendCodeOwner, checked:()=>_fcOwnerChecked, ensure:ensureMyFriendCode_real };",
    ].join('\n'));
    return { LS, rec, m: f(LS, api, rec) };
  };
  const untouched = (e) => e.LS.getItem('tw.myFriendCode') === 'MATE-AB12' && e.rec.ownerSet.length === 0 && e.rec.migrated.length === 0
    && e.rec.ensureCalls === 0 && e.rec.registered.length === 0 && e.rec.toasts.length === 0;

  let e = mkHeal({ owner: 'me' });
  await (e.m.heal('MATE-AB12'));
  chk(untouched(e), '  내 것이면 아무것도 안 한다');

  e = mkHeal({ owner: null });
  await (e.m.heal('MATE-AB12'));
  chk(e.rec.registered.length === 0 && e.LS.getItem('tw.myFriendCode') === 'MATE-AB12', '★ 주인 없는 코드도 앱이 등록하지 않는다(0.13 — 코드는 서버가 가입 때 정한다) · 코드는 그대로');
  e = mkHeal({ owner: 'me' });
  e.LS.removeItem('tw.myFriendCode');
  const got = await e.m.ensure();
  chk(got === null && e.rec.registered.length === 0 && e.LS.getItem('tw.myFriendCode') === null, '★ 이 PC 에 코드가 없어도 ensureMyFriendCode 는 뽑지 · 등록하지 않는다(로그인 때 서버 코드를 적는다)');

  e = mkHeal({ owner: 'old-uid', prev: ['old-uid'], seen: Date.now() });
  await (e.m.heal('MATE-AB12'));
  chk(untouched(e), '★ 예전 «버린 uid» 목록에 있어도 가져오지 않는다 — 소유권 · 친구 요청 그대로 (개정 56 · 그 uid 는 다른 계정)');

  e = mkHeal({ owner: 'ghost', seen: Date.now() - 30 * 86400000 });
  await (e.m.heal('MATE-AB12'));
  chk(untouched(e) && e.rec.seenReads === 0, '★ 소유자가 오래 조용해도 되찾지 않는다 — lastSeen 을 읽지도 않는다 (개정 56)');

  /* ★ 제보 3-2 의 그 갈래 — 활동 중인 남 */
  e = mkHeal({ owner: 'office-uid', seen: Date.now() - 86400000 });
  await (e.m.heal('MATE-AB12'));
  chk(untouched(e), '★ 활동 중인 남의 코드여도 **로컬 코드가 그대로 남는다** — 새로 뽑지 않고 · 소유권도 안 건드리고 · 토스트 없다(제보 3-2)');
  chk(e.rec.warns.some(w => /재발급 안 함/.test(w)), '  대신 콘솔에 남긴다(지원 때 읽는다)');
  chk(e.m.checked() === true, '  이 세션에서 다시 판정하지 않는다(매 부팅 한 번)');
  chk(JSON.parse(e.LS.getItem('tw.myFriendCodePrev') || '[]')[0] === 'MATE-AB12', '  진단 기록에만 남긴다(getOldFriendCodes)');
}

/* ═══ 2. 정적 ═══ */
say('── 2. 정적 — 코드를 바꾸는 길이 없다');
{
  const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/mg, '');
  chk(!/function genFriendCodeCandidate\(|registerFriendCode\(/.test(CODE), '★ 앱이 친구 코드 후보를 뽑거나 등록하는 길이 없다(0.13 — 서버가 가입 때)');
  chk(!/setFriendCodeOwner|_claimFriendCodeAfterTransfer\(|migrateFriendRequests|_isMyPrevUserId|_rememberPrevUserId|FC_STALE_DAYS/.test(CODE), '★ 소유권 강제 지정 · 버린 uid · 7일 되찾기가 app.js 코드에 없다 (개정 56)');
  let FB = ''; try{ FB = fs.readFileSync('firebase-init.js', 'utf8'); }catch(_){}
  if(FB){
    const FBC = FB.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/mg, '');
    chk(!/async setFriendCodeOwner\(|async migrateFriendRequests\(/.test(FBC), '  firebase-init 에 setFriendCodeOwner · migrateFriendRequests 통로가 없다 (선점은 registerFriendCode 트랜잭션뿐)');
  } else say('  ? firebase-init.js 없음 — 통로 검사 생략');
}
chk(/const FC_NEVER_REISSUE = true;/.test(SRC), '  결정에 이름이 붙어 있다(FC_NEVER_REISSUE) — 되살리려면 갈래 전체를 되살려야 한다는 주석과 함께');
chk(!/toast\('🔗 친추 코드가/.test(SRC), '  «새로 발급됐어요» 토스트 호출 자체가 없다(주석에만 남아 있다)');
if(HTML){
  chk(!/(재발급|되찾기|바꾸기)[^<]{0,20}(친추|친구 ?코드)|(친추|친구 ?코드)[^<]{0,20}(재발급|바꾸기)/.test(HTML), '  마크업에 친추코드 재발급·바꾸기 버튼이 없다(사용자가 직접 바꾸는 길 없음)');
}else{
  say('  ? desk-companion-prototype.html 없음 — 마크업 검사 생략');
}

/* ═══ 3. _enterAccount ═══ */
say('── 3. _enterAccount — 서버 계정으로 이 PC 맞추기');
if(!fEnter){
  chk(false, '★ _enterAccount 를 못 떼어 옴');
}else{
  const ME = { userCode: 'u_new_000001', friendCode: 'MATE-SRV1', displayName: '연우', version: 1 };
  const mkEnter = (o) => {
    const LS = mkLS();
    for(const [k, v] of Object.entries(o.ls || {})) LS.setItem(k, v);
    const rec = { calls: [] };
    const f = new Function('localStorage', 'rec', [
      "const MY_USER_ID_KEY='tw.myUserId', MY_FRIEND_CODE_KEY='tw.myFriendCode', MY_FRIEND_CODE_PREV_KEY='tw.myFriendCodePrev', LOGIN_EMAIL_KEY='tw.loginEmail', LOGIN_UID_KEY='tw.loginAuthUid', USER_NAME_KEY='tw.userName';",
      "const IDENTITY_KEYS = () => [MY_FRIEND_CODE_KEY, MY_FRIEND_CODE_PREV_KEY];",
      "const getMyLoginEmail=()=>localStorage.getItem(LOGIN_EMAIL_KEY) || null;",
      "const _rememberOldFriendCode=(c)=>{ rec.calls.push('rememberOld:'+c); };",
      "const _wipeAccountLocal=()=>{ rec.calls.push('wipe'); localStorage.removeItem('tw.licenseKey'); localStorage.removeItem('deskFriends.chars.v1'); localStorage.removeItem(MY_FRIEND_CODE_KEY); localStorage.removeItem(LOGIN_EMAIL_KEY); };",
      "const _setMyUserId=(u)=>{ if(" + JSON.stringify(!!o.cantSave) + ") return false; localStorage.setItem(MY_USER_ID_KEY, u); return true; };",
      fEnter,
      "return _enterAccount;",
    ].join('\n'));
    return { LS, rec, enter: f(LS, rec) };
  };
  let e = mkEnter({ ls: { 'tw.myUserId': 'u_new_000001', 'tw.myFriendCode': 'MATE-OLD1', 'tw.loginEmail': 'a@b.c' } });
  let r = e.enter(ME, { email: 'a@b.c', uid: 'auth1' });
  chk(r.ok && !r.switched && e.LS.getItem('tw.myFriendCode') === 'MATE-SRV1' && e.rec.calls.join() === 'rememberOld:MATE-OLD1', '같은 계정 — 다시 켜지 않음 · 서버 코드를 적고 옛 코드는 진단 기록');
  chk(e.LS.getItem('tw.userName') === '연우' && e.LS.getItem('tw.loginAuthUid') === 'auth1' && e.LS.getItem('tw.loginEmail') === 'a@b.c', '  ↳ 이름 · 로그인 표시도 서버 · Auth 값으로');
  e = mkEnter({ ls: { 'tw.myFriendCode': 'MATE-SRV1' } });
  r = e.enter(ME, { email: null, uid: 'auth1' });
  chk(r.ok && r.switched && e.LS.getItem('tw.myUserId') === 'u_new_000001' && !e.rec.calls.length, '처음 쓰는 PC — 코드를 적고 다시 켠다(switched) · 같은 코드면 기록 없음');
  e = mkEnter({ ls: { 'tw.myUserId': 'u_other_00001', 'tw.myFriendCode': 'MATE-OTH1', 'tw.loginEmail': 'x@y.z', 'tw.licenseKey': 'K', 'deskFriends.chars.v1': '{}' } });
  r = e.enter(ME, { email: 'a@b.c', uid: 'auth1' });
  chk(r.ok && r.switched && e.rec.calls[0] === 'wipe' && !e.LS.getItem('tw.licenseKey') && !e.LS.getItem('deskFriends.chars.v1') && e.LS.getItem('tw.myUserId') === 'u_new_000001',
    '★ 다른 계정으로 로그인했던 PC — 남의 것일 수 있어 전부 내려놓는다(로그아웃과 같은 한 벌)');
  e = mkEnter({ ls: { 'tw.myUserId': 'u_unbound_001', 'tw.myFriendCode': 'MATE-UNB1', 'tw.myFriendCodePrev': '["MATE-X"]', 'deskFriends.chars.v1': '{}' } });
  r = e.enter(ME, { email: 'a@b.c', uid: 'auth1' });
  chk(r.ok && r.switched && e.rec.calls.indexOf('wipe') < 0 && e.LS.getItem('deskFriends.chars.v1') === '{}' && !e.LS.getItem('tw.myFriendCodePrev') && e.LS.getItem('tw.myFriendCode') === 'MATE-SRV1',
    '★ 로그인 없이 쓰던 PC(0.12 묶이지 않은 코드) — 신원 키만 바꾸고 캐릭터는 남긴다(첫 실행 legacy-sync 가 이 계정으로 올린다)');
  e = mkEnter({ cantSave: true, ls: { 'tw.myUserId': 'u_unbound_001' } });
  r = e.enter(ME, {});
  chk(!r.ok && /저장하지 못했어요/.test(r.reason || ''), 'uid 를 못 적으면 실패(부르는 쪽이 로그인도 놓는다)');
  chk(!e.enter(null, {}).ok, '계정이 없으면 실패');
}

say('');
say('통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error('검사 자체가 죽음:', e); process.exit(2); });

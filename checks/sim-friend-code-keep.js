/* ═══ 🔗 sim-friend-code-keep.js — 친추코드는 처음 것이 유지된다 · 스냅샷이 없어도 소지품은 온다 (2026-09-20) ═══
   [무엇을 지키나]
     [제보 3-2] 회사↔집 두 PC 를 같은 구글 계정으로 쓰는데, 집 PC 를 켤 때마다 친추코드가 새로 발급됐다.
       원인: _healFriendCodeOwner 의 마지막 갈래. 코드 소유자가 «내가 버린 uid 가 아니고 아직 활동 중»이면
       로컬 코드를 지우고 새 코드를 뽑았다. 회사 PC 의 uid 는 어제까지 쓴 것이라 «활동 중인 남» 으로
       보였다 — 같은 사람인데. 친구들이 적어 둔 코드가 매번 죽었다.
     [결정 · 2026-09-20] **자동 재발급을 하지 않는다.** 처음 발급된 코드가 유지된다. 소유권은 손대지 않는다
       (활동 중인 소유자의 것을 빼앗으면 두 기기가 매 부팅 서로 되찾는 핑퐁). 사용자가 직접 바꾸는 UI 는
       이미 없었고, 자동으로 바뀌는 길도 이것으로 사라졌다 — 로컬 코드를 지우는 자리는 로그아웃뿐이다.
     [제보 3-1] 계정 연동 뒤 캐릭터·파츠·곡이 하나도 안 따라왔다. 원인: _applyTransferSnapshot 첫 줄
       `if(!r) return`. 스냅샷(이름·라이선스·친추코드·집중초)이 없으면 그 뒤의 **소지품 복원까지** 통째로
       건너뛰었다. 소지품은 users/{uid} 사본을 직접 읽는 별개의 일인데 호출만 스냅샷에 묶여 있었다.
       부르는 쪽이 넷(로그인·연동·되찾기·부팅 게이트)이라 함수 안에서 갈랐다.

     [개정 56 · 회원가입 설계 §6-②③⑧] «버린 uid» 되찾기 · 7일 되찾기 · 로그인 직후 소유자 강제 정정(_claimFriendCodeAfterTransfer)을
       걷었다. 이 기기의 이전 uid 는 이제 **다른 계정**이다 — 그 코드를 가져가면 남의 아이디(코드 = 로그인 아이디)를 빼앗는다.
       대신 로그인한 계정에 코드 기록이 없으면(스냅샷 · 거울 둘 다 없음) 친구 코드 로그인은 **입력한 코드**,
       구글은 로컬 코드를 **지우고** 다음 부팅에 거울 → 첫 발급(사용자 확정 (가)). 소유권(friendCodes)은 어디서도 안 쓴다.

   ・1절: _healFriendCodeOwner 를 **떼어 와 실행한다** — 내 것 · 주인 없음(선점)만 손대고, 그 밖(버린 uid 였던 것 ·
          오래 조용함 · 활동 중인 남)은 전부 **코드 그대로 · 소유권 그대로 · 경고만**.
   ・2절: 정적 — 로컬 코드를 지우는 문장은 _adoptAccountFriendCode 한 곳뿐 · 소유권 강제 지정 통로 없음 · 재발급 UI 없음.
   ・3절: _applyTransferSnapshot + _adoptAccountFriendCode 를 **떼어 와 실행한다** — 스냅샷 없이도 소지품 복원 셋이 돈다,
          스냅샷이 있으면 예전과 같다, 계정에 코드가 없을 때의 (가) 갈래.

   ⚠️ 이 검사는 `sim-google-login.js`(로그인이 _applyTransferSnapshot 을 부르는가)와 짝이다.
      그쪽은 부르는 쪽, 이쪽은 불린 함수 안을 본다.
   [실행] app.js 가 있는 폴더에서. 판정 줄은 맨 끝. */
'use strict';
const fs = require('fs');
const SRC = fs.readFileSync('app.js', 'utf8');
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
const fAdopt  = grabFn('_adoptAccountFriendCode');
const reLogin = /const FRIEND_CODE_LOGIN_RE = (\/[^\n]+\/);/.exec(SRC);
const fRemOld = grabFn('_rememberOldFriendCode');
const fGen    = grabFn('genFriendCodeCandidate');
const fApply  = grabFn('_applyTransferSnapshot', 'async function ');

/* ── 공용 스텁 ── */
function mkLS(){
  const m = new Map();
  return { m, getItem:k=>m.has(k)?m.get(k):null, setItem:(k,v)=>m.set(k,String(v)), removeItem:k=>m.delete(k) };
}

(async () => {
/* ═══ 1. _healFriendCodeOwner ═══ */
say('── 1. _healFriendCodeOwner — 내 것 · 주인 없음만 손댄다 · 남의 것은 코드도 소유권도 그대로 (개정 56)');
if(!fHeal || !fEnsure || !fRemOld || !fGen){
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
      fGen, fRemOld,
      fEnsure.replace('async function ensureMyFriendCode(', 'async function ensureMyFriendCode_real('),
      "async function ensureMyFriendCode(){ rec.ensureCalls++; return ensureMyFriendCode_real(); }",
      fHeal,
      "return { heal:_healFriendCodeOwner, checked:()=>_fcOwnerChecked };",
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
  chk(e.rec.registered.length === 1 && e.rec.registered[0][1] === 'me' && e.LS.getItem('tw.myFriendCode') === 'MATE-AB12', '  주인 없는 코드는 그 자리에서 내 것으로 선점한다(코드 유지)');

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
  const n = (CODE.match(/removeItem\(MY_FRIEND_CODE_KEY\)/g) || []).length;
  chk(n === 1 && !!fAdopt && /removeItem\(MY_FRIEND_CODE_KEY\)/.test(fAdopt), '★ 로컬 친추코드를 지우는 문장은 _adoptAccountFriendCode 한 곳뿐 (계정에 코드 기록이 없을 때 · 개정 56) — 그 밖은 로그아웃(ACCOUNT_LOCAL_KEYS)');
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

/* ═══ 3. _applyTransferSnapshot ═══ */
say('── 3. _applyTransferSnapshot — 스냅샷이 없어도 소지품은 온다');
if(!fApply){
  chk(false, '★ _applyTransferSnapshot 을 못 떼어 옴');
}else{
  chk(!!fAdopt && !!reLogin, '  _adoptAccountFriendCode · FRIEND_CODE_LOGIN_RE 를 떼어 왔다');
  const mkApply = (noCode) => {
    const LS = mkLS();
    LS.setItem('tw.focusTotalSec', '1000');
    LS.setItem('tw.focusSyncedSec', '900');
    if(!noCode) LS.setItem('tw.myFriendCode', 'MATE-OLD1');
    const rec = { calls: [], premium: null };
    const f = new Function('localStorage', 'rec', [
      "const console={ warn:()=>{}, log:()=>{}, info:()=>{} };",
      "const LICENSE_KEY_STORAGE='tw.licenseKey', FOCUS_TOTAL_KEY='tw.focusTotalSec', FOCUS_SYNCED_KEY='tw.focusSyncedSec', USER_NAME_KEY='tw.userName', MY_FRIEND_CODE_KEY='tw.myFriendCode';",
      "let _focusTotalSec=1000;",
      "const _setPremium=(v)=>{ rec.premium=v; };",
      "const _rememberOldFriendCode=(c)=>{ rec.calls.push('rememberOld:'+c); };",
      "const FRIEND_CODE_LOGIN_RE=" + (reLogin ? reLogin[1] : '/^$/') + ";",
      fAdopt || "function _adoptAccountFriendCode(){ rec.calls.push('NO-ADOPT'); }",
      "const _restoreOwnedDataAfterTransfer=async()=>{ rec.calls.push('restoreOwned'); };",
      "const syncFocusTotalToServer=async(w)=>{ rec.calls.push('syncFocus:'+w); };",
      fApply,
      "return { apply:_applyTransferSnapshot, focus:()=>_focusTotalSec };",
    ].join('\n'));
    return { LS, rec, m: f(LS, rec) };
  };

  let a = mkApply();
  await (a.m.apply(null));
  chk(a.rec.calls.includes('restoreOwned'), '★ 스냅샷이 null 이어도 **소지품 복원이 돈다** — 예전엔 첫 줄 if(!r) return 에서 끝났다(제보 3-1)');
  chk(a.rec.calls.includes('syncFocus:transfer') && !a.rec.calls.includes('NO-ADOPT'), '  집중초 동기화도 같이 돈다(스냅샷과 무관한 셋)');
  chk(a.rec.calls.indexOf('rememberOld:MATE-OLD1') >= 0 && a.rec.calls.indexOf('rememberOld:MATE-OLD1') < a.rec.calls.indexOf('restoreOwned') && a.rec.calls.indexOf('restoreOwned') < a.rec.calls.indexOf('syncFocus:transfer'), '  순서 — 친추코드 → 소지품 → 집중초');
  chk(a.rec.premium === null && a.LS.getItem('tw.licenseKey') === null && a.LS.getItem('tw.userName') === null, '  스냅샷이 없으니 라이선스·이름은 안 건드린다');
  chk(a.LS.getItem('tw.focusTotalSec') === '1000' && a.LS.getItem('tw.focusSyncedSec') === '900' && a.m.focus() === 1000, '  집중초·마크도 그대로(스냅샷 값이 없는데 맞출 수 없다)');
  chk(a.LS.getItem('tw.myFriendCode') === null, '★ 계정에 코드 기록이 없고 입력한 코드도 없으면(구글) 이 기기 코드를 **내려놓는다** — 다음 부팅에 거울 → 첫 발급 (개정 56 (가))');

  a = mkApply();
  await (a.m.apply({ license: 'LIC', focusTotalSec: 5000, name: '연우', friendCode: 'MATE-NEW2' }));
  chk(a.rec.premium === true && a.LS.getItem('tw.licenseKey') === 'LIC' && a.LS.getItem('tw.userName') === '연우', '  스냅샷이 있으면 예전과 같다 — 라이선스·이름 적용');
  chk(a.LS.getItem('tw.focusTotalSec') === '5000' && a.LS.getItem('tw.focusSyncedSec') === '5000' && a.m.focus() === 5000, '  집중초는 max 로 합치고 마크도 맞춘다(예전 그대로)');
  chk(a.LS.getItem('tw.myFriendCode') === 'MATE-NEW2' && a.rec.calls.includes('rememberOld:MATE-OLD1'), '  스냅샷 코드로 바꾸되 이 기기 코드는 기록해 둔다(예전 그대로)');
  chk(a.rec.calls.includes('restoreOwned') && a.rec.calls.includes('syncFocus:transfer'), '  소지품 복원 셋도 돈다');

  a = mkApply();
  await (a.m.apply({ focusTotalSec: 100 }));
  chk(a.LS.getItem('tw.focusTotalSec') === '1000' && a.m.focus() === 1000, '  스냅샷 집중초가 더 작으면 이 기기 것을 지킨다(max — 레벨이 깎이지 않는다)');

  /* 개정 56 (가) — 계정에 코드 기록이 없을 때 */
  a = mkApply();
  await (a.m.apply({ name: '연우' }, { typedCode: ' mate-zz99 ' }));
  chk(a.LS.getItem('tw.myFriendCode') === 'MATE-ZZ99' && a.rec.calls.includes('rememberOld:MATE-OLD1'), '★ 친구 코드 로그인이면 **입력한 코드**를 쓴다(대문자로) · 이 기기 코드는 기록');
  a = mkApply();
  await (a.m.apply({ friendCode: 'MATE-NEW2' }, { typedCode: 'MATE-ZZ99' }));
  chk(a.LS.getItem('tw.myFriendCode') === 'MATE-NEW2', '  계정 기록(스냅샷 · 거울)이 있으면 그것이 먼저다');
  a = mkApply();
  await (a.m.apply({}, { typedCode: 'NOPE' }));
  chk(a.LS.getItem('tw.myFriendCode') === null, '  입력한 코드가 형식에 안 맞으면 구글과 같이 내려놓는다');
  a = mkApply(true);
  await (a.m.apply({}));
  chk(a.LS.getItem('tw.myFriendCode') === null && !a.rec.calls.some(c => /^rememberOld:/.test(c)), '  이 기기에 코드가 없었으면 아무것도 안 한다');
  a = mkApply();
  a.LS.setItem('tw.myFriendCode', 'MATE-ZZ99');
  await (a.m.apply({}, { typedCode: 'MATE-ZZ99' }));
  chk(a.LS.getItem('tw.myFriendCode') === 'MATE-ZZ99' && !a.rec.calls.some(c => /^rememberOld:/.test(c)), '  입력한 코드가 이미 이 기기 코드면 그대로 (헛기록 없음)');
}

say('');
say('통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error('검사 자체가 죽음:', e); process.exit(2); });

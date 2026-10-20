/*
 * 🗑️ 회원 탈퇴 — 서버 함수 deleteMyAccount(functions/account-delete.js handleSelfDeleteAccount)를 부른다.
 * 미리 보기(preview)는 지울 것을 세어 오기만 한다. 탈퇴(run)는 지우는 동안 · 지운 뒤에 이 PC 가 다시 쓰지 않게
 *   ① 접속 표시의 onDisconnect 예약을 거두고(남아 있으면 연결이 끊길 때 서버가 users/{코드}/presence 를 도로 만든다)
 *   ② DB 연결을 끊은 다음 부른다. 실패하면 연결을 다시 잇는다 — 재접속 감시가 접속 표시를 다시 건다.
 * 이 PC 기록 지우기 · 다시 켜기는 부르는 쪽(account.js _loginDoDeleteAccount)이 한다.
 *
 * deps: callFn(name, data) → Promise<{ data }> · signedIn() → 'none' | 'anonymous' | 'ok'
 *       cancelPresence() → Promise | null · goOffline() · goOnline() · signOut() → Promise | null
 */
export const DELETE_FN = 'deleteMyAccount';
export const DELETE_CONFIRM_WORD = '탈퇴';   // functions/account-delete.js SELF_CONFIRM_WORD 와 같아야 한다
// 예약 거두기가 서버에 닿기를 기다리는 한도 — 못 닿아도 탈퇴는 이어 간다(서버가 지우는 범위에 접속 표시도 들어 있다).
const CANCEL_WAIT_MS = 4000;

export function deleteErrorReason(e){
  const k = String((e && e.code) || e || '');
  const msg = e && typeof e.message === 'string' ? e.message : '';
  if(k.includes('not-found')) return '서버에 탈퇴 기능이 아직 없어요 (함수 배포 전)';
  if(k.includes('unauthenticated')) return '로그인이 풀려 있어요 — 앱을 다시 시작해 로그인한 뒤 해 주세요';
  // 서버가 정한 문구(본인 확인 · 확인 글자 · 관리자 계정 등)는 그대로 보여 준다.
  if((k.includes('failed-precondition') || k.includes('permission-denied') || k.includes('invalid-argument') || k.includes('aborted')) && msg) return msg;
  if(k.includes('unavailable') || k.includes('deadline') || k.includes('internal') || k.includes('network')) return '서버에 닿지 못했어요 — 잠시 뒤 다시 눌러 주세요';
  return '탈퇴하지 못했어요 (' + (k || '알 수 없음') + ')';
}

function signedInReason(s){
  if(s === 'ok') return null;
  if(s === 'anonymous') return '가입을 마친 계정만 탈퇴할 수 있어요';
  return '로그인이 풀려 있어요 — 앱을 다시 시작해 로그인한 뒤 해 주세요';
}

export function createAccountDelete(deps){
  const { callFn, signedIn } = deps;
  const wait = (p, ms) => Promise.race([Promise.resolve(p).catch(()=>{}), new Promise(r => setTimeout(r, ms))]);

  /* 지울 것 세기 — { ok:true, groups, dbCount, storage, kept, warnings, … } | { ok:false, reason } */
  async function preview(){
    const no = signedInReason(signedIn());
    if(no) return { ok:false, reason: no };
    try{
      const r = await callFn(DELETE_FN, { dryRun: true });
      return Object.assign({}, (r && r.data) || {}, { ok: true });
    }catch(e){ return { ok:false, reason: deleteErrorReason(e) }; }
  }

  /* 탈퇴 — { ok:true, done } | { ok:false, reason }. ok:false 면 서버에서 아무것도 안 지웠거나, 지우다 멈춰 다시 누르면 이어서 지운다. */
  async function run(word){
    const no = signedInReason(signedIn());
    if(no) return { ok:false, reason: no };
    if(String(word == null ? '' : word).trim() !== DELETE_CONFIRM_WORD) return { ok:false, reason:'확인 글자 «' + DELETE_CONFIRM_WORD + '» 를 그대로 입력해 주세요' };
    try{ await wait(deps.cancelPresence(), CANCEL_WAIT_MS); }catch(_){}
    try{ deps.goOffline(); }catch(_){}
    let r;
    try{ r = await callFn(DELETE_FN, { dryRun: false, confirm: DELETE_CONFIRM_WORD }); }
    catch(e){
      try{ deps.goOnline(); }catch(_){}
      return { ok:false, reason: deleteErrorReason(e) };
    }
    try{ await deps.signOut(); }catch(_){}   // 서버가 로그인 계정을 지웠다 — 이 PC 의 세션도 놓는다
    return { ok:true, done: (r && r.data && r.data.done) || null };
  }

  return { preview, run, CONFIRM_WORD: DELETE_CONFIRM_WORD };
}

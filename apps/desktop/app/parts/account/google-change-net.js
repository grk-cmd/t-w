/*
 * 🔁 구글 계정 바꾸기 — 로그인된 계정(같은 Auth uid · 유저 코드)의 «구글 연결» 만 새 구글로 갈아 끼운다.
 * 유저 코드 · 친구 · 마이홈 · 라이선스는 움직이지 않는다(서버 데이터 · 규칙 그대로).
 * 순서: ① 지금 구글로 본인 확인(reauth) ② 지금 구글 끊기(unlink) ③ 새 구글 붙이기(link)
 *       ③ 이 실패하면(새 구글이 이미 남의 계정 등) 지금 구글을 다시 붙여 되돌린다.
 * ★ 비밀번호(친구 코드 + 비밀번호)가 있는 계정만 — 되돌리기까지 실패해도 로그인할 길이 남게.
 *   Firebase 는 한 계정에 구글을 하나만 붙여서, 새 구글이 남의 것인지는 ② 뒤에야 알 수 있다.
 *
 * deps: currentUser() → Auth 사용자 | null · credential(idToken) → 구글 자격
 *       reauth(user, cred) · unlink(user, providerId) · link(user, cred) → Promise
 * 돌려주는 err:true = 사용자 조건(다른 구글 · 이미 쓰임 · 비밀번호 없음)이 아닌 진짜 실패 — 부르는 쪽이 에러코드로 알린다.
 */
const GOOGLE = 'google.com';
const code = (e) => String((e && e.code) || e || '');

export function createGoogleChange(deps){
  const { currentUser, credential, reauth, unlink, link } = deps;

  /* oldIdToken = 지금 구글로 방금 받은 토큰 · newIdToken = 새로 고른 구글 토큰
     → { ok:true, email } | { ok:false, reason, needPassword?, restored? } */
  async function change(oldIdToken, newIdToken){
    const cu = currentUser();
    if(!cu || cu.isAnonymous) return { ok:false, reason:'로그인이 풀려 있어요 — 앱을 다시 시작해 주세요' };
    const pd = cu.providerData || [];
    if(!pd.some(p => p && p.providerId === 'password')) return { ok:false, needPassword:true, reason:'구글을 바꾸려면 먼저 비밀번호를 만들어 주세요' };
    if(!pd.some(p => p && p.providerId === GOOGLE)) return { ok:false, reason:'연결된 구글이 없어요 — [연결하기]를 써 주세요' };
    if(!oldIdToken || !newIdToken) return { ok:false, reason:'구글 확인에 실패했어요 — 다시 시도해 주세요' };
    const oldCred = credential(oldIdToken);
    try{ await reauth(cu, oldCred); }
    catch(e){
      const k = code(e);
      if(k.includes('user-mismatch')) return { ok:false, reason:'지금 연결된 구글 계정으로 골라 주세요' };
      if(k.includes('network')) return { ok:false, err:true, reason:'네트워크 오류 — 연결을 확인해 주세요' };
      return { ok:false, err:true, reason:'구글 확인에 실패했어요 (' + (k || '알 수 없음') + ')' };
    }
    try{ await unlink(cu, GOOGLE); }
    catch(e){ return { ok:false, err:true, reason:'구글 연결을 바꾸지 못했어요 (' + (code(e) || '알 수 없음') + ')' }; }
    try{
      const r = await link(cu, credential(newIdToken));
      const g = ((r && r.user && r.user.providerData) || []).find(p => p && p.providerId === GOOGLE);
      return { ok:true, email:(g && g.email) || null };
    }catch(e){
      const k = code(e);
      let restored = false;
      try{ await link(cu, oldCred); restored = true; }catch(_){}
      const taken = k.includes('credential-already-in-use') || k.includes('email-already-in-use');
      const why = taken
        ? '이 구글 계정은 이미 다른 계정에 쓰이고 있어요.'
        : (k.includes('network') ? '네트워크 오류로 새 구글을 연결하지 못했어요.' : '새 구글을 연결하지 못했어요 (' + (k || '알 수 없음') + ').');
      return { ok:false, restored, err: !taken || !restored, reason: why + (restored ? ' 원래 구글 그대로예요.'
        : ' 구글 연결이 풀렸어요 — 친구 코드 + 비밀번호로 로그인되고, [연결하기]로 다시 붙일 수 있어요.') };
    }
  }
  return { change };
}

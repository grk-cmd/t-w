/*
 * 관리자 전체 초대권 회수 — 모든 사용자의 남은 초대권을 0 장으로(관리자 › 초대권 지급 창의 «전체 유저에게 지급» 우클릭).
 *
 * 대상 목록은 전체 지급(grantInvitesAll)과 같이 friendCodes(code → {userId})에서 얻는다 — users 는 상위 .read 가 없어 통째로 못 읽는다.
 * 1장 이상인 사람만 0 으로 쓴다. 마이너스는 reclaimInvitesSince 가 깎아 둔 빚이라 0 으로 올리면 지워지므로 그대로 둔다.
 * 사람마다 먼저 get 한다 — 트랜잭션은 로컬 캐시가 비면 첫 호출이 null 로 들어와 «칸 없음» 으로 오해한다.
 *
 * deps: db, ref, get, runTransaction
 */
export function createInviteRevokeAll(deps){
  const { db, ref, get, runTransaction } = deps;
  const CHUNK = 20;   // 전체 지급과 같이 20명씩 동시에 — 한 명씩이면 사용자 수만큼 왕복이 쌓인다

  return async function revokeInvitesAll(){
    const codes = (await get(ref(db, 'friendCodes'))).val() || {};
    const uids = [...new Set(Object.values(codes).map(c => c && c.userId).filter(Boolean))];
    let revoked = 0, taken = 0, skipped = 0, failed = 0;
    const revokeOne = async uid => {
      try{
        const p = ref(db, `users/${uid}/invite/invitesLeft`);
        const base = (await get(p)).val();
        if(typeof base !== 'number' || base <= 0){ skipped++; return; }
        let before = null;
        const r = await runTransaction(p, v => {
          const n = (typeof v === 'number') ? v : base;
          before = n;
          return n > 0 ? 0 : undefined;   // 그 사이 본인이 다 썼으면 쓰지 않는다
        });
        if(r && r.committed && before > 0){ revoked++; taken += before; } else skipped++;
      }catch(_){ failed++; }
    };
    for(let i = 0; i < uids.length; i += CHUNK){
      await Promise.all(uids.slice(i, i + CHUNK).map(revokeOne));
    }
    return { ok: true, total: uids.length, revoked, taken, skipped, failed };
  };
}

/*
 * 초대 게이트 판정용 계정 읽기. users/{uid} 를 통째로 받지 않는다(평균 22KB, 큰 사람은 수 MB).
 *
 * 1) invite 하위 하나를 먼저 읽는다. 있으면 그것만으로 통과라 거기서 끝난다 — 대부분의 사용자(수십 바이트).
 * 2) 없을 때만 REST ?shallow=true 로 자식 키 목록을 받아 «실사용 흔적»을 본다. 객체 자식은 true,
 *    원시값 자식은 값 그대로 오므로 !!v.x 판정은 전체 값으로 할 때와 같다. users/$userId 는 .read: true 라 토큰 없이 읽힌다.
 *    shallow 가 실패하면 예전처럼 노드 전체를 받는다(비용만 예전, 판정은 같음).
 *
 * 반환: { exists, invite, hasProfile, hasLegacy } | null. invite 가 있으면 hasProfile · hasLegacy 는 null 이다 —
 * 부르는 쪽(checkInviteGate · refreshInviteBtn)은 invite 가 없을 때만 그 둘을 본다.
 *
 * deps: db, ref, get, databaseURL, fetch(기본 전역 fetch — 테스트용)
 */
export function createInviteAccount(deps){
  const { db, ref, get, databaseURL } = deps;
  const fetchFn = deps.fetch || ((...a) => fetch(...a));

  async function readShallow(userId){
    if(!databaseURL) return { ok: false };
    try{
      const res = await fetchFn(databaseURL.replace(/\/$/, '') + `/users/${encodeURIComponent(userId)}.json?shallow=true`);
      if(!res.ok) return { ok: false };
      return { ok: true, value: await res.json() };
    }catch(_){ return { ok: false }; }
  }

  return async function getInviteAccount(userId){
    const invite = (await get(ref(db, `users/${userId}/invite`))).val();
    if(invite) return { exists: true, invite, hasProfile: null, hasLegacy: null };
    const shallow = await readShallow(userId);
    const v = shallow.ok ? shallow.value : (await get(ref(db, `users/${userId}`))).val();
    if(!v) return null;
    // 실사용 흔적. presence · profile 은 첫 실행에 자동으로 생겨서 신규 사용자도 가지므로 판정에 쓰지 않는다.
    const hasLegacy = !!(v.home || v.friends || v.schedule || v.ddays || v.guestbook || v.clap);
    return { exists: true, invite: null, hasProfile: !!(v.profile || v.home), hasLegacy };
  };
}

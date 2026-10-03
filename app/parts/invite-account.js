/*
 * 초대 게이트 판정용 계정 읽기. users/{uid} 를 통째로 받지 않는다(평균 22KB, 큰 사람은 수 MB).
 *
 * 1) REST ?shallow=true 로 자식 키 목록만 받는다. 객체 자식은 true, 원시값 자식은 값 그대로 오므로
 *    아래 !!v.x 판정은 전체 값으로 할 때와 같다. users/$userId 는 .read: true 라 토큰 없이 읽힌다.
 * 2) invite 가 있을 때만 그 하위 경로 하나를 실제 값으로 받는다.
 * shallow 가 실패하면 예전처럼 노드 전체를 받는다(비용만 예전, 판정은 같음).
 *
 * 반환 모양을 바꾸면 기존 사용자가 초대 게이트에 다시 걸린다 — { exists, invite, hasProfile, hasLegacy } | null 유지.
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
    const shallow = await readShallow(userId);
    const v = shallow.ok ? shallow.value : (await get(ref(db, `users/${userId}`))).val();
    if(!v) return null;
    // 실사용 흔적. presence · profile 은 첫 실행에 자동으로 생겨서 신규 사용자도 가지므로 판정에 쓰지 않는다.
    const hasLegacy = !!(v.home || v.friends || v.schedule || v.ddays || v.guestbook || v.clap);
    let invite = v.invite || null;
    if(shallow.ok && invite) invite = (await get(ref(db, `users/${userId}/invite`))).val() || null;
    return { exists: true, invite, hasProfile: !!(v.profile || v.home), hasLegacy };
  };
}

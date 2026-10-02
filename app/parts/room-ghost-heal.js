/*
 * 방에서 내 멤버 노드(rooms/{방}/{멤버id})가 연결이 살아 있는 채로 사라졌을 때 다시 등록한다.
 *
 * 노드가 없으면 하트비트 update 가 규칙(name·state 필수)에 걸려 거부된다. 그 거부를 신호로 삼아
 * 노드가 정말 없는지 확인하고, 입장 때와 같은 값으로 다시 쓴다. 평소에는 아무것도 하지 않는다.
 *
 * 되살리지 않는 경우
 * - 같은 계정이 다른 기기에서 들어와 밀려났다(window._deviceSessionLost) — 의도된 정리다.
 * - 방이 닫혔다(_meta 도 없고 다른 멤버도 없다).
 * - 노드는 있다 — 값 형식 문제라 다시 써도 같은 거부가 난다. 로그만 남긴다.
 *
 * TODO: 임시 처리다. 사라진 뒤 최대 30초(다음 하트비트)는 상대 화면에서 안 보인다.
 *   근본 해결은 연결마다 다른 멤버 자리를 써서 옛 연결의 늦은 onDisconnect 가 새 자리를 못 지우게 하는 것.
 *   배포 뒤 쓰기 거부율과 [ghost-heal] 로그를 보고 결정한다.
 *
 * deps: db, ref, get, set, onDisconnect, serverTimestamp, touchRoomIndex(room),
 *       state() → { room, mid, memberRef, data, friends, meta } — 호출할 때마다 현재 값을 읽는다.
 *       win, now 는 테스트용(기본 window, Date.now).
 */
const HEAL_INTERVAL_MS = 15000;   // 거부가 몰려도 확인 읽기는 이 간격에 한 번

export function createGhostHeal(deps){
  const { db, ref, get, set, onDisconnect, serverTimestamp, touchRoomIndex, state } = deps;
  const win = deps.win || (typeof window !== 'undefined' ? window : {});
  const now = deps.now || (() => Date.now());
  let lastAt = -Infinity, busy = false;

  return async function healMyMemberNode(why){
    const s = state();
    const { room, mid, memberRef } = s;
    if(!room || !mid || !memberRef || !s.data || busy) return;
    if(win._deviceSessionLost) return;
    const t = now();
    if(t - lastAt < HEAL_INTERVAL_MS) return;
    busy = true; lastAt = t;
    const stillHere = () => { const c = state(); return c.room === room && c.mid === mid; };
    try{
      const mine = await get(ref(db, `rooms/${room}/${mid}/name`));
      if(!stillHere()) return;
      if(mine.exists()){
        console.warn('[ghost-heal] 노드는 있는데 거부됐다 — 값 형식 문제로 보인다 (' + why + ')');
        return;
      }
      const cur = state();
      const othersAlive = !!(cur.friends && Object.keys(cur.friends).length);
      if(!cur.meta && !othersAlive){
        console.warn('[ghost-heal] 방이 닫힌 것으로 보여 재등록하지 않는다 —', room, '(' + why + ')');
        return;
      }
      await set(memberRef, { ...cur.data, lastSeen: serverTimestamp() });
      // 쓰는 사이 방을 나갔으면 노드는 나가기 쪽 remove 가 지운다. 예약만 건너뛴다.
      if(!stillHere()) return;
      onDisconnect(memberRef).remove();
      touchRoomIndex(room);
      console.warn('[ghost-heal] 내 멤버 노드가 사라져 재등록했다 —', room, '(' + why + ')');
    }catch(_){
    }finally{ busy = false; }
  };
}

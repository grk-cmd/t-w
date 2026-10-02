/* ═══ 👻 room-ghost-heal.js — 방 «유령» 복구 (2026-10-03 · 프로파일러 실측) ═════════════════════════
   🚧 TODO(임시 처리): 이 파일은 «사라진 뒤 감지해서 되살리는» 응급 처치다. 유령 구간이 최대 30초(다음 하트비트) 남는다.
     근본 해결 = 연결마다 다른 멤버 자리를 써서 옛 연결의 늦은 onDisconnect 가 새 자리를 못 지우게 하는 것.
     멤버 id 가 입장 순서 · 좌석 · 방장 승계 · poke 의 기준이라 같이 바꿔야 한다(옛 버전과 섞이는 기간 주의).
     먼저 할 일: 이 복구가 들어간 릴리스 뒤 프로파일러로 rooms/{방}/{멤버} 쓰기 거부율(47%)과
       콘솔 [ghost-heal] 로그(«재등록» vs «노드는 있는데 거부») 비율을 보고, 근본 해결 여부를 정한다.
   firebase-init.js 가 import 해서 쓴다. 이 파일은 Firebase 를 직접 import 하지 않는다 — 필요한 함수와
   방 상태는 firebase-init.js 가 넘겨 준다(createGhostHeal). 그래서 node 에서 가짜 DB 로 그대로 돌려볼 수 있다
   (checks/sim-ghost-heal.js).

   [실측] 2분간 rooms/{방}/{멤버} 쓰기 11,499건 중 5,365건(47%)이 거부됐다.
   [기전] 내 멤버 노드가 지워진 뒤 하트비트(update {lastSeen, exp}) · updateMe 가 오면, 합친 결과에 name·state 가 없어
     `$memberId` 의 .validate 에 걸려 거부된다(dev DB 재현: 노드 있음 → update 성공 · 삭제 후 → Permission denied).
     재등록은 `.info/connected` 가 true 가 되는 순간에만 했으므로(joinRoom), **연결이 끊기지 않은 채로** 노드가
     사라지면 복구 길이 없다 — 상대 화면에서 나는 사라지고 나는 상대가 다 보이는 비대칭이 영구화된다.
   [지워지는 경우]
     ① 옛 소켓의 onDisconnect.remove() 가 새 소켓으로 재등록한 **뒤에** 늦게 실행(절전 · 와이파이 전환).
        예약은 서버가 옛 연결에 묶어 둔 것이라 새 연결에서 확실히 취소할 길이 없다.
     ② 같은 계정의 다른 기기가 입장하며 내 옛 노드를 정리(joinRoom 첫 스냅샷의 userId 정리)
   [대응] 쓰기가 **거부될 때만** 확인한다(평소 비용 0): 내 노드가 정말 없으면 입장 때와 같은 전체 재등록
     + onDisconnect 재예약 + roomIndex 갱신. 길어야 다음 하트비트(30초) 안에 상대 화면에 다시 나타난다.
   ★ 되살리지 않는 경우
     · 한 계정 한 기기에서 밀려남(window._deviceSessionLost) — ②는 의도된 정리다
     · 방이 닫힘 — _meta 도 없고 살아 있는 다른 멤버도 없다(관리자 «모든 방 종료» · 마지막 사람 정리)
     · 노드는 있다 — 값 형식이 규칙에 안 맞아 거부된 것(예: customStatus.emo 4자 초과). 재등록해도 같은 거부라
       진단 로그만 남긴다 — 프로파일러의 «거부» 가 어느 쪽인지 가르는 줄이다
   ⚠️ 거부가 이어져도 15초에 한 번만 확인한다 — 확인 읽기는 name 한 칸(수 바이트)이다.
   ⚠️ 근본 해결은 연결마다 다른 멤버 자리를 쓰는 것이지만, 멤버 id 가 입장 순서 · 좌석 · 방장 승계 · poke 의 기준이라
     옛 버전과 섞이면 위험하다. 이 복구로 거부가 충분히 줄지 다음 릴리스 뒤 프로파일러로 먼저 본다. */

const HEAL_INTERVAL_MS = 15000;

/* deps
     db, ref, get, set, onDisconnect, serverTimestamp — firebase-init.js 의 것 그대로
     touchRoomIndex(room)  — roomIndex 하트비트(firebase-init.js _touchRoomIndex)
     state() → { room, mid, memberRef, data, friends, meta } — 지금 방 상태를 **부를 때마다** 읽는다
       (leaveRoom 이 비우는 값들이라, 기다리는 사이 방을 나갔는지 다시 볼 수 있어야 한다)
     win    — 기본 window (검사에서 바꿔 끼운다)
     now    — 기본 Date.now */
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
      if(!stillHere()) return;   // 그 사이 나갔다
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
      // 쓰기를 기다리는 사이 방을 나갔다면 — 노드는 나가기의 remove 가 뒤에 지운다. 예약 · 방 목록 갱신만 건너뛴다.
      if(!stillHere()) return;
      onDisconnect(memberRef).remove();
      touchRoomIndex(room);
      console.warn('[ghost-heal] 내 멤버 노드가 사라져 재등록했다 —', room, '(' + why + ')');
    }catch(_){
    }finally{ busy = false; }
  };
}

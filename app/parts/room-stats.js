/* ═══ 📊 room-stats.js — 서버가 세어 둔 방 개수 요약 roomStats 읽기 (2026-10-03 · RTDB 트래픽 분석 §2-1) ═══════
   [왜] 방 창 · F1 멀티모드 탭을 열어 둔 사람마다 30초마다 roomIndex **전체**(약 24KB)를 받아 각자 셌다 —
        다운로드 1위(약 29%). 서버 함수(functions/room-stats.js)가 1분마다 세어 roomStats 에 두고 앱은 그것만 읽는다.
   [모양] roomStats = { workingroom, togetherroom, open:[랜덤 참여 후보 코드 ≤30], at }  (수백 바이트)
   [규칙] 모양이 맞고 FRESH_MS 안에 쓴 것일 때만 쓴다. 없음(함수 배포 전) · 규칙 거부(규칙 배포 전) ·
          낡음(함수 멈춤)이면 null → 부르는 쪽이 예전처럼 roomIndex 로 직접 센다. 비용만 늘고 화면은 안 틀린다.
   ⚠️ 정원 검사(방 만들기 · 빈 방 승격)에는 쓰지 않는다 — 최대 1분 늦은 숫자로 정원을 넘기면 안 된다.
   ★ open 이 비어 있으면 RTDB 는 그 키를 저장하지 않는다 — 없으면 [] 로 본다(모양 틀림이 아니다).
   firebase-init.js 가 import 해서 쓴다. Firebase 를 직접 import 하지 않는다(checks/sim-room-stats.js 가 가짜 DB 로 돌린다).

   deps
     db, ref, get — firebase-init.js 의 것 그대로
     now()        — 서버 기준 시각(firebase-init.js _svNow). 사용자 PC 시계가 틀려도 신선도 판정이 맞게
     rnd()        — 기본 Math.random (검사에서 고정) */
export const ROOM_STATS_FRESH_MS = 3 * 60 * 1000;

export function createRoomStats(deps){
  const { db, ref, get, now } = deps;
  const rnd = deps.rnd || Math.random;

  /* → { workingroom, togetherroom, open } | null */
  async function read(){
    try{
      const s = (await get(ref(db, 'roomStats'))).val();
      if(!s || typeof s.at !== 'number' || (now() - s.at) >= ROOM_STATS_FRESH_MS) return null;
      if(typeof s.workingroom !== 'number' || typeof s.togetherroom !== 'number') return null;
      const open = (s.open == null) ? [] : (Array.isArray(s.open) ? s.open : Object.values(s.open));
      return { workingroom: s.workingroom, togetherroom: s.togetherroom, open };
    }catch(_){ return null; }
  }

  /* getRoomCounts({quick}) 용 — 화면 표시 숫자. 없으면 null */
  async function counts(){
    const st = await read();
    return st ? { total: st.workingroom + st.togetherroom, workingroom: st.workingroom, togetherroom: st.togetherroom } : null;
  }

  /* findRandomRooms 용 — 섞은 후보(시크릿룸 방어로 한 번 더 거름). 없으면 null.
     최대 1분 낡지만 부르는 쪽이 후보마다 checkRoomCapacity 로 확인하고 0명(죽은 방)은 건너뛴다. */
  async function randomOpen(limit){
    const st = await read();
    if(!st) return null;
    const out = st.open.filter(c => typeof c === 'string' && c.indexOf('SCRT-') !== 0);
    for(let i = out.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); const t = out[i]; out[i] = out[j]; out[j] = t; }
    return (limit > 0) ? out.slice(0, limit) : out;
  }

  return { read, counts, randomOpen };
}

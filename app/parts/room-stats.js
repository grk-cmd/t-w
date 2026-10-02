/*
 * 서버 함수(functions/room-stats.js)가 1분마다 세어 둔 roomStats 읽기.
 * roomStats = { workingroom, togetherroom, at }
 *
 * 화면 표시용이다. 없거나(함수 배포 전) 읽기가 거부되거나 낡았으면 null 을 돌려주고,
 * 부르는 쪽이 예전처럼 roomIndex 로 직접 센다. 정원 검사에는 쓰지 않는다(최대 1분 늦은 값이다).
 *
 * deps: db, ref, get, now() — 서버 기준 시각
 */
export const ROOM_STATS_FRESH_MS = 3 * 60 * 1000;

export function createRoomStats(deps){
  const { db, ref, get, now } = deps;

  async function read(){
    try{
      const s = (await get(ref(db, 'roomStats'))).val();
      if(!s || typeof s.at !== 'number' || (now() - s.at) >= ROOM_STATS_FRESH_MS) return null;
      if(typeof s.workingroom !== 'number' || typeof s.togetherroom !== 'number') return null;
      return { workingroom: s.workingroom, togetherroom: s.togetherroom };
    }catch(_){ return null; }
  }

  async function counts(){
    const st = await read();
    return st ? { total: st.workingroom + st.togetherroom, workingroom: st.workingroom, togetherroom: st.togetherroom } : null;
  }

  return { read, counts };
}

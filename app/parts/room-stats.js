/*
 * 서버 함수(functions/room-stats.js)가 1분마다 세어 둔 roomStats 읽기.
 * roomStats = { workingroom, togetherroom, at }
 *
 * 화면 표시용이다. 없거나(함수 배포 전) 읽기가 거부되거나 낡았으면 null 을 돌려주고,
 * 부르는 쪽이 예전처럼 roomIndex 로 직접 센다. 정원 검사에는 쓰지 않는다(최대 1분 늦은 값이다).
 *
 * deps: db, ref, get, onValue, now() — 서버 기준 시각
 */
export const ROOM_STATS_FRESH_MS = 3 * 60 * 1000;

export function createRoomStats(deps){
  const { db, ref, get, onValue, now } = deps;

  function toCounts(s){
    if(!s || typeof s.at !== 'number' || (now() - s.at) >= ROOM_STATS_FRESH_MS) return null;
    if(typeof s.workingroom !== 'number' || typeof s.togetherroom !== 'number') return null;
    return { total: s.workingroom + s.togetherroom, workingroom: s.workingroom, togetherroom: s.togetherroom };
  }

  async function counts(){
    try{ return toCounts((await get(ref(db, 'roomStats'))).val()); }catch(_){ return null; }
  }

  // 서버가 쓰는 즉시 cb(counts | null) 를 부른다. 돌려주는 함수로 끊는다 — 화면이 닫히면 꼭 끊는다.
  function watch(cb){
    try{ return onValue(ref(db, 'roomStats'), snap => cb(toCounts(snap.val())), () => cb(null)); }
    catch(_){ return () => {}; }
  }

  return { counts, watch };
}

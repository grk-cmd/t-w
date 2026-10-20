/*
 * 서버 함수(functions/room-stats.js)가 1분마다 세어 둔 roomStats 읽기.
 * roomStats = { workingroom, togetherroom, at, server? } — server 는 그중 방 서버 몫(이미 합계에 들어 있다).
 * server 가 있으면 counts 에 inclServer:true 를 붙인다 — app.js 가 방 서버 stats 를 또 더하지 않게.
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
    const c = { total: s.workingroom + s.togetherroom, workingroom: s.workingroom, togetherroom: s.togetherroom };
    if(s.server && typeof s.server === 'object') c.inclServer = true;
    return c;
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

/*
 * 서버 함수(functions/room-stats.js)가 1분마다 세어 둔 roomStats 읽기.
 * roomStats = { workingroom, togetherroom, open: [랜덤 참여 후보], at }
 *
 * 화면 표시용이다. 없거나(함수 배포 전) 읽기가 거부되거나 낡았으면 null 을 돌려주고,
 * 부르는 쪽이 예전처럼 roomIndex 로 직접 센다. 정원 검사에는 쓰지 않는다(최대 1분 늦은 값이다).
 *
 * deps: db, ref, get, now() — 서버 기준 시각, rnd() — 테스트용(기본 Math.random)
 */
import { isSecretRoom } from './room-channel.js';

export const ROOM_STATS_FRESH_MS = 3 * 60 * 1000;

export function createRoomStats(deps){
  const { db, ref, get, now } = deps;
  const rnd = deps.rnd || Math.random;

  async function read(){
    try{
      const s = (await get(ref(db, 'roomStats'))).val();
      if(!s || typeof s.at !== 'number' || (now() - s.at) >= ROOM_STATS_FRESH_MS) return null;
      if(typeof s.workingroom !== 'number' || typeof s.togetherroom !== 'number') return null;
      // 빈 배열은 RTDB 에 저장되지 않아 키가 없다. 실패가 아니라 후보 0개다.
      const open = (s.open == null) ? [] : (Array.isArray(s.open) ? s.open : Object.values(s.open));
      return { workingroom: s.workingroom, togetherroom: s.togetherroom, open };
    }catch(_){ return null; }
  }

  async function counts(){
    const st = await read();
    return st ? { total: st.workingroom + st.togetherroom, workingroom: st.workingroom, togetherroom: st.togetherroom } : null;
  }

  // 후보가 죽은 방일 수 있다. 부르는 쪽이 checkRoomCapacity 로 확인한다.
  async function randomOpen(limit){
    const st = await read();
    if(!st) return null;
    const out = st.open.filter(c => typeof c === 'string' && !isSecretRoom(c));
    for(let i = out.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); const t = out[i]; out[i] = out[j]; out[j] = t; }
    return (limit > 0) ? out.slice(0, limit) : out;
  }

  return { read, counts, randomOpen };
}

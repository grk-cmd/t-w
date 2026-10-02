/*
 * roomIndex/{방} = { lastSeen, channel?, open? } 쓰기.
 * 방 개수 · 채널별 개수 · 랜덤 참여 후보를 rooms 전체 대신 이 작은 노드로 판단한다.
 *
 * 하트비트에도 channel · open 을 싣는 이유: 서버 함수(functions/room-stats.js)가 오래 조용한 줄을 지우는데,
 * 절전에서 깨어난 하트비트가 { lastSeen } 만으로 줄을 다시 만들면 투게더룸이 워킹룸으로 세어지고
 * 랜덤 참여 방이 후보에서 빠진다. 두 값은 지금 방의 _meta 에서 꺼낸다.
 *
 * deps: db, ref, update, serverTimestamp,
 *       state() → { room, meta } — 지금 방 코드와 _meta 값. 호출할 때마다 현재 값을 읽는다.
 */
export function createRoomIndex(deps){
  const { db, ref, update, serverTimestamp, state } = deps;

  function keep(room){
    const s = state();
    if(!room || room !== s.room || !s.meta) return {};
    const out = {};
    if(s.meta.channel === 'workingroom' || s.meta.channel === 'togetherroom') out.channel = s.meta.channel;
    // 모를 때 false 를 쓰면 방장이 켠 랜덤 참여가 꺼진다. 아는 값만 싣는다.
    if(typeof s.meta.open === 'boolean') out.open = s.meta.open;
    return out;
  }

  function touch(room, extra){
    if(String(room || '').indexOf('SCRT-') === 0) return;   // 시크릿룸은 방 개수에 안 잡히게 기록하지 않는다
    try{ update(ref(db, `roomIndex/${room}`), Object.assign({ lastSeen: serverTimestamp() }, keep(room), extra || {})); }catch(_){}
  }

  return { touch, keep };
}

/*
 * roomIndex/{방} = { lastSeen, channel?, open? } 쓰기.
 * 방 개수 · 채널별 개수 · 랜덤 참여 후보를 rooms 전체 대신 이 작은 노드로 판단한다.
 *
 * 하트비트에도 channel · open 을 싣는 이유: 서버 함수(functions/room-stats.js)가 오래 조용한 줄을 지우는데,
 * 절전에서 깨어난 하트비트가 { lastSeen } 만으로 줄을 다시 만들면 투게더룸이 워킹룸으로 세어지고
 * 랜덤 참여 방이 후보에서 빠진다.
 *
 * deps: db, ref, get, update, serverTimestamp,
 *       state() → { room, meta } — 지금 방 코드와 _meta 값. 호출할 때마다 현재 값을 읽는다.
 */
export function createRoomIndex(deps){
  const { db, ref, get, update, serverTimestamp, state } = deps;
  let memo = { room: null, open: null };   // open 은 roomIndex 에만 있어서 따로 기억한다

  function keep(room){
    const out = {};
    const s = state();
    if(!room || room !== s.room) return out;
    const ch = s.meta && s.meta.channel;
    if(ch === 'workingroom' || ch === 'togetherroom') out.channel = ch;
    // 모를 때 false 를 쓰면 방장이 켠 랜덤 참여가 꺼진다. 아는 값만 싣는다.
    if(memo.room === room && typeof memo.open === 'boolean') out.open = memo.open;
    return out;
  }

  function touch(room, extra){
    if(String(room || '').indexOf('SCRT-') === 0) return;   // 시크릿룸은 방 개수에 안 잡히게 기록하지 않는다
    try{ update(ref(db, `roomIndex/${room}`), Object.assign({ lastSeen: serverTimestamp() }, keep(room), extra || {})); }catch(_){}
  }

  // 입장 때 한 번. 방을 연 사람이 setOpen 으로 먼저 알려 줬으면 읽지 않는다.
  function rememberOpen(room){
    if(!room || memo.room === room) return;
    Promise.resolve().then(() => get(ref(db, `roomIndex/${room}/open`))).then(snap => {
      if(state().room !== room || memo.room === room) return;
      const v = snap.val();
      if(typeof v === 'boolean') memo = { room, open: v };
    }).catch(() => {});
  }

  function setOpen(room, open){
    if(room && typeof open === 'boolean') memo = { room, open };
  }

  function reset(){ memo = { room: null, open: null }; }

  return { touch, keep, rememberOpen, setOpen, reset };
}

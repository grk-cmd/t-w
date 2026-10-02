/* ═══ 💰 room-index.js — 방 요약 노드 roomIndex/{방} 쓰기 (2026-10-03 분리) ═════════════════════════════
   roomIndex/{code} = { lastSeen, channel?, open? } — 방 개수 · 채널별 개수 · 랜덤 참여 후보를 rooms 전체
   (멤버 · 아바타 · chatLog, 방당 수백 KB) 대신 이 노드(방당 수십 바이트)로 판단하게 하는 요약이다.
   firebase-init.js 가 import 해서 쓴다. 이 파일은 Firebase 를 직접 import 하지 않는다 — 필요한 함수와 방 상태는
   firebase-init.js 가 넘겨 준다(createRoomIndex). 그래서 node 에서 가짜 DB 로 그대로 돌려볼 수 있다
   (checks/sim-room-stats.js).

   [쓰는 곳] 입장 · 재접속 · 30초 하트비트 · 유령 복구 → touch(room)
            방 열기 · 채널 확정(setRoomChannel · recoverRoomChannel) → touch(room, { channel, open? })
   [channel · open 을 하트비트에도 싣는 이유]
     서버 함수 roomStats(functions/room-stats.js)가 10분 넘게 조용한 줄을 지운다. 방 사람들이 다 절전했다가
     깨어나면 하트비트가 { lastSeen } 만으로 줄을 새로 만들어, 투게더룸이 워킹룸으로 세어지고(정원 검사 포함)
     랜덤 참여 방이 후보에서 빠졌다 — channel · open 을 쓰는 곳이 방을 열 때뿐이었기 때문이다.
     · channel — 지금 방의 _meta 구독 값. 없으면(옛 방 · 메타 도착 전) 싣지 않는다.
     · open    — roomIndex 에만 있는 값이라, 입장 때 그 한 칸을 읽어 두거나(rememberOpen) 방을 연 사람이
                 쓴 값을 기억한다(setOpen). 나가면 비운다(reset).
     ⚠️ open 은 **명시적 boolean 일 때만** 싣는다. 모를 때 false 를 쓰면 방장이 켠 방이 하트비트 한 번에 꺼진다.
     업로드라 다운로드 요금은 그대로다. 옛 판 앱이 되살린 줄은 여전히 { lastSeen } 뿐 — 같은 방에 이 판이
     한 명이라도 있으면 다음 하트비트(30초)에 채워진다.
   🔒 시크릿룸(SCRT-)은 기록하지 않는다 — 인덱스에서 빠지는 것만으로 방 개수(정원)에 잡히지 않는다.
   쓰기 실패는 조용히 무시 — 카운트가 잠깐 어긋날 뿐이다.

   deps
     db, ref, get, update, serverTimestamp — firebase-init.js 의 것 그대로
     state() → { room, meta } — 지금 방 코드와 _meta 구독 값. **부를 때마다** 읽는다(나가면 비는 값이다) */
export function createRoomIndex(deps){
  const { db, ref, get, update, serverTimestamp, state } = deps;
  let memo = { room: null, open: null };

  /* 지금 방이면 channel · 기억한 open 을 돌려준다. 다른 방이면 {} */
  function keep(room){
    const out = {};
    const s = state();
    if(!room || room !== s.room) return out;
    const ch = s.meta && s.meta.channel;
    if(ch === 'workingroom' || ch === 'togetherroom') out.channel = ch;
    if(memo.room === room && (memo.open === true || memo.open === false)) out.open = memo.open;
    return out;
  }

  /* lastSeen + keep + extra(명시한 값이 이긴다) */
  function touch(room, extra){
    if(String(room || '').indexOf('SCRT-') === 0) return;
    try{ update(ref(db, `roomIndex/${room}`), Object.assign({ lastSeen: serverTimestamp() }, keep(room), extra || {})); }catch(_){}
  }

  /* 입장 때 한 번 — open 한 칸(수 바이트)만 읽는다. 방을 연 사람이 먼저 기억했으면 읽지 않는다(그 값이 더 새롭다) */
  function rememberOpen(room){
    if(!room || memo.room === room) return;
    Promise.resolve().then(() => get(ref(db, `roomIndex/${room}/open`))).then(snap => {
      if(state().room !== room || memo.room === room) return;   // 읽는 사이 나갔거나 setOpen 이 먼저 왔다
      const v = snap.val();
      if(v === true || v === false) memo = { room, open: v };
    }).catch(() => {});
  }

  function setOpen(room, open){
    if(room && (open === true || open === false)) memo = { room, open };
  }

  function reset(){ memo = { room: null, open: null }; }

  return { touch, keep, rememberOpen, setOpen, reset };
}

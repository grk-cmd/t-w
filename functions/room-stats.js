/*
 * 1분마다 roomIndex 를 세어 roomStats = { workingroom, togetherroom, at } 에 기록한다.
 * 앱은 30초마다 roomIndex 전체를 받는 대신 이 작은 노드만 읽는다(app/parts/room-stats.js).
 * 세는 기준(90초 · 시크릿룸 제외 · channel 없으면 워킹룸)은 앱의 getRoomCounts 와 같아야 한다.
 *
 * 10분 넘게 조용한 줄은 지운다. 강제 종료 · 절전으로 끝난 방의 줄이 계속 쌓이기 때문이다.
 * 다시 들어온 방의 줄은 하트비트가 channel · open 과 함께 되살린다(app/parts/room-index.js).
 */
'use strict';
// app/parts/room-channel.js 와 같은 값
const CHANNEL = Object.freeze({ WORKING: 'workingroom', TOGETHER: 'togetherroom' });
const SECRET_ROOM_PREFIX = 'SCRT-';
const ROOM_LIVE_MS = 90 * 1000;              // 앱 getRoomCounts 의 STALE 과 같게
const ROOM_INDEX_DROP_MS = 10 * 60 * 1000;   // 하트비트가 30초라 살아 있는 방은 이만큼 조용하지 않다
const ROOM_DROP_MAX = 300;                   // 첫 실행 때 밀린 줄이 많아도 한 번에 이만큼만

function roomStatsFrom(idx, now){
  const out = { [CHANNEL.WORKING]: 0, [CHANNEL.TOGETHER]: 0, at: now };
  const drop = [];
  for (const code in (idx || {})){
    const e = idx[code];
    if (!e || typeof e !== 'object') continue;
    const seen = Number(e.lastSeen);
    if (!Number.isFinite(seen)) continue;
    if (now - seen >= ROOM_INDEX_DROP_MS){ drop.push(code); continue; }
    if (code.indexOf(SECRET_ROOM_PREFIX) === 0) continue;
    if (now - seen >= ROOM_LIVE_MS) continue;
    const ch = (e.channel === CHANNEL.TOGETHER) ? CHANNEL.TOGETHER : CHANNEL.WORKING;
    out[ch]++;
  }
  return { stats: out, drop: drop.slice(0, ROOM_DROP_MAX) };
}

async function runRoomStats(db, now){
  const idx = (await db.ref('roomIndex').get()).val() || {};
  const { stats, drop } = roomStatsFrom(idx, now);
  await db.ref('roomStats').set(stats);
  let dropped = 0, kept = 0, failed = 0;
  const cutoff = now - ROOM_INDEX_DROP_MS;
  for (const code of drop){
    try{
      // 첫 호출의 cur 는 로컬 추측값(대개 null)이라 null 을 돌려줘야 서버 값으로 다시 불린다.
      // 그새 다시 들어와 lastSeen 이 새로워진 줄은 그만둔다(undefined).
      const r = await db.ref('roomIndex/' + code).transaction(cur => {
        if (cur === null) return null;
        if (Number(cur.lastSeen) < cutoff) return null;
        return;
      }, undefined, false);
      if (r.committed) dropped++; else kept++;
    }catch(e){ failed++; }
  }
  const sum = { live: stats.workingroom + stats.togetherroom, working: stats.workingroom, together: stats.togetherroom,
                rows: Object.keys(idx).length, dropped, kept, failed };
  if (dropped || failed) console.log('[roomStats]', JSON.stringify(sum));
  return sum;
}

module.exports = { roomStatsFrom, runRoomStats, ROOM_LIVE_MS, ROOM_INDEX_DROP_MS, ROOM_DROP_MAX };

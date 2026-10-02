/*
 * roomIndex 를 세어 roomStats = { workingroom, togetherroom, at } 에 기록한다.
 * 방이 열리고 닫힐 때(roomIndex 줄 생성 · 삭제) 바로 한 번, 그리고 줄을 지울 사람 없이 끝난 방을 반영하려고 1분마다 한 번 돈다.
 * 앱은 30초마다 roomIndex 전체를 받는 대신 이 작은 노드만 읽는다(app/parts/room-stats.js).
 * 세는 기준(90초 · 시크릿룸 제외 · channel 없으면 워킹룸)은 앱의 getRoomCounts 와 같아야 한다.
 *
 * 10분 넘게 조용한 줄은 지운다. 강제 종료 · 절전으로 끝난 방의 줄이 계속 쌓이기 때문이다.
 * 다시 들어온 방의 줄은 하트비트가 channel · open 과 함께 되살린다(app/parts/room-index.js).
 * 옛 판 앱은 { lastSeen } 만 써서 channel · open 이 빠질 수 있다. 그래서 줄을 지우기 전에 두 값을 그 방 _meta 에
 * 옮겨 두고(빠진 것만), 방이 되살아나면 주기 실행이 _meta 에서 다시 채워 넣는다.
 */
'use strict';
// app/parts/room-channel.js 와 같은 값
const CHANNEL = Object.freeze({ WORKING: 'workingroom', TOGETHER: 'togetherroom' });
const SECRET_ROOM_PREFIX = 'SCRT-';
const ROOM_LIVE_MS = 90 * 1000;              // 앱 getRoomCounts 의 STALE 과 같게
const ROOM_INDEX_DROP_MS = 10 * 60 * 1000;   // 하트비트가 30초라 살아 있는 방은 이만큼 조용하지 않다
const ROOM_DROP_MAX = 300;                   // 첫 실행 때 밀린 줄이 많아도 한 번에 이만큼만
const ROOM_REPAIR_MAX = 50;                  // channel 채워 넣기도 한 번에 이만큼만

function roomStatsFrom(idx, now){
  const out = { [CHANNEL.WORKING]: 0, [CHANNEL.TOGETHER]: 0, at: now };
  const drop = [], repair = [];
  for (const code in (idx || {})){
    const e = idx[code];
    if (!e || typeof e !== 'object') continue;
    const seen = Number(e.lastSeen);
    if (!Number.isFinite(seen)) continue;
    if (now - seen >= ROOM_INDEX_DROP_MS){ drop.push(code); continue; }
    if (code.indexOf(SECRET_ROOM_PREFIX) === 0) continue;
    if (now - seen >= ROOM_LIVE_MS) continue;
    if (e.channel !== CHANNEL.WORKING && e.channel !== CHANNEL.TOGETHER) repair.push(code);
    const ch = (e.channel === CHANNEL.TOGETHER) ? CHANNEL.TOGETHER : CHANNEL.WORKING;
    out[ch]++;
  }
  return { stats: out, drop: drop.slice(0, ROOM_DROP_MAX), repair: repair.slice(0, ROOM_REPAIR_MAX) };
}

// 살아 있는데 channel 이 빠진 줄을 그 방 _meta(수십 바이트)로 채운다. 채운 값은 idx 에도 반영한다.
async function repairChannels(db, idx, codes){
  let repaired = 0;
  for (const code of codes){
    try{
      const meta = (await db.ref('rooms/' + code + '/_meta').get()).val();
      const ch = meta && meta.channel;
      if (ch !== CHANNEL.WORKING && ch !== CHANNEL.TOGETHER) continue;
      const patch = { channel: ch };
      if (typeof meta.open === 'boolean') patch.open = meta.open;
      // 첫 호출의 cur 는 로컬 추측값이라 null 을 돌려줘야 서버 값으로 다시 불린다. 그새 줄이 사라졌거나 채워졌으면 그만둔다.
      const r = await db.ref('roomIndex/' + code).transaction(cur => {
        if (cur === null) return null;
        if (cur.channel === CHANNEL.WORKING || cur.channel === CHANNEL.TOGETHER) return;
        return Object.assign({}, cur, patch);
      }, undefined, false);
      const v = r.committed && r.snapshot && r.snapshot.val();
      if (v && v.channel){ idx[code] = v; repaired++; }
    }catch(_){}
  }
  return repaired;
}

// 지울 줄의 channel · open 을 그 방 _meta 에 옮겨 둔다(빠진 것만). _meta 가 없으면(방이 정상 종료됨) 그만둔다.
async function keepInMeta(db, code, row){
  const patch = {};
  if (row && (row.channel === CHANNEL.WORKING || row.channel === CHANNEL.TOGETHER)) patch.channel = row.channel;
  if (row && typeof row.open === 'boolean') patch.open = row.open;
  if (!Object.keys(patch).length) return;
  await db.ref('rooms/' + code + '/_meta').transaction(cur => {
    if (cur === null) return null;
    const add = {};
    for (const k in patch) if (cur[k] === undefined) add[k] = patch[k];
    return Object.keys(add).length ? Object.assign({}, cur, add) : undefined;
  }, undefined, false);
}

// opts.drop === false 면 세기만 한다(열림 · 닫힘 트리거). 낡은 줄 지우기 · channel 채우기는 주기 실행만.
async function runRoomStats(db, now, opts){
  const idx = (await db.ref('roomIndex').get()).val() || {};
  const light = !!(opts && opts.drop === false);
  const repaired = light ? 0 : await repairChannels(db, idx, roomStatsFrom(idx, now).repair);
  const { stats, drop: dropAll } = roomStatsFrom(idx, now);
  const drop = light ? [] : dropAll;
  // 여러 실행이 겹치면 먼저 읽은 쪽이 늦게 써서 새 값을 덮을 수 있다. 더 늦게 읽은 값이 있으면 쓰지 않는다.
  await db.ref('roomStats').transaction(cur => ((cur && Number(cur.at) > stats.at) ? undefined : stats), undefined, false);
  let dropped = 0, kept = 0, failed = 0;
  const cutoff = now - ROOM_INDEX_DROP_MS;
  for (const code of drop){
    try{
      await keepInMeta(db, code, idx[code]);
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
                rows: Object.keys(idx).length, dropped, kept, failed, repaired };
  if (dropped || failed || repaired) console.log('[roomStats]', JSON.stringify(sum));
  return sum;
}

module.exports = { roomStatsFrom, runRoomStats, ROOM_LIVE_MS, ROOM_INDEX_DROP_MS, ROOM_DROP_MAX, ROOM_REPAIR_MAX };

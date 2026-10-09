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
 *
 * 💓 유령 멤버 청소(sweepRoomAlive) — 새 하트비트(app/parts/room-alive.js)는 30초 도장을 roomAlive/{방}/{멤버id} 에 찍고
 * 멤버 노드에는 hb:2 만 남긴다. 앱은 hb:2 멤버를 «노드가 있으면 산 것» 으로 보므로, onDisconnect 가 못 지운 노드는
 * 여기서 지운다: 도장이 ROOM_ALIVE_STALE_MS 넘게 낡았고 멤버 노드가 hb:2 면 둘 다 지운다. 옛 방식 멤버(hb 없음)는
 * 건드리지 않는다 — 그 사람들은 lastSeen 으로 각자 판정한다.
 *
 * 🧹 빈 방 표지 청소(sweepEmptyRooms) — 마지막 사람이 나가면 앱은 roomIndex 줄에 «비었음»({ lastSeen: 0, emptyAt }) 만 남기고
 * `_meta` · `_chatTab` 은 지우지 않는다(app/parts/firebase-init.js _finalCleanup). 앱이 «남은 사람 확인 → 지우기» 를 하면
 * 그 사이에 다시 들어온 사람의 방에서 `_meta` 가 사라졌다(투게더룸이 워킹룸으로). 여기서는
 *   ① 비었음 표시가 EMPTY_GRACE_MS 넘게 그대로인 줄만(그새 하트비트가 lastSeen 을 찍었으면 아님 — 이미 읽은 roomIndex 로 고른다)
 *   ② 지우기 직전에 멤버를 다시 본다 — roomAlive 도장(이미 읽은 트리) · 멤버 키(shallow) · 멤버마다 hb · lastSeen
 *   ③ `_meta` 는 트랜잭션으로 지운다 — 그새 누가 열었으면(ts · openTs · restoredTs 가 EMPTY_GRACE_MS 안) 그만둔다.
 *      빈 방에 들어오는 길(빈 방 선점 · 만들기 · 시크릿룸 · 되살리기)은 전부 `_meta.ts` 를 먼저 쓴다.
 *   그 뒤 `_chatTab` 과 줄을 지운다. chatLog 는 남긴다(앱 KEEP_CHAT_LOG_ON_EMPTY).
 *   비었음 표시 없이 조용해진 방(강제 종료 · 절전)은 건드리지 않는다 — 절전에서 깨어난, 혼자 있던 사람이 표지를 잃는다.
 *   옛 앱(0.11.x 이하)은 예전처럼 직접 지운다 — 그 방은 줄이 없어 여기 오지 않는다.
 *
 * 📈 지난날 지표 요약(daily-summary.js) — 1분 주기 실행이 어제 요약이 없을 때 한 번 만든다. 새 예약 함수를 늘리지 않으려고 여기 붙였다.
 */
'use strict';
// app/parts/room-channel.js 와 같은 값
const CHANNEL = Object.freeze({ WORKING: 'workingroom', TOGETHER: 'togetherroom' });
const SECRET_ROOM_PREFIX = 'SCRT-';
const ROOM_LIVE_MS = 90 * 1000;              // 앱 getRoomCounts 의 STALE 과 같게
const ROOM_INDEX_DROP_MS = 10 * 60 * 1000;   // 하트비트가 30초라 살아 있는 방은 이만큼 조용하지 않다
const ROOM_DROP_MAX = 100;                   // 밀린 줄이 많아도 한 번에 이만큼만(줄마다 트랜잭션 2개 · 실행 제한 60초)
const ROOM_REPAIR_MAX = 50;                  // channel 채워 넣기도 한 번에 이만큼만
const ROOM_ALIVE_STALE_MS = 150 * 1000;      // app/parts/room-alive.js 와 같게 — 도장 30초 × 5번 놓침
const ROOM_ALIVE_HB = 2;                     // 같은 파일의 멤버 표시
const ROOM_ALIVE_SWEEP_MAX = 200;            // 한 번에 이만큼만(줄마다 읽기 1 · 트랜잭션 1)
const EMPTY_GRACE_MS = 2 * 60 * 1000;        // 비었음 표시 뒤 이만큼 아무도 안 들어와야 표지를 걷는다(주기 1분 → 2~3번째 실행)
const MEMBER_GONE_MS = 10 * 60 * 1000;       // 옛 방식(lastSeen) 멤버를 «없다» 로 볼 문턱 — 입장 검사(5분)보다 넉넉하게
const EMPTY_SWEEP_MAX = 50;                  // 한 번에 이만큼만(방마다 shallow 1 · 트랜잭션 2)

// 줄이 조용해진 때 — 하트비트(lastSeen)와 비었음 표시(emptyAt) 중 늦은 쪽. 비었음 표시는 lastSeen 을 0 으로 쓴다.
function quietSince(e){
  const a = Number(e && e.lastSeen), b = Number(e && e.emptyAt);
  return Math.max(Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0);
}
// 비었음 표시가 그대로인가 — 표시 뒤에 하트비트가 찍혔으면(다시 들어옴) 아니다.
function isEmptyMark(e){
  const at = Number(e && e.emptyAt);
  return Number.isFinite(at) && at > 0 && !(Number(e.lastSeen) > at);
}

function roomStatsFrom(idx, now){
  const out = { [CHANNEL.WORKING]: 0, [CHANNEL.TOGETHER]: 0, at: now };
  const drop = [], repair = [], empty = [];
  for (const code in (idx || {})){
    const e = idx[code];
    if (!e || typeof e !== 'object') continue;
    const seen = Number(e.lastSeen);
    if (!Number.isFinite(seen)) continue;
    if (isEmptyMark(e) && now - Number(e.emptyAt) >= EMPTY_GRACE_MS) empty.push(code);
    if (now - quietSince(e) >= ROOM_INDEX_DROP_MS){ drop.push(code); continue; }
    if (code.indexOf(SECRET_ROOM_PREFIX) === 0) continue;
    if (now - seen >= ROOM_LIVE_MS) continue;
    if (e.channel !== CHANNEL.WORKING && e.channel !== CHANNEL.TOGETHER) repair.push(code);
    const ch = (e.channel === CHANNEL.TOGETHER) ? CHANNEL.TOGETHER : CHANNEL.WORKING;
    out[ch]++;
  }
  return { stats: out, drop: drop.slice(0, ROOM_DROP_MAX), repair: repair.slice(0, ROOM_REPAIR_MAX), empty: empty.slice(0, EMPTY_SWEEP_MAX) };
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

// roomAlive 트리에서 낡은 도장을 고른다(순수). 숫자가 아닌 값도 고른다 — 지워도 되는 쓰레기다.
function staleAliveFrom(tree, now){
  const out = [];
  for (const room in (tree || {})){
    const members = tree[room];
    if (!members || typeof members !== 'object') continue;
    for (const mid in members){
      const at = Number(members[mid]);
      if (!Number.isFinite(at) || now - at >= ROOM_ALIVE_STALE_MS) out.push({ room, mid });
      if (out.length >= ROOM_ALIVE_SWEEP_MAX) return out;
    }
  }
  return out;
}
async function sweepRoomAlive(db, now, given){
  const tree = given || (await db.ref('roomAlive').get()).val() || {};
  const cutoff = now - ROOM_ALIVE_STALE_MS;
  let ghosts = 0, orphans = 0, kept = 0, failed = 0;
  for (const { room, mid } of staleAliveFrom(tree, now)){
    try{
      const hb = (await db.ref('rooms/' + room + '/' + mid + '/hb').get()).val();
      // 읽은 사이에 도장을 다시 찍었으면(살아 있음) 그만둔다. 첫 호출의 cur 는 로컬 추측값이라 null 을 돌려줘야 서버 값으로 다시 불린다.
      const r = await db.ref('roomAlive/' + room + '/' + mid).transaction(cur => {
        if (cur === null) return null;
        const at = Number(cur);
        if (Number.isFinite(at) && at >= cutoff) return;
        return null;
      }, undefined, false);
      if (!r.committed){ kept++; continue; }
      if (hb === ROOM_ALIVE_HB){ await db.ref('rooms/' + room + '/' + mid).remove(); ghosts++; }
      else orphans++;   // 멤버 노드가 이미 없거나 옛 방식 — 도장만 걷는다
    }catch(e){ failed++; }
  }
  return { ghosts, orphans, kept, failed };
}

// 이 방에 사람이 있나 — 하나라도 «있을 수 있으면» 있다고 본다(잘못 지우는 쪽이 훨씬 나쁘다).
// stamps = roomAlive/{방}(이미 읽은 값) · keys = rooms/{방} shallow · member(id) → { hb, lastSeen }
async function roomOccupied(stamps, keys, member, now){
  for (const mid in (stamps || {})){
    const at = Number(stamps[mid]);
    if (Number.isFinite(at) && now - at < ROOM_ALIVE_STALE_MS) return true;
  }
  const ids = Object.keys(keys || {}).filter(k => k.charAt(0) !== '_' && k !== 'chatLog');   // 앱 _isMemberKey 와 같다
  for (const id of ids){
    const m = await member(id);
    if (m.hb === ROOM_ALIVE_HB) return true;   // 새 방식은 노드가 있으면 산 것(유령은 sweepRoomAlive 가 먼저 지운다)
    const seen = Number(m.lastSeen);
    if (m.lastSeen == null || !Number.isFinite(seen) || now - seen < MEMBER_GONE_MS) return true;   // lastSeen 없음도 산 것(입장 검사와 같다)
  }
  return false;
}
// `_meta` 를 마지막으로 연 때 — 빈 방에 들어오는 길은 전부 ts 를 쓴다(선점 · 만들기 · 시크릿룸 · 되살리기).
function metaTouchedAt(m){
  let t = 0;
  for (const k of ['ts', 'openTs', 'restoredTs']){ const v = Number(m && m[k]); if (Number.isFinite(v) && v > t) t = v; }
  return t;
}

// RTDB REST shallow(키만 · 본문 없음) — Admin SDK 에는 shallow 가 없다. 못 받으면 던진다(모르면 안 지운다).
function adminShallow(db){
  let tokenP = null;
  const base = String(db.ref().toString()).replace(/\/$/, '');
  return async (p) => {
    const cred = require('firebase-admin/app').getApp().options.credential;
    const tok = cred ? await (tokenP || (tokenP = cred.getAccessToken())) : null;
    const res = await fetch(base + '/' + p.split('/').map(encodeURIComponent).join('/') + '.json?shallow=true',
      { headers: tok ? { Authorization: 'Bearer ' + tok.access_token } : {} });
    if (!res.ok) throw new Error('shallow ' + res.status);
    return res.json();
  };
}

// 비었음 표시가 EMPTY_GRACE_MS 넘게 그대로인 방의 `_meta` · `_chatTab` · 줄을 걷는다(맨 위 🧹).
async function sweepEmptyRooms(db, codes, aliveTree, now, shallow){
  const done = new Set();
  let cleared = 0, busy = 0, kept = 0, failed = 0;
  for (const code of codes){
    try{
      const keys = await shallow('rooms/' + code);   // 방 노드가 없으면 null
      const member = async (id) => {
        const p = 'rooms/' + code + '/' + id;
        const [hb, seen] = await Promise.all([db.ref(p + '/hb').get(), db.ref(p + '/lastSeen').get()]);
        return { hb: hb.val(), lastSeen: seen.val() };
      };
      if (await roomOccupied((aliveTree || {})[code], keys, member, now)){
        // 그새 다시 들어왔다 — 표시만 걷는다(다음 마지막 사람이 다시 남긴다). 줄은 하트비트 · 10분 청소에 맡긴다.
        await db.ref('roomIndex/' + code).transaction(cur => {
          if (cur === null) return null;
          if (!isEmptyMark(cur)) return;
          const next = Object.assign({}, cur); delete next.emptyAt;
          return next;
        }, undefined, false);
        busy++; continue;
      }
      // 첫 호출의 cur 는 로컬 추측값이라 null 을 돌려줘야 서버 값으로 다시 불린다. 그새 누가 열었으면 그만둔다.
      const r = await db.ref('rooms/' + code + '/_meta').transaction(cur => {
        if (cur === null) return null;
        if (now - metaTouchedAt(cur) < EMPTY_GRACE_MS) return;
        return null;
      }, undefined, false);
      if (!r.committed){ kept++; continue; }
      if (keys && keys._chatTab) await db.ref('rooms/' + code + '/_chatTab').remove();
      await db.ref('roomIndex/' + code).transaction(cur => {
        if (cur === null) return null;
        if (!isEmptyMark(cur) || now - Number(cur.emptyAt) < EMPTY_GRACE_MS) return;   // 그새 하트비트 · 새 표시
        return null;
      }, undefined, false);
      done.add(code); cleared++;
    }catch(e){ failed++; }
  }
  return { done, cleared, busy, kept, failed };
}

// opts.drop === false 면 세기만 한다(열림 · 닫힘 트리거). 낡은 줄 지우기 · channel 채우기는 주기 실행만.
async function runRoomStats(db, now, opts){
  const idx = (await db.ref('roomIndex').get()).val() || {};
  const light = !!(opts && opts.drop === false);
  const repaired = light ? 0 : await repairChannels(db, idx, roomStatsFrom(idx, now).repair);
  const { stats, drop: dropAll, empty } = roomStatsFrom(idx, now);
  // 여러 실행이 겹치면 먼저 읽은 쪽이 늦게 써서 새 값을 덮을 수 있다. 더 늦게 읽은 값이 있으면 쓰지 않는다.
  await db.ref('roomStats').transaction(cur => ((cur && Number(cur.at) > stats.at) ? undefined : stats), undefined, false);
  // 💓 유령 멤버를 먼저 걷고(빈 방 판정이 유령 hb:2 노드에 걸리지 않게) 같은 roomAlive 트리로 빈 방을 본다 — 트리는 한 번만 읽는다.
  let alive = { ghosts: 0, orphans: 0, kept: 0, failed: 0 };
  let emptied = { done: new Set(), cleared: 0, busy: 0, kept: 0, failed: 0 };
  if (!light){
    let tree = null;
    try{ tree = (await db.ref('roomAlive').get()).val() || {}; }catch(e){ alive.failed++; }
    if (tree){ try{ alive = await sweepRoomAlive(db, now, tree); }catch(e){ alive.failed++; } }
    // 트리를 못 읽었으면 빈 방 청소는 쉰다 — 도장을 모른 채 지우지 않는다.
    if (tree && empty.length){
      try{ emptied = await sweepEmptyRooms(db, empty, tree, now, (opts && opts.shallow) || adminShallow(db)); }
      catch(e){ emptied.failed++; }
    }
  }
  const drop = light ? [] : dropAll.filter(code => !emptied.done.has(code));
  let dropped = 0, kept = 0, failed = 0;
  const cutoff = now - ROOM_INDEX_DROP_MS;
  for (const code of drop){
    try{
      await keepInMeta(db, code, idx[code]);
      // 첫 호출의 cur 는 로컬 추측값(대개 null)이라 null 을 돌려줘야 서버 값으로 다시 불린다.
      // 그새 다시 들어와 lastSeen 이 새로워진 줄은 그만둔다(undefined).
      const r = await db.ref('roomIndex/' + code).transaction(cur => {
        if (cur === null) return null;
        if (quietSince(cur) < cutoff) return null;
        return;
      }, undefined, false);
      if (r.committed) dropped++; else kept++;
    }catch(e){ failed++; }
  }
  // 지난날 지표 요약(daily-summary.js) — 방 집계와 무관하다. 실패해도 위 일은 이미 끝났고 다음 주기에 다시 해 본다.
  if (!light){
    try{
      const made = await require('./daily-summary').ensureDailySummary(db, now);
      if (made) console.log('[roomStats] 지표 요약', made.day, JSON.stringify(made.summary));
    }catch(e){ console.warn('[roomStats] 지표 요약 못 함', e && e.message); }
  }
  const sum = { live: stats.workingroom + stats.togetherroom, working: stats.workingroom, together: stats.togetherroom,
                rows: Object.keys(idx).length, dropped, kept, failed, repaired, alive,
                emptied: { cleared: emptied.cleared, busy: emptied.busy, kept: emptied.kept, failed: emptied.failed } };
  if (dropped || failed || repaired || alive.ghosts || alive.failed || emptied.cleared || emptied.failed) console.log('[roomStats]', JSON.stringify(sum));
  return sum;
}

module.exports = { roomStatsFrom, runRoomStats, staleAliveFrom, sweepRoomAlive, sweepEmptyRooms, roomOccupied, isEmptyMark, quietSince,
  ROOM_LIVE_MS, ROOM_INDEX_DROP_MS, ROOM_DROP_MAX, ROOM_REPAIR_MAX, ROOM_ALIVE_STALE_MS, ROOM_ALIVE_HB,
  EMPTY_GRACE_MS, MEMBER_GONE_MS, EMPTY_SWEEP_MAX };

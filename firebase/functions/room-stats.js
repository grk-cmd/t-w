/*
 * roomIndex 를 세어 roomStats = { workingroom, togetherroom, at } 에 기록한다.
 * 방이 열리고 닫힐 때(roomIndex 줄 생성 · 삭제) 바로 한 번, 그리고 줄을 지울 사람 없이 끝난 방을 반영하려고 1분마다 한 번 돈다.
 * 이 노드를 읽는 것은 웹 관리자(apps/admin entities/room)다 — 앱은 0.13.0 부터 읽지 않는다(방 개수는 방 목록 로비로).
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
 *   그 뒤 `_chatTab` 과 줄을 지운다. chatLog 는 남긴다(앱 KEEP_CHAT_LOG_ON_EMPTY) — **투게더룸만 빼고**:
 *   투게더룸은 누구나 들어오는 공용 방이라 방장까지 다 나가 비면 #일반 대화(chatLog)까지 지운다(2026-10-11 결정).
 *   ⏳ 다만 바로 지우지 않고 CHAT_KEEP_EMPTY_MS(1시간) 뒤에 — 다 같이 잠깐 나갔다 오면(재접속 · 앱 다시 켜기) 대화가 남게.
 *   비는 순간 chatPurge/{코드} = 그 시각 을 적고, 1분 주기(sweepChatPurge)가 1시간 지난 칸을 본다: 그새 다시 열렸으면
 *   (Firebase `_meta` · 방 서버 roomDir) 칸만 걷고 대화는 남긴다 — 그 방이 다시 비면 새 시각이 적힌다.
 *   워킹룸 · 시크릿룸(SCRT-)은 예전처럼 남긴다. 채널은 지우는 `_meta` 트랜잭션이 본 값, 없으면 roomIndex 줄의 값.
 *   🔒 시크릿룸은 비어도 방이 유지된다(2026-10-11 결정) — `_meta`(채팅 탭 목록 · 방장) · `_chatTab` · chatLog 를 모두 남기고
 *   비었음 줄만 걷는다. 다시 들어올 때 앱은 `_meta` 를 update 로 고쳐 쓰므로(setRoomChannel) 탭 목록이 그대로 이어진다.
 *   🛰 같은 코드의 방 서버 방이 살아 있으면(roomDir/{코드}) `_chatTab` · chatLog 를 남긴다 — 방 서버 방도 대화는 Firebase 같은 자리에 쓴다.
 *   방 서버에 못 붙은 앱이 같은 코드로 Firebase 방을 열었다 나가면 그 빈 Firebase 방만 걷어야 하는데, 대화까지 지워
 *   살아 있는 방 서버 방의 대화가 통째로 사라졌다. 요약에 `serverKept`, 대화를 지운 방 코드는 `codes`(앞 CODES_LOG_MAX 개).
 *   그 대화는 방 서버 방이 닫힐 때(roomDir/{코드} 가 지워질 때) 정리한다 — onServerRoomClosed. 같은 규칙: 시크릿룸은 다 남기고,
 *   `_chatTab` 은 지우고, chatLog 는 투게더룸만. 방 서버는 재시작 때 roomDir 칸을 지우지 않고 되살리므로 재시작으로는 안 지워진다.
 *   비었음 표시 없이 조용해진 방(강제 종료 · 절전)은 건드리지 않는다 — 절전에서 깨어난, 혼자 있던 사람이 표지를 잃는다.
 *   옛 앱(0.11.x 이하)은 예전처럼 직접 지운다 — 그 방은 줄이 없어 여기 오지 않는다.
 *
 * 🛰 방 서버 줄 — 방 서버(t-w-server realtime)도 자기 방(시크릿룸 제외)을 roomIndex/{코드} = { lastSeen, channel, srv } 로 올리고
 * 30초마다 갱신한다. roomIndex 가 Firebase 방 + 서버 방의 단일 장부라 여기서 세는 값이 곧 전체 개수(채널 상한 250 기준)다.
 * `srv` 가 있는 줄은 Firebase rooms/{코드} 에 사람이 없어도 정상이므로 빈 방 청소 · channel 채우기 · `_meta` 옮기기 대상이 아니다.
 * 개수에는 넣고(stats.server 에 서버 몫을 따로도 적는다), 서버가 죽어 lastSeen 이 낡으면 일반 줄처럼 90초 뒤 개수에서 빠지고
 * ROOM_INDEX_DROP_MS 뒤 줄만 지운다.
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
const CODES_LOG_MAX = 20;                    // 로그에 남길 방 코드 수
const CHAT_KEEP_EMPTY_MS = 60 * 60 * 1000;   // 빈 투게더룸 #일반 대화를 지우기까지(사용자 10-20 «1시간»)
const CHAT_PURGE_PATH = 'chatPurge';         // {코드: 빈 시각} — 서버만 읽고 쓴다(규칙 맨 위 거절 · admin 만)
const CHAT_PURGE_MAX = 50;                   // 한 번에 이만큼만(칸마다 읽기 2 · 지우기 2)

// 줄이 조용해진 때 — 하트비트(lastSeen)와 비었음 표시(emptyAt) 중 늦은 쪽. 비었음 표시는 lastSeen 을 0 으로 쓴다.
function quietSince(e){
  const a = Number(e && e.lastSeen), b = Number(e && e.emptyAt);
  return Math.max(Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0);
}
// 방 서버가 올린 줄인가(맨 위 🛰) — srv 는 방 서버 이름.
function isServerRow(e){
  return !!(e && typeof e === 'object' && typeof e.srv === 'string' && e.srv);
}
// 비었음 표시가 그대로인가 — 표시 뒤에 하트비트가 찍혔으면(다시 들어옴) 아니다.
function isEmptyMark(e){
  const at = Number(e && e.emptyAt);
  return Number.isFinite(at) && at > 0 && !(Number(e.lastSeen) > at);
}

function roomStatsFrom(idx, now){
  // server = 그중 방 서버 몫(이미 위 두 칸에 들어 있다 — 따로 더하지 않는다)
  const out = { [CHANNEL.WORKING]: 0, [CHANNEL.TOGETHER]: 0, at: now, server: { [CHANNEL.WORKING]: 0, [CHANNEL.TOGETHER]: 0 } };
  const drop = [], repair = [], empty = [];
  for (const code in (idx || {})){
    const e = idx[code];
    if (!e || typeof e !== 'object') continue;
    const seen = Number(e.lastSeen);
    if (!Number.isFinite(seen)) continue;
    const srv = isServerRow(e);
    if (!srv && isEmptyMark(e) && now - Number(e.emptyAt) >= EMPTY_GRACE_MS) empty.push(code);
    if (now - quietSince(e) >= ROOM_INDEX_DROP_MS){ drop.push(code); continue; }
    if (code.indexOf(SECRET_ROOM_PREFIX) === 0) continue;
    if (now - seen >= ROOM_LIVE_MS) continue;
    if (!srv && e.channel !== CHANNEL.WORKING && e.channel !== CHANNEL.TOGETHER) repair.push(code);
    const ch = (e.channel === CHANNEL.TOGETHER) ? CHANNEL.TOGETHER : CHANNEL.WORKING;
    out[ch]++;
    if (srv) out.server[ch]++;
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
    if (m.lastSeen != null && Number.isFinite(seen) && now - seen < MEMBER_GONE_MS) return true;   // lastSeen 없는 칸은 찌꺼기(앱 room-alive.js isProbeAlive 와 같다)
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

// 비었음 표시가 EMPTY_GRACE_MS 넘게 그대로인 방의 `_meta` · `_music` · `_chatTab` · 줄을 걷는다(맨 위 🧹).
/* 비었음 줄을 걷는다 — 그새 하트비트가 찍혔거나 새 표시면 그대로 둔다. 첫 호출의 cur 는 로컬 추측값이라 null 을 돌려줘야 서버 값으로 다시 불린다. */
function dropEmptyRow(db, code, now){
  return db.ref('roomIndex/' + code).transaction(cur => {
    if (cur === null) return null;
    if (!isEmptyMark(cur) || now - Number(cur.emptyAt) < EMPTY_GRACE_MS) return;   // 그새 하트비트 · 새 표시
    return null;
  }, undefined, false);
}
/* 공용 투게더룸인가 — 시크릿룸(SCRT-)은 아니다. 채널은 _meta 에서 본 값, 없으면(옛 방 · 이미 지워진 _meta) roomIndex 줄. */
async function isPublicTogether(db, code, metaChannel){
  if (String(code).indexOf(SECRET_ROOM_PREFIX) === 0) return false;
  let ch = metaChannel;
  if (!ch){ try{ ch = (await db.ref('roomIndex/' + code + '/channel').get()).val(); }catch(_){ ch = null; } }
  return ch === CHANNEL.TOGETHER;
}
/* 방 서버에 같은 코드의 방이 살아 있는가 — 방 서버는 방을 닫을 때 roomDir/{코드} 를 지운다. 칸 하나만 읽는다. */
async function serverRoomLive(db, code){
  const srv = (await db.ref('roomDir/' + code + '/srv').get()).val();
  return typeof srv === 'string' && srv.length > 0;
}
async function sweepEmptyRooms(db, codes, aliveTree, now, shallow){
  const done = new Set();
  const codesOut = [];
  let cleared = 0, busy = 0, kept = 0, failed = 0, secretKept = 0, serverKept = 0;
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
      if (String(code).indexOf(SECRET_ROOM_PREFIX) === 0){
        // 🔒 시크릿룸 — 방 표지 · 탭 · 대화는 남기고 비었음 줄만 걷는다(위 머리 주석)
        await dropEmptyRow(db, code, now);
        done.add(code); secretKept++; continue;
      }
      // 첫 호출의 cur 는 로컬 추측값이라 null 을 돌려줘야 서버 값으로 다시 불린다. 그새 누가 열었으면 그만둔다.
      let metaChannel = null;
      const r = await db.ref('rooms/' + code + '/_meta').transaction(cur => {
        if (cur === null) return null;
        if (now - metaTouchedAt(cur) < EMPTY_GRACE_MS) return;
        metaChannel = cur.channel || null;   // 마지막(서버 값) 호출의 것이 남는다
        return null;
      }, undefined, false);
      if (!r.committed){ kept++; continue; }
      // 🎧 같이 듣기 곡 칸도 걷는다 — 남기면 같은 코드로 다시 연 방이 지난 곡 · 지난 DJ 를 읽는다(docs/LISTEN_TOGETHER.md 2.2)
      if (keys && keys._music) await db.ref('rooms/' + code + '/_music').remove();
      if (await serverRoomLive(db, code)){
        await dropEmptyRow(db, code, now);
        done.add(code); serverKept++; continue;
      }
      if (keys && keys._chatTab) await db.ref('rooms/' + code + '/_chatTab').remove();
      if (keys && keys.chatLog && await isPublicTogether(db, code, metaChannel)) await markChatPurge(db, code, now);
      await dropEmptyRow(db, code, now);
      done.add(code); cleared++;
      if (codesOut.length < CODES_LOG_MAX) codesOut.push(code);
    }catch(e){ failed++; }
  }
  return { done, cleared, busy, kept, failed, secretKept, serverKept, codes: codesOut };
}

/* 🛰 방 서버 방이 닫혔다(roomDir/{코드} 삭제 트리거 · prev = 지워진 칸) — 빈 Firebase 방과 같은 규칙으로 대화를 걷는다.
   같은 코드의 Firebase 방이 열려 있거나(_meta) 그새 방 서버 방이 다시 열렸으면 그만둔다 — 그 방이 쓰는 대화다.
   Firebase 방이 비면 sweepEmptyRooms 가 같은 규칙으로 걷는다(그땐 roomDir 이 없으니 대화도). */
async function onServerRoomClosed(db, code, prev, now){
  const meta = (prev && prev.meta) || {};
  if (String(code).indexOf(SECRET_ROOM_PREFIX) === 0 || meta.secret === true) return 'secret';
  if (await serverRoomLive(db, code)) return 'reopened';
  if ((await db.ref('rooms/' + code + '/_meta/channel').get()).val() != null) return 'firebase';
  await db.ref('rooms/' + code + '/_chatTab').remove();
  if (meta.channel === CHANNEL.TOGETHER) await markChatPurge(db, code, now);
  return 'cleared';
}

/* ⏳ 빈 투게더룸 대화 지우기 예약(맨 위 ⏳) — 지금 비었다는 시각만 적는다. 다시 비면 새 시각으로 덮는다. */
function markChatPurge(db, code, now){
  return db.ref(CHAT_PURGE_PATH + '/' + code).set(now);
}
/* 예약이 CHAT_KEEP_EMPTY_MS 지난 방의 chatLog 를 지운다. 그새 다시 열린 방(Firebase _meta · 방 서버)은 예약만 걷는다. */
async function sweepChatPurge(db, now){
  const marks = (await db.ref(CHAT_PURGE_PATH).get()).val() || {};
  const due = Object.keys(marks).filter(code => !(now - Number(marks[code]) < CHAT_KEEP_EMPTY_MS)).slice(0, CHAT_PURGE_MAX);
  let purged = 0, reopened = 0, failed = 0;
  for (const code of due){
    const mark = marks[code];
    const ref = db.ref(CHAT_PURGE_PATH + '/' + code);
    try{
      if (typeof mark !== 'number'){ await ref.remove(); failed++; continue; }   // 망가진 예약 — 대화는 두고 예약만
      const inUse = (await db.ref('rooms/' + code + '/_meta/channel').get()).val() != null || await serverRoomLive(db, code);
      // 맨 앞에서 읽은 뒤 다시 열렸다 다시 비었으면 새 예약이다 — 그 방의 새 대화를 지우지 않는다
      if (!inUse && (await ref.get()).val() !== mark) continue;
      if (!inUse){ await db.ref('rooms/' + code + '/chatLog').remove(); purged++; } else reopened++;
      // 지우는 사이 다시 비어 새 시각이 적혔으면 남긴다
      await ref.transaction(cur => (cur === null || cur === mark) ? null : undefined, undefined, false);
    }catch(e){ failed++; }
  }
  return { waiting: Object.keys(marks).length - due.length, purged, reopened, failed };
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
  let emptied = { done: new Set(), cleared: 0, busy: 0, kept: 0, failed: 0, secretKept: 0, serverKept: 0, codes: [] };
  let lobby = { candidates: 0, working: 0, together: 0, failed: 0 };
  if (!light){
    let tree = null;
    try{ tree = (await db.ref('roomAlive').get()).val() || {}; }catch(e){ alive.failed++; }
    if (tree){ try{ alive = await sweepRoomAlive(db, now, tree); }catch(e){ alive.failed++; } }
    // 트리를 못 읽었으면 빈 방 청소는 쉰다 — 도장을 모른 채 지우지 않는다.
    if (tree && empty.length){
      try{ emptied = await sweepEmptyRooms(db, empty, tree, now, (opts && opts.shallow) || adminShallow(db)); }
      catch(e){ emptied.failed++; }
    }
    // 방 목록 로비 사본(room-lobby.js) — 같은 트리로 센다. 못 읽었으면 쉰다(옛 사본이 남고 앱은 at 으로 낡음을 본다).
    if (tree){ try{ lobby = await require('./room-lobby').buildRoomLobby(db, idx, tree, now); }catch(e){ lobby.failed++; } }
  }
  let chatPurge = { waiting: 0, purged: 0, reopened: 0, failed: 0 };
  if (!light){ try{ chatPurge = await sweepChatPurge(db, now); }catch(e){ chatPurge.failed++; } }
  const drop = light ? [] : dropAll.filter(code => !emptied.done.has(code));
  let dropped = 0, kept = 0, failed = 0;
  const cutoff = now - ROOM_INDEX_DROP_MS;
  for (const code of drop){
    try{
      // 방 서버 줄은 Firebase 방이 아니다 — 같은 코드의 옛 Firebase `_meta` 에 channel · open 을 옮기지 않는다.
      if (!isServerRow(idx[code])) await keepInMeta(db, code, idx[code]);
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
                server: stats.server.workingroom + stats.server.togetherroom,
                rows: Object.keys(idx).length, dropped, kept, failed, repaired, alive,
                emptied: { cleared: emptied.cleared, busy: emptied.busy, kept: emptied.kept, failed: emptied.failed, secretKept: emptied.secretKept,
                           serverKept: emptied.serverKept, codes: emptied.codes }, chatPurge, lobby };
  if (dropped || failed || repaired || alive.ghosts || alive.failed || emptied.cleared || emptied.failed || emptied.serverKept || chatPurge.purged || chatPurge.failed || lobby.failed || lobby.bannedFailed) console.log('[roomStats]', JSON.stringify(sum));
  return sum;
}

module.exports = { CHANNEL, SECRET_ROOM_PREFIX, roomStatsFrom, runRoomStats, adminShallow, staleAliveFrom, sweepRoomAlive, sweepEmptyRooms, roomOccupied, serverRoomLive, onServerRoomClosed, markChatPurge, sweepChatPurge, isEmptyMark, quietSince, isServerRow,
  ROOM_LIVE_MS, ROOM_INDEX_DROP_MS, ROOM_DROP_MAX, ROOM_REPAIR_MAX, ROOM_ALIVE_STALE_MS, ROOM_ALIVE_HB,
  EMPTY_GRACE_MS, MEMBER_GONE_MS, EMPTY_SWEEP_MAX, CHAT_KEEP_EMPTY_MS, CHAT_PURGE_PATH, CHAT_PURGE_MAX };

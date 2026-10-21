/*
 * 방 목록 로비의 목록 사본 roomLobby/{채널} = { at, rooms: { 코드: 줄 } } 를 만든다.
 * 채널마다 at 을 두는 까닭: 방이 하나도 없는 채널도 칸이 남아, 앱이 «빈 목록» 과 «못 불러옴 · 낡음» 을 가른다.
 * 앱은 지금 탭의 roomLobby/{채널} 하나만 읽는다 — 멤버 노드(캐릭터 def 포함 · 큼)나 방마다 _meta 를 읽지 않게.
 * room-stats.js 1분 주기 실행이 이미 읽은 roomIndex · roomAlive 트리로 부른다 — 새로 읽는 것은 공개 방의 _meta 와 금칙어뿐.
 *
 * 넣는 방: Firebase 방(방 서버 줄 아님) · 시크릿룸 아님 · 90초 안에 살아 있음 · _meta.open === true · 살아 있는 도장 1개 이상.
 * 방 서버 방은 서버가 자기 목록을 낸다(설계 docs/ROOM_LOBBY.md 4장) — 여기는 Firebase 방 몫이다.
 * 인원은 roomAlive 도장(새 하트비트) 수다 — 옛 하트비트(lastSeen)만 쓰는 0.11.x 이하 앱은 세지 못한다.
 * 들어갈 때 앱이 정원을 다시 확인하므로 목록 숫자(최대 1분 늦음)로 막지 않는다.
 */
'use strict';
const { cleanBannedList, hasBannedWord } = require('./banned-words');

// 채널 · 살아 있음 기준은 room-stats.js 한 곳 — 그 파일이 이 파일을 부르므로 쓸 때 꺼낸다(서로 require)
const rs = () => require('./room-stats');

const LOBBY_PATH = 'roomLobby';
const BANNED_PATH = 'config/bannedWords';
const LOBBY_META_MAX = 300;   // 한 번에 읽을 _meta 수 — 채널 상한(roomLimits) 언저리
const LOBBY_READ_BATCH = 20;  // _meta 를 이만큼씩 동시에 읽는다(하나씩 기다리면 방이 많을 때 1분 실행이 늘어진다)
// 규칙(rooms/$room/_meta)과 같은 범위
const TITLE_MAX = 20, HOST_NAME_MAX = 20, ROOM_MAX_MIN = 2, ROOM_MAX_MAX = 50;

function isChannel(v){ const C = rs().CHANNEL; return v === C.WORKING || v === C.TOGETHER; }

// roomIndex 에서 _meta 를 읽어 볼 방 — 줄의 open 은 하트비트가 옮긴 사본이라 거르기만 하고, 판정은 _meta 로 다시 한다.
function lobbyCandidates(idx, now){
  const { SECRET_ROOM_PREFIX, ROOM_LIVE_MS, isServerRow } = rs();
  const out = [];
  for (const code in (idx || {})){
    const e = idx[code];
    if (!e || typeof e !== 'object') continue;
    if (code.indexOf(SECRET_ROOM_PREFIX) === 0) continue;
    if (isServerRow(e)) continue;
    if (e.open !== true) continue;
    const seen = Number(e.lastSeen);
    if (!Number.isFinite(seen) || now - seen >= ROOM_LIVE_MS) continue;
    out.push(code);
  }
  return out.slice(0, LOBBY_META_MAX);
}

function liveCount(stamps, now){
  const { ROOM_ALIVE_STALE_MS } = rs();
  let n = 0;
  for (const k in (stamps || {})){
    const v = Number(stamps[k]);
    if (Number.isFinite(v) && now - v < ROOM_ALIVE_STALE_MS) n++;
  }
  return n;
}

function cleanText(v, max){
  if (typeof v !== 'string') return '';
  const s = v.trim();
  return (s.length >= 1 && s.length <= max) ? s : '';
}

// 방 하나의 목록 줄. 넣지 않을 방이면 null. banned 는 cleanBannedList 를 거친 것.
// 금칙어가 든 제목은 비운다 — 앱이 «○○ 님의 방» 기본값으로 그린다(앱을 고쳐 막기를 건너뛰어도 목록에는 안 나가게).
function lobbyRow(meta, n, banned){
  if (!meta || meta.open !== true || !isChannel(meta.channel) || !(n >= 1)) return null;
  const title = cleanText(meta.title, TITLE_MAX);
  const max = (Number.isInteger(meta.max) && meta.max >= ROOM_MAX_MIN && meta.max <= ROOM_MAX_MAX) ? meta.max : null;
  const since = Number(meta.openTs) || Number(meta.ts) || 0;
  return {
    t: hasBannedWord(title, banned) ? '' : title,
    n,
    max,
    hn: cleanText(meta.hostName, HOST_NAME_MAX),
    mu: meta.music === true,
    since,
  };
}

// metas = { 코드: _meta }, tree = roomAlive 트리
function lobbyFrom(metas, tree, banned, now){
  const C = rs().CHANNEL;
  const out = { [C.WORKING]: { at: now, rooms: {} }, [C.TOGETHER]: { at: now, rooms: {} } };
  for (const code in (metas || {})){
    const meta = metas[code];
    const row = lobbyRow(meta, liveCount(tree && tree[code], now), banned);
    if (row) out[meta.channel].rooms[code] = row;
  }
  return out;
}

async function buildRoomLobby(db, idx, tree, now){
  const codes = lobbyCandidates(idx, now);
  // 금칙어를 못 읽은 회차는 쓰지 않는다 — «목록 없음» 으로 보면 걸린 제목이 그대로 나간다(옛 사본이 남고 앱은 at 으로 낡음을 본다)
  let banned;
  try{ banned = cleanBannedList((await db.ref(BANNED_PATH).get()).val()); }
  catch(_){ return { candidates: codes.length, working: 0, together: 0, failed: 0, bannedFailed: true }; }
  const metas = {};
  let failed = 0;
  for (let i = 0; i < codes.length; i += LOBBY_READ_BATCH){
    await Promise.all(codes.slice(i, i + LOBBY_READ_BATCH).map(async (code) => {
      try{ metas[code] = (await db.ref('rooms/' + code + '/_meta').get()).val(); }catch(_){ failed++; }
    }));
  }
  const lobby = lobbyFrom(metas, tree, banned, now);
  const C = rs().CHANNEL;
  // 여러 실행이 겹치면 먼저 읽은 쪽이 늦게 써서 새 값을 덮을 수 있다(roomStats 와 같은 막기)
  await db.ref(LOBBY_PATH).transaction(cur => ((cur && cur[C.WORKING] && Number(cur[C.WORKING].at) > now) ? undefined : lobby), undefined, false);
  return { candidates: codes.length, working: Object.keys(lobby[C.WORKING].rooms).length,
           together: Object.keys(lobby[C.TOGETHER].rooms).length, failed };
}

module.exports = { lobbyCandidates, liveCount, lobbyRow, lobbyFrom, buildRoomLobby,
  LOBBY_PATH, BANNED_PATH, LOBBY_META_MAX, LOBBY_READ_BATCH, TITLE_MAX, HOST_NAME_MAX, ROOM_MAX_MIN, ROOM_MAX_MAX };

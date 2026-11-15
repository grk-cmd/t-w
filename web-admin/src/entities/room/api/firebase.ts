// Firebase 판 — 지금 코드 그대로: config/roomLimits · roomMaxPeople · chatKeepDays 를 읽고 쓰고,
// roomIndex · rooms · roomStats 로 방 목록을 만들고 방을 닫는다(방 서버 목록만 API 에서 받는다).
import { countTarget, withAudit, type Api, type AuditAction, type Db } from '@/shared/api';
import { CHAT_KEEP_PATH, chatKeepDetail, parseChatKeep, type ChatKeep } from '../model/chatKeep';
import {
  allRoomCodes,
  closeRoomsWrite,
  isMemberKey,
  LIVE_ROOMS_PATH,
  parseLiveRooms,
  toRoomPerson,
  type Channel,
  type LiveRooms,
  type RoomIndexEntry,
  type RoomPerson,
  type RoomProbe,
  type RoomStats,
} from '../model/room';
import {
  isRoomMaxPeople,
  parseRoomLimits,
  roomLimitChanges,
  roomMaxPeopleOf,
  ROOM_LIMITS_PATH,
  ROOM_MAX_PEOPLE_PATH,
} from '../model/roomConfig';
import type { RoomPort } from './port';

export async function getRoomLimits(db: Db): Promise<Record<Channel, number | null>> {
  return parseRoomLimits(await db.get<unknown>(ROOM_LIMITS_PATH));
}

/** 정원 — 서버에 정해 둔 값. 없거나 범위 밖이면 null(앱 · 방 서버는 기본값). */
export async function getRoomMaxPeople(db: Db): Promise<number | null> {
  const v = await db.get<unknown>(ROOM_MAX_PEOPLE_PATH);
  return isRoomMaxPeople(v) ? v : null;
}

/** 전체 방 상한 — 두 채널을 한 객체로 쓴다(한쪽만 있는 모양이 남지 않게). 바뀐 게 없으면 쓰지 않는다. */
export function saveRoomLimits(
  db: Db,
  before: Record<Channel, number | null> | null | undefined,
  next: Record<Channel, number>,
): Promise<void> {
  const changes = roomLimitChanges(before, next);
  if (!changes.length) return Promise.resolve();
  const value = { workingroom: next.workingroom, togetherroom: next.togetherroom };
  return db.commit(
    withAudit(db, { [ROOM_LIMITS_PATH]: value }, 'settings.roomLimits', 'roomLimits', changes.join(' · ')),
  );
}

export function saveRoomMaxPeople(db: Db, before: number | null | undefined, next: number): Promise<void> {
  return db.commit(
    withAudit(
      db,
      { [ROOM_MAX_PEOPLE_PATH]: next },
      'settings.roomMaxPeople',
      `정원 ${next}명`,
      `${before ?? `기본 ${roomMaxPeopleOf(null)}`} → ${next}`,
    ),
  );
}

export async function getChatKeep(db: Db): Promise<ChatKeep> {
  return parseChatKeep(await db.get<unknown>(CHAT_KEEP_PATH));
}

/** 바뀐 칸 + 작업 기록 한 묶음. */
export function saveChatKeep(
  db: Db,
  before: ChatKeep,
  updates: Record<string, number | null>,
): Promise<void> {
  const detail = chatKeepDetail(before, updates);
  return db.commit(withAudit(db, updates, 'settings.chatKeepDays', '대화 보관 일수', detail));
}

// 방마다 키 목록 한 번씩이라 한꺼번에 몰지 않는다 — 다른 일괄 동작과 같은 20개씩.
const PROBE_CHUNK = 20;

// rooms 는 멤버 · chatLog · _photo 까지 실려 커서 읽지 않는다. 방당 수십 바이트인 roomIndex 만 받는다.
export async function getRoomIndex(db: Db): Promise<Record<string, RoomIndexEntry>> {
  return (await db.get<Record<string, RoomIndexEntry>>('roomIndex')) ?? {};
}

/** rooms 의 방 코드만(shallow) — 본체(멤버 · chatLog · _photo)는 받지 않는다. */
export function getRoomCodes(db: Db): Promise<string[]> {
  return db.shallowKeys('rooms');
}

/**
 * 방 하나의 멤버 수(키만). withSeen 이면 멤버마다 lastSeen 한 칸씩 읽어 가장 최근 신호를 낸다 —
 * roomIndex 에 줄이 없는 방이 살아 있는지 볼 때만(앱 getRoomCounts 의 프로브와 같은 방식).
 * 새 하트비트(앱 room-alive.js) 멤버는 lastSeen 이 입장 때 값에 머물고 30초 도장을 roomAlive/{방} 에 찍으므로 그것도 본다.
 */
export async function probeRoom(
  db: Db,
  code: string,
  withSeen: boolean,
  withPeople = true,
): Promise<RoomProbe> {
  const ids = (await db.shallowKeys(`rooms/${code}`)).filter(isMemberKey);
  if (!ids.length) return { members: 0, lastSeen: null, ...(withPeople ? { people: [] } : {}) };
  const [people, seen] = await Promise.all([
    withPeople ? readPeople(db, code, ids) : null,
    withSeen ? readSeen(db, code, ids) : null,
  ]);
  return { members: ids.length, lastSeen: seen, ...(people ? { people } : {}) };
}

/** 사람으로 찾기용 — 멤버마다 name · userId 두 칸만(def · 얼굴 같은 큰 칸은 안 받는다). */
function readPeople(db: Db, code: string, ids: readonly string[]): Promise<RoomPerson[]> {
  const read = (id: string, key: string) => db.get<unknown>(`rooms/${code}/${id}/${key}`).catch(() => null);
  return Promise.all(
    ids.map(async (id) => toRoomPerson(...(await Promise.all([read(id, 'name'), read(id, 'userId')])))),
  );
}

async function readSeen(db: Db, code: string, ids: readonly string[]): Promise<number | null> {
  const [seens, alive] = await Promise.all([
    Promise.all(ids.map((id) => db.get<unknown>(`rooms/${code}/${id}/lastSeen`).catch(() => null))),
    db.get<Record<string, unknown> | null>(`roomAlive/${code}`).catch(() => null),
  ]);
  const nums = [...seens, ...Object.values(alive ?? {})].filter((v): v is number => typeof v === 'number');
  return nums.length ? Math.max(...nums) : null;
}

/** 방 서버에 지금 열린 방(시크릿룸 · 사람 포함). 이 환경에 API 가 없으면 null — Firebase 방만 보인다. */
export async function getLiveRooms(api: Api | null): Promise<LiveRooms | null> {
  if (!api) return null;
  const live = parseLiveRooms(await api.get<unknown>(LIVE_ROOMS_PATH));
  if (!live) throw new Error('방 서버 목록 모양이 달라요');
  return live;
}

export async function probeRooms(
  db: Db,
  codes: readonly string[],
  withSeen: ReadonlySet<string>,
): Promise<Record<string, RoomProbe>> {
  const out: Record<string, RoomProbe> = {};
  for (let i = 0; i < codes.length; i += PROBE_CHUNK) {
    await Promise.all(
      codes.slice(i, i + PROBE_CHUNK).map(async (code) => {
        out[code] = await probeRoom(db, code, withSeen.has(code));
      }),
    );
  }
  return out;
}

export async function serverNow(db: Db, clock: () => number = Date.now): Promise<number> {
  return clock() + (await db.serverTimeOffset());
}

/** 방을 한 묶음으로 닫고 같은 묶음에 기록 한 줄 — 한 방이면 그 코드, 여럿이면 개수와 앞 몇 개. */
export function closeRooms(db: Db, codes: string[], action: AuditAction = 'room.close'): Promise<void> {
  if (!codes.length) return Promise.resolve();
  const many = action !== 'room.close' || codes.length > 1;
  const target = many ? `${codes.length}개` : codes[0];
  return db.commit(
    withAudit(db, closeRoomsWrite(codes), action, target, many ? countTarget(codes) : undefined),
  );
}

export function closeRoom(db: Db, code: string): Promise<void> {
  return closeRooms(db, [code]);
}

/** 고른 방들을 한 묶음으로 닫는다 — 하나라도 규칙에 막히면 아무 방도 지워지지 않는다. */
export async function closeSelectedRooms(db: Db, codes: readonly string[]): Promise<number> {
  await closeRooms(db, [...codes]);
  return codes.length;
}

/**
 * 방을 전부 닫는다 — 앱 closeAllRooms 처럼 rooms 의 모든 방(시크릿룸 · 고아 포함)과 roomIndex 의 줄.
 * 보여 준 뒤 새로 열린 방도 닫히도록 실행 직전에 다시 받는다(rooms 는 키만).
 */
export async function closeAllRooms(db: Db): Promise<string[]> {
  const [index, codes] = await Promise.all([getRoomIndex(db), getRoomCodes(db)]);
  const all = allRoomCodes(index, codes);
  await closeRooms(db, all, 'room.closeAll');
  return all;
}

export function createFirebaseRoomPort(db: Db, api: Api | null): RoomPort {
  return {
    getLimits: () => getRoomLimits(db),
    getMaxPeople: () => getRoomMaxPeople(db),
    saveLimits: (before, next) => saveRoomLimits(db, before, next),
    saveMaxPeople: (before, next) => saveRoomMaxPeople(db, before, next),
    getChatKeep: () => getChatKeep(db),
    saveChatKeep: (before, updates) => saveChatKeep(db, before, updates),
    getIndex: () => getRoomIndex(db),
    getCodes: () => getRoomCodes(db),
    probeRooms: (codes, withSeen) => probeRooms(db, codes, withSeen),
    getStats: () => db.get<RoomStats>('roomStats'),
    getLive: () => getLiveRooms(api),
    serverTimeOffset: () => db.serverTimeOffset(),
    close: (codes) => closeRooms(db, [...codes]),
    closeAll: () => closeAllRooms(db),
  };
}

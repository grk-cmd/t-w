import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { countTarget, useApi, useDb, withAudit, type Api, type AuditAction, type Db } from '@/shared/api';
import {
  closeRoomsWrite,
  isMemberKey,
  LIVE_ROOMS_PATH,
  orphanCodes,
  parseLiveRooms,
  toRoomPerson,
  type LiveRooms,
  type RoomIndexEntry,
  type RoomPerson,
  type RoomProbe,
  type RoomStats,
} from '../model/room';

const ROOM_INDEX_KEY = ['roomIndex'];
const ROOM_CODES_KEY = ['roomCodes'];
const ROOM_PROBES_KEY = ['roomProbes'];
// 방마다 키 목록 한 번씩이라 한꺼번에 몰지 않는다 — 다른 일괄 동작과 같은 20개씩.
const PROBE_CHUNK = 20;
const ROOM_STATS_KEY = ['roomStats'];
const LIVE_ROOMS_KEY = ['liveRooms'];
const SERVER_OFFSET_KEY = ['serverTimeOffset'];
// rooms 는 멤버 · chatLog · _photo 까지 실려 커서 읽지 않는다. 방당 수십 바이트인 roomIndex 만 받는다.
export async function getRoomIndex(db: Db): Promise<Record<string, RoomIndexEntry>> {
  return (await db.get<Record<string, RoomIndexEntry>>('roomIndex')) ?? {};
}

export function useRoomIndex() {
  const db = useDb();
  return useQuery({ queryKey: ROOM_INDEX_KEY, queryFn: () => getRoomIndex(db) });
}

/** rooms 의 방 코드만(shallow) — 본체(멤버 · chatLog · _photo)는 받지 않는다. */
export function getRoomCodes(db: Db): Promise<string[]> {
  return db.shallowKeys('rooms');
}

export function useRoomCodes() {
  const db = useDb();
  return useQuery({ queryKey: ROOM_CODES_KEY, queryFn: () => getRoomCodes(db) });
}

/**
 * 방 하나의 멤버 수(키만). withSeen 이면 멤버마다 lastSeen 한 칸씩 읽어 가장 최근 신호를 낸다 —
 * roomIndex 에 줄이 없는 방이 살아 있는지 볼 때만(앱 getRoomCounts 의 프로브와 같은 방식).
 * 새 하트비트(앱 room-alive.js) 멤버는 lastSeen 이 입장 때 값에 머물고 30초 도장을 roomAlive/{방} 에 찍으므로 그것도 본다.
 */
export async function probeRoom(db: Db, code: string, withSeen: boolean): Promise<RoomProbe> {
  const ids = (await db.shallowKeys(`rooms/${code}`)).filter(isMemberKey);
  if (!ids.length) return { members: 0, lastSeen: null, people: [] };
  const [people, seen] = await Promise.all([
    readPeople(db, code, ids),
    withSeen ? readSeen(db, code, ids) : null,
  ]);
  return { members: ids.length, lastSeen: seen, people };
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

export function useLiveRooms() {
  const api = useApi();
  // 방 서버가 아직 이 API 를 모르면(배포 전) 404 — 다시 해 봐도 같다.
  return useQuery({ queryKey: LIVE_ROOMS_KEY, queryFn: () => getLiveRooms(api), retry: false });
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

/** rooms 의 방마다 인원 수 · 고아 방의 마지막 신호. roomIndex 와 방 코드를 받은 뒤에 돈다. */
export function useRoomProbes(
  index: Record<string, RoomIndexEntry> | undefined,
  codes: string[] | undefined,
) {
  const db = useDb();
  const orphans = index && codes ? orphanCodes(index, codes) : [];
  return useQuery({
    queryKey: [...ROOM_PROBES_KEY, codes, orphans],
    queryFn: () => probeRooms(db, codes ?? [], new Set(orphans)),
    enabled: !!index && !!codes,
    // 새로고침 동안 인원 칸이 비지 않게 — 정리 직전에는 cleanGhostRooms 가 다시 살펴본다.
    placeholderData: keepPreviousData,
  });
}

export function useRoomStats() {
  const db = useDb();
  return useQuery({ queryKey: ROOM_STATS_KEY, queryFn: () => db.get<RoomStats>('roomStats') });
}

/**
 * 받은 시점의 서버 기준 «지금» — 살았나 죽었나는 **받아 둔 값을 받은 그 시각**으로 판정한다.
 * 화면 시계를 흘려보내면 roomIndex 를 다시 받지 않는 동안(staleTime 무한) 모든 방의 lastSeen 이 낡아
 * 90초 뒤엔 살아 있는 방까지 전부 유령으로 보였다. 시계가 틀린 PC 를 위해 서버 시각 차는 더한다.
 */
export function useSnapshotNow(fetchedAt: number | undefined): number | null {
  const db = useDb();
  const offset = useQuery({ queryKey: SERVER_OFFSET_KEY, queryFn: () => db.serverTimeOffset() });
  return offset.data === undefined || !fetchedAt ? null : fetchedAt + offset.data;
}

export function useRefreshRooms() {
  const client = useQueryClient();
  return () => {
    for (const queryKey of [
      ROOM_INDEX_KEY,
      ROOM_CODES_KEY,
      ROOM_PROBES_KEY,
      ROOM_STATS_KEY,
      SERVER_OFFSET_KEY,
      LIVE_ROOMS_KEY,
    ]) {
      client.invalidateQueries({ queryKey });
    }
  };
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

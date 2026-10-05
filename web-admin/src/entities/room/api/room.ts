import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { countTarget, useDb, withAudit, type AuditAction, type Db } from '@/shared/api';
import {
  closeRoomsWrite,
  isMemberKey,
  orphanCodes,
  type RoomIndexEntry,
  type RoomProbe,
  type RoomStats,
} from '../model/room';

const ROOM_INDEX_KEY = ['roomIndex'];
const ROOM_CODES_KEY = ['roomCodes'];
const ROOM_PROBES_KEY = ['roomProbes'];
// 방마다 키 목록 한 번씩이라 한꺼번에 몰지 않는다 — 다른 일괄 동작과 같은 20개씩.
const PROBE_CHUNK = 20;
const ROOM_STATS_KEY = ['roomStats'];
const SERVER_OFFSET_KEY = ['serverTimeOffset'];
const CLOCK_TICK_MS = 15 * 1000;

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
 */
export async function probeRoom(db: Db, code: string, withSeen: boolean): Promise<RoomProbe> {
  const ids = (await db.shallowKeys(`rooms/${code}`)).filter(isMemberKey);
  if (!withSeen || !ids.length) return { members: ids.length, lastSeen: null };
  const seens = await Promise.all(
    ids.map((id) => db.get<unknown>(`rooms/${code}/${id}/lastSeen`).catch(() => null)),
  );
  const nums = seens.filter((v): v is number => typeof v === 'number');
  return { members: ids.length, lastSeen: nums.length ? Math.max(...nums) : null };
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

/** 서버 기준 «지금». 시계가 틀린 PC 에서 살아 있는 방을 유령으로 보지 않게 서버 시각 차를 더한다. 받은 뒤엔 내려받기 없이 화면만 흘러간다. */
export function useServerNow(): number | null {
  const db = useDb();
  const offset = useQuery({ queryKey: SERVER_OFFSET_KEY, queryFn: () => db.serverTimeOffset() });
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);
  return offset.data === undefined ? null : tick + offset.data;
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

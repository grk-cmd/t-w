import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useDb, type Db } from '@/shared/api';
import { closeRoomsWrite, type RoomIndexEntry, type RoomStats } from '../model/room';

const ROOM_INDEX_KEY = ['roomIndex'];
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
    for (const queryKey of [ROOM_INDEX_KEY, ROOM_STATS_KEY, SERVER_OFFSET_KEY]) {
      client.invalidateQueries({ queryKey });
    }
  };
}

export async function serverNow(db: Db, clock: () => number = Date.now): Promise<number> {
  return clock() + (await db.serverTimeOffset());
}

export function closeRooms(db: Db, codes: string[]): Promise<void> {
  return codes.length ? db.commit(closeRoomsWrite(codes)) : Promise.resolve();
}

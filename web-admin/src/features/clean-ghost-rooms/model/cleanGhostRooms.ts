import { closeRooms, getRoomIndex, isRoomAlive, serverNow } from '@/entities/room';
import type { Db } from '@/shared/api';

export interface GhostCleanResult {
  removed: string[];
  revived: string[];
}

/**
 * 미리 보여 준 유령 방을 지운다. 보여 준 뒤 다시 살아난 방이 있을 수 있어 지우기 직전에 roomIndex(작다)를 한 번 더 받는다.
 * 그새 줄이 사라진 방도 지운다 — 함수가 10분 넘게 조용한 줄을 지운 것이라 rooms 쪽에 찌꺼기가 남아 있을 수 있다.
 */
export async function cleanGhostRooms(
  db: Db,
  preview: string[],
  clock?: () => number,
): Promise<GhostCleanResult> {
  const [index, now] = await Promise.all([getRoomIndex(db), serverNow(db, clock)]);
  const removed = preview.filter((code) => !isRoomAlive(index[code], now));
  const revived = preview.filter((code) => isRoomAlive(index[code], now));
  await closeRooms(db, removed);
  return { removed, revived };
}

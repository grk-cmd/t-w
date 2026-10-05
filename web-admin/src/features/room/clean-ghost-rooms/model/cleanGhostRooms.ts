import { closeRooms, getRoomIndex, isRoomAlive, isSecretRoom, probeRoom, serverNow } from '@/entities/room';
import type { Db } from '@/shared/api';

export interface GhostCleanResult {
  removed: string[];
  revived: string[];
}

/**
 * 미리 보여 준 유령 방을 지운다. 보여 준 뒤 다시 살아난 방이 있을 수 있어 지우기 직전에 한 번 더 본다 —
 * roomIndex 에 줄이 있으면 그 신호로, 없으면(고아 · 함수가 10분 넘게 조용한 줄을 지운 방) 멤버 신호를 직접 읽어서.
 * 시크릿룸은 roomIndex 를 안 써 신호로 판정할 수 없어 넘겨받아도 지우지 않는다.
 */
export async function cleanGhostRooms(
  db: Db,
  preview: string[],
  clock?: () => number,
): Promise<GhostCleanResult> {
  const [index, now] = await Promise.all([getRoomIndex(db), serverNow(db, clock)]);
  const targets = preview.filter((code) => !isSecretRoom(code));
  const alive = await Promise.all(
    targets.map(async (code) =>
      code in index
        ? isRoomAlive(index[code], now)
        : isRoomAlive({ lastSeen: (await probeRoom(db, code, true)).lastSeen ?? undefined }, now),
    ),
  );
  const removed = targets.filter((_, i) => !alive[i]);
  const revived = targets.filter((_, i) => alive[i]);
  await closeRooms(db, removed, 'room.cleanGhost');
  return { removed, revived };
}

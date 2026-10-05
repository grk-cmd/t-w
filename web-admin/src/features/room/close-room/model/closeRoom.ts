import { allRoomCodes, closeRooms, getRoomCodes, getRoomIndex } from '@/entities/room';
import type { Db } from '@/shared/api';

// 실수 방지 — 앱과 같이 이 낱말을 직접 입력해야 전체 종료가 된다.
export const CLOSE_ALL_WORD = '종료';

export const isCloseAllConfirmed = (typed: string) => typed.trim() === CLOSE_ALL_WORD;

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
  await closeRooms(db, all);
  return all;
}

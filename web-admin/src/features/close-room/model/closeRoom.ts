import { closeRooms, getRoomIndex } from '@/entities/room';
import type { Db } from '@/shared/api';

// 실수 방지 — 앱과 같이 이 낱말을 직접 입력해야 전체 종료가 된다.
export const CLOSE_ALL_WORD = '종료';

export const isCloseAllConfirmed = (typed: string) => typed.trim() === CLOSE_ALL_WORD;

export function closeRoom(db: Db, code: string): Promise<void> {
  return closeRooms(db, [code]);
}

/** roomIndex 에 있는 방을 전부 닫는다. 보여 준 뒤 새로 열린 방도 닫히도록 실행 직전에 다시 받는다. */
export async function closeAllRooms(db: Db): Promise<string[]> {
  const codes = Object.keys(await getRoomIndex(db)).sort();
  await closeRooms(db, codes);
  return codes;
}

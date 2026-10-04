import { useMutation } from '@tanstack/react-query';
import {
  checkMinRoomVer,
  getMinRoomVer,
  saveMinRoomVer,
  useRefreshMinRoomVer,
} from '@/entities/min-room-ver';
import { useDb, type Db } from '@/shared/api';

export type SetMinRoomVerResult =
  | { ok: true }
  | { ok: false; reason: 'changed'; current: string | null }
  | { ok: false; reason: 'invalid'; message: string };

/**
 * 확인 창에 보여 준 «현재 값» 이 그 사이 바뀌었으면(다른 관리자 · min-room-ver.yml) 쓰지 않는다 —
 * 관리자가 본 적 없는 값을 덮어쓰지 않게, 쓰기 직전에 한 번 더 읽는다.
 */
export async function setMinRoomVer(
  db: Db,
  next: string,
  expectedCurrent: string | null,
): Promise<SetMinRoomVerResult> {
  const current = await getMinRoomVer(db);
  if (current !== expectedCurrent) return { ok: false, reason: 'changed', current };
  const check = checkMinRoomVer(next, current);
  if (!check.ok) return { ok: false, reason: 'invalid', message: check.reason };
  await saveMinRoomVer(db, next);
  return { ok: true };
}

export function useSetMinRoomVer() {
  const db = useDb();
  const refresh = useRefreshMinRoomVer();
  return useMutation({
    mutationFn: ({ next, expected }: { next: string; expected: string | null }) =>
      setMinRoomVer(db, next, expected),
    onSettled: refresh,
  });
}

import { useMutation } from '@tanstack/react-query';
import { removeAllow, setAllow, USER_CODE_RE, useRefreshRoomServer } from '@/entities/room-server';
import { findUserByFriendCode } from '@/entities/user';
import { useDb, type Db } from '@/shared/api';

/** 사용자 코드(u…) 는 그대로, 아니면 친구 코드(MATE-XXXX · 뒤 4자리)로 찾는다. 못 찾으면 null. */
export async function resolveUserCode(
  db: Db,
  input: string,
): Promise<{ userCode: string; friendCode: string | null } | null> {
  const v = input.trim();
  if (USER_CODE_RE.test(v)) return { userCode: v, friendCode: null };
  const hit = await findUserByFriendCode(db, v);
  return hit && USER_CODE_RE.test(hit.uid) ? { userCode: hit.uid, friendCode: hit.code } : null;
}

export function useSetAllow() {
  const db = useDb();
  const refresh = useRefreshRoomServer();
  return useMutation({
    mutationFn: ({ userCode, server, before }: { userCode: string; server: string; before: string | null }) =>
      setAllow(db, userCode, server, before),
    onSuccess: refresh,
  });
}

export function useRemoveAllow() {
  const db = useDb();
  const refresh = useRefreshRoomServer();
  return useMutation({
    mutationFn: ({ userCode, before }: { userCode: string; before: string }) =>
      removeAllow(db, userCode, before),
    onSuccess: refresh,
  });
}

import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { KEYSET_PAGE_MAX, resetKeyset } from '@/shared/lib';
import { USER_KEYSET_KEY, type UserInvite } from '@/entities/user/@x/invite';
import { GROUP_INVITES_KEY, groupInviteUsesKey, invitesLeftKey, USER_INVITE, userInviteKey } from './keys';
import { useInvitePort } from './index';

/** 여러 명 코드 — 쪽으로 받는다. 이어 붙이기 · 쪽 넘기기는 `useKeysetPaging` 이 한다. */
export function useGroupInvites(enabled: boolean) {
  const port = useInvitePort();
  return useInfiniteQuery({
    queryKey: GROUP_INVITES_KEY,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => port.groups(pageParam, KEYSET_PAGE_MAX),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });
}

/** 그 코드로 들어온 사람 — 펼쳤을 때만 쪽으로 받는다. */
export function useGroupInviteUses(code: string, enabled: boolean) {
  const port = useInvitePort();
  return useInfiniteQuery({
    queryKey: groupInviteUsesKey(code),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => port.uses(code, pageParam, KEYSET_PAGE_MAX),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });
}

/** 한 사람 몫 한 칸 — 지급 창을 열 때만 읽는다. */
export function useInvitesLeft(uid: string, enabled: boolean) {
  const port = useInvitePort();
  return useQuery({ queryKey: invitesLeftKey(uid), queryFn: () => port.invitesLeft(uid), enabled });
}

/** 한 명에게 지급한 뒤 — 지급 창의 장수와 목록의 가입 칸을 함께 맞춘다. */
export function useSetInvitesLeftCache() {
  const client = useQueryClient();
  return (uid: string, value: number) => {
    client.setQueryData(invitesLeftKey(uid), value);
    client.setQueryData<UserInvite | null>(userInviteKey(uid), (cur) =>
      cur ? { ...cur, invitesLeft: value } : cur,
    );
    // API 판은 목록 줄이 초대권 수를 싣고 온다 — 그 줄을 다시 받는다(Firebase 판에는 없는 목록이라 아무 일도 없다).
    void resetKeyset(client, USER_KEYSET_KEY);
  };
}

/** 여러 명에게 지급한 뒤 — 받아 둔 가입 칸을 버려 보이는 줄만 다시 읽게 한다. */
export function useForgetUserInvites() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: [USER_INVITE] }),
      resetKeyset(client, USER_KEYSET_KEY),
    ]);
}

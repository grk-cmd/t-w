import { useQuery, useQueryClient } from '@tanstack/react-query';
import { USER_KEYSET_KEY, type UserInvite } from '@/entities/user/@x/invite';
import { GROUP_INVITES_KEY, invitesLeftKey, USER_INVITE, userInviteKey } from './keys';
import { useInvitePort } from './index';

export function useGroupInvites(enabled: boolean) {
  const port = useInvitePort();
  return useQuery({ queryKey: GROUP_INVITES_KEY, queryFn: () => port.groups(), enabled });
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
    void client.invalidateQueries({ queryKey: USER_KEYSET_KEY });
  };
}

/** 여러 명에게 지급한 뒤 — 받아 둔 가입 칸을 버려 보이는 줄만 다시 읽게 한다. */
export function useForgetUserInvites() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: [USER_INVITE] }),
      client.invalidateQueries({ queryKey: USER_KEYSET_KEY }),
    ]);
}

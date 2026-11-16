import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { userInviteKey } from '@/entities/invite/@x/user';
import type { UserInvite } from '../model/live';
import type { UserRow } from '../model/userRow';
import { userBriefKey, userDetailKey, userPresenceKey } from './keys';
import type { UserBrief, UserCellsPort, UserPort } from './port';
import { useUserPort } from './index';

/** 이 판은 가입 · 초대 칸을 줄이 싣고 온다 — 칸마다 따로 읽는 훅은 Firebase 판 몫. */
function cellsOnly(port: UserPort, what: string): UserCellsPort {
  if (port.kind !== 'cells') throw new Error(`이 판은 ${what} 을(를) 한 사람 몫(상세)으로 받아요`);
  return port;
}

/** 목록 칸과 기간 검색이 같은 캐시를 쓰도록 한 곳에서 만든다. */
export const userPresenceQuery = (port: UserPort, uid: string) =>
  queryOptions({ queryKey: userPresenceKey(uid), queryFn: () => port.presence(uid) });

/** 목록 칸과 기간 검색이 같은 캐시를 쓰도록 한 곳에서 만든다(Firebase 판). */
export const userInviteQuery = (port: UserPort, uid: string) =>
  queryOptions({ queryKey: userInviteKey(uid), queryFn: () => cellsOnly(port, '가입 칸').invite(uid) });

/** 화면에 보이는 줄만 읽는다 — 한 번 읽은 값은 캐시에 남아 페이지를 오가도 다시 받지 않는다. */
export function useUserPresence(uid: string) {
  return useQuery(userPresenceQuery(useUserPort(), uid));
}

/** 목록 줄의 접속 칸 — 줄이 싣고 왔으면 그대로, 아니면 그 사람 것만 읽는다. */
export function useRowPresence(row: UserRow) {
  const port = useUserPort();
  const read = useQuery({ ...userPresenceQuery(port, row.userCode), enabled: row.live === null });
  return row.live ? { data: row.live.presence, isLoading: false, error: null } : read;
}

/** 목록 줄의 가입 칸 — 줄이 싣고 왔으면 그대로, 아니면 그 사람 것만 읽는다. */
export function useRowInvite(row: UserRow) {
  const port = useUserPort();
  const read = useQuery({ ...userInviteQuery(port, row.userCode), enabled: row.live === null });
  return row.live ? { data: row.live.invite as UserInvite | null, isLoading: false, error: null } : read;
}

/** 화면에 보이는 줄만 읽고 캐시에 남긴다. */
export function useUserInvite(uid: string) {
  return useQuery(userInviteQuery(useUserPort(), uid));
}

/** 상세 창을 열 때만. */
export function useIssuedInvites(uid: string) {
  const port = useUserPort();
  return useQuery({
    queryKey: ['issuedInvites', uid],
    queryFn: () => cellsOnly(port, '만든 초대 코드').issuedInvites(uid),
  });
}

/** 상세 창을 열 때만 읽는다. */
export function useUserFocusSec(uid: string) {
  const port = useUserPort();
  return useQuery({ queryKey: ['userFocus', uid], queryFn: () => port.focusSec(uid) });
}

/** 이름 한 칸 — 한 번 받은 이름은 캐시에 남아 페이지를 오가도 다시 받지 않는다. */
export function useUserName(uid: string, enabled: boolean) {
  const port = useUserPort();
  return useQuery({ queryKey: ['userName', uid], queryFn: () => port.name(uid), enabled });
}

export function useUserLicense(uid: string) {
  const port = useUserPort();
  return useQuery({ queryKey: ['userLicense', uid], queryFn: () => port.license(uid) });
}

export function useUserBrief(uid: string, enabled = true) {
  const port = useUserPort();
  return useQuery({ queryKey: userBriefKey(uid), queryFn: () => port.brief(uid), enabled });
}

/** API 판 상세 — 한 사람 몫을 한 번에. */
export function useUserDetail(uid: string) {
  const port = useUserPort();
  return useQuery({
    queryKey: userDetailKey(uid),
    queryFn: () => {
      if (port.kind !== 'detail') throw new Error('이 판은 사용자 상세를 칸마다 받아요');
      return port.detail(uid);
    },
  });
}

export function useRefreshUserBrief() {
  const client = useQueryClient();
  return (uid: string) => client.invalidateQueries({ queryKey: userBriefKey(uid) });
}

export function useForgetAwayImg() {
  const client = useQueryClient();
  return (uid: string) =>
    client.setQueryData<UserBrief>(userBriefKey(uid), (b) => (b ? { ...b, awayImg: null } : b));
}

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';

const invitesLeftKey = (uid: string) => ['invitesLeft', uid];

/** 초대권 칸이 없으면 null — 규칙이 «없던 칸은 0 으로만 만들 수 있다» 고 해서 지급 대상이 아니다. */
export async function getInvitesLeft(db: Db, uid: string): Promise<number | null> {
  const v = await db.get<unknown>(`users/${uid}/invite/invitesLeft`);
  return typeof v === 'number' ? v : null;
}

export function setInvitesLeft(db: Db, uid: string, value: number): Promise<void> {
  return db.update(`users/${uid}/invite`, { invitesLeft: value });
}

/** 한 사람 몫 한 칸 — 지급 창을 열 때만 읽는다. */
export function useInvitesLeft(uid: string, enabled: boolean) {
  const db = useDb();
  return useQuery({ queryKey: invitesLeftKey(uid), queryFn: () => getInvitesLeft(db, uid), enabled });
}

export function useSetInvitesLeftCache() {
  const client = useQueryClient();
  return (uid: string, value: number) => client.setQueryData(invitesLeftKey(uid), value);
}

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';
import { addInvites, INVITES_LEFT_MAX } from '../model/invite';

const invitesLeftKey = (uid: string) => ['invitesLeft', uid];

/** 초대권 칸이 없으면 null — 규칙이 «없던 칸은 0 으로만 만들 수 있다» 고 해서 지급 대상이 아니다. */
export async function getInvitesLeft(db: Db, uid: string): Promise<number | null> {
  const v = await db.get<unknown>(`users/${uid}/invite/invitesLeft`);
  return typeof v === 'number' ? v : null;
}

export type AddInvitesResult =
  { ok: true; before: number; after: number } | { ok: false; reason: 'no-invite' | 'full' };

/**
 * 초대권에 count 장을 더한다(999 에서 자름). 트랜잭션이라 그 사이 본인이 쓰거나 다른 관리자가 지급해도 덮지 않는다.
 * 칸이 없으면 쓰지 않는다 — 규칙이 새 칸을 0 으로만 받아 어차피 거부된다.
 */
export async function addInvitesLeft(db: Db, uid: string, count: number): Promise<AddInvitesResult> {
  // 서버가 거절하면 update 가 다시 불리므로 마지막 호출의 판단만 남긴다.
  const seen: { before: number | null } = { before: null };
  const r = await db.transaction<unknown>(`users/${uid}/invite/invitesLeft`, (current) => {
    seen.before = typeof current === 'number' ? current : null;
    if (seen.before === null || seen.before >= INVITES_LEFT_MAX) return undefined;
    return addInvites(seen.before, count);
  });
  if (seen.before === null) return { ok: false, reason: 'no-invite' };
  if (!r.committed || typeof r.value !== 'number') return { ok: false, reason: 'full' };
  return { ok: true, before: seen.before, after: r.value };
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

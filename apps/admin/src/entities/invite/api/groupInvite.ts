import { useQuery } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';
import { genInviteCode, INVITE_ISSUER_ADMIN } from '../model/invite';
import {
  GROUP_INVITE_NOTE_MAX,
  isGroupMaxUses,
  toGroupInvites,
  type GroupInvite,
  type GroupInviteDraft,
  type GroupInviteRecord,
} from '../model/groupInvite';

export const GROUP_INVITES_KEY = ['groupInvites'];

/**
 * 새 여러 명 코드 하나. 앱은 invites/{code} 를 먼저 보고 없을 때만 groupInvites 를 보니,
 * 한 명짜리와 이름이 겹치면 이 코드가 가려진다 — 양쪽 다 비었을 때만 만든다.
 */
export async function createGroupInvite(
  db: Db,
  draft: GroupInviteDraft,
  now = Date.now(),
  gen: () => string = genInviteCode,
): Promise<string> {
  if (!isGroupMaxUses(draft.maxUses)) throw new Error(`인원이 범위를 벗어났어요: ${draft.maxUses}`);
  if (draft.expiresAt !== null && draft.expiresAt <= now) throw new Error('마감 날짜가 이미 지났어요');
  const note = draft.note.trim().slice(0, GROUP_INVITE_NOTE_MAX);
  const record: GroupInviteRecord = {
    issuedBy: INVITE_ISSUER_ADMIN,
    createdAt: now,
    maxUses: draft.maxUses,
    usedCount: 0,
    ...(draft.expiresAt !== null ? { expiresAt: draft.expiresAt } : {}),
    ...(note ? { note } : {}),
  };
  for (let i = 0; i < 5; i++) {
    const code = gen();
    if ((await db.get(`invites/${code}`)) !== null) continue;
    const r = await db.transaction<GroupInviteRecord>(`groupInvites/${code}`, (current) =>
      current === null ? record : undefined,
    );
    if (r.committed) return code;
  }
  throw new Error('초대 코드가 계속 겹쳐요');
}

/** 관리자만 읽는 목록 — 코드 수는 적고 칸이 작아 통째로 받는다(들어온 사람 칸은 따로 있어 안 딸려 온다). */
export async function listGroupInvites(db: Db): Promise<GroupInvite[]> {
  return toGroupInvites(await db.get<Record<string, Record<string, unknown> | null>>('groupInvites'));
}

export function useGroupInvites(enabled: boolean) {
  const db = useDb();
  return useQuery({ queryKey: GROUP_INVITES_KEY, queryFn: () => listGroupInvites(db), enabled });
}

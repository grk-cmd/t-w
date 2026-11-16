// Firebase 판 — 지금 코드 그대로: 초대권 · 초대 코드를 RTDB 에서 읽고 쓴다(트랜잭션).
import type { Db } from '@/shared/api';
import {
  addInvites,
  genInviteCode,
  INVITE_ISSUER_ADMIN,
  INVITES_LEFT_MAX,
  type InviteRecord,
} from '../model/invite';
import {
  GROUP_INVITE_NOTE_MAX,
  isGroupMaxUses,
  toGroupInvites,
  type GroupInvite,
  type GroupInviteDraft,
  type GroupInviteRecord,
} from '../model/groupInvite';
import type { InvitePort } from './port';

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

export type ClearInvitesResult = { ok: true; before: number } | { ok: false; reason: 'no-invite' | 'empty' };

/**
 * 남은 초대권을 0 장으로. 1장 이상일 때만 쓴다 — 마이너스(앱이 회수로 깎아 둔 빚)는 0 으로 올리면 빚이 지워지므로 그대로 둔다.
 * 트랜잭션이라 그 사이 본인이 초대장을 써도 그 값을 보고 다시 판단한다.
 */
export async function clearInvitesLeft(db: Db, uid: string): Promise<ClearInvitesResult> {
  const seen: { before: number | null } = { before: null };
  const r = await db.transaction<unknown>(`users/${uid}/invite/invitesLeft`, (current) => {
    seen.before = typeof current === 'number' ? current : null;
    if (seen.before === null || seen.before <= 0) return undefined;
    return 0;
  });
  if (seen.before === null) return { ok: false, reason: 'no-invite' };
  if (!r.committed) return { ok: false, reason: 'empty' };
  return { ok: true, before: seen.before };
}

/**
 * 새 초대 코드 하나. invites 는 규칙상 누구나 덮어쓸 수 있어, 이미 있는 코드면 쓰지 않도록 트랜잭션으로 «없을 때만» 만든다.
 * 겹치면 새 코드로 몇 번 더 해 본다.
 */
export async function createInviteCode(
  db: Db,
  now = Date.now(),
  gen: () => string = genInviteCode,
): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = gen();
    const record: InviteRecord = { issuedBy: INVITE_ISSUER_ADMIN, createdAt: now };
    const r = await db.transaction<InviteRecord>(`invites/${code}`, (current) =>
      current === null ? record : undefined,
    );
    if (r.committed) return code;
  }
  throw new Error('초대 코드가 계속 겹쳐요');
}

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

export function createFirebaseInvitePort(db: Db): InvitePort {
  return {
    // 노드를 통째로 받는 판이라 한 쪽에 전부 싣는다(다음 쪽 없음 · 전체 수 = 받은 수).
    groups: async () => {
      const items = await listGroupInvites(db);
      return { items, nextCursor: null, total: items.length };
    },
    invitesLeft: (uid) => getInvitesLeft(db, uid),
  };
}

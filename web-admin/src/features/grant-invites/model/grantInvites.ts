import {
  addInvites,
  getInvitesLeft,
  INVITES_LEFT_MAX,
  isGrantCount,
  setInvitesLeft,
} from '@/entities/invite';
import type { Db } from '@/shared/api';

export type GrantInvitesResult =
  { ok: true; before: number; after: number } | { ok: false; reason: 'no-invite' | 'full' };

/**
 * 한 사람의 초대권에 count 장을 더한다(999 에서 자름).
 * 칸이 없는 사람은 쓰지 않는다 — 규칙이 새 칸을 0 으로만 받아 어차피 거부되고, 앱 전체 지급도 이들을 뺀다.
 * TODO: Db 에 트랜잭션이 생기면 바꾼다. 지금은 읽고 → 쓰기라, 그 사이 본인이 초대권을 쓰거나 다른 관리자가
 *   지급하면 그 변화가 덮인다(앱은 runTransaction 을 쓴다).
 */
export async function grantInvites(db: Db, uid: string, count: number): Promise<GrantInvitesResult> {
  if (!isGrantCount(count)) throw new Error(`지급 장수가 범위를 벗어났어요: ${count}`);
  const before = await getInvitesLeft(db, uid);
  if (before === null) return { ok: false, reason: 'no-invite' };
  if (before >= INVITES_LEFT_MAX) return { ok: false, reason: 'full' };
  const after = addInvites(before, count);
  await setInvitesLeft(db, uid, after);
  return { ok: true, before, after };
}

/** friendCodes 는 코드 → 사용자라 코드를 바꾼 사람이 여럿 나온다 — 한 번씩만. */
export function uniqueUserIds(friendCodes: Record<string, { userId?: string }>): string[] {
  const uids = new Set<string>();
  for (const entry of Object.values(friendCodes)) if (entry?.userId) uids.add(entry.userId);
  return [...uids];
}

export interface GrantAllResult {
  total: number;
  granted: number;
  /** 초대권 칸이 없거나 이미 상한인 사람. */
  skipped: number;
  failed: number;
  stopped: boolean;
}

// 앱과 같이 20명씩 동시에 — 한 명씩이면 사용자 수만큼 왕복이 쌓인다.
const CHUNK = 20;

export async function grantInvitesAll(
  db: Db,
  uids: string[],
  count: number,
  opts: { onProgress?: (done: number, total: number) => void; shouldStop?: () => boolean } = {},
): Promise<GrantAllResult> {
  if (!isGrantCount(count)) throw new Error(`지급 장수가 범위를 벗어났어요: ${count}`);
  const result: GrantAllResult = { total: uids.length, granted: 0, skipped: 0, failed: 0, stopped: false };
  let done = 0;
  for (let i = 0; i < uids.length; i += CHUNK) {
    if (opts.shouldStop?.()) {
      result.stopped = true;
      break;
    }
    await Promise.all(
      uids.slice(i, i + CHUNK).map(async (uid) => {
        try {
          const r = await grantInvites(db, uid, count);
          if (r.ok) result.granted++;
          else result.skipped++;
        } catch {
          result.failed++;
        }
        opts.onProgress?.(++done, uids.length);
      }),
    );
  }
  return result;
}

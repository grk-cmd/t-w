import {
  addInvitesLeft,
  createInviteCode,
  INVITE_CODE_MAX,
  isGrantCount,
  type AddInvitesResult,
} from '@/entities/invite';
import { auditAfter, type Db } from '@/shared/api';

export type GrantInvitesResult = AddInvitesResult;

function addInvites(db: Db, uid: string, count: number): Promise<GrantInvitesResult> {
  if (!isGrantCount(count)) return Promise.reject(new Error(`지급 장수가 범위를 벗어났어요: ${count}`));
  return addInvitesLeft(db, uid, count);
}

/**
 * 한 사람의 초대권에 count 장을 더한다(999 에서 자름).
 * 칸이 없는 사람은 쓰지 않는다 — 규칙이 새 칸을 0 으로만 받아 어차피 거부되고, 앱 전체 지급도 이들을 뺀다.
 * 트랜잭션이라 기록은 묶지 못하고 지급된 뒤 따로 남긴다.
 */
export async function grantInvites(db: Db, uid: string, count: number): Promise<GrantInvitesResult> {
  const r = await addInvites(db, uid, count);
  if (r.ok) await auditAfter(db, 'invite.grant', uid, `+${count} → ${r.after}장`);
  return r;
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

/** 여러 명 지급의 범위 — 기록에서 «선택» 과 «전체» 를 가른다. */
export type GrantScope = 'selected' | 'all';

export async function grantInvitesAll(
  db: Db,
  uids: string[],
  count: number,
  opts: {
    onProgress?: (done: number, total: number) => void;
    shouldStop?: () => boolean;
    scope?: GrantScope;
  } = {},
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
          const r = await addInvites(db, uid, count);
          if (r.ok) result.granted++;
          else result.skipped++;
        } catch {
          result.failed++;
        }
        opts.onProgress?.(++done, uids.length);
      }),
    );
  }
  // 사람마다가 아니라 한 번에 한 줄 — 몇 명에게 갔는지만.
  if (result.granted)
    await auditAfter(
      db,
      opts.scope === 'all' ? 'invite.grantAll' : 'invite.grantSelected',
      `${result.total}명`,
      `+${count} · 지급 ${result.granted} · 건너뜀 ${result.skipped} · 실패 ${result.failed}` +
        (result.stopped ? ' · 중간에 멈춤' : ''),
    );
  return result;
}

/**
 * 초대 코드 n 개 — 하나씩 차례로(겹침 확인이 코드마다 따로라 묶음으로 쓸 수 없다).
 * 중간에 실패해도 이미 만든 코드는 살아 있으니 onCode 로 하나씩 알려 화면에서 잃지 않게 한다.
 */
export async function createInviteCodes(
  db: Db,
  n: number,
  onCode?: (code: string) => void,
): Promise<string[]> {
  if (!Number.isInteger(n) || n < 1 || n > INVITE_CODE_MAX)
    throw new Error(`만들 개수가 범위를 벗어났어요: ${n}`);
  const codes: string[] = [];
  try {
    for (let i = 0; i < n; i++) {
      const code = await createInviteCode(db);
      codes.push(code);
      onCode?.(code);
    }
  } finally {
    // 중간에 멈춰도 만든 만큼은 남긴다. 코드 자체는 가입 열쇠라 기록에 적지 않는다.
    if (codes.length) await auditAfter(db, 'invite.codes', `${codes.length}개`);
  }
  return codes;
}

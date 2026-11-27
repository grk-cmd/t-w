// Firebase 판 — 지금 코드 그대로: 초대권 지급 · 회수 · 초대 코드 만들기를 클라이언트가 RTDB 에 직접 쓴다(트랜잭션).
import type { QueryClient } from '@tanstack/react-query';
import {
  addInvitesLeft,
  clearInvitesLeft,
  createGroupInvite,
  createInviteCode,
  INVITE_CODE_MAX,
  isGrantCount,
  lastDay,
  type AddInvitesResult,
  type GroupInvite,
  type GroupInviteDraft,
} from '@/entities/invite';
import { listFriendCodes } from '@/entities/user';
import { auditAfter, withAudit, type Db } from '@/shared/api';
import {
  uniqueUserIds,
  type BatchOpts,
  type GrantAllResult,
  type RevokeAllResult,
} from '../model/grantInvites';
import type { GrantInvitesPort } from './port';

/** 이 판은 모든 칸을 센다 — `null` 이 없다. */
type Counted<T> = { [K in keyof T]-?: NonNullable<T[K]> };

function addInvites(db: Db, uid: string, count: number): Promise<AddInvitesResult> {
  if (!isGrantCount(count)) return Promise.reject(new Error(`지급 장수가 범위를 벗어났어요: ${count}`));
  return addInvitesLeft(db, uid, count);
}

/**
 * 한 사람의 초대권에 count 장을 더한다(999 에서 자름).
 * 칸이 없는 사람은 쓰지 않는다 — 규칙이 새 칸을 0 으로만 받아 어차피 거부되고, 앱 전체 지급도 이들을 뺀다.
 * 트랜잭션이라 기록은 묶지 못하고 지급된 뒤 따로 남긴다.
 */
export async function grantInvites(db: Db, uid: string, count: number): Promise<AddInvitesResult> {
  const r = await addInvites(db, uid, count);
  if (r.ok) await auditAfter(db, 'invite.grant', uid, `+${count} → ${r.after}장`);
  return r;
}

// 앱과 같이 20명씩 동시에 — 한 명씩이면 사용자 수만큼 왕복이 쌓인다.
const CHUNK = 20;

/** CHUNK 명씩 동시에 one 을 돌린다. 멈추면 다음 묶음부터 서고, 멈췄는지를 돌려준다. */
async function runChunked(
  uids: string[],
  one: (uid: string) => Promise<void>,
  opts: BatchOpts,
): Promise<boolean> {
  let done = 0;
  for (let i = 0; i < uids.length; i += CHUNK) {
    if (opts.shouldStop?.()) return true;
    await Promise.all(
      uids.slice(i, i + CHUNK).map(async (uid) => {
        await one(uid);
        opts.onProgress?.(++done, uids.length);
      }),
    );
  }
  return false;
}

export async function grantInvitesAll(
  db: Db,
  uids: string[],
  count: number,
  opts: BatchOpts = {},
): Promise<Counted<GrantAllResult>> {
  if (!isGrantCount(count)) throw new Error(`지급 장수가 범위를 벗어났어요: ${count}`);
  const result: Counted<GrantAllResult> = {
    total: uids.length,
    granted: 0,
    skipped: 0,
    failed: 0,
    stopped: false,
  };
  result.stopped = await runChunked(
    uids,
    async (uid) => {
      try {
        const r = await addInvites(db, uid, count);
        if (r.ok) result.granted++;
        else result.skipped++;
      } catch {
        result.failed++;
      }
    },
    opts,
  );
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

/** 여러 명의 남은 초대권을 0 장으로 — 지급과 같이 20명씩 동시에, 기록은 끝나고 한 줄. */
export async function revokeInvitesAll(
  db: Db,
  uids: string[],
  opts: BatchOpts = {},
): Promise<Counted<RevokeAllResult>> {
  const result: Counted<RevokeAllResult> = {
    total: uids.length,
    revoked: 0,
    taken: 0,
    skipped: 0,
    failed: 0,
    stopped: false,
  };
  result.stopped = await runChunked(
    uids,
    async (uid) => {
      try {
        const r = await clearInvitesLeft(db, uid);
        if (r.ok) {
          result.revoked++;
          result.taken += r.before;
        } else result.skipped++;
      } catch {
        result.failed++;
      }
    },
    opts,
  );
  if (result.revoked)
    await auditAfter(
      db,
      opts.scope === 'all' ? 'invite.revokeAll' : 'invite.revokeSelected',
      `${result.total}명`,
      `→ 0장 · 회수 ${result.revoked}명(${result.taken}장) · 건너뜀 ${result.skipped} · 실패 ${result.failed}` +
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

// 기록 대상 칸 — 코드는 가입 열쇠라 적지 않고 관리자가 붙인 메모로 가른다.
const targetOf = (note: string) => note.trim() || '메모 없음';

/** 만들기는 트랜잭션이라 기록을 묶지 못하고 만든 뒤 따로 남긴다. */
export async function createGroupInviteCode(db: Db, draft: GroupInviteDraft): Promise<string> {
  const code = await createGroupInvite(db, draft);
  const until = draft.expiresAt !== null ? ` · ${lastDay(draft.expiresAt)}까지` : '';
  await auditAfter(db, 'invite.groupCreate', targetOf(draft.note), `${draft.maxUses}명${until}`);
  return code;
}

/** 중지 · 다시 열기 — 앱이 다음 소진부터 바로 따른다(규칙이 stoppedAt 을 본다). 이미 들어온 사람은 그대로. */
export function setGroupInviteStopped(db: Db, invite: GroupInvite, stop: boolean): Promise<void> {
  return db.commit(
    withAudit(
      db,
      { [`groupInvites/${invite.code}/stoppedAt`]: stop ? db.now() : null },
      stop ? 'invite.groupStop' : 'invite.groupResume',
      targetOf(invite.note),
      `${invite.usedCount}/${invite.maxUses}명`,
    ),
  );
}

/** 전체 대상(사용자코드) — friendCodes 를 통째로 받는다. 이미 받아 둔 캐시가 있으면 그대로 쓴다. */
async function loadAllUserIds(db: Db, client: QueryClient): Promise<string[]> {
  return uniqueUserIds(
    await client.fetchQuery({
      queryKey: ['friendCodes'],
      queryFn: () => listFriendCodes(db),
      staleTime: Infinity,
    }),
  );
}

export function createFirebaseGrantInvitesPort(db: Db, client: QueryClient): GrantInvitesPort {
  return {
    grantOne: (uid, count) => grantInvites(db, uid, count),
    // 대상은 단추를 눌렀을 때만 받는다(friendCodes 통째) — 화면을 열기만 해서 받지 않게.
    countAll: async () => (await loadAllUserIds(db, client)).length,
    async grant(target, count, opts = {}) {
      const uids = target.kind === 'all' ? await loadAllUserIds(db, client) : target.uids;
      opts.onProgress?.(0, uids.length);
      return grantInvitesAll(db, uids, count, { ...opts, scope: target.kind === 'all' ? 'all' : 'selected' });
    },
    async revoke(target, opts = {}) {
      const uids = target.kind === 'all' ? await loadAllUserIds(db, client) : target.uids;
      opts.onProgress?.(0, uids.length);
      return revokeInvitesAll(db, uids, { ...opts, scope: target.kind === 'all' ? 'all' : 'selected' });
    },
    createCodes: (n, onCode) => createInviteCodes(db, n, onCode),
    createGroup: (draft) => createGroupInviteCode(db, draft),
    setGroupStopped: (invite, stop) => setGroupInviteStopped(db, invite, stop),
  };
}

import { createGroupInvite, lastDay, type GroupInvite, type GroupInviteDraft } from '@/entities/invite';
import { auditAfter, withAudit, type Db } from '@/shared/api';

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

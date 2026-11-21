import { checkEdit, editChanges, editWrite, getBugPost, type EditInput } from '@/entities/bug-board';
import { withAudit, type Db } from '@/shared/api';

export type EditResult = { ok: true } | { ok: false; reason: string };

/**
 * 제목 · 본문 · 분류 · 공개 범위 수정 + 작업 기록을 한 묶음으로.
 * 글은 쓰기 직전에 다시 읽는다 — 공개 범위를 옮길 때 내용 · 공개 답변을 빠짐없이 옮기려고.
 * 기록엔 번호(label)와 바뀐 칸 이름만 — 제목 · 본문 글자는 남기지 않는다.
 */
export async function editPost(db: Db, id: string, input: EditInput, label: string): Promise<EditResult> {
  const post = await getBugPost(db, id);
  if (!post) return { ok: false, reason: '글 없음 — 삭제됐을 수 있음' };
  const bad = checkEdit(post.item, input);
  if (bad) return { ok: false, reason: bad };
  const changes = editChanges(post.item, post.content, input);
  if (!changes.length) return { ok: false, reason: '바뀐 것 없음' };
  const updates = editWrite(post.item, post.content, post.answers, input);
  await db.commit(withAudit(db, updates, 'bug.edit', label, changes.join(' · ')));
  return { ok: true };
}

/** 확인 문구 — 공개 → 비공개면 이미 보낸 우편함 알림 속 제목은 남는다는 것까지. */
export function editAsk(label: string, changes: string[], toPrivate: boolean): string {
  const tail = toPrivate
    ? '\n공개 답변도 비공개로 옮겨요. 이미 보낸 우편함 알림 속 제목은 그대로 남아요.'
    : '';
  return `${label} 제보를 고칠까요? (${changes.join(' · ')})${tail}`;
}

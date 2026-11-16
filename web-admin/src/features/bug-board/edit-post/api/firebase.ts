// Firebase 판 — 지금 코드 그대로: 글을 쓰기 직전에 다시 읽어 내용 · 공개 답변을 옮기며 한 묶음으로 쓴다 + 작업 기록.
import { checkEdit, editChanges, editWrite, getBugPost, type EditInput } from '@/entities/bug-board';
import { withAudit, type Db } from '@/shared/api';
import type { EditResult } from '../model/editPost';
import type { EditPostPort } from './port';

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

export function createFirebaseEditPostPort(db: Db): EditPostPort {
  return {
    check: (item, input) => checkEdit(item, input),
    edit: (item, _content, input, label) => editPost(db, item.id, input, label),
  };
}

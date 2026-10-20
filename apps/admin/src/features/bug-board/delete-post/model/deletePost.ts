import { deleteWrite, type BugItem } from '@/entities/bug-board';
import { withAudit, type Db } from '@/shared/api';

/**
 * 제보 지우기 — 목록 줄 · 내용 · 답변 · 공감 + 작업 기록을 한 묶음으로.
 * 기록 대상은 번호(label)만 — 비공개 글 제목은 기록에 남기지 않는다.
 */
export function deletePost(db: Db, item: BugItem, label: string): Promise<void> {
  return db.commit(withAudit(db, deleteWrite(item), 'bug.delete', label));
}

/** 확인 문구 */
export const deleteAsk = (label: string) =>
  `${label} 제보를 지울까요? 본문 · 답변 · 공감까지 모두 지워지고 되돌릴 수 없어요.`;

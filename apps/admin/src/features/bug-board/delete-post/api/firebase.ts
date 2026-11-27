// Firebase 판 — 지금 코드 그대로: 목록 줄 · 내용 · 답변 · 공감 + 작업 기록을 한 묶음으로 지운다.
import { deleteWrite, type BugItem } from '@/entities/bug-board';
import { withAudit, type Db } from '@/shared/api';
import type { DeletePostPort } from './port';

/**
 * 제보 지우기 — 목록 줄 · 내용 · 답변 · 공감 + 작업 기록을 한 묶음으로.
 * 기록 대상은 번호(label)만 — 비공개 글 제목은 기록에 남기지 않는다.
 */
export function deletePost(db: Db, item: BugItem, label: string): Promise<void> {
  return db.commit(withAudit(db, deleteWrite(item), 'bug.delete', label));
}

export function createFirebaseDeletePostPort(db: Db): DeletePostPort {
  return { remove: (item, label) => deletePost(db, item, label) };
}

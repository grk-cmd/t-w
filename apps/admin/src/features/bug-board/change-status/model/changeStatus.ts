import { BUG_STATUS, statusWrite, type BugItem, type BugStatus } from '@/entities/bug-board';
import { withAudit, type Db } from '@/shared/api';

/** 답변 없이 상태만 — openTs(미해결 목록용 칸)도 같은 묶음으로 맞춘다. */
export function changeStatus(db: Db, item: BugItem, status: BugStatus, label: string): Promise<void> {
  const detail = `${BUG_STATUS[item.status]} → ${BUG_STATUS[status]}`;
  return db.commit(withAudit(db, statusWrite(item, status), 'bug.status', label, detail));
}

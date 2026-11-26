// Firebase 판 — 지금 코드 그대로: 상태 · openTs(미해결 목록용 칸) · 작업 기록을 한 묶음으로 RTDB 에 쓴다.
import { BUG_STATUS, statusWrite, type BugItem, type BugStatus } from '@/entities/bug-board';
import { withAudit, type Db } from '@/shared/api';
import type { ChangeStatusPort } from './port';

/** 답변 없이 상태만 — openTs(미해결 목록용 칸)도 같은 묶음으로 맞춘다. */
export function changeStatus(db: Db, item: BugItem, status: BugStatus, label: string): Promise<void> {
  const detail = `${BUG_STATUS[item.status]} → ${BUG_STATUS[status]}`;
  return db.commit(withAudit(db, statusWrite(item, status), 'bug.status', label, detail));
}

export function createFirebaseChangeStatusPort(db: Db): ChangeStatusPort {
  return { change: (item, status, label) => changeStatus(db, item, status, label) };
}

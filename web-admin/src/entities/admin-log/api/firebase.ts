// Firebase 판 — 지금 코드 그대로: 작업 기록(auditLog)에서 최근 n 개를 읽는다.
import { AUDIT_ROOT, type AuditRecord, type Db } from '@/shared/api';
import { FIREBASE_LOG_GROUPS, toLogEntries } from '../model/adminLog';
import type { AdminLogPage, AdminLogPort } from './port';

/** 최근 n 개만 — 통째로 받지 않는다(규칙 .indexOn ["at"]). */
export async function listAdminLog(db: Db, n: number): Promise<AdminLogPage> {
  const recent = await db.getLast<Partial<AuditRecord>>(AUDIT_ROOT, 'at', n);
  return { items: toLogEntries(recent), hasMore: Object.keys(recent).length >= n };
}

export function createFirebaseAdminLogPort(db: Db): AdminLogPort {
  return { groups: FIREBASE_LOG_GROUPS, list: (n) => listAdminLog(db, n) };
}

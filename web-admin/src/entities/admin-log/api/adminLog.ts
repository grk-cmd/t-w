import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { AUDIT_ROOT, useDb, type AuditRecord, type Db } from '@/shared/api';
import { toLogEntries, type AdminLogEntry } from '../model/adminLog';

const ADMIN_LOG_KEY = ['adminLog'];

export interface AdminLogPage {
  items: AdminLogEntry[];
  /** 최근 n 개를 꽉 채워 받았다 — 더 오래된 기록이 남아 있을 수 있다. */
  hasMore: boolean;
}

/** 최근 n 개만 — 통째로 받지 않는다(규칙 .indexOn ["at"]). */
export async function listAdminLog(db: Db, n: number): Promise<AdminLogPage> {
  const recent = await db.getLast<Partial<AuditRecord>>(AUDIT_ROOT, 'at', n);
  return { items: toLogEntries(recent), hasMore: Object.keys(recent).length >= n };
}

// 메뉴를 열 때마다 최근 것을 한 번 받는다(다른 메뉴에서 한 동작이 바로 보이게). 그 밖엔 새로고침 · 뒤쪽으로 갈 때만.
export function useAdminLog(n: number) {
  const db = useDb();
  return useQuery({
    queryKey: [...ADMIN_LOG_KEY, n],
    queryFn: () => listAdminLog(db, n),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

export function useRefreshAdminLog() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ADMIN_LOG_KEY });
}

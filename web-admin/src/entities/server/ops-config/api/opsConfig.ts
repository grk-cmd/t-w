import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, withAudit, type AuditAction, type Db } from '@/shared/api';
import {
  API_CORS_PATH,
  intGroupDetail,
  LOG_LEVEL_PATH,
  LOG_TARGETS,
  parseCorsOrigins,
  parseIntGroup,
  parseLogLevels,
  type IntGroup,
  type IntValues,
  type LogLevel,
  type LogLevels,
  type LogTarget,
} from '../model/opsConfig';

const OPS_KEY = ['opsConfig'];

/** 정수 칸 묶음 — 그 노드 하나만 읽는다(config 통째 읽기 없음). */
export async function getIntGroup(db: Db, group: IntGroup): Promise<IntValues> {
  return parseIntGroup(group, await db.get<unknown>(group.path));
}

export function useIntGroup(group: IntGroup) {
  const db = useDb();
  return useQuery({ queryKey: [...OPS_KEY, group.path], queryFn: () => getIntGroup(db, group) });
}

export async function getLogLevels(db: Db): Promise<LogLevels> {
  return parseLogLevels(await db.get<unknown>(LOG_LEVEL_PATH));
}

export function useLogLevels() {
  const db = useDb();
  return useQuery({ queryKey: [...OPS_KEY, LOG_LEVEL_PATH], queryFn: () => getLogLevels(db) });
}

export async function getCorsOrigins(db: Db): Promise<string[]> {
  return parseCorsOrigins(await db.get<unknown>(API_CORS_PATH));
}

export function useCorsOrigins() {
  const db = useDb();
  return useQuery({ queryKey: [...OPS_KEY, API_CORS_PATH], queryFn: () => getCorsOrigins(db) });
}

export function useRefreshOpsConfig() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: OPS_KEY });
}

/** 바뀐 칸 + 작업 기록 한 묶음. 바뀐 게 없으면 쓰지 않는다. */
export function saveIntGroup(
  db: Db,
  group: IntGroup,
  action: AuditAction,
  target: string,
  before: IntValues,
  updates: Record<string, number | null>,
): Promise<void> {
  if (!Object.keys(updates).length) return Promise.resolve();
  return db.commit(withAudit(db, updates, action, target, intGroupDetail(group, before, updates)));
}

/** 로그 수준 바뀐 칸만 — null 은 지움(= 서버 기본 info). */
export function logLevelChanges(
  before: LogLevels,
  next: Partial<Record<LogTarget, LogLevel | null>>,
): Record<string, LogLevel | null> {
  const updates: Record<string, LogLevel | null> = {};
  for (const { key } of LOG_TARGETS) {
    if (!(key in next)) continue;
    const v = next[key] ?? null;
    if ((before[key] ?? null) !== v) updates[`${LOG_LEVEL_PATH}/${key}`] = v;
  }
  return updates;
}

export function logLevelDetail(before: LogLevels, updates: Record<string, LogLevel | null>): string {
  return LOG_TARGETS.filter(({ key }) => `${LOG_LEVEL_PATH}/${key}` in updates)
    .map(({ key }) => `${key} ${before[key] ?? '기본'} → ${updates[`${LOG_LEVEL_PATH}/${key}`] ?? '기본'}`)
    .join(' · ');
}

export function saveLogLevels(
  db: Db,
  before: LogLevels,
  updates: Record<string, LogLevel | null>,
): Promise<void> {
  if (!Object.keys(updates).length) return Promise.resolve();
  return db.commit(withAudit(db, updates, 'settings.logLevel', '로그 수준', logLevelDetail(before, updates)));
}

/** 출처 목록을 통째로 쓴다(0..n-1 키) — 빈 목록이면 지운다(= 서버 env 기본). */
export function saveCorsOrigins(db: Db, before: string[], next: string[]): Promise<void> {
  const added = next.filter((o) => !before.includes(o));
  const removed = before.filter((o) => !next.includes(o));
  const detail = [
    added.length ? `+${added.map((o) => o.replace('https://', '')).join(', ')}` : '',
    removed.length ? `-${removed.map((o) => o.replace('https://', '')).join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return db.commit(
    withAudit(
      db,
      { [API_CORS_PATH]: next.length ? next : null },
      'settings.apiCors',
      `CORS 출처 ${next.length}개`,
      detail || '순서만 바뀜',
    ),
  );
}

// Firebase 판 — 지금 코드 그대로: config/ 아래 운영 설정(정수 묶음 · 로그 수준 · CORS 출처)을 읽고 쓴다.
import { withAudit, type AuditAction, type Db } from '@/shared/api';
import {
  API_CORS_PATH,
  intGroupDetail,
  logLevelDetail,
  LOG_LEVEL_PATH,
  parseCorsOrigins,
  parseIntGroup,
  parseLogLevels,
  type IntGroup,
  type IntValues,
  type LogLevel,
  type LogLevels,
} from '../model/opsConfig';
import type { OpsConfigPort } from './port';

/** 정수 칸 묶음 — 그 노드 하나만 읽는다(config 통째 읽기 없음). */
export async function getIntGroup(db: Db, group: IntGroup): Promise<IntValues> {
  return parseIntGroup(group, await db.get<unknown>(group.path));
}

export async function getLogLevels(db: Db): Promise<LogLevels> {
  return parseLogLevels(await db.get<unknown>(LOG_LEVEL_PATH));
}

export async function getCorsOrigins(db: Db): Promise<string[]> {
  return parseCorsOrigins(await db.get<unknown>(API_CORS_PATH));
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

export function createFirebaseOpsConfigPort(db: Db): OpsConfigPort {
  return {
    getIntGroup: (group) => getIntGroup(db, group),
    getLogLevels: () => getLogLevels(db),
    getCorsOrigins: () => getCorsOrigins(db),
    saveIntGroup: (group, action, target, before, updates) =>
      saveIntGroup(db, group, action, target, before, updates),
    saveLogLevels: (before, updates) => saveLogLevels(db, before, updates),
    saveCorsOrigins: (before, next) => saveCorsOrigins(db, before, next),
  };
}

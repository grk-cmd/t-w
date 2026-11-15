// Firebase 판 — 지금 코드 그대로: metrics/usage/{날짜} · metrics/improvements 를 읽고 쓴다.
import { withAudit, type Db } from '@/shared/api';
import {
  cleanDraft,
  draftProblem,
  METRICS_IMPROVEMENTS,
  toImprovements,
  type Improvement,
  type ImprovementDraft,
} from '../model/improvement';
import { METRICS_USAGE, toDayUsage, type DayUsage } from '../model/usage';
import type { UsagePort } from './port';

/** 하루치 — 날짜 노드 하나(무리 넷 · 수백 바이트). metrics/usage 를 통째로 받지 않는다. */
export async function getDayUsage(db: Db, date: string): Promise<DayUsage> {
  return toDayUsage(date, await db.get<unknown>(`${METRICS_USAGE}/${date}`));
}

/** 기록 전부 — 릴리스마다 한 칸(수백 바이트)이라 통째로 받는다. */
export async function getImprovements(db: Db): Promise<Improvement[]> {
  return toImprovements(await db.get<Record<string, unknown>>(METRICS_IMPROVEMENTS));
}

const newId = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/**
 * 새로 적거나(id 없음) 고친다 — 칸 하나를 통째로 바꾼다(빠진 칸이 남지 않게). 작업 기록과 한 묶음.
 * 규칙이 받지 않을 값이면 쓰지 않고 던진다. 쓴 id 를 돌려준다.
 */
export async function saveImprovement(
  db: Db,
  draft: ImprovementDraft,
  id?: string,
  makeId: () => string = newId,
): Promise<string> {
  const d = cleanDraft(draft);
  const problem = draftProblem(d);
  if (problem) throw new Error(problem);
  const key = id ?? makeId();
  const updates = { [`${METRICS_IMPROVEMENTS}/${key}`]: d };
  await db.commit(withAudit(db, updates, id ? 'improvements.edit' : 'improvements.add', d.version, d.title));
  return key;
}

export function deleteImprovement(db: Db, entry: Improvement): Promise<void> {
  const updates = { [`${METRICS_IMPROVEMENTS}/${entry.id}`]: null };
  return db.commit(withAudit(db, updates, 'improvements.delete', entry.version, entry.title));
}

export function createFirebaseUsagePort(db: Db): UsagePort {
  return {
    features: { db: true, functions: true },
    getDay: (date) => getDayUsage(db, date),
    serverTimeOffset: () => db.serverTimeOffset(),
    listImprovements: () => getImprovements(db),
    saveImprovement: (draft, id) => saveImprovement(db, draft, id),
    deleteImprovement: (entry) => deleteImprovement(db, entry),
  };
}

// Firebase 판 — 지금 코드 그대로: metrics/usage/{날짜} 를 읽는다.
import type { Db } from '@/shared/api';
import { METRICS_USAGE, toDayUsage, type DayUsage } from '../model/usage';
import type { UsagePort } from './port';

/** 하루치 — 날짜 노드 하나(무리 넷 · 수백 바이트). metrics/usage 를 통째로 받지 않는다. */
export async function getDayUsage(db: Db, date: string): Promise<DayUsage> {
  return toDayUsage(date, await db.get<unknown>(`${METRICS_USAGE}/${date}`));
}

export function createFirebaseUsagePort(db: Db): UsagePort {
  return {
    features: { db: true, functions: true },
    getDay: (date) => getDayUsage(db, date),
    serverTimeOffset: () => db.serverTimeOffset(),
  };
}

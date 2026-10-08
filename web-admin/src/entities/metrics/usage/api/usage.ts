import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';
import { kstDateKey, lastDateKeys } from '@/shared/lib';
import { METRICS_USAGE, toDayUsage, USAGE_DAYS, type DayUsage } from '../model/usage';

const DAY_KEY = ['usage', 'day'];
const NOW_KEY = ['usage', 'serverNow'];
// 서버가 매시간 어제 · 오늘을 다시 적는다 — 둘만 몇 분 뒤 다시 받고, 그 전 날은 한 번 받으면 그대로 둔다.
const RECENT_STALE_MS = 5 * 60 * 1000;

/** 하루치 — 날짜 노드 하나(무리 넷 · 수백 바이트). metrics/usage 를 통째로 받지 않는다. */
export async function getDayUsage(db: Db, date: string): Promise<DayUsage> {
  return toDayUsage(date, await db.get<unknown>(`${METRICS_USAGE}/${date}`));
}

/** 받을 날 수 — 최근 days 일, 이번 달 1일이 그보다 앞이면(31일 달의 31일) 1일까지. */
export function usageDayCount(nowMs: number, days: number = USAGE_DAYS): number {
  return Math.max(days, Number(kstDateKey(nowMs).slice(8, 10)));
}

/**
 * 최근 days 일 · 이번 달 1일부터 중 긴 쪽(서울 날짜 · 오래된 날 → 오늘). 날마다 따로 캐시해 새로고침은 어제 · 오늘만 다시 받는다.
 * «오늘» 은 받은 시점의 서버 기준 시각으로 정한다.
 */
export function useRecentUsage(days: number = USAGE_DAYS) {
  const db = useDb();
  const now = useQuery({
    queryKey: NOW_KEY,
    queryFn: async () => Date.now() + (await db.serverTimeOffset()),
  });
  const dates = now.data === undefined ? [] : lastDateKeys(now.data, usageDayCount(now.data, days));
  const recent = new Set(dates.slice(-2));
  return useQueries({
    queries: dates.map((date) => ({
      queryKey: [...DAY_KEY, date],
      queryFn: () => getDayUsage(db, date),
      staleTime: recent.has(date) ? RECENT_STALE_MS : Infinity,
    })),
    combine: (results) => ({
      data:
        dates.length > 0 && results.every((r) => r.data) ? results.map((r) => r.data as DayUsage) : undefined,
      now: now.data,
      error: now.error ?? results.find((r) => r.error)?.error ?? null,
      fetching: now.isFetching || results.some((r) => r.isFetching),
    }),
  });
}

/** 어제 · 오늘 칸만 다시 받는다(날이 넘어갔으면 새 날짜 칸을 받는다) — 그 전 날은 그대로. */
export function useRefreshRecentUsage() {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries({ queryKey: NOW_KEY });
    const now = client.getQueryData<number>(NOW_KEY);
    if (now === undefined) return;
    for (const date of lastDateKeys(now, 2)) await client.invalidateQueries({ queryKey: [...DAY_KEY, date] });
  };
}

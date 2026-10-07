import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';
import { lastDateKeys, METRICS_DAILY, METRICS_DAYS, toVisits, type DayMetrics } from '../model/metrics';

const DAY_KEY = ['metrics', 'day'];
const NOW_KEY = ['metrics', 'serverNow'];
// 오늘 칸만 쌓이는 중이라 몇 분 뒤 다시 받는다. 지난날은 더 바뀌지 않아 한 번 받으면 그대로 둔다.
const TODAY_STALE_MS = 5 * 60 * 1000;

/** 하루치 — 사용자 코드는 키만(shallow), 방문 수는 숫자 한 칸. 기록이 없는 날은 빈 값. */
export async function getDayMetrics(db: Db, date: string): Promise<DayMetrics> {
  const base = `${METRICS_DAILY}/${date}`;
  const [users, visits] = await Promise.all([db.shallowKeys(`${base}/u`), db.get<unknown>(`${base}/visits`)]);
  return { date, users, visits: toVisits(visits) };
}

export function getRecentMetrics(db: Db, dates: readonly string[]): Promise<DayMetrics[]> {
  return Promise.all(dates.map((date) => getDayMetrics(db, date)));
}

/**
 * 최근 days 일(서울 날짜 · 오래된 날 → 오늘). 날마다 따로 캐시해 새로고침은 오늘 칸만 다시 받는다.
 * «오늘» 은 받은 시점의 서버 기준 시각으로 정한다 — 자정을 넘겨 열어 둔 화면은 새로고침해야 날이 넘어간다.
 */
export function useRecentMetrics(days: number = METRICS_DAYS) {
  const db = useDb();
  const now = useQuery({
    queryKey: NOW_KEY,
    queryFn: async () => Date.now() + (await db.serverTimeOffset()),
  });
  const dates = now.data === undefined ? [] : lastDateKeys(now.data, days);
  const today = dates.length ? dates[dates.length - 1] : null;
  return useQueries({
    queries: dates.map((date) => ({
      queryKey: [...DAY_KEY, date],
      queryFn: () => getDayMetrics(db, date),
      staleTime: date === today ? TODAY_STALE_MS : Infinity,
    })),
    combine: (results) => ({
      data:
        dates.length > 0 && results.every((r) => r.data)
          ? results.map((r) => r.data as DayMetrics)
          : undefined,
      error: now.error ?? results.find((r) => r.error)?.error ?? null,
      fetching: now.isFetching || results.some((r) => r.isFetching),
    }),
  });
}

/** 오늘 칸만 다시 받는다(날이 넘어갔으면 새 날짜 칸을 받는다) — 지난날은 그대로. */
export function useRefreshTodayMetrics() {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries({ queryKey: NOW_KEY });
    const now = client.getQueryData<number>(NOW_KEY);
    if (now !== undefined)
      await client.invalidateQueries({ queryKey: [...DAY_KEY, ...lastDateKeys(now, 1)] });
  };
}

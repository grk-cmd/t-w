import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import type { KeysetPage } from '@/shared/lib';
import type { ReportTarget } from '../model/report';
import { REPORTS_KEY, userReportCountKey } from './keys';
import { useReportPort } from './index';

/** 서버 한 번에 받는 상한(`limit` 1~100). */
const PAGE_MAX = 100;

/** 통째로 받는 판(`kind: 'all'` — Firebase). */
export function useReports() {
  const port = useReportPort();
  return useQuery({
    queryKey: [...REPORTS_KEY, 'all'],
    queryFn: () => {
      if (port.kind !== 'all') throw new Error('이 판은 신고 목록을 쪽으로 받아요');
      return port.targets();
    },
  });
}

/** 쪽으로 받는 판(`kind: 'keyset'` — API). 이어 붙이기 · 쪽 넘기기는 `useKeysetPaging` 이 한다. */
export function useReportsKeyset() {
  const port = useReportPort();
  return useInfiniteQuery({
    queryKey: [...REPORTS_KEY, 'keyset'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      if (port.kind !== 'keyset') throw new Error('이 판은 신고 목록을 통째로 받아요');
      return port.page(pageParam, PAGE_MAX);
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useRefreshReports() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: REPORTS_KEY });
}

export function useUserReportCount(uid: string) {
  const port = useReportPort();
  return useQuery({ queryKey: userReportCountKey(uid), queryFn: () => port.countFor(uid) });
}

/** 비운 사람을 캐시에서만 뺀다 — 목록을 다시 받지 않아도 된다. */
export function useForgetReports() {
  const client = useQueryClient();
  return (target: string) => {
    client.setQueryData<ReportTarget[]>([...REPORTS_KEY, 'all'], (all) =>
      all?.filter((t) => t.target !== target),
    );
    client.setQueryData<{ pages: KeysetPage<ReportTarget>[]; pageParams: unknown[] }>(
      [...REPORTS_KEY, 'keyset'],
      (data) =>
        data && {
          ...data,
          pages: data.pages.map((p) => ({ ...p, items: p.items.filter((t) => t.target !== target) })),
        },
    );
  };
}

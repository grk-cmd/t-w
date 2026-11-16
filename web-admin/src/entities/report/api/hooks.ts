import { useInfiniteQuery, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { KEYSET_PAGE_MAX, resetKeyset } from '@/shared/lib';
import type { ReportTarget } from '../model/report';
import { REPORTS_KEY, REPORTS_KEYSET_KEY, userReportCountKey } from './keys';
import { useReportPort } from './index';

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
    queryKey: REPORTS_KEYSET_KEY,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      if (port.kind !== 'keyset') throw new Error('이 판은 신고 목록을 통째로 받아요');
      return port.page(pageParam, KEYSET_PAGE_MAX);
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

/**
 * 쓰기 뒤 — Firebase 판은 받아 둔 목록에서 그 사람들 줄만 뺀다. API 판은 이어 둔 쪽을 버리고 첫 쪽부터 한 번 다시 받는다
 * (줄만 빼면 첫 쪽 `total` · 끝 쪽 번호가 틀린 채로 남는다). 여러 명을 한꺼번에 처리해도 다시 받기는 한 번.
 */
export function forgetReports(client: QueryClient, targets: readonly string[]): void {
  if (!targets.length) return;
  const gone = new Set(targets);
  client.setQueryData<ReportTarget[]>([...REPORTS_KEY, 'all'], (all) =>
    all?.filter((t) => !gone.has(t.target)),
  );
  void resetKeyset(client, REPORTS_KEYSET_KEY);
}

export function useForgetReports() {
  const client = useQueryClient();
  return (targets: readonly string[]) => forgetReports(client, targets);
}

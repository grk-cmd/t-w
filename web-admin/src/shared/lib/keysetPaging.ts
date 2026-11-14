import { useEffect } from 'react';
import type { InfiniteData, QueryClient, QueryKey, UseInfiniteQueryResult } from '@tanstack/react-query';
import { usePaging, type Paging } from './paging';

/** 서버 목록의 한 쪽 — 키셋(`cursor` · `limit` · `nextCursor`). `total` 은 첫 쪽에만 오는 목록이 있다. */
export interface KeysetPage<T> {
  items: T[];
  nextCursor?: string | null;
  total?: number | null;
}

export interface KeysetView<T> {
  /** 받은 쪽을 이어 붙인 것. */
  items: T[];
  /** 뒤에 더 있다(`nextCursor` 가 있다). */
  more: boolean;
  /** 첫 쪽이 준 전체 수. 안 주는 목록은 null. */
  total: number | null;
}

/** 받은 쪽을 이어 붙인다. 전체 수는 첫 쪽 것만 믿는다(다음 쪽은 null). */
export function keysetView<T>(pages: readonly KeysetPage<T>[]): KeysetView<T> {
  const last = pages[pages.length - 1];
  const total = pages[0]?.total;
  return {
    items: pages.flatMap((p) => p.items),
    more: Boolean(last?.nextCursor),
    total: typeof total === 'number' ? total : null,
  };
}

/** 고른 쪽까지 보이려면 더 받아야 하나 — 먼 쪽으로 건너뛰면 그 쪽까지 이어 받는다. */
export function needsMore(loaded: number, wantPage: number, size: number, more: boolean): boolean {
  return more && loaded < wantPage * size;
}

export interface KeysetPaging<T> extends Paging<T> {
  /** `Pager` 의 `more` — 전체 수를 모를 때만(«총 N개+»). */
  more: boolean;
  /** 받아 둔 쪽 뒤를 받는 중. */
  fetchingMore: boolean;
}

/**
 * 키셋 목록(`useInfiniteQuery`)의 쪽 넘기기. 받은 것에서 화면 쪽을 자르고(`usePaging`),
 * 먼 쪽으로 건너뛰면 그 쪽까지 이어 받는다. 첫 쪽이 `total` 을 주면 «총 N개» · 끝 쪽 번호를 그대로 보인다.
 */
export function useKeysetPaging<T>(
  query: Pick<
    UseInfiniteQueryResult<InfiniteData<KeysetPage<T>>>,
    'data' | 'fetchNextPage' | 'hasNextPage' | 'isFetchingNextPage' | 'isError'
  >,
  listKey: string,
): KeysetPaging<T> {
  const view = keysetView(query.data?.pages ?? []);
  const paging = usePaging(view.items, listKey);
  const { fetchNextPage, isFetchingNextPage, isError } = query;
  const hasNext = query.hasNextPage;

  useEffect(() => {
    if (
      hasNext &&
      !isFetchingNextPage &&
      !isError &&
      needsMore(view.items.length, paging.want, paging.size, true)
    ) {
      void fetchNextPage();
    }
  }, [hasNext, isFetchingNextPage, isError, view.items.length, paging.want, paging.size, fetchNextPage]);

  if (view.total === null) {
    return { ...paging, more: hasNext, fetchingMore: isFetchingNextPage };
  }
  // 전체 수를 알면 아직 못 받은 쪽도 번호로 보인다 — 건너뛰면 위 효과가 그 쪽까지 받고, 그동안 받아 둔 끝 쪽을 보인다.
  const pageCount = Math.max(1, Math.ceil(view.total / paging.size));
  return {
    ...paging,
    pageCount,
    total: view.total,
    more: false,
    fetchingMore: isFetchingNextPage,
  };
}

/** 쓰기 뒤 — 이 목록을 첫 쪽부터 다시 받는다(옛 커서를 이어 쓰지 않는다). */
export function resetKeyset(client: QueryClient, queryKey: QueryKey): Promise<void> {
  return client.resetQueries({ queryKey });
}

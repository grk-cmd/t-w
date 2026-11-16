import {
  keepPreviousData,
  useInfiniteQuery,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { REPLICA_LAG_MS } from '@/shared/api';
import { kstDateKey } from '@/shared/lib';
import { bugDay, bugNo, type BugFilter, type BugItem, type BugListView, type BugNo } from '../model/bugBoard';
import { BUG_KEY, BUG_LIST_KEY } from './keys';

/** 서버 한 번에 받는 상한(관리자 `limit` 1~100). */
const PAGE_MAX = 100;
import type { BugListQuery } from './port';
import { useBugBoardPort } from './index';

/** 쪽 번호 · 커서로 한 쪽씩 받는 판(`kind: 'paged'` — Firebase). */
export function useBugList(query: BugListQuery) {
  const port = useBugBoardPort();
  const { filter, page, size, before } = query;
  return useQuery({
    queryKey: [...BUG_KEY, 'list', filter, page, size, before?.value ?? null, before?.key ?? null],
    queryFn: () => {
      if (port.kind !== 'paged') throw new Error('이 판은 제보 목록을 키셋으로 받아요');
      return port.list(query);
    },
    placeholderData: keepPreviousData,
  });
}

/** 서버 키셋을 쪽으로 받는 판(`kind: 'keyset'` — API). 이어 붙이기 · 쪽 넘기기는 `useKeysetPaging` 이 한다. */
export function useBugListKeyset(filter: BugFilter) {
  const port = useBugBoardPort();
  return useInfiniteQuery({
    queryKey: [...BUG_KEY, 'list', 'keyset', filter],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      if (port.kind !== 'keyset') throw new Error('이 판은 제보 목록을 쪽 번호로 받아요');
      return port.page(filter, pageParam, PAGE_MAX);
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** 목록 한 줄 하나 — 할 일 화면이 연결된 제보 번호를 보일 때. 글이 지워졌으면 null. */
export function useBugItem(id: string) {
  const port = useBugBoardPort();
  return useQuery({
    queryKey: [...BUG_KEY, 'item', id],
    queryFn: () => port.item(id),
    staleTime: 60_000,
  });
}

/**
 * 제보 id → 고정 번호(B-MMDD-n) — 할 일 검색용. useBugItem 과 같은 캐시를 써서, 할 일 카드가 이미 받은 줄이면 다시 읽지 않는다.
 * 고정 번호가 없는 옛 글 · 지워진 글은 빠진다(임시 번호는 날마다 순번을 세야 해서 검색에 쓰지 않는다).
 */
export function useBugNos(ids: readonly string[]): Map<string, string> {
  const port = useBugBoardPort();
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: [...BUG_KEY, 'item', id],
      queryFn: () => port.item(id),
      staleTime: 60_000,
    })),
    combine: (results) => {
      const out = new Map<string, string>();
      results.forEach((r, i) => {
        if (r.data?.no) out.set(ids[i], r.data.no);
      });
      return out;
    },
  });
}

/** 지난 날짜는 글이 더 붙지 않으니 다시 받지 않는다. 오늘은 새로고침 때 다시. */
export function useDayOrder(day: string, enabled = true) {
  const port = useBugBoardPort();
  return useQuery({
    queryKey: [...BUG_KEY, 'day', day],
    queryFn: () => port.dayOrder(day),
    staleTime: () => (day < kstDateKey(Date.now()) ? Infinity : 0),
    enabled,
  });
}

/** 번호 — 고정 번호(no)가 있으면 그대로(그날 순번은 받지 않는다), 없으면 임시 번호 «B-MMDD-n»(순번 받기 전엔 «?»). */
export function useBugNo(item: Pick<BugItem, 'id' | 'ts' | 'no'>): BugNo {
  const order = useDayOrder(bugDay(item.ts), !item.no);
  return bugNo(item, order.data?.get(item.id));
}

/** 비공개 글 제목 — Firebase 판 목록에는 없어서 따로 읽는다(API 판은 서버가 줄에 준다). */
export function usePrvTitle(item: BugItem) {
  const port = useBugBoardPort();
  return useQuery({
    queryKey: [...BUG_KEY, 'prvTitle', item.id],
    queryFn: () => port.prvTitle(item),
    enabled: item.vis === 'prv' && !item.server,
    staleTime: Infinity,
  });
}

export function useBugPost(id: string | null) {
  const port = useBugBoardPort();
  return useQuery({
    queryKey: [...BUG_KEY, 'post', id],
    queryFn: () => port.post(id as string),
    enabled: !!id,
  });
}

/** 비공개 제목은 staleTime Infinity 라 글을 고친 뒤엔 그 글 것만 다시 받는다. */
export function useRefreshPrvTitle() {
  const client = useQueryClient();
  return (id: string) => client.invalidateQueries({ queryKey: [...BUG_KEY, 'prvTitle', id] });
}

/**
 * 목록 · 상세 · 오늘 순번을 다시 받는다(지난 날짜 순번 · 비공개 제목은 그대로).
 * 목록을 API 사본으로 읽고 있었으면 쓰기 직후엔 사본이 늦으니 [lagMs] 뒤에 목록을 한 번 더 받는다.
 */
export function refreshBugBoard(client: QueryClient, lagMs: number = REPLICA_LAG_MS): Promise<void> {
  const viaApi = client
    .getQueriesData<BugListView>({ queryKey: BUG_LIST_KEY })
    .some(([, data]) => data?.via === 'api');
  if (viaApi && lagMs > 0) setTimeout(() => void client.invalidateQueries({ queryKey: BUG_LIST_KEY }), lagMs);
  return client.invalidateQueries({
    queryKey: BUG_KEY,
    predicate: (q) => {
      const [, kind, arg] = q.queryKey;
      return kind === 'list' || kind === 'post' || (kind === 'day' && arg === kstDateKey(Date.now()));
    },
  });
}

export function useRefreshBugBoard() {
  const client = useQueryClient();
  return () => refreshBugBoard(client);
}

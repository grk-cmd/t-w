import { useState } from 'react';
import { paginate } from './paginate';

export const PAGE_SIZES = [20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 50;

const PAGE_SIZE_KEY = 'tw.admin.pageSize.';

type ReadStore = Pick<Storage, 'getItem'>;
type WriteStore = Pick<Storage, 'setItem'>;

// 사생활 보호 창 · 막힌 저장소에서는 localStorage 를 꺼내기만 해도 던진다 — 꺼내는 것까지 try 안에서.
const browserStore = (): Storage => globalThis.localStorage;

export function pageSizeKey(listKey: string): string {
  return PAGE_SIZE_KEY + listKey;
}

/** 목록마다 고른 개수. 못 읽거나 고를 수 없는 값이면 기본 개수. */
export function readPageSize(listKey: string, store: () => ReadStore | undefined = browserStore): number {
  try {
    const n = Number(store()?.getItem(pageSizeKey(listKey)));
    return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

export function savePageSize(
  listKey: string,
  size: number,
  store: () => WriteStore | undefined = browserStore,
): void {
  try {
    store()?.setItem(pageSizeKey(listKey), String(size));
  } catch {
    // 기억하지 못해도 이번 화면에서는 고른 개수로 보인다.
  }
}

/** 쪽 번호 줄 — 처음 · 끝 · 지금 쪽 앞뒤만 두고 나머지는 'gap'(…)으로 줄인다. 늘 7칸 이하. */
export function pageNumbers(page: number, pageCount: number): (number | 'gap')[] {
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
  if (pageCount <= 7) return range(1, pageCount);
  const nearStart = page <= 4;
  const nearEnd = page >= pageCount - 3;
  const from = nearStart ? 2 : nearEnd ? pageCount - 4 : page - 1;
  const to = nearStart ? 5 : nearEnd ? pageCount - 1 : page + 1;
  return [
    1,
    ...(from > 2 ? (['gap'] as const) : []),
    ...range(from, to),
    ...(to < pageCount - 1 ? (['gap'] as const) : []),
    pageCount,
  ];
}

/** 개수를 바꿔도 지금 보던 첫 줄이 들어 있는 쪽으로 간다. */
export function pageForSize(page: number, size: number, nextSize: number): number {
  return Math.floor(((Math.max(page, 1) - 1) * size) / nextSize) + 1;
}

export interface Paging<T> {
  /** 이 쪽에 보일 항목. */
  items: T[];
  /** 지금 쪽(범위 안으로 맞춘 값). */
  page: number;
  pageCount: number;
  /** 고른 쪽 — 받아 둔 것보다 뒤로 간 경우 page 보다 클 수 있다(더 받을 양을 정할 때). */
  want: number;
  size: number;
  total: number;
  /** 이 쪽 첫 항목의 순번(0부터). */
  start: number;
  setPage: (page: number) => void;
  setSize: (size: number) => void;
}

/**
 * 쪽 · 페이지당 개수를 함께 든다. 개수는 listKey 별로 기억한다.
 * 항목이 줄어 지금 쪽이 넘치면 paginate 가 끝 쪽으로 맞춘다.
 */
export function usePaging<T>(items: readonly T[], listKey: string): Paging<T> {
  const [want, setWant] = useState(1);
  const [size, setSizeState] = useState(() => readPageSize(listKey));
  const view = paginate(items as T[], want, size);

  return {
    ...view,
    want,
    size,
    total: items.length,
    start: (view.page - 1) * size,
    setPage: (page) => setWant(Math.max(1, page)),
    setSize: (next) => {
      savePageSize(listKey, next);
      setWant(pageForSize(view.page, size, next));
      setSizeState(next);
    },
  };
}

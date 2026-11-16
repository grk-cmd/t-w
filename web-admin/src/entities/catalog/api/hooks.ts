import { useCallback } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { byPopularity } from '../model/popularity';
import {
  applyListEdit,
  type CatalogShelf,
  type CatalogSort,
  type ListEdit,
  type ShelfKind,
} from '../model/shelf';
import type { CatView } from '../model/category';
import { CATEGORIES_KEY, kindShelvesKey, SHELF_KEY, shelfKey } from './keys';
import { useCatalogPort } from './index';
import { shelfKindOf } from '../model/shelf';

/**
 * 한 종류의 진열대. 처음 연 종류마다 한 번만 받고 세션 동안 들고 있는다(gcTime 무한) — 쓰고 나면 포트가 돌려준 말로 캐시만 고치고,
 * 다시 받는 것은 새로고침 버튼뿐이다. 서버가 정렬하는 판은 정렬마다 따로 받고, 아닌 판은 진열 순서로 한 번 받아 장착 수로 다시 정렬한다.
 */
export function useCatalogShelf(kind: ShelfKind, sort: CatalogSort) {
  const port = useCatalogPort();
  const sortKey = port.sort === 'server' ? sort : 'order';
  const byEquip = port.sort === 'client' && sort === 'popular';
  const select = useCallback(
    (shelf: CatalogShelf): CatalogShelf =>
      byEquip
        ? {
            ...shelf,
            entries: byPopularity(
              shelf.entries,
              Object.fromEntries(shelf.entries.map((e) => [e.id, e.equip ?? 0])),
            ),
          }
        : shelf,
    [byEquip],
  );
  return useQuery({
    queryKey: shelfKey(kind, sortKey),
    queryFn: () => port.shelf(kind, sortKey),
    gcTime: Infinity,
    select,
  });
}

export function useCatalogCategories() {
  const port = useCatalogPort();
  return useQuery({ queryKey: CATEGORIES_KEY, queryFn: () => port.categories(), gcTime: Infinity });
}

export function useRefreshCatalog() {
  const client = useQueryClient();
  return (kind: ShelfKind) => client.invalidateQueries({ queryKey: kindShelvesKey(kind) });
}

export function useRefreshCategories() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: CATEGORIES_KEY });
}

/** 카테고리를 담은 캐시 — 카테고리 카드와 파츠 진열대들. */
function setCategories(client: QueryClient, change: (categories: CatView[]) => CatView[]) {
  client.setQueryData<CatView[]>(CATEGORIES_KEY, (old) => old && change(old));
  client.setQueriesData<CatalogShelf>({ queryKey: SHELF_KEY }, (old) =>
    old && old.categories.length ? { ...old, categories: change(old.categories) } : old,
  );
}

/** 쓰기 포트가 돌려준 말을 받아 둔 캐시에 적용한다. 받은 것을 다시 받지 않는다. */
export function applyEdits(client: QueryClient, edits: readonly ListEdit[]): void {
  for (const edit of edits) {
    switch (edit.op) {
      case 'category':
        setCategories(client, (cats) => cats.map((c) => (c.id === edit.cat.id ? edit.cat : c)));
        break;
      case 'categories':
        setCategories(client, () => edit.categories);
        break;
      case 'seed': {
        const kind = shelfKindOf(edit.kind);
        client.setQueryData(shelfKey(kind, 'order'), edit.shelf);
        // 다른 정렬로 받아 둔 것은 낡았다 — 그것만 다시 받는다.
        void client.invalidateQueries({
          queryKey: kindShelvesKey(kind),
          predicate: (q) => q.queryKey[3] !== 'order',
        });
        break;
      }
      case 'refetch':
        void client.invalidateQueries({ queryKey: kindShelvesKey(shelfKindOf(edit.kind)) });
        break;
      default:
        client.setQueriesData<CatalogShelf>({ queryKey: kindShelvesKey(shelfKindOf(edit.kind)) }, (old) =>
          old ? applyListEdit(old, edit) : old,
        );
    }
  }
}

export function useApplyEdits() {
  const client = useQueryClient();
  return (edits: readonly ListEdit[]) => applyEdits(client, edits);
}

/** 쿼리 키 — 훅 · 두 판이 같이 쓴다. API 판 번들이 `firebase.ts` 를 끌고 가지 않게 따로 둔다. */
import type { CatalogSort, ShelfKind } from '../model/shelf';

export const SHELF_KEY = ['catalog', 'shelf'];
export const shelfKey = (kind: ShelfKind, sort: CatalogSort) => [...SHELF_KEY, kind, sort];
export const kindShelvesKey = (kind: ShelfKind) => [...SHELF_KEY, kind];
export const CATEGORIES_KEY = ['catalog', 'categories'];

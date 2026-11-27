import type { CatalogEditResult, CatalogEntry } from '@/entities/catalog';

export interface ReorderInput {
  /** 한 진열 칸(파츠는 카테고리 하나, 책상 · 아이템은 전체)의 줄 — 화면에 보이는 순서대로. */
  group: readonly CatalogEntry[];
  dragged: string;
  target: string;
  /** 화면이 읽은 이 칸의 진열대 번호(`shelfVersion`). */
  version: number;
}

/** ↕ 진열 순서 바꾸기 — dragged 를 target 자리로. 남이 먼저 바꿨으면 쓰지 않고 지금 순서를 돌려준다(`conflict`). */
export interface ReorderEntriesPort {
  reorder(input: ReorderInput): Promise<CatalogEditResult>;
}

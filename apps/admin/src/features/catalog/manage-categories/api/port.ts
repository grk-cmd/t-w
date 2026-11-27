import type { CatalogEditResult, CatView } from '@/entities/catalog';

/** 📁 카테고리 이름 · 아이콘 고치기. 남이 먼저 고쳤으면 쓰지 않고 지금 목록을 돌려준다(`conflict`). */
export interface ManageCategoriesPort {
  /** 저장 전에 알 수 있는 문제 — 없으면 null. 글자 수 판정을 서버가 하는 판은 늘 null 이다. */
  check(cat: CatView, label: string, icon: string): string | null;
  /** 화면이 읽은 카테고리(`cat`)를 그대로 받는다 — 그 번호로 쓴다. 기본 카테고리를 비우면 처음 값으로 되돌린다. */
  save(cat: CatView, label: string, icon: string): Promise<CatalogEditResult>;
}

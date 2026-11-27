import type { CatView } from '../model/category';
import type { CatalogSort, CatalogShelf, ShelfKind } from '../model/shelf';

/**
 * 🧩 카탈로그 읽기 — 종류별 진열대(줄 · 카테고리 · 진열대 번호)와 카테고리.
 * 쓰기는 features/catalog/* 의 포트가 한다.
 */
export interface CatalogPort {
  /**
   * 많이 쓰는 순을 누가 정하나 — `server`: 요청에 실어 서버가 정렬해 준다(정렬마다 따로 받는다),
   * `client`: 포트는 늘 진열 순서로 주고 화면이 장착 수로 다시 정렬한다(받아 둔 큰 노드를 다시 받지 않으려고).
   */
  sort: 'server' | 'client';
  /** 용량 진단 · base64 정리 화면이 있는 판. */
  diagnosable: boolean;
  /** 한 종류의 진열대. 이 종류의 물건 줄만 온다. */
  shelf(kind: ShelfKind, sort: CatalogSort): Promise<CatalogShelf>;
  /** 카테고리 전부(기본 카테고리 + 운영 추가). */
  categories(): Promise<CatView[]>;
}

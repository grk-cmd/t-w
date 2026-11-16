import type { CatalogEditResult, CatalogEntry } from '@/entities/catalog';

/** 🖊 책상 · 아이템 이름 · 아이콘 고치기. 남이 먼저 고쳤으면 쓰지 않고 지금 값을 돌려준다(`conflict`). */
export interface EditEntryInfoPort {
  /** 저장 전에 알 수 있는 문제 — 없으면 null. 글자 수 · 빈 이름 판정을 서버가 하는 판은 늘 null 이다. */
  check(name: string, icon: string): string | null;
  /** 화면이 읽은 줄(`entry`)을 그대로 받는다 — 그 줄의 번호로 쓴다. */
  save(entry: CatalogEntry, name: string, icon: string): Promise<CatalogEditResult>;
}

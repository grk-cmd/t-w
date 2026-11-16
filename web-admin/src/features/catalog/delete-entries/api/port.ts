import type { CatalogEntry, ListEdit } from '@/entities/catalog';

export interface RemoveEntriesResult {
  /** 지우거나 단종한 수. */
  removed: number;
  /** 지우지 못하고 남은 Storage 파일 수 — 항목은 이미 지워졌다(Firebase 판만). */
  filesLeft: number;
  /** 안 된 줄과 까닭(서버가 줄마다 답하는 판 — 나머지는 이미 처리됐다). */
  failed: { id: string; reason: string }[];
  edits: ListEdit[];
}

/** 🗑 항목 지우기. */
export interface DeleteEntriesPort {
  /** `entries` 를 지운다. `rest` 는 같은 목록 전체 — 남는 항목이 쓰는 파일은 지우지 않는다. */
  remove(entries: readonly CatalogEntry[], rest: readonly CatalogEntry[]): Promise<RemoveEntriesResult>;
}

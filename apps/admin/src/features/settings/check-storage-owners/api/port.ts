import type { StorageOwnersResult } from '../model/storageOwners';

/** Storage 주인 문서 — API 판에만 있다. */
export interface StorageOwnersPort {
  check(): Promise<StorageOwnersResult>;
  /** 모든 계정을 문서로 쓴다 — 몇 번 돌려도 같다 · 서버가 작업 기록(`user.storageBackfill`)을 남긴다. */
  backfill(memo: string): Promise<StorageOwnersResult>;
}

import type { AdminLogEntry } from '../model/adminLog';

export interface AdminLogPage {
  items: AdminLogEntry[];
  /** 최근 n 개를 꽉 채워 받았다 — 더 오래된 기록이 남아 있을 수 있다. */
  hasMore: boolean;
}

/** 🧾 작업 기록 — 관리자가 한 일의 목록(최신순). */
export interface AdminLogPort {
  /** 최근 `n` 개. */
  list(n: number): Promise<AdminLogPage>;
}

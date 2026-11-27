import type { AdminLogEntry, LogGroup } from '../model/adminLog';

export interface AdminLogPage {
  items: AdminLogEntry[];
  /** 최근 n 개를 꽉 채워 받았다 — 더 오래된 기록이 남아 있을 수 있다. */
  hasMore: boolean;
}

/** 🧾 작업 기록 — 관리자가 한 일의 목록(최신순). */
export interface AdminLogPort {
  /** 이 판에서 보이는 필터 칩(동작 이름의 앞부분이 판마다 다르다). */
  readonly groups: readonly LogGroup[];
  /** 최근 `n` 개. */
  list(n: number): Promise<AdminLogPage>;
}

import type { BugItem, BugStatus } from '@/entities/bug-board';

/** 🐞 상태만 바꾸기 — 답변 없이. */
export interface ChangeStatusPort {
  /** `item` 은 화면이 읽은 글 그대로 — API 판은 그 글의 `version` 을 싣고, 그 사이 다른 곳이 고쳤으면 `conflict`. */
  change(item: BugItem, status: BugStatus, label: string): Promise<void>;
}

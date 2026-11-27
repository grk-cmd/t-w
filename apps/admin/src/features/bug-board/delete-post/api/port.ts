import type { BugItem } from '@/entities/bug-board';

/** 🐞 제보 지우기 — 글 · 답변 · 공감 모두. */
export interface DeletePostPort {
  remove(item: BugItem, label: string): Promise<void>;
}

import type { BugContent, BugItem, EditInput } from '@/entities/bug-board';
import type { EditResult } from '../model/editPost';

/** 🐞 제보 고치기 — 제목 · 본문 · 분류 · 공개 범위. */
export interface EditPostPort {
  /** 서버에 보내기 전에 막을 입력 오류 — 없으면 null. API 판은 서버 제한을 미리 판정하지 않는다. */
  check(item: Pick<BugItem, 'notice'>, input: EditInput): string | null;
  /** `item` · `content` 는 화면이 읽은 글 그대로 — API 판은 그 글의 `version` 을 싣고, 그 사이 다른 곳이 고쳤으면 `conflict`. */
  edit(item: BugItem, content: BugContent | null, input: EditInput, label: string): Promise<EditResult>;
}

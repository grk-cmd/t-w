import type { AnswerInput, BugItem } from '@/entities/bug-board';
import type { AnswerResult } from '../model/answerPost';

/** 🐞 운영자 답변 등록 — 답변 · 함께 바꿀 상태 · 글쓴이 알림. */
export interface AnswerPostPort {
  /** 서버에 보내기 전에 막을 입력 오류 — 없으면 null. API 판은 서버 제한을 미리 판정하지 않는다. */
  check(input: AnswerInput): string | null;
  /** `item` 은 답변 칸이 지금 보고 있는 글 — 그 뒤 다른 관리자가 먼저 답했으면 `busy`. */
  answer(item: BugItem, input: AnswerInput, label: string): Promise<AnswerResult>;
}

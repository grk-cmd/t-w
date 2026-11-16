import type { AnswerEditInput, BugAnswer } from '@/entities/bug-board';
import type { EditAnswerResult } from '../model/editAnswer';

/** 🐞 운영자 답변 고치기 — 내용 · 오픈카톡 링크만. */
export interface EditAnswerPort {
  /** 서버에 보내기 전에 막을 입력 오류 — 없으면 null. API 판은 서버 제한을 미리 판정하지 않는다. */
  check(input: AnswerEditInput): string | null;
  edit(
    postId: string,
    answer: Pick<BugAnswer, 'id' | 'vis' | 'byAuthor'>,
    input: AnswerEditInput,
    label: string,
  ): Promise<EditAnswerResult>;
}

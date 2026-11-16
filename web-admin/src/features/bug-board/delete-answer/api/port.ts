import type { BugAnswer } from '@/entities/bug-board';
import type { DeleteAnswerResult } from '../model/deleteAnswer';

/** 🐞 운영자 답변 한 개 지우기. */
export interface DeleteAnswerPort {
  remove(
    postId: string,
    answer: Pick<BugAnswer, 'id' | 'vis' | 'byAuthor'>,
    label: string,
  ): Promise<DeleteAnswerResult>;
}

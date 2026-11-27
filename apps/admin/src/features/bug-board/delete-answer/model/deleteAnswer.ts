export type DeleteAnswerResult = { ok: true } | { ok: false; reason: string };

/** 확인 문구 */
export const deleteAnswerAsk = (label: string) =>
  `${label} 답변을 지울까요? 되돌릴 수 없어요.\n이미 보낸 우편함 알림은 글쓴이에게 그대로 남아요.`;

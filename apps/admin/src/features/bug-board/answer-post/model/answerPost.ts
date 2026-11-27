/** busy — 화면을 연 뒤 다른 관리자 답변이 먼저 달려 등록을 멈춤(쓰던 글은 화면에 그대로). */
export type AnswerResult = { ok: true } | { ok: false; reason: string; busy?: true };

export const ANSWER_BUSY =
  '방금 다른 관리자 답변이 달렸어요 — 위에서 확인하고, 그래도 올릴 거면 다시 눌러 주세요';

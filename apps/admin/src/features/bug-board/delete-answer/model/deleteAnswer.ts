import { answerDeleteWrite, getBugItem, getStaffAnswers, type BugAnswer } from '@/entities/bug-board';
import { withAudit, type Db } from '@/shared/api';

export type DeleteAnswerResult = { ok: true } | { ok: false; reason: string };

/**
 * 운영자 답변 한 개 지우기 + 목록 줄 ansN · lastReplyTs 다시 세기 + 작업 기록을 한 묶음으로.
 * 글 줄과 운영자 답변을 쓰기 직전에 다시 읽는다 — 화면을 연 뒤 다른 관리자가 답변을 달거나 지웠어도 남은 수가 맞게,
 * 이미 지워졌거나 옮겨 간 답변이면 쓰지 않게. 공개 답변 칸은 상세(getBugPost)처럼 공개 글일 때만 읽는다.
 * 글쓴이 답글(rep)은 지우지 않는다. 이미 보낸 우편함 알림은 그대로 남는다.
 */
export async function deleteAnswer(
  db: Db,
  postId: string,
  answer: Pick<BugAnswer, 'id' | 'vis' | 'byAuthor'>,
  label: string,
): Promise<DeleteAnswerResult> {
  if (answer.byAuthor) return { ok: false, reason: '글쓴이 답글은 지울 수 없음' };
  const item = await getBugItem(db, postId);
  if (!item) return { ok: false, reason: '글 없음 — 삭제됐을 수 있음' };
  const all = await getStaffAnswers(db, item);
  const cur = all.find((a) => a.id === answer.id && a.vis === answer.vis);
  if (!cur) return { ok: false, reason: '답변 없음 — 지워졌거나 옮겨졌을 수 있음 · 다시 열어 주세요' };
  const rest = all.filter((a) => a !== cur);
  const updates = answerDeleteWrite(postId, cur, rest);
  const detail = `${cur.vis === 'pub' ? '공개' : '비공개'} 답변 · 남은 답변 ${rest.length}`;
  await db.commit(withAudit(db, updates, 'bug.answerDelete', label, detail));
  return { ok: true };
}

/** 확인 문구 */
export const deleteAnswerAsk = (label: string) =>
  `${label} 답변을 지울까요? 되돌릴 수 없어요.\n이미 보낸 우편함 알림은 글쓴이에게 그대로 남아요.`;

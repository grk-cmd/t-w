import {
  answerEditChanges,
  answerEditWrite,
  answerPath,
  checkAnswer,
  toAnswers,
  type AnswerEditInput,
  type BugAnswer,
} from '@/entities/bug-board';
import { withAudit, type Db } from '@/shared/api';

export type EditAnswerResult = { ok: true } | { ok: false; reason: string };

/**
 * 운영자 답변 한 개 고치기 + 작업 기록을 한 묶음으로. 글쓴이 답글(rep)은 고치지 않는다.
 * 답변은 쓰기 직전에 그 자리에서 다시 읽는다 — 글이 지워졌거나 공개 범위가 바뀌어 옮겨 갔으면
 * 옛 자리에 답변을 되살리지 않게. 글쓴이에게 알림은 다시 보내지 않는다.
 */
export async function editAnswer(
  db: Db,
  postId: string,
  answer: Pick<BugAnswer, 'id' | 'vis' | 'byAuthor'>,
  input: AnswerEditInput,
  label: string,
): Promise<EditAnswerResult> {
  if (answer.byAuthor) return { ok: false, reason: '글쓴이 답글은 고칠 수 없음' };
  const bad = checkAnswer(input);
  if (bad) return { ok: false, reason: bad };
  const one = { [answer.id]: await db.get<unknown>(answerPath(postId, answer)) };
  const [cur] = toAnswers(answer.vis === 'pub' ? one : null, answer.vis === 'prv' ? one : null);
  if (!cur) return { ok: false, reason: '답변 없음 — 지워졌거나 옮겨졌을 수 있음 · 다시 열어 주세요' };
  const changes = answerEditChanges(cur, input);
  if (!changes.length) return { ok: false, reason: '바뀐 것 없음' };
  const updates = answerEditWrite(postId, cur, input);
  const detail = `${cur.vis === 'pub' ? '공개' : '비공개'} 답변 · ${changes.join(' · ')}`;
  await db.commit(withAudit(db, updates, 'bug.answerEdit', label, detail));
  return { ok: true };
}

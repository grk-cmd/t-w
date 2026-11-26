// Firebase 판 — 지금 코드 그대로: 답변 · 상태 · 글쓴이 우편함 알림 · 작업 기록을 한 묶음으로 RTDB 에 쓴다.
import {
  answerId,
  answerNoticeBody,
  answerVis,
  answerWrite,
  BUG_NOTICE_TITLE,
  BUG_STATUS,
  checkAnswer,
  getBugItem,
  type AnswerInput,
  type BugItem,
} from '@/entities/bug-board';
import { inboxMessageWrite } from '@/entities/inbox';
import { withAudit, type Db } from '@/shared/api';
import { ANSWER_BUSY, type AnswerResult } from '../model/answerPost';
import type { AnswerPostPort } from './port';

/**
 * 답변 · 상태 · 글쓴이 우편함 알림 · 작업 기록을 한 묶음으로 — 하나라도 막히면 아무것도 남지 않는다.
 * 글 줄은 쓰기 직전에 다시 읽는다(ansN +1 이 다른 관리자의 답변과 겹치지 않게, 상태도 최신 기준).
 * seen 은 답변 칸이 본 글 — 그 뒤로 운영자 답변(lastReplyTs)이 바뀌었으면 겹친 답변이라 쓰지 않는다.
 *   앱 관리자 답변도 lastReplyTs 를 바꾸므로 같이 잡힌다. 없으면 확인하지 않는다.
 * label 은 화면의 짧은 번호(B-MMDD-n) — 기록에만 쓴다. 비공개 제목은 기록에도 남기지 않는다.
 */
export async function answerPost(
  db: Db,
  id: string,
  input: AnswerInput,
  label: string,
  seen?: Pick<BugItem, 'lastReplyTs'>,
): Promise<AnswerResult> {
  const bad = checkAnswer(input);
  if (bad) return { ok: false, reason: bad };
  const item = await getBugItem(db, id);
  if (!item) return { ok: false, reason: '글 없음 — 삭제됐을 수 있음' };
  if (seen && (item.lastReplyTs ?? 0) !== (seen.lastReplyTs ?? 0))
    return { ok: false, reason: ANSWER_BUSY, busy: true };
  const vis = answerVis(item, input.vis);
  const hasKakao = !!input.kakao?.trim();
  const status = input.status ?? item.status;
  const notify = item.code
    ? inboxMessageWrite(item.code, {
        tag: 'bug',
        title: BUG_NOTICE_TITLE,
        body: answerNoticeBody(item.vis, item.title, hasKakao),
        bugId: id,
      })
    : {};
  const updates = { ...answerWrite(item, input, answerId(), db.now()), ...notify };
  const detail = `${vis === 'pub' ? '공개' : '비공개'} 답변 · ${BUG_STATUS[status]}${item.code ? '' : ' · 알림 없음'}`;
  await db.commit(withAudit(db, updates, 'bug.answer', label, detail));
  return { ok: true };
}

export function createFirebaseAnswerPostPort(db: Db): AnswerPostPort {
  return {
    check: (input) => checkAnswer(input),
    answer: (item, input, label) => answerPost(db, item.id, input, label, item),
  };
}

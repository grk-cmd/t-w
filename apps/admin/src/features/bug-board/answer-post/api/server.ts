// API 판 — `POST /v2/admin/bugs/{number}/answers { requestId, seenLastAnswerAt, text, status, visibility, kakaoLink? }` — 글쓴이 알림은 서버가 보낸다.
// `seenLastAnswerAt` 은 답변 칸이 보던 글의 마지막 운영자 답변 시각(서버가 준 글자 그대로) — 그 뒤 다른 관리자가 먼저 답했으면 409 `BUG_ANSWER_CONFLICT` → `busy`.
// 글자 수 · 링크 모양 · 비공개 글에 공개 답변 같은 판정은 서버가 한다 — 값은 그대로 보내고 400 은 서버 문구로 띄운다.
import { serverStatus, serverVisibility } from '@/entities/bug-board';
import { adminPath, isPortError, perApi, portCall, type Api } from '@/shared/api';
import { createPayloadRequestId } from '@/shared/lib';
import type { AnswerPostPort } from './port';

const CONFLICT = 'BUG_ANSWER_CONFLICT';

function build(api: Api | null): AnswerPostPort {
  const once = createPayloadRequestId();
  return {
    // 서버가 판정한다.
    check: () => null,

    async answer(item, input, label) {
      const kakao = input.kakao?.trim() ?? '';
      const body = {
        seenLastAnswerAt: item.lastReplyAt ?? null,
        text: input.text.trim(),
        // 상태를 안 골랐으면 화면이 보던 글의 상태 그대로.
        status: serverStatus(input.status ?? item.status),
        visibility: serverVisibility(input.vis),
        ...(kakao ? { kakaoLink: kakao } : {}),
      };
      try {
        await portCall(
          api,
          (a) =>
            once(body, (requestId) =>
              a.send('POST', adminPath(`/bugs/${encodeURIComponent(item.id)}/answers`), {
                body: { requestId, ...body },
              }),
            ),
          `${label} 답변을 등록하지 못했어요`,
        );
      } catch (error) {
        // 다른 관리자가 먼저 답했다 — 쓰던 글은 칸에 그대로 두고 글을 다시 받는다.
        if (isPortError(error, 'conflict') && error.code === CONFLICT)
          return { ok: false, reason: error.message, busy: true };
        throw error;
      }
      return { ok: true };
    },
  };
}

/** `api` 마다 하나 — 같은 내용을 다시 보낼 때만 같은 요청 번호를 쓰는 기억만 든다. */
export const createServerAnswerPostPort = perApi(build);

// API 판 — `PATCH /v2/admin/bugs/{number}/answers/{id} { text, kakaoLink }` — 링크를 비우면 서버가 링크를 지운다. 글쓴이에게 알림은 다시 가지 않는다.
// 글자 수 · 링크 모양 판정은 서버가 한다 — 값은 그대로 보내고 400 은 서버 문구로 띄운다.
import { adminPath, perApi, portCall, type Api } from '@/shared/api';
import type { EditAnswerPort } from './port';

function build(api: Api | null): EditAnswerPort {
  return {
    // 서버가 판정한다.
    check: () => null,

    async edit(postId, answer, input, label) {
      await portCall(
        api,
        (a) =>
          a.send(
            'PATCH',
            adminPath(`/bugs/${encodeURIComponent(postId)}/answers/${encodeURIComponent(answer.id)}`),
            { body: { text: input.text.trim(), kakaoLink: input.kakao?.trim() ?? '' } },
          ),
        `${label} 답변을 고치지 못했어요`,
      );
      return { ok: true };
    },
  };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerEditAnswerPort = perApi(build);

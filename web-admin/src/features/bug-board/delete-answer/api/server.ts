// API 판 — `DELETE /v2/admin/bugs/{number}/answers/{id}`. 글쓴이 답글이면 서버가 404 `BUG_NOT_ADMIN_ANSWER` 로 거절한다.
import { adminPath, perApi, portCall, type Api } from '@/shared/api';
import type { DeleteAnswerPort } from './port';

function build(api: Api | null): DeleteAnswerPort {
  return {
    async remove(postId, answer, label) {
      await portCall(
        api,
        (a) =>
          a.send(
            'DELETE',
            adminPath(`/bugs/${encodeURIComponent(postId)}/answers/${encodeURIComponent(answer.id)}`),
          ),
        `${label} 답변을 지우지 못했어요`,
      );
      return { ok: true };
    },
  };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerDeleteAnswerPort = perApi(build);

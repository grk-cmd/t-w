// API 판 — `DELETE /v2/admin/bugs/{number}` — 글 · 댓글 · 공감 · 읽음을 서버가 모두 지운다.
import { adminPath, perApi, portCall, type Api } from '@/shared/api';
import type { DeletePostPort } from './port';

function build(api: Api | null): DeletePostPort {
  return {
    async remove(item, label) {
      await portCall(
        api,
        (a) => a.send('DELETE', adminPath(`/bugs/${encodeURIComponent(item.id)}`)),
        `${label} 제보를 지우지 못했어요`,
      );
    },
  };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerDeletePostPort = perApi(build);

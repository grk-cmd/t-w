// API 판 — `POST /v2/admin/licenses { requestId, grants: [{ note }] }` — 주인 없는 키 한 장. 키 원문은 답으로 온다.
import { NOTE_MAX, postGrants } from '@/entities/license';
import { perApi, PortError, rowCodeText, type Api } from '@/shared/api';
import { createPayloadRequestId } from '@/shared/lib';
import type { IssueKeyPort } from './port';

function build(api: Api | null): IssueKeyPort {
  const once = createPayloadRequestId();
  return {
    async issue(note) {
      const memo = note.slice(0, NOTE_MAX);
      const grants = [memo ? { note: memo } : {}];
      const [row] = await once(grants, (requestId) => postGrants(api, requestId, grants, false));
      if (!row.ok) throw new PortError('invalid', rowCodeText(row.code), row.code);
      return row.key;
    },
  };
}

/** `api` 마다 하나 — 같은 내용을 다시 보낼 때만 같은 요청 번호를 쓰는 기억만 든다. */
export const createServerIssueKeyPort = perApi(build);

// API 판 — `POST /v2/admin/licenses { requestId, reissue: true, grants: [{ friendCode }] }` — 서버가 그 사람 우편으로 키를 보낸다.
// 받는 사람 이름은 이 길이 주지 않는다(없는 사람은 줄 결과 `USER_NOT_FOUND`).
import { postGrants } from '@/entities/license';
import { perApi, PortError, rowCodeText, type Api } from '@/shared/api';
import { createPayloadRequestId } from '@/shared/lib';
import type { GrantByCodePort } from './port';

function build(api: Api | null): GrantByCodePort {
  const once = createPayloadRequestId();
  return {
    async grant(input) {
      const friendCode = input.trim().toUpperCase();
      const grants = [{ friendCode }];
      // 직접 친구코드를 적어 보내는 일이라 이미 유효한 키가 있는 사람에게도 발급한다(Firebase 판과 같다).
      const [row] = await once(grants, (requestId) => postGrants(api, requestId, grants, true));
      if (row.ok) return { ok: true, key: row.key, code: friendCode, name: null };
      if (row.code === 'USER_NOT_FOUND') return { ok: false, reason: 'not-found' };
      throw new PortError('invalid', rowCodeText(row.code), row.code);
    },
  };
}

export const createServerGrantByCodePort = perApi(build);

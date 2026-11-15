// API 판 — `GET /v2/admin/license-requests?cursor&limit`(대기 요청 · 키셋). 연결이 없어 화면이 열려 있는 동안 30초마다 묻는다(설계 5절).
import {
  adminPath,
  perApi,
  portCall,
  wireArray,
  wireError,
  wireNullableString,
  wireObject,
  wireString,
  type Api,
} from '@/shared/api';
import type { LicenseRequest } from '../model/request';
import type { LicenseRequestPort } from './port';

const BASE = adminPath('/license-requests');
/** 서버 한 번에 받는 상한(`limit` 1~100). */
const PAGE_MAX = 100;
export const POLL_MS = 30_000;

/** 요청 한 건 — 칸이 약속과 다르면 줄을 버리지 않고 던진다. */
function toRequest(w: unknown): LicenseRequest {
  const o = wireObject(w, '라이선스 요청 줄');
  const id = wireString(o.id, '라이선스 요청의 id');
  const at = Date.parse(wireString(o.createdAt, `라이선스 요청 ${id} 의 createdAt`));
  if (Number.isNaN(at)) throw wireError(`라이선스 요청 ${id} 의 createdAt`, 'ISO 시각');
  return {
    id,
    name: wireString(o.name, `라이선스 요청 ${id} 의 name`),
    userCode: wireString(o.requesterUserCode, `라이선스 요청 ${id} 의 requesterUserCode`),
    requestedAt: at,
  };
}

function build(api: Api | null): LicenseRequestPort {
  return {
    kind: 'poll',
    intervalMs: POLL_MS,
    pending: () =>
      portCall(
        api,
        async (a) => {
          const out: LicenseRequest[] = [];
          let cursor: string | undefined;
          do {
            const page = wireObject(
              await a.get<unknown>(BASE, { cursor, limit: PAGE_MAX }),
              '라이선스 요청 쪽',
            );
            out.push(...wireArray(page.items, '라이선스 요청 쪽의 items').map(toRequest));
            cursor = wireNullableString(page.nextCursor, '라이선스 요청 쪽의 nextCursor') ?? undefined;
          } while (cursor !== undefined);
          return out;
        },
        '요청 목록을 받지 못했어요',
      ),
  };
}

export const createServerLicenseRequestPort = perApi(build);

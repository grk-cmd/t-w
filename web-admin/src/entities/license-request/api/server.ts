// API 판 — `GET /v2/admin/license-requests?cursor&limit`(대기 요청 · 키셋 · 첫 쪽 `total`). 연결이 없어 화면이 열려 있는 동안 30초마다 묻는다(설계 5절).
import {
  adminPath,
  perApi,
  portCall,
  wireArray,
  wireError,
  wireNullableNumber,
  wireNullableString,
  wireNumber,
  wireObject,
  wireString,
  type Api,
} from '@/shared/api';
import type { KeysetPage } from '@/shared/lib';
import type { LicenseRequest } from '../model/request';
import type { LicenseRequestPort } from './port';

const BASE = adminPath('/license-requests');
export const POLL_MS = 30_000;

/** 요청 한 건 — 칸이 약속과 다르면 줄을 버리지 않고 던진다. */
function toRequest(w: unknown): LicenseRequest {
  const o = wireObject(w, '라이선스 요청 줄');
  const id = wireString(o.id, '라이선스 요청의 id');
  const at = Date.parse(wireString(o.createdAt, `라이선스 요청 ${id} 의 createdAt`));
  if (Number.isNaN(at)) throw wireError(`라이선스 요청 ${id} 의 createdAt`, 'ISO 시각');
  return {
    id,
    name: wireNullableString(o.name, `라이선스 요청 ${id} 의 name`),
    userCode: wireString(o.requesterUserCode, `라이선스 요청 ${id} 의 requesterUserCode`),
    requestedAt: at,
  };
}

function build(api: Api | null): LicenseRequestPort {
  return {
    kind: 'poll',
    intervalMs: POLL_MS,
    page: (cursor, limit) =>
      portCall(
        api,
        async (a): Promise<KeysetPage<LicenseRequest>> => {
          const page = wireObject(await a.get<unknown>(BASE, { cursor, limit }), '라이선스 요청 쪽');
          return {
            items: wireArray(page.items, '라이선스 요청 쪽의 items').map(toRequest),
            nextCursor: wireNullableString(page.nextCursor, '라이선스 요청 쪽의 nextCursor'),
            // `total` 은 첫 쪽에만 오고 다음 쪽은 null.
            total:
              cursor === undefined
                ? wireNumber(page.total, '라이선스 요청 첫 쪽의 total')
                : wireNullableNumber(page.total, '라이선스 요청 쪽의 total'),
          };
        },
        '요청 목록을 받지 못했어요',
      ),
  };
}

export const createServerLicenseRequestPort = perApi(build);

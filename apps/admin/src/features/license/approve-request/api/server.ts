// API 판 — `POST /v2/admin/license-requests/{id}/approve · reject`(승인 = 키 발급 + 받는 사람 우편은 서버가) ·
// `POST …/bulk-approve { ids ≤500 }` → 줄마다 `{ id, ok, code? }`.
import {
  adminPath,
  perApi,
  portCall,
  wireArray,
  wireBool,
  wireError,
  wireNullableString,
  wireObject,
  wireString,
  type Api,
} from '@/shared/api';
import type { ApproveRequestPort, BulkResult } from './port';

const BASE = adminPath('/license-requests');
/** 한 번에 보내는 상한(서버 `ids` 1~500). */
const BULK_MAX = 500;

/** 묶음 결과의 한 줄 — `{ id, ok, code? }`. 안 된 줄은 `code` 가 있다. */
function toBulkRow(r: unknown): { ok: boolean; code: string | null } {
  const o = wireObject(r, '묶음 결과 줄');
  wireString(o.id, '묶음 결과 줄의 id');
  const ok = wireBool(o.ok, '묶음 결과 줄의 ok');
  const code = wireNullableString(o.code, '묶음 결과 줄의 code');
  if (!ok && code === null) throw wireError('묶음 결과 줄의 code', '실패한 줄의 글자');
  return { ok, code };
}

function build(api: Api | null): ApproveRequestPort {
  const path = (id: string, act: 'approve' | 'reject') => `${BASE}/${encodeURIComponent(id)}/${act}`;

  return {
    async approve(req) {
      await portCall(api, (a) => a.send('POST', path(req.id, 'approve')), '발급하지 못했어요');
      return { delivered: null };
    },
    async approveAll(reqs) {
      const result: BulkResult = { issued: 0, failed: 0, notDelivered: null };
      for (let i = 0; i < reqs.length; i += BULK_MAX) {
        const ids = reqs.slice(i, i + BULK_MAX).map((r) => r.id);
        const rows = await portCall(
          api,
          async (a) =>
            wireArray(
              await a.send<unknown>('POST', `${BASE}/bulk-approve`, { body: { ids } }),
              '묶음 결과',
            ).map(toBulkRow),
          '발급하지 못했어요',
        );
        if (rows.length !== ids.length) throw wireError('묶음 결과', `${ids.length}줄`);
        for (const row of rows) {
          if (row.ok) result.issued += 1;
          else result.failed += 1;
        }
      }
      return result;
    },
    async reject(req) {
      await portCall(api, (a) => a.send('POST', path(req.id, 'reject')), '거절하지 못했어요');
    },
  };
}

export const createServerApproveRequestPort = perApi(build);

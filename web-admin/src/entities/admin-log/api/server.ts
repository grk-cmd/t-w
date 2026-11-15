// API 판 — `GET /v2/admin/audit-logs?cursor&limit`(최신순 키셋 · limit 1~200). 서버가 같은 트랜잭션에 적은 기록이라
// 동작 이름 · 대상 표기가 서버 것이고(설계 R10), 이름은 응답의 `byName` 을 쓴다.
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
import { SERVER_LOG_GROUPS, type AdminLogEntry } from '../model/adminLog';
import type { AdminLogPage, AdminLogPort } from './port';

const PATH = adminPath('/audit-logs');
const PAGE_MAX = 200;

/** 기록 한 줄 — 칸이 약속과 다르면 줄을 버리지 않고 던진다. `byName` · `detail` 의 null 만 문서가 약속한 «없음» 이다. */
function toEntry(w: unknown): AdminLogEntry {
  const o = wireObject(w, '작업 기록 줄');
  const id = wireString(o.id, '작업 기록의 id');
  const at = Date.parse(wireString(o.at, `작업 기록 ${id} 의 at`));
  if (Number.isNaN(at)) throw wireError(`작업 기록 ${id} 의 at`, 'ISO 시각');
  const byName = wireNullableString(o.byName, `작업 기록 ${id} 의 byName`);
  return {
    id,
    at,
    by: wireString(o.by, `작업 기록 ${id} 의 by`),
    action: wireString(o.action, `작업 기록 ${id} 의 action`),
    target: wireString(o.target, `작업 기록 ${id} 의 target`),
    detail: wireNullableString(o.detail, `작업 기록 ${id} 의 detail`) ?? '',
    ...(byName ? { byName } : {}),
  };
}

function build(api: Api | null): AdminLogPort {
  return {
    groups: SERVER_LOG_GROUPS,
    async list(n): Promise<AdminLogPage> {
      return portCall(
        api,
        async (a) => {
          const items: AdminLogEntry[] = [];
          let cursor: string | undefined;
          let more = false;
          do {
            const page = wireObject(
              await a.get<unknown>(PATH, { limit: Math.min(PAGE_MAX, n - items.length), cursor }),
              '작업 기록 쪽',
            );
            items.push(...wireArray(page.items, '작업 기록 쪽의 items').map(toEntry));
            cursor = wireNullableString(page.nextCursor, '작업 기록 쪽의 nextCursor') ?? undefined;
            more = cursor !== undefined;
          } while (cursor && items.length < n);
          return { items, hasMore: more };
        },
        '기록을 불러오지 못했어요',
      );
    },
  };
}

export const createServerAdminLogPort = perApi(build);

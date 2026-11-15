// API 판 — `GET /v2/admin/audit-logs?cursor&limit`(최신순 키셋 · limit 1~200). 서버가 같은 트랜잭션에 적은 기록이라
// 동작 이름 · 대상 표기가 서버 것이고(설계 R10), 이름은 응답의 `byName` 을 쓴다.
import { adminPath, perApi, portCall, type Api } from '@/shared/api';
import { SERVER_LOG_GROUPS, type AdminLogEntry } from '../model/adminLog';
import type { AdminLogPage, AdminLogPort } from './port';

const PATH = adminPath('/audit-logs');
const PAGE_MAX = 200;

interface Wire {
  id?: unknown;
  at?: unknown;
  by?: unknown;
  byName?: unknown;
  action?: unknown;
  target?: unknown;
  detail?: unknown;
}

const text = (v: unknown) => (typeof v === 'string' ? v : '');

function toEntry(w: Wire): AdminLogEntry | null {
  const at = typeof w.at === 'string' ? Date.parse(w.at) : NaN;
  if (Number.isNaN(at) || w.id === undefined || w.id === null) return null;
  return {
    id: String(w.id),
    at,
    by: text(w.by),
    action: text(w.action),
    target: text(w.target),
    detail: text(w.detail),
    ...(text(w.byName) ? { byName: text(w.byName) } : {}),
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
            const page = await a.get<{ items?: Wire[]; nextCursor?: unknown }>(PATH, {
              limit: Math.min(PAGE_MAX, n - items.length),
              cursor,
            });
            for (const w of page.items ?? []) {
              const entry = toEntry(w);
              if (entry) items.push(entry);
            }
            cursor = typeof page.nextCursor === 'string' ? page.nextCursor : undefined;
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

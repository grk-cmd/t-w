// API 판 — `PATCH /v2/admin/bugs/{number} { version, status }`(요청은 entities/bug-board 의 `changeBugStatus` — 릴리스 반영 · 할 일 완료와 같이 쓴다).
import { changeBugStatus } from '@/entities/bug-board';
import { perApi, type Api } from '@/shared/api';
import type { ChangeStatusPort } from './port';

function build(api: Api | null): ChangeStatusPort {
  return { change: (item, status, label) => changeBugStatus(api, item, status, label) };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerChangeStatusPort = perApi(build);

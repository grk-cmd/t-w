// API 판 — `GET /v2/admin/metrics/totals` 의 `users`(가입자 수).
import { adminPath, perApi, portCall, type Api } from '@/shared/api';
import type { UserCountPort } from './port';

function build(api: Api | null): UserCountPort {
  return {
    async get() {
      const totals = await portCall(
        api,
        (a) => a.get<{ users?: unknown }>(adminPath('/metrics/totals')),
        '가입자 수를 불러오지 못했어요',
      );
      return typeof totals.users === 'number' ? totals.users : 0;
    },
  };
}

export const createServerUserCountPort = perApi(build);

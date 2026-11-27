// API 판 — `GET /v2/admin/metrics/totals` 의 `users`(가입자 수).
import { adminPath, perApi, portCall, wireNumber, wireObject, type Api } from '@/shared/api';
import type { UserCountPort } from './port';

function build(api: Api | null): UserCountPort {
  return {
    async get() {
      const totals = await portCall(
        api,
        (a) => a.get<unknown>(adminPath('/metrics/totals')),
        '가입자 수를 불러오지 못했어요',
      );
      return wireNumber(wireObject(totals, '지표 합계').users, '지표 합계의 users');
    },
  };
}

export const createServerUserCountPort = perApi(build);

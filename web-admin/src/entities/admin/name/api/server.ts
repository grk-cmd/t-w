// API 판 — `GET /v2/admin/admins` → `[{ authUid, name }]`(이름을 아직 안 정한 관리자는 name 이 null · 먼저 들어온 순).
// 이름표는 이름이 있는 관리자만 담는다(Firebase 판도 한 번도 안 들어온 관리자는 없다). 이름을 못 받으면 던진다 — 빈 표로 덮지 않는다.
import {
  adminPath,
  perApi,
  portCall,
  wireArray,
  wireNullableString,
  wireObject,
  wireString,
  type Api,
} from '@/shared/api';
import type { AdminNamePort } from './port';

const ADMINS = adminPath('/admins');

function build(api: Api | null): AdminNamePort {
  return {
    names: () =>
      portCall(
        api,
        async (a) => {
          const names = new Map<string, string>();
          for (const row of wireArray(await a.get<unknown>(ADMINS), '관리자 목록')) {
            const o = wireObject(row, '관리자 목록의 줄');
            const uid = wireString(o.authUid, '관리자 줄의 authUid');
            const name = wireNullableString(o.name, `관리자 ${uid} 의 name`);
            if (name !== null && name.trim()) names.set(uid, name.trim());
          }
          return names;
        },
        '관리자 이름을 불러오지 못했어요',
      ),
  };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerAdminNamePort = perApi(build);

import { cleanAdminName } from '@/entities/admin/name';
import { ApiError, apiErrorText, type Api } from '@/shared/api';

/** `GET /v1/admin/admins/me` 의 답. */
interface AdminMe {
  name?: unknown;
  version?: unknown;
}

export type AdminCheck =
  | { state: 'admin'; name: string; version: number }
  | { state: 'denied' }
  | { state: 'unreachable'; message: string };

const NO_API = '이 환경에는 API 주소가 없어요 — 빌드 값 VITE_API_BASE_URL 로 정해 주세요';

/**
 * 로그인 뒤 «관리자인가» — 서버가 토큰의 uid 로 판정한다(403 이면 관리자가 아님).
 * 닿지 못하면 관리자 화면을 열지 않는다(`unreachable`). 이름이 비었으면 로그인 이름으로 한 번 채운다(실패해도 로그인은 그대로).
 */
export async function checkAdmin(api: Api | null, displayName: string | null): Promise<AdminCheck> {
  if (!api) return { state: 'unreachable', message: NO_API };
  let me: AdminMe;
  try {
    me = await api.get<AdminMe>('/v1/admin/admins/me');
  } catch (error) {
    if (error instanceof ApiError && error.kind === 'auth' && error.status === 403) {
      return { state: 'denied' };
    }
    return { state: 'unreachable', message: apiErrorText(error, '서버에 연결하지 못했어요') };
  }

  let name = typeof me.name === 'string' ? me.name : '';
  let version = typeof me.version === 'number' ? me.version : 0;
  const wanted = cleanAdminName(displayName);
  if (!name.trim() && wanted) {
    try {
      const saved = await api.send<AdminMe | null>('PATCH', '/v1/admin/admins/me', {
        body: { version, name: wanted },
      });
      name = typeof saved?.name === 'string' && saved.name ? saved.name : wanted;
      version = typeof saved?.version === 'number' ? saved.version : version + 1;
    } catch (error) {
      console.warn('[admin] 이름을 저장하지 못했어요', error);
    }
  }
  return { state: 'admin', name, version };
}

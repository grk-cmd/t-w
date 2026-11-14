// API 판 — `GET /v2/admin/admins/me` 한 번으로 서버가 토큰의 uid 로 가린다(403 이면 관리자가 아님).
// 서버에 닿지 못하면 관리자 화면을 열지 않는다. 이름이 비었으면 로그인 이름으로 한 번 채운다(실패해도 로그인은 그대로).
import { cleanAdminName } from '@/entities/admin/name';
import { adminPath, ApiError, apiErrorText, type Api } from '@/shared/api';
import type { AdminCheck, AuthPort, AuthUser } from './port';

/** `GET /v2/admin/admins/me` 의 답. */
interface AdminMe {
  name?: unknown;
  version?: unknown;
}

const ME_PATH = adminPath('/admins/me');

export const NO_API_TEXT = '이 환경에는 API 주소가 없어요 — 빌드 값 VITE_API_BASE_URL 로 정해 주세요';
export const NOT_READY_TEXT = '서버가 아직 옮기기 전이에요 — 이 빌드는 점검 뒤에 쓰는 판이에요';

export function createServerAuthPort(api: Api | null): AuthPort {
  async function checkAdmin(user: AuthUser): Promise<AdminCheck> {
    if (!api) return { state: 'unreachable', message: NO_API_TEXT };
    let me: AdminMe;
    try {
      me = await api.get<AdminMe>(ME_PATH);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.kind === 'notReady') return { state: 'notReady', message: NOT_READY_TEXT };
        if (error.kind === 'auth' && error.status === 403) {
          return {
            state: 'denied',
            message: `${user.email ?? user.uid} 은(는) 관리자로 등록된 계정이 아니에요.\n등록할 uid: ${user.uid}`,
          };
        }
      }
      return { state: 'unreachable', message: apiErrorText(error, '서버에 연결하지 못했어요') };
    }

    const name = typeof me.name === 'string' ? me.name : '';
    const wanted = cleanAdminName(user.displayName);
    if (!name.trim() && wanted) {
      try {
        await api.send('PATCH', ME_PATH, {
          body: { version: typeof me.version === 'number' ? me.version : 0, name: wanted },
        });
      } catch (error) {
        console.warn('[admin] 이름을 저장하지 못했어요', error);
      }
    }
    return { state: 'admin' };
  }

  return { signOutOnRefusal: false, checkAdmin };
}

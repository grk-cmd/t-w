// API 판 — `GET /v2/admin/admins/me` 한 번으로 서버가 토큰의 uid 로 가린다(403 이면 관리자가 아님).
// 서버에 닿지 못하면 관리자 화면을 열지 않는다. 이름이 비었으면 로그인 이름으로 한 번 채운다(실패해도 로그인은 그대로).
import { cleanAdminName } from '@/entities/admin/name';
import {
  adminPath,
  ApiError,
  apiErrorText,
  isPortError,
  wireNumber,
  wireObject,
  wireNullableString,
  type Api,
} from '@/shared/api';
import type { AdminCheck, AuthPort, AuthUser } from './port';

const ME_PATH = adminPath('/admins/me');

export const NO_API_TEXT = '이 환경에는 API 주소가 없어요 — 빌드 값 VITE_API_BASE_URL 로 정해 주세요';
export const NOT_READY_TEXT = '서버가 아직 옮기기 전이에요 — 이 빌드는 점검 뒤에 쓰는 판이에요';

/** 모양이 틀린 응답(PortError)은 그 문구를, 서버 오류는 표의 문구를. */
const failText = (error: unknown, fallback: string) =>
  isPortError(error) ? error.message : apiErrorText(error, fallback);

export function createServerAuthPort(api: Api | null): AuthPort {
  async function checkAdmin(user: AuthUser): Promise<AdminCheck> {
    if (!api) return { state: 'unreachable', message: NO_API_TEXT };
    let me: Record<string, unknown>;
    try {
      // 서버가 «관리자다» 하고 모양이 틀린 답을 주면 관리자 확인을 통과시키지 않는다(PortError → 닿지 못함 화면).
      me = wireObject(await api.get<unknown>(ME_PATH), '관리자 정보');
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
      return { state: 'unreachable', message: failText(error, '서버에 연결하지 못했어요') };
    }

    let name: string | null;
    let version: number;
    try {
      // 이름이 아직 없으면 서버가 null 을 준다(문서가 약속한 null).
      name = wireNullableString(me.name, '관리자 정보의 name');
      version = wireNumber(me.version, '관리자 정보의 version');
    } catch (error) {
      return { state: 'unreachable', message: failText(error, '서버 응답이 이상해요') };
    }
    const wanted = cleanAdminName(user.displayName);
    if (!name?.trim() && wanted) {
      try {
        await api.send('PATCH', ME_PATH, { body: { version, name: wanted } });
      } catch (error) {
        console.warn('[admin] 이름을 저장하지 못했어요', error);
      }
    }
    return { state: 'admin' };
  }

  return { signOutOnRefusal: false, checkAdmin };
}

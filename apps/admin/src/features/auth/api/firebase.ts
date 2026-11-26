// Firebase 판 — 지금 코드 그대로: `licenses` 한 건을 읽어 보는 것으로 관리자를 가리고, 구글 이름을 이름 칸에 채운다.
import { syncMyAdminName } from '@/entities/admin/name';
import { isAdmin, type Db } from '@/shared/api';
import type { AuthPort } from './port';

export function createFirebaseAuthPort(db: Db): AuthPort {
  return {
    signOutOnRefusal: true,
    async checkAdmin(user) {
      try {
        if (await isAdmin(db)) {
          // 할 일 작업자 목록에 보일 이름 — 같으면 쓰지 않는다. 실패해도 로그인은 그대로.
          void syncMyAdminName(db, user.uid, user.displayName);
          return { state: 'admin' };
        }
        // 등록하려면 콘솔에서 admins/{uid} 를 넣어야 하니 uid 를 바로 복사할 수 있게 보여 준다.
        return {
          state: 'denied',
          message: `${user.email ?? user.uid} 은(는) 관리자로 등록된 계정이 아니에요.\n등록할 uid: ${user.uid}`,
        };
      } catch {
        return {
          state: 'unreachable',
          message: '관리자 여부를 확인하지 못했어요 — 네트워크를 확인하고 다시 로그인해 주세요',
        };
      }
    },
  };
}

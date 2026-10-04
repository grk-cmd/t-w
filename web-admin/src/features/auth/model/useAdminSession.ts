import type { User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { isAdmin, queryClient, type Firebase } from '@/shared/api';

export type AdminSession =
  { state: 'checking' } | { state: 'signedOut'; message?: string } | { state: 'admin'; user: User };

// 로그인 상태가 바뀔 때마다(새로고침 포함) 관리자인지 다시 확인한다. 관리자가 아니면 바로 로그아웃시킨다.
export function useAdminSession(fb: Firebase): AdminSession {
  const [session, setSession] = useState<AdminSession>({ state: 'checking' });

  useEffect(
    () =>
      fb.onAuth(async (user) => {
        if (!user) {
          queryClient.clear(); // 다음에 들어오는 계정에게 이전 계정이 받은 목록을 보이지 않는다
          setSession((s) => (s.state === 'signedOut' ? s : { state: 'signedOut' }));
          return;
        }
        setSession({ state: 'checking' });
        let message: string;
        try {
          if (await isAdmin(fb.db)) {
            setSession({ state: 'admin', user });
            return;
          }
          // 등록하려면 콘솔에서 admins/{uid} 를 넣어야 하니 uid 를 바로 복사할 수 있게 보여 준다.
          message = `${user.email ?? user.uid} 은(는) 관리자로 등록된 계정이 아니에요.\n등록할 uid: ${user.uid}`;
        } catch {
          message = '관리자 여부를 확인하지 못했어요 — 네트워크를 확인하고 다시 로그인해 주세요';
        }
        setSession({ state: 'signedOut', message });
        await fb.signOut();
      }),
    [fb],
  );

  return session;
}

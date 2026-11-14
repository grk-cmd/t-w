import type { User } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import { queryClient, type Firebase } from '@/shared/api';
import { useAuthPort, type AdminCheck } from '../api';

/**
 * - `checking` — 로그인 상태 · 관리자 확인을 기다림
 * - `signedOut` — 로그인 전(또는 막혀 로그아웃됨 — 이유는 `message`)
 * - `blocked` — 로그인은 됐으나 관리자 화면을 열 수 없음(관리자가 아님 · 서버에 닿지 못함). «다시 시도 · 로그아웃» 을 보인다
 */
export type AdminSession =
  | { state: 'checking' }
  | { state: 'signedOut'; message?: string }
  | { state: 'blocked'; user: User; refusal: Exclude<AdminCheck, { state: 'admin' }> }
  | { state: 'admin'; user: User };

export interface AdminSessionControl {
  session: AdminSession;
  /** 막힌 화면의 «다시 시도». */
  retry: () => void;
}

// 로그인 상태가 바뀔 때마다(새로고침 포함) 관리자인지 다시 확인한다. 관리자가 아니면 판에 따라 로그아웃시키거나 막힌 화면에 둔다.
export function useAdminSession(fb: Firebase): AdminSessionControl {
  const port = useAuthPort();
  const [session, setSession] = useState<AdminSession>({ state: 'checking' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    const unsubscribe = fb.onAuth(async (user) => {
      if (!user) {
        queryClient.clear(); // 다음에 들어오는 계정에게 이전 계정이 받은 목록을 보이지 않는다
        setSession((s) => (s.state === 'signedOut' ? s : { state: 'signedOut' }));
        return;
      }
      setSession({ state: 'checking' });
      const check = await port.checkAdmin(user);
      if (!current) return;
      if (check.state === 'admin') {
        setSession({ state: 'admin', user });
      } else if (port.signOutOnRefusal) {
        setSession({ state: 'signedOut', message: check.message });
        await fb.signOut();
      } else {
        setSession({ state: 'blocked', user, refusal: check });
      }
    });
    return () => {
      current = false;
      unsubscribe();
    };
  }, [fb, port, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { session, retry };
}

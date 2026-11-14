import type { User } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import { queryClient, type Firebase } from '@/shared/api';
import { checkAdmin } from './checkAdmin';

/**
 * - `loading` — 로그인 상태 · 관리자 확인을 기다림
 * - `signedOut` — 로그인 전
 * - `denied` — 로그인은 됐으나 관리자 계정이 아님(서버 403)
 * - `unreachable` — 서버에 닿지 못해 관리자인지 모름(관리자 화면을 열지 않는다)
 */
export type AdminSession =
  | { state: 'loading' }
  | { state: 'signedOut' }
  | { state: 'denied'; user: User }
  | { state: 'unreachable'; user: User; message: string }
  | { state: 'admin'; user: User; name: string; version: number };

export interface AdminSessionControl {
  session: AdminSession;
  /** 닿지 못했을 때 «다시 시도». */
  retry: () => void;
}

// 로그인 상태가 바뀔 때마다(새로고침 포함) 서버에 관리자인지 확인한다.
export function useAdminSession(fb: Firebase): AdminSessionControl {
  const [session, setSession] = useState<AdminSession>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    const unsubscribe = fb.onAuth(async (user) => {
      if (!user) {
        queryClient.clear(); // 다음에 들어오는 계정에게 이전 계정이 받은 목록을 보이지 않는다
        setSession((s) => (s.state === 'signedOut' ? s : { state: 'signedOut' }));
        return;
      }
      setSession({ state: 'loading' });
      const check = await checkAdmin(fb.api, user.displayName);
      if (!current) return;
      setSession(
        check.state === 'admin'
          ? { state: 'admin', user, name: check.name, version: check.version }
          : check.state === 'denied'
            ? { state: 'denied', user }
            : { state: 'unreachable', user, message: check.message },
      );
    });
    return () => {
      current = false;
      unsubscribe();
    };
  }, [fb, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { session, retry };
}

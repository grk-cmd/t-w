import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAccountSnaps } from '@/entities/account';
import { useLicenses } from '@/entities/license';
import { buildUserRows, useFriendCodes, type UserRow } from '@/entities/user';

// 세 목록을 받아 사용자 한 줄씩으로 맞춘다. licenses 는 라이선스 화면과 캐시를 같이 쓴다.
export function useUserRows(): { rows: UserRow[] | null; error: Error | null; refresh: () => void } {
  const client = useQueryClient();
  const accounts = useAccountSnaps();
  const friendCodes = useFriendCodes();
  const licenses = useLicenses();

  const rows = useMemo(
    () =>
      accounts.data && friendCodes.data && licenses.data
        ? buildUserRows(accounts.data, friendCodes.data, licenses.data)
        : null,
    [accounts.data, friendCodes.data, licenses.data],
  );

  const refresh = () => {
    for (const queryKey of [['accountSnap'], ['friendCodes'], ['licenses'], ['userName']]) {
      client.invalidateQueries({ queryKey });
    }
  };

  return { rows, error: accounts.error ?? friendCodes.error ?? licenses.error, refresh };
}

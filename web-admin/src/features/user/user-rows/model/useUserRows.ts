import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAccountSnaps } from '@/entities/account';
import { useLicenses } from '@/entities/license';
import { buildUserRows, useFriendCodes, type UserRow } from '@/entities/user';

// 세 목록을 받아 사용자 한 줄씩으로 맞춘다. 사용자 화면 · 방 서버 화면이 같은 캐시를 쓴다(따로 내려받지 않음).
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
    // 상세 창만 쓰는 칸(집중 · 시크릿룸 · 신고 수)도 함께 — 열려 있는 창은 바로 다시 읽는다.
    const keys = [
      ['accountSnap'],
      ['friendCodes'],
      ['licenses'],
      ['userName'],
      ['userFocus'],
      ['userSecretRoom'],
      ['reports'],
    ];
    for (const queryKey of keys) {
      client.invalidateQueries({ queryKey });
    }
  };

  return { rows, error: accounts.error ?? friendCodes.error ?? licenses.error, refresh };
}

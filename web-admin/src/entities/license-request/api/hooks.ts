import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { LicenseRequest } from '../model/request';
import { useLicenseRequestPort } from './index';

const REQUESTS_KEY = ['licenseRequests'];

/**
 * 대기 요청 — Firebase 판은 지켜보고(받은 값을 다른 목록과 같은 캐시에 넣는다, 따로 한 번 더 받지 않도록 skipToken),
 * API 판은 연결이 없어 열려 있는 동안 주기로 묻는다(탭이 가려지면 멈춘다).
 */
export function usePendingRequests(): { data: LicenseRequest[] | undefined; error: Error | null } {
  const port = useLicenseRequestPort();
  const client = useQueryClient();
  const [watchError, setWatchError] = useState<Error | null>(null);

  useEffect(
    () =>
      port.kind === 'watch'
        ? port.watch((pending) => client.setQueryData(REQUESTS_KEY, pending), setWatchError)
        : undefined,
    [port, client],
  );

  const query = useQuery<LicenseRequest[]>({
    queryKey: REQUESTS_KEY,
    queryFn: port.kind === 'poll' ? () => port.pending() : skipToken,
    refetchInterval: port.kind === 'poll' ? port.intervalMs : false,
  });
  return { data: query.data, error: port.kind === 'watch' ? watchError : query.error };
}

/** 지금 바로 다시 받는다 — API 판의 새로고침 단추 · 승인 · 거절 뒤. Firebase 판은 지켜보고 있어 할 일이 없다. */
export function useReloadRequests(): (() => void) | null {
  const port = useLicenseRequestPort();
  const client = useQueryClient();
  return port.kind === 'poll' ? () => void client.invalidateQueries({ queryKey: REQUESTS_KEY }) : null;
}

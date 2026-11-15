import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { LicenseRequest } from '../model/request';
import { useLicenseRequestPort } from './index';

const REQUESTS_KEY = ['licenseRequests'];

/**
 * 대기 요청 — 작은 노드라 지켜보고, 받은 값을 다른 목록과 같은 캐시에 넣는다.
 * 따로 한 번 더 받지 않도록(skipToken) 값은 지켜보기에서만 들어온다.
 */
export function usePendingRequests(): { data: LicenseRequest[] | undefined; error: Error | null } {
  const port = useLicenseRequestPort();
  const client = useQueryClient();
  const [error, setError] = useState<Error | null>(null);

  useEffect(
    () => port.watch((pending) => client.setQueryData(REQUESTS_KEY, pending), setError),
    [port, client],
  );

  const { data } = useQuery<LicenseRequest[]>({ queryKey: REQUESTS_KEY, queryFn: skipToken });
  return { data, error };
}

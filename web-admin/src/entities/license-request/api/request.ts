import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useDb, type Db } from '@/shared/api';
import { pendingRequests, type LicenseRequest, type RawRequest } from '../model/request';

const REQUESTS_KEY = ['licenseRequests'];

/**
 * 대기 요청 — 작은 노드라 실시간으로 지켜보고, 받은 값을 다른 목록과 같은 캐시에 넣는다.
 * 따로 한 번 더 받지 않도록(skipToken) 값은 구독에서만 들어온다. 같은 경로 구독은 Firebase SDK 가 하나로 합친다.
 */
export function usePendingRequests(): { data: LicenseRequest[] | undefined; error: Error | null } {
  const db = useDb();
  const client = useQueryClient();
  const [error, setError] = useState<Error | null>(null);

  useEffect(
    () =>
      db.watch<Record<string, RawRequest>>(
        'licenseRequests',
        (all) => client.setQueryData(REQUESTS_KEY, pendingRequests(all ?? {})),
        setError,
      ),
    [db, client],
  );

  const { data } = useQuery<LicenseRequest[]>({ queryKey: REQUESTS_KEY, queryFn: skipToken });
  return { data, error };
}

/** 요청을 승인으로 바꾸는 쓰기 — 앱의 요청 화면이 status · issuedKey 를 지켜본다. */
export function approvedWrite(db: Db, id: string, key: string) {
  return {
    [`licenseRequests/${id}/status`]: 'approved',
    [`licenseRequests/${id}/issuedKey`]: key,
    [`licenseRequests/${id}/approvedAt`]: db.now(),
  };
}

// 지우면 앱의 요청 화면이 처음 상태로 돌아가 다시 요청할 수 있다 — 그게 «거절» 이다.
export function removeRequest(db: Db, id: string): Promise<void> {
  return db.remove(`licenseRequests/${id}`);
}

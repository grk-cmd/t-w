import { skipToken, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { KEYSET_PAGE_MAX, keysetView, resetKeyset } from '@/shared/lib';
import type { LicenseRequest } from '../model/request';
import { useLicenseRequestPort } from './index';

const REQUESTS_KEY = ['licenseRequests'];
const REQUESTS_KEYSET_KEY = ['licenseRequests', 'keyset'];

/**
 * 지켜보는 판(`kind: 'watch'` — Firebase)의 대기 요청 전부 — 받은 값을 캐시에 넣는다(따로 한 번 더 받지 않도록 skipToken).
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

  const query = useQuery<LicenseRequest[]>({ queryKey: REQUESTS_KEY, queryFn: skipToken });
  return { data: query.data, error: watchError };
}

/**
 * 주기로 묻는 판(`kind: 'poll'` — API) — 쪽으로 받고 열려 있는 동안 받아 둔 쪽을 다시 받는다(탭이 가려지면 멈춘다).
 * 이어 붙이기 · 쪽 넘기기는 `useKeysetPaging` 이 한다.
 */
export function usePendingRequestsKeyset() {
  const port = useLicenseRequestPort();
  return useInfiniteQuery({
    queryKey: REQUESTS_KEYSET_KEY,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      if (port.kind !== 'poll') throw new Error('이 판은 요청 목록을 지켜봐요');
      return port.page(pageParam, KEYSET_PAGE_MAX);
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: port.kind === 'poll',
    refetchInterval: port.kind === 'poll' ? port.intervalMs : false,
  });
}

/** 탭에 보일 대기 수 — 지켜보는 판은 받은 수, 쪽으로 받는 판은 첫 쪽 `total`. 아직 모르면 null. */
export function usePendingCount(): number | null {
  const port = useLicenseRequestPort();
  const watched = usePendingRequests();
  const polled = usePendingRequestsKeyset();
  if (port.kind === 'watch') return watched.data?.length ?? null;
  return polled.data ? keysetView(polled.data.pages).total : null;
}

/**
 * 지금 바로 첫 쪽부터 다시 받는다 — API 판의 새로고침 단추 · 승인 · 거절 뒤(옛 커서 · `total` 을 이어 쓰지 않는다).
 * Firebase 판은 지켜보고 있어 할 일이 없다.
 */
export function useReloadRequests(): (() => void) | null {
  const port = useLicenseRequestPort();
  const client = useQueryClient();
  return port.kind === 'poll' ? () => void resetKeyset(client, REQUESTS_KEYSET_KEY) : null;
}

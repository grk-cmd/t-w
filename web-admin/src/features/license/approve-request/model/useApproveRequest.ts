import { useMutation } from '@tanstack/react-query';
import { useRefreshLicenses } from '@/entities/license';
import type { LicenseRequest } from '@/entities/license-request';
import { useDb } from '@/shared/api';
import { approveRequest, approveRequests, rejectRequest } from './approveRequest';

// 요청 목록은 실시간 구독이라 따로 다시 받을 필요가 없다. 키 목록만 새로 받는다.
export function useApproveRequest() {
  const db = useDb();
  const refresh = useRefreshLicenses();
  return useMutation({ mutationFn: (req: LicenseRequest) => approveRequest(db, req), onSuccess: refresh });
}

export function useApproveRequests() {
  const db = useDb();
  const refresh = useRefreshLicenses();
  return useMutation({
    mutationFn: (reqs: LicenseRequest[]) => approveRequests(db, reqs),
    onSettled: refresh,
  });
}

export function useRejectRequest() {
  const db = useDb();
  return useMutation({ mutationFn: (req: LicenseRequest) => rejectRequest(db, req) });
}

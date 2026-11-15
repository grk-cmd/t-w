import { useMutation } from '@tanstack/react-query';
import { useRefreshLicenses } from '@/entities/license';
import type { LicenseRequest } from '@/entities/license-request';
import { useApproveRequestPort } from '../api';

// 요청 목록은 실시간 구독이라 따로 다시 받을 필요가 없다. 키 목록만 새로 받는다.
export function useApproveRequest() {
  const port = useApproveRequestPort();
  const refresh = useRefreshLicenses();
  return useMutation({ mutationFn: (req: LicenseRequest) => port.approve(req), onSuccess: refresh });
}

export function useApproveRequests() {
  const port = useApproveRequestPort();
  const refresh = useRefreshLicenses();
  return useMutation({
    mutationFn: (reqs: LicenseRequest[]) => port.approveAll(reqs),
    onSettled: refresh,
  });
}

export function useRejectRequest() {
  const port = useApproveRequestPort();
  return useMutation({ mutationFn: (req: LicenseRequest) => port.reject(req) });
}

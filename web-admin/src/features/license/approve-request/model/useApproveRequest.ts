import { useMutation } from '@tanstack/react-query';
import { useRefreshLicenses } from '@/entities/license';
import { useReloadRequests, type LicenseRequest } from '@/entities/license-request';
import { useApproveRequestPort } from '../api';

// Firebase 판은 요청 목록을 지켜보고 있어 따로 다시 받을 필요가 없다(`useReloadRequests` 가 null). API 판은 쓴 뒤 바로 다시 받는다 —
// 이미 처리된 요청이어서 실패해도(다른 관리자가 먼저) 같다. 키 목록은 새로 받는다.
export function useApproveRequest() {
  const port = useApproveRequestPort();
  const refresh = useRefreshLicenses();
  const reloadRequests = useReloadRequests();
  return useMutation({
    mutationFn: (req: LicenseRequest) => port.approve(req),
    onSuccess: refresh,
    onSettled: () => reloadRequests?.(),
  });
}

export function useApproveRequests() {
  const port = useApproveRequestPort();
  const refresh = useRefreshLicenses();
  const reloadRequests = useReloadRequests();
  return useMutation({
    mutationFn: (reqs: LicenseRequest[]) => port.approveAll(reqs),
    onSettled: () => {
      refresh();
      reloadRequests?.();
    },
  });
}

export function useRejectRequest() {
  const port = useApproveRequestPort();
  const reloadRequests = useReloadRequests();
  return useMutation({
    mutationFn: (req: LicenseRequest) => port.reject(req),
    onSettled: () => reloadRequests?.(),
  });
}

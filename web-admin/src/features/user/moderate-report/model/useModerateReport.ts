import { useMutation } from '@tanstack/react-query';
import { useForgetReports, useRefreshReports } from '@/entities/report';
import { useForgetAwayImg, useRefreshUserBrief } from '@/entities/user';
import { useModerateReportPort } from '../api';

// 쓰고 나면 캐시만 고친다 — 신고 목록을 통째로 다시 받지 않는다.
export function useTakeDownAwayImg(target: string) {
  const port = useModerateReportPort();
  const forgetReports = useForgetReports();
  const forgetAwayImg = useForgetAwayImg();
  const refreshBrief = useRefreshUserBrief();
  const refreshReports = useRefreshReports();
  return useMutation({
    mutationFn: (shownUrl: string) => port.takeDown(target, shownUrl),
    onSuccess: (r) => {
      if (r.ok) {
        forgetAwayImg(target);
        forgetReports(target);
      } else {
        // 그 사이 그림이 바뀌었다 — 목록 · 사람 정보를 한 번 다시 받는다.
        refreshReports();
        refreshBrief(target);
      }
    },
  });
}

export function useDismissReports(target: string) {
  const port = useModerateReportPort();
  const forgetReports = useForgetReports();
  return useMutation({
    mutationFn: () => port.dismiss(target),
    onSuccess: () => forgetReports(target),
  });
}

export function useDismissReportsMany() {
  const port = useModerateReportPort();
  const forgetReports = useForgetReports();
  return useMutation({
    mutationFn: (targets: string[]) => port.dismissMany(targets),
    onSuccess: (r) => r.dismissed.forEach(forgetReports),
  });
}

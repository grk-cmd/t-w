import { useMutation } from '@tanstack/react-query';
import { useForgetReports } from '@/entities/report';
import { useForgetAwayImg, useRefreshUserBrief } from '@/entities/user';
import { useDb, useFiles } from '@/shared/api';
import { dismissReports, takeDownAwayImg } from './moderateReport';

// 쓰고 나면 캐시만 고친다 — 신고 목록을 통째로 다시 받지 않는다.
export function useTakeDownAwayImg(target: string) {
  const db = useDb();
  const files = useFiles();
  const forgetReports = useForgetReports();
  const forgetAwayImg = useForgetAwayImg();
  const refreshBrief = useRefreshUserBrief();
  return useMutation({
    mutationFn: (shownUrl: string) => takeDownAwayImg(db, files, target, shownUrl),
    onSuccess: (r) => {
      if (r.ok) {
        forgetAwayImg(target);
        forgetReports(target);
      } else {
        refreshBrief(target);
      }
    },
  });
}

export function useDismissReports(target: string) {
  const db = useDb();
  const forgetReports = useForgetReports();
  return useMutation({
    mutationFn: () => dismissReports(db, target),
    onSuccess: () => forgetReports(target),
  });
}

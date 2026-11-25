import { useMutation } from '@tanstack/react-query';
import { useForgetXmasReport, type XmasReport } from '@/entities/seasonal/xmas-event';
import { useApi } from '@/shared/api';
import { dismissXmasReport, removeGotLetter, removeOrnament } from './moderateXmas';

// 처리한 신고는 캐시에서만 뺀다 — 신고 목록을 통째로 다시 받지 않는다.
// 장식은 본 판(version)을 같이 넘긴다 — 상세에서 읽은 값.
export function useRemoveReported() {
  const api = useApi();
  const forget = useForgetXmasReport();
  return useMutation({
    mutationFn: ({ report, version }: { report: XmasReport; version: number | null }) =>
      report.kind === 'orn'
        ? removeOrnament(api, report.tree, report.slot, version ?? -1)
        : removeGotLetter(api, report.got, report.n),
    onSuccess: (_v, { report }) => forget(report.key),
  });
}

export function useDismissXmasReport() {
  const api = useApi();
  const forget = useForgetXmasReport();
  return useMutation({
    mutationFn: (key: string) => dismissXmasReport(api, key),
    onSuccess: (_v, key) => forget(key),
  });
}

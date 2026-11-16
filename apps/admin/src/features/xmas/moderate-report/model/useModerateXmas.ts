import { useMutation } from '@tanstack/react-query';
import { useForgetXmasReport, type XmasReport } from '@/entities/seasonal/xmas-event';
import { useDb, useFunctions } from '@/shared/api';
import { dismissXmasReport, removeGotLetter, removeOrnament } from './moderateXmas';

// 처리한 신고는 캐시에서만 뺀다 — 신고 목록을 통째로 다시 받지 않는다.
export function useRemoveReported() {
  const fns = useFunctions();
  const db = useDb();
  const forget = useForgetXmasReport();
  return useMutation({
    mutationFn: (r: XmasReport) =>
      r.kind === 'orn' ? removeOrnament(fns, db, r.tree, r.slot) : removeGotLetter(fns, db, r.got, r.n),
    onSuccess: (_v, r) => forget(r.key),
  });
}

export function useDismissXmasReport() {
  const db = useDb();
  const forget = useForgetXmasReport();
  return useMutation({
    mutationFn: (key: string) => dismissXmasReport(db, key),
    onSuccess: (_v, key) => forget(key),
  });
}

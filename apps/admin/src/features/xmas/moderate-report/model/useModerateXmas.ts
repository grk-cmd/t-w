import { useMutation } from '@tanstack/react-query';
import { useForgetXmasReport } from '@/entities/seasonal/xmas-event';
import { useApi } from '@/shared/api';
import { dismissXmasReport, removeGotLetter, removeOrnament } from './moderateXmas';

// 처리한 신고는 캐시에서만 뺀다 — 신고 목록을 통째로 다시 받지 않는다.
// 장식은 본 판(version)을 같이 넘긴다 — 상세에서 읽은 값(이미 없는 장식은 지우기 단추를 그리지 않는다).
export type RemoveTarget =
  | { key: string; kind: 'orn'; tree: number; slot: number; version: number }
  | { key: string; kind: 'got'; got: string; n: number };
export function useRemoveReported() {
  const api = useApi();
  const forget = useForgetXmasReport();
  return useMutation({
    mutationFn: (t: RemoveTarget) =>
      t.kind === 'orn' ? removeOrnament(api, t.tree, t.slot, t.version) : removeGotLetter(api, t.got, t.n),
    onSuccess: (_v, t) => forget(t.key),
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

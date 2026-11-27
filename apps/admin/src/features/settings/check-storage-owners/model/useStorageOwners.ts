import { useMutation } from '@tanstack/react-query';
import type { StorageOwnersPort } from '../api/port';

/** 확인 · 채우기 — 둘 다 누를 때 한 번 부른다(읽어 두지 않는다). */
export function useStorageOwners(port: StorageOwnersPort) {
  const check = useMutation({ mutationFn: () => port.check() });
  const backfill = useMutation({ mutationFn: (memo: string) => port.backfill(memo) });
  return { check, backfill };
}

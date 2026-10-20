import { useMutation } from '@tanstack/react-query';
import {
  useApplyCatalogWrite,
  useCatalogNode,
  type CatalogKind,
  type CatalogRecord,
  type CleanupTarget,
} from '@/entities/catalog';
import { useDb } from '@/shared/api';
import { cleanBase64 } from './cleanBase64';

type Raw = Record<string, CatalogRecord>;

/** 진단에 쓰는 네 종류 — 목록 탭에서 이미 받았으면 그 캐시를 그대로 쓴다. */
export function useDiagnoseSource() {
  const parts = useCatalogNode<CatalogRecord>('parts');
  const gachaParts = useCatalogNode<CatalogRecord>('gachaParts');
  const desks = useCatalogNode<CatalogRecord>('desks');
  const items = useCatalogNode<CatalogRecord>('items');
  const all = { parts, gachaParts, desks, items };
  const error = Object.values(all).find((q) => q.error)?.error ?? null;
  const ready = Object.values(all).every((q) => q.data);
  const data = ready
    ? (Object.fromEntries(Object.entries(all).map(([k, q]) => [k, q.data])) as Record<CatalogKind, Raw>)
    : null;
  return { data, error };
}

export function useCleanBase64() {
  const db = useDb();
  const apply = useApplyCatalogWrite();
  return useMutation({
    mutationFn: (targets: CleanupTarget[]) => cleanBase64(db, targets),
    onSuccess: (r) => apply(r.written),
  });
}

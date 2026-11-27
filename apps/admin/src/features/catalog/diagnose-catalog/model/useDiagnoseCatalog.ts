import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyCatalogWrite,
  applyEdits,
  getCatalogNode,
  type CatalogKind,
  type CatalogNode,
  type CatalogRecord,
  type CleanupTarget,
} from '@/entities/catalog';
import { useDb } from '@/shared/api';
import { cleanBase64 } from './cleanBase64';

type Raw = Record<string, CatalogRecord>;

// Firebase 판에만 있는 화면(진단) — 진단은 노드를 통째로 읽어 크기를 잰다. 목록의 진열대와 캐시를 나눠 쓰지 않는다.
const nodeKey = (node: CatalogNode) => ['catalog', 'node', node];
const DIAGNOSE_NODES: readonly CatalogKind[] = ['parts', 'gachaParts', 'desks', 'items'];

function useNode(node: CatalogKind) {
  const db = useDb();
  return useQuery({
    queryKey: nodeKey(node),
    queryFn: () => getCatalogNode<CatalogRecord>(db, node),
    gcTime: Infinity,
  });
}

/** 진단에 쓰는 네 종류. */
export function useDiagnoseSource() {
  const parts = useNode('parts');
  const gachaParts = useNode('gachaParts');
  const desks = useNode('desks');
  const items = useNode('items');
  const all = { parts, gachaParts, desks, items };
  const error = Object.values(all).find((q) => q.error)?.error ?? null;
  const ready = Object.values(all).every((q) => q.data);
  const data = ready
    ? (Object.fromEntries(Object.entries(all).map(([k, q]) => [k, q.data])) as Record<CatalogKind, Raw>)
    : null;
  return { data, error };
}

export function useRefreshDiagnose() {
  const client = useQueryClient();
  return () => DIAGNOSE_NODES.forEach((node) => client.invalidateQueries({ queryKey: nodeKey(node) }));
}

export function useCleanBase64() {
  const db = useDb();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (targets: CleanupTarget[]) => cleanBase64(db, targets),
    onSuccess: (r) => {
      // 받아 둔 노드에서 지운 glb 를 빼고, 목록의 «base64» 표시도 끈다 — 다시 받지 않는다.
      for (const node of DIAGNOSE_NODES) {
        client.setQueryData<Raw>(nodeKey(node), (old) =>
          old ? applyCatalogWrite(old, node, r.written) : old,
        );
      }
      applyEdits(
        client,
        r.cleaned.map((t) => ({ op: 'update', kind: t.kind, id: t.id, change: { base64: false } })),
      );
    },
  });
}

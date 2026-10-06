import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isPermissionDenied, useDb, type Db } from '@/shared/api';
import {
  applyCatalogWrite,
  CATALOG_NODES,
  catalogPath,
  withCatalogVersion,
  type CatalogNode,
  type CatalogWrite,
} from '../model/catalog';
import type { CatOverride, CustomCat } from '../model/category';
import { catalogEntries, type CatalogKind, type CatalogRecord } from '../model/entry';

const nodeKey = (node: CatalogNode) => ['catalog', node];

export async function getCatalogNode<T>(db: Db, node: CatalogNode): Promise<Record<string, T>> {
  return (await db.get<Record<string, T>>(catalogPath(node))) ?? {};
}

// 메뉴를 처음 열 때 종류마다 한 번만 받고 세션 동안 들고 있는다(gcTime 무한). 쓰고 나면 캐시만 고치고,
// 다시 받는 것은 새로고침 버튼뿐이다 — 옛 항목엔 glb base64 가 남아 있어 노드가 수 MB 일 수 있다.
export function useCatalogNode<T>(node: CatalogNode) {
  const db = useDb();
  return useQuery({
    queryKey: nodeKey(node),
    queryFn: () => getCatalogNode<T>(db, node),
    gcTime: Infinity,
  });
}

/** 같은 캐시를 진열 순서대로 편 목록. */
export function useCatalogEntries(kind: CatalogKind) {
  const db = useDb();
  return useQuery({
    queryKey: nodeKey(kind),
    queryFn: () => getCatalogNode<CatalogRecord>(db, kind),
    gcTime: Infinity,
    select: (raw: Record<string, CatalogRecord>) => catalogEntries(kind, raw),
  });
}

export const useCustomCats = () => useCatalogNode<CustomCat>('customCats');
export const useCatOverrides = () => useCatalogNode<CatOverride>('catOverrides');

export function useRefreshCatalog() {
  const client = useQueryClient();
  return (node: CatalogNode) => client.invalidateQueries({ queryKey: nodeKey(node) });
}

/** 방금 쓴 묶음을 받아 둔 노드들에 반영한다 — 아직 안 받은 노드는 건드리지 않는다. */
export function useApplyCatalogWrite() {
  const client = useQueryClient();
  return (updates: CatalogWrite) => {
    for (const node of CATALOG_NODES) {
      client.setQueryData<Record<string, object>>(nodeKey(node), (old) =>
        old ? applyCatalogWrite(old, node, updates) : old,
      );
    }
  };
}

/**
 * 카탈로그 쓰기는 전부 여기를 지난다 — 한 묶음(db.commit)이라 규칙에 하나라도 막히면 아무것도 바뀌지 않는다.
 * 바뀐 종류의 catalogMeta 버전도 같은 묶음으로 올린다(앱이 그걸 보고 캐시를 버린다).
 */
export async function catalogCommit(db: Db, updates: CatalogWrite): Promise<void> {
  if (!Object.keys(updates).length) return;
  const versioned = withCatalogVersion(updates, db.now());
  if (versioned === updates) return db.commit(updates);
  try {
    await db.commit(versioned);
  } catch (error) {
    // 규칙에 catalogMeta 가 아직 없는 DB(운영 규칙 배포 전)는 묶음째 거절한다 — 그때만 카탈로그만 다시 쓴다.
    // 그 DB 를 쓰는 앱은 catalogMeta 를 못 읽어 통째 구독으로 돌고 있으니 버전 없이도 바로 반영된다.
    if (!isPermissionDenied(error)) throw error;
    await db.commit(updates);
    console.warn('[catalog] catalogMeta 규칙이 없어 버전 없이 카탈로그만 썼다');
  }
}

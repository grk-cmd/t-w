// DB 모양은 앱(app/parts/firebase-init.js 카탈로그 · app.js 관리자 카탈로그)과 규칙 catalog/* 의 .validate 를 따른다.

/** 관리 화면이 받는 catalog 아래 노드. 종류마다 따로 받는다 — glb base64 가 남아 있으면 노드 하나가 수 MB 다. */
export type CatalogNode = 'parts' | 'gachaParts' | 'desks' | 'items' | 'customCats' | 'catOverrides';

export const CATALOG_NODES: readonly CatalogNode[] = [
  'parts',
  'gachaParts',
  'desks',
  'items',
  'customCats',
  'catOverrides',
];

/** 경로 → 값(null 이면 지움). db.commit 한 묶음으로 보낸다. */
export type CatalogWrite = Record<string, unknown>;

export const catalogPath = (node: CatalogNode, id?: string) =>
  id === undefined ? `catalog/${node}` : `catalog/${node}/${id}`;

/**
 * 방금 쓴 묶음을 받아 둔 노드에 그대로 반영한다 — 쓰고 나서 노드를 통째로 다시 받지 않으려고.
 * catalog/{node}/{id} 는 항목 통째, catalog/{node}/{id}/{필드} 는 그 필드만. 다른 노드 경로는 건너뛴다.
 */
export function applyCatalogWrite<T extends object>(
  current: Record<string, T>,
  node: CatalogNode,
  updates: CatalogWrite,
): Record<string, T> {
  const prefix = `${catalogPath(node)}/`;
  const paths = Object.keys(updates).filter((p) => p.startsWith(prefix));
  if (!paths.length) return current;
  const next: Record<string, T> = { ...current };
  for (const path of paths) {
    const value = updates[path];
    const [id, ...rest] = path.slice(prefix.length).split('/');
    if (!rest.length) {
      if (value === null) delete next[id];
      else next[id] = value as T;
      continue;
    }
    const rec = { ...(next[id] ?? {}) } as Record<string, unknown>;
    if (value === null) delete rec[rest.join('/')];
    else rec[rest.join('/')] = value;
    next[id] = rec as T;
  }
  return next;
}

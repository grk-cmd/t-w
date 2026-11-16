// Firebase 판 — 지금 코드 그대로: 종류마다 catalog 노드를 통째로 받고(옛 항목엔 glb base64 가 남아 노드가 수 MB 일 수 있다),
// 장착 수는 metrics 노드에서 따로 읽는다. 쓰기는 features/catalog/* 가 `catalogCommit` 으로 한 묶음씩 한다.
import { isPermissionDenied, type Db } from '@/shared/api';
import { catalogPath, withCatalogVersion, type CatalogNode, type CatalogWrite } from '../model/catalog';
import { categoryViews, type CatOverride, type CatView, type CustomCat } from '../model/category';
import { byShelfOrder, catalogEntries, type CatalogKind, type CatalogRecord } from '../model/entry';
import { equipCountOf, equipKindOf, equipPath, toEquipCounts, type EquipKind } from '../model/popularity';
import type { CatalogShelf } from '../model/shelf';
import type { CatalogPort } from './port';

export async function getCatalogNode<T>(db: Db, node: CatalogNode): Promise<Record<string, T>> {
  return (await db.get<Record<string, T>>(catalogPath(node))) ?? {};
}

export async function getEquipCounts(db: Db, kind: EquipKind): Promise<Record<string, number>> {
  return toEquipCounts(await db.get<unknown>(equipPath(kind)));
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

async function getCategories(db: Db): Promise<CatView[]> {
  const [customCats, overrides] = await Promise.all([
    getCatalogNode<CustomCat>(db, 'customCats'),
    getCatalogNode<CatOverride>(db, 'catOverrides'),
  ]);
  return categoryViews(customCats, overrides);
}

export function createFirebaseCatalogPort(db: Db): CatalogPort {
  return {
    sort: 'client',
    diagnosable: true,

    async shelf(kind): Promise<CatalogShelf> {
      // 파츠 탭은 보통 파츠(parts)와 가챠 파츠(gachaParts)를 한 목록으로 — 앱이 두 통을 order 로 합쳐 보이는 것과 같다.
      const nodes: CatalogKind[] = kind === 'parts' ? ['parts', 'gachaParts'] : [kind];
      const [raws, categories, counts] = await Promise.all([
        Promise.all(nodes.map((node) => getCatalogNode<CatalogRecord>(db, node))),
        kind === 'parts' ? getCategories(db) : [],
        // 장착 수를 못 읽어도 목록은 보인다 — 못 읽은 줄은 `equip: null`(화면이 «장착 ?» 로 보인다).
        getEquipCounts(db, equipKindOf(kind)).catch(() => null),
      ]);
      const entries = nodes
        .flatMap((node, i) => catalogEntries(node, raws[i]))
        .sort(byShelfOrder)
        .map((e) => ({ ...e, equip: counts ? equipCountOf(counts, e.id) : null }));
      return { entries, categories, shelves: {} };
    },

    categories: () => getCategories(db),
  };
}

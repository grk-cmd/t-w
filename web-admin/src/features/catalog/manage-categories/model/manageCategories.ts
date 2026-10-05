import { catalogCommit, categoryNameWrite, type CatalogWrite, type CatView } from '@/entities/catalog';
import type { Db } from '@/shared/api';

/** 쓴 묶음을 돌려준다 — 받아 둔 목록에 그대로 반영해 노드를 다시 받지 않으려고. */
export async function saveCategoryName(
  db: Db,
  cat: CatView,
  label: string,
  icon: string,
  now = Date.now(),
): Promise<CatalogWrite> {
  const write = categoryNameWrite(cat, label, icon, now);
  await catalogCommit(db, write);
  return write;
}

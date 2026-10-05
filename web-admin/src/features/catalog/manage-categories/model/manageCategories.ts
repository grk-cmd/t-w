import {
  catalogCommit,
  customCatWrite,
  overrideWrite,
  removeCustomCatsWrite,
  revertOverridesWrite,
  type CatalogWrite,
  type CustomCatInput,
} from '@/entities/catalog';
import type { Db } from '@/shared/api';

// 모두 쓴 묶음을 돌려준다 — 받아 둔 목록에 그대로 반영해 노드를 다시 받지 않으려고.

export async function addCustomCat(db: Db, input: CustomCatInput, now = Date.now()): Promise<CatalogWrite> {
  const write = customCatWrite(input, now);
  await catalogCommit(db, write);
  return write;
}

/** 카테고리만 지운다 — 그 카테고리의 파츠 데이터는 남는다(앱과 같다). */
export async function deleteCustomCats(db: Db, ids: readonly string[]): Promise<CatalogWrite> {
  const write = removeCustomCatsWrite(ids);
  await catalogCommit(db, write);
  return write;
}

export async function saveCatOverride(
  db: Db,
  cat: string,
  label: string,
  icon: string,
  now = Date.now(),
): Promise<CatalogWrite> {
  const write = overrideWrite(cat, label, icon, now);
  await catalogCommit(db, write);
  return write;
}

export async function revertCatOverrides(db: Db, cats: readonly string[]): Promise<CatalogWrite> {
  const write = revertOverridesWrite(cats);
  await catalogCommit(db, write);
  return write;
}

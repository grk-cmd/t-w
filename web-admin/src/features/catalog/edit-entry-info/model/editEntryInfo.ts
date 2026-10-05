import { catalogCommit, entryInfoWrite, type CatalogEntry, type CatalogWrite } from '@/entities/catalog';
import type { Db } from '@/shared/api';

/** 이름 · 아이콘 중 바뀐 것만 쓴다. 바뀐 게 없으면 아무것도 보내지 않고 빈 묶음을 돌려준다. */
export async function saveEntryInfo(
  db: Db,
  entry: CatalogEntry,
  name: string,
  icon: string,
): Promise<CatalogWrite> {
  const write = entryInfoWrite(entry, name, icon);
  await catalogCommit(db, write);
  return write;
}

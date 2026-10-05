import { catalogCommit, moveId, orderWrite, type CatalogEntry, type CatalogWrite } from '@/entities/catalog';
import type { Db } from '@/shared/api';

/**
 * 한 진열 칸(파츠는 카테고리 하나, 책상 · 아이템은 전체) 안에서 dragged 를 target 자리로 옮기고
 * 바뀐 order 만 한 묶음으로 쓴다. 바뀐 게 없으면 아무것도 보내지 않는다.
 */
export async function reorderEntries(
  db: Db,
  group: readonly CatalogEntry[],
  dragged: string,
  target: string,
): Promise<CatalogWrite> {
  const byId = new Map(group.map((e) => [e.id, e]));
  const ids = moveId(
    group.map((e) => e.id),
    dragged,
    target,
  );
  const write = orderWrite(ids.map((id) => byId.get(id)!));
  await catalogCommit(db, write);
  return write;
}

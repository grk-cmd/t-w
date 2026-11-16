// Firebase 판 — 지금 코드 그대로: 바뀐 order 만 한 묶음(db.commit)으로 쓰고, 감사 기록을 같이 남긴다.
import {
  catalogCommit,
  moveId,
  orderWrite,
  shelfScope,
  type CatalogEntry,
  type CatalogWrite,
} from '@/entities/catalog';
import { withAudit, type Db } from '@/shared/api';
import type { ReorderEntriesPort } from './port';

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
  await catalogCommit(db, withAudit(db, write, 'catalog.reorder', `${group[0]?.kind ?? ''}/${dragged}`));
  return write;
}

export function createFirebaseReorderEntriesPort(db: Db): ReorderEntriesPort {
  return {
    async reorder({ group, dragged, target }) {
      const written = await reorderEntries(db, group, dragged, target);
      return {
        ok: true,
        changed: Object.keys(written).length > 0,
        edits: group.length
          ? [
              {
                op: 'order',
                kind: group[0].kind,
                scope: shelfScope(group[0]),
                ids: moveId(
                  group.map((e) => e.id),
                  dragged,
                  target,
                ),
                version: 0,
              },
            ]
          : [],
      };
    },
  };
}

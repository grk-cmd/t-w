// Firebase 판 — 지금 코드 그대로: 바뀐 필드만 한 묶음(db.commit)으로 쓰고 감사 기록을 같이 남긴다. 마지막 쓰기가 이긴다.
import {
  catalogCommit,
  entryInfoProblem,
  entryInfoWrite,
  type CatalogEntry,
  type CatalogWrite,
} from '@/entities/catalog';
import { withAudit, type Db } from '@/shared/api';
import type { EditEntryInfoPort } from './port';

/** 이름 · 아이콘 중 바뀐 것만 쓴다. 바뀐 게 없으면 아무것도 보내지 않고 빈 묶음을 돌려준다. */
export async function saveEntryInfo(
  db: Db,
  entry: CatalogEntry,
  name: string,
  icon: string,
): Promise<CatalogWrite> {
  const write = entryInfoWrite(entry, name, icon);
  await catalogCommit(db, withAudit(db, write, 'catalog.editInfo', `${entry.kind}/${entry.id}`, name.trim()));
  return write;
}

export function createFirebaseEditEntryInfoPort(db: Db): EditEntryInfoPort {
  return {
    check: entryInfoProblem,
    async save(entry, name, icon) {
      const written = await saveEntryInfo(db, entry, name, icon);
      return {
        ok: true,
        changed: Object.keys(written).length > 0,
        edits: [
          { op: 'update', kind: entry.kind, id: entry.id, change: { name: name.trim(), icon: icon.trim() } },
        ],
      };
    },
  };
}

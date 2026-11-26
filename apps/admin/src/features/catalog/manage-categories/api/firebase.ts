// Firebase 판 — 지금 코드 그대로: 기본 카테고리는 catOverrides · 운영 추가는 customCats 에 이름 · 아이콘만 한 묶음(db.commit)으로 쓴다.
import {
  catalogCommit,
  categoryAfterNameSave,
  categoryNameProblem,
  categoryNameWrite,
  type CatalogWrite,
  type CatView,
} from '@/entities/catalog';
import { withAudit, type Db } from '@/shared/api';
import type { ManageCategoriesPort } from './port';

/** 쓴 묶음을 돌려준다 — 받아 둔 목록에 그대로 반영해 노드를 다시 받지 않으려고. */
export async function saveCategoryName(
  db: Db,
  cat: CatView,
  label: string,
  icon: string,
  now = Date.now(),
): Promise<CatalogWrite> {
  const write = categoryNameWrite(cat, label, icon, now);
  await catalogCommit(
    db,
    withAudit(db, write, 'catalog.categoryName', cat.id, label.trim() || '(기본 이름)'),
  );
  return write;
}

export function createFirebaseManageCategoriesPort(db: Db): ManageCategoriesPort {
  return {
    check: categoryNameProblem,
    async save(cat, label, icon) {
      await saveCategoryName(db, cat, label, icon);
      return {
        ok: true,
        changed: true,
        edits: [{ op: 'category', cat: categoryAfterNameSave(cat, label, icon) }],
      };
    },
  };
}

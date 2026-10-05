import { describe, expect, it } from 'vitest';
import {
  addCustomCat,
  deleteCustomCats,
  revertCatOverrides,
  saveCatOverride,
} from '@/features/catalog/manage-categories';
import { fakeDb } from '../shared/fakeDb';

describe('카테고리 관리', () => {
  it('추가 · 덮어쓰기는 한 묶음으로 쓰고 쓴 묶음을 돌려준다', async () => {
    const { db, writes } = fakeDb();
    const added = await addCustomCat(
      db,
      { id: 'scarf', label: '목도리', icon: '', group: 'cloth', bone: 'spine' },
      1,
    );
    const saved = await saveCatOverride(db, 'cape', '겉옷', '🧥', 2);
    expect(writes).toEqual([
      ['commit', 'catalog/customCats/scarf', added['catalog/customCats/scarf']],
      ['commit', 'catalog/catOverrides/cape', { label: '겉옷', icon: '🧥', updatedAt: 2 }],
    ]);
    expect(saved).toEqual({ 'catalog/catOverrides/cape': { label: '겉옷', icon: '🧥', updatedAt: 2 } });
  });

  it('여러 개 지우기 · 되돌리기는 한 묶음 — 하나라도 막히면 아무것도 안 바뀐다', async () => {
    const ok = fakeDb();
    await deleteCustomCats(ok.db, ['a', 'b']);
    await revertCatOverrides(ok.db, ['cape']);
    expect(ok.writes).toEqual([
      ['commit', 'catalog/customCats/a', null],
      ['commit', 'catalog/customCats/b', null],
      ['commit', 'catalog/catOverrides/cape', null],
    ]);

    const denied = fakeDb({}, (p) => p === 'catalog/customCats/b');
    await expect(deleteCustomCats(denied.db, ['a', 'b'])).rejects.toThrow();
    expect(denied.writes).toEqual([]);
  });

  it('대상이 없으면 아무것도 보내지 않는다', async () => {
    const { db, writes } = fakeDb({}, () => true);
    await deleteCustomCats(db, []);
    expect(writes).toEqual([]);
  });
});

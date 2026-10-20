import { describe, expect, it } from 'vitest';
import { categoryViews } from '@/entities/catalog';
import { saveCategoryName } from '@/features/catalog/manage-categories';
import { fakeDb, withoutAudits } from '../shared/fakeDb';

describe('카테고리 이름', () => {
  const [hat] = categoryViews({}, {});

  it('한 묶음으로 쓰고 쓴 묶음을 돌려준다', async () => {
    const { db, writes } = fakeDb();
    const write = await saveCategoryName(db, hat, '캡', '', 2);
    expect(withoutAudits(writes)).toEqual([
      ['commit', 'catalog/catOverrides/hat', { label: '캡', updatedAt: 2 }],
    ]);
    expect(write).toEqual({ 'catalog/catOverrides/hat': { label: '캡', updatedAt: 2 } });
  });

  it('막히면 아무것도 안 바뀐다', async () => {
    const { db, writes } = fakeDb({}, () => true);
    await expect(saveCategoryName(db, hat, '캡', '', 2)).rejects.toThrow();
    expect(withoutAudits(writes)).toEqual([]);
  });
});

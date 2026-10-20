import { describe, expect, it } from 'vitest';
import { catalogCommit, touchedVersionedNodes, withCatalogVersion } from '@/entities/catalog';
import type { Db } from '@/shared/api';
import { fakeDb, NOW } from '../shared/fakeDb';

describe('카탈로그 버전(catalogMeta)', () => {
  it('묶음이 건드리는 버전 있는 종류만 — 겹치지 않게, 처음 나온 순서대로', () => {
    expect(
      touchedVersionedNodes({
        'catalog/parts/p1': null,
        'catalog/gachaParts/p1': null,
        'catalog/parts/p2/order': 3,
        'catalog/desks': null,
        'catalog/customCats/scarf': null,
        'catalog/catOverrides/hat': null,
        'catalog/adBanner': [],
        'catalog/partsX/p1': null,
        'adminLog/a1': {},
      }),
    ).toEqual(['parts', 'gachaParts', 'desks']);
  });

  it('바뀐 종류의 버전을 서버 시각으로 얹는다 — 원래 묶음은 건드리지 않는다', () => {
    const updates = { 'catalog/items/i1/order': 0 };
    expect(withCatalogVersion(updates, NOW)).toEqual({
      'catalog/items/i1/order': 0,
      'catalogMeta/items': NOW,
    });
    expect(updates).toEqual({ 'catalog/items/i1/order': 0 });
  });

  it('버전 있는 종류를 안 건드리면 묶음을 그대로 돌려준다', () => {
    const updates = { 'catalog/customCats/scarf': null };
    expect(withCatalogVersion(updates, NOW)).toBe(updates);
  });

  it('카탈로그 쓰기와 버전 올림이 한 번의 db.commit 으로 간다', async () => {
    const commits: Record<string, unknown>[] = [];
    const { db } = fakeDb();
    const spy: Db = { ...db, commit: async (u) => void commits.push(u) };
    await catalogCommit(spy, { 'catalog/desks/d1': null, 'adminLog/a1': { action: 'catalog.delete' } });
    expect(commits).toEqual([
      { 'catalog/desks/d1': null, 'adminLog/a1': { action: 'catalog.delete' }, 'catalogMeta/desks': NOW },
    ]);
  });

  it('카테고리 이름처럼 버전이 없는 쓰기엔 catalogMeta 를 안 붙인다', async () => {
    const { db, writes } = fakeDb();
    await catalogCommit(db, { 'catalog/catOverrides/hat': { label: '캡' } });
    expect(writes).toEqual([['commit', 'catalog/catOverrides/hat', { label: '캡' }]]);
  });

  it('빈 묶음이면 아무것도 보내지 않는다', async () => {
    const { db, writes } = fakeDb();
    await catalogCommit(db, {});
    expect(writes).toEqual([]);
  });

  it('규칙에 catalogMeta 가 없어 거절되면(운영 규칙 배포 전) 카탈로그만 다시 쓴다', async () => {
    const commits: Record<string, unknown>[] = [];
    const { db } = fakeDb();
    const denied: Db = {
      ...db,
      commit: async (u) => {
        if (Object.keys(u).some((p) => p.startsWith('catalogMeta/'))) {
          throw Object.assign(new Error('PERMISSION_DENIED: Permission denied'), {
            code: 'PERMISSION_DENIED',
          });
        }
        commits.push(u);
      },
    };
    const warn = console.warn;
    console.warn = () => {};
    try {
      await catalogCommit(denied, { 'catalog/items/i1/name': '컵' });
    } finally {
      console.warn = warn;
    }
    expect(commits).toEqual([{ 'catalog/items/i1/name': '컵' }]);
  });

  it('권한 말고 다른 이유로 실패하면 다시 쓰지 않고 그대로 실패한다', async () => {
    let calls = 0;
    const { db } = fakeDb();
    const broken: Db = {
      ...db,
      commit: async () => {
        calls++;
        throw new Error('network');
      },
    };
    await expect(catalogCommit(broken, { 'catalog/items/i1/name': '컵' })).rejects.toThrow('network');
    expect(calls).toBe(1);
  });
});

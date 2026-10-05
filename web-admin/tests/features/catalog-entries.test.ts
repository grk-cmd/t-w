import { describe, expect, it } from 'vitest';
import { catalogEntries } from '@/entities/catalog';
import { deleteEntries } from '@/features/catalog/delete-entries';
import { reorderEntries } from '@/features/catalog/reorder-entries';
import { fakeDb } from '../shared/fakeDb';
import { fakeFiles } from '../shared/fakeFiles';

const FILE = (path: string) =>
  `https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/${encodeURIComponent(path)}?alt=media`;

const parts = catalogEntries('parts', {
  p1: {
    cat: 'hat',
    name: '모자1',
    glbUrl: FILE('catalog/parts/p1.glb'),
    thumbUrl: FILE('catalog/parts/p1.thumb.png'),
  },
  p2: { cat: 'hat', name: '모자2', glb: 'AAAA' },
});

describe('카탈로그 항목 삭제', () => {
  it('DB 를 한 묶음으로 먼저 지우고 그다음 Storage 파일을 지운다', async () => {
    const { db, writes } = fakeDb();
    const { files, deleted } = fakeFiles();
    const r = await deleteEntries(db, files, parts);
    expect(writes).toEqual([
      ['commit', 'catalog/parts/p1', null],
      ['commit', 'catalog/gachaParts/p1', null],
      ['commit', 'catalog/parts/p2', null],
      ['commit', 'catalog/gachaParts/p2', null],
    ]);
    expect(deleted).toEqual([FILE('catalog/parts/p1.glb'), FILE('catalog/parts/p1.thumb.png')]);
    expect(r).toMatchObject({ removed: 2, filesLeft: 0 });
  });

  it('DB 가 거절되면 파일은 건드리지 않는다', async () => {
    const { db, writes } = fakeDb({}, (p) => p === 'catalog/parts/p2');
    const { files, deleted } = fakeFiles();
    await expect(deleteEntries(db, files, parts)).rejects.toThrow();
    expect(writes).toEqual([]);
    expect(deleted).toEqual([]);
  });

  it('파일을 못 지워도 항목 삭제는 성공으로 두고 남은 파일 수를 알린다', async () => {
    const { db } = fakeDb();
    const { files } = fakeFiles((url) => url.includes('thumb'));
    expect(await deleteEntries(db, files, parts)).toMatchObject({ removed: 2, filesLeft: 1 });
  });
});

describe('카탈로그 진열 순서', () => {
  it('칸 안에서 끌어 놓은 결과 중 바뀐 order 만 한 묶음으로 쓴다', async () => {
    const group = catalogEntries('gachaParts', { a: { order: 0 }, b: { order: 1 }, c: { order: 2 } });
    const { db, writes } = fakeDb();
    const written = await reorderEntries(db, group, 'c', 'a');
    expect(writes).toEqual([
      ['commit', 'catalog/gachaParts/c/order', 0],
      ['commit', 'catalog/gachaParts/a/order', 1],
      ['commit', 'catalog/gachaParts/b/order', 2],
    ]);
    expect(Object.keys(written)).toHaveLength(3);
  });

  it('바뀐 것이 없으면 아무것도 보내지 않는다', async () => {
    const group = catalogEntries('items', { a: { order: 0 } });
    const { db, writes } = fakeDb({}, () => true);
    expect(await reorderEntries(db, group, 'a', 'a')).toEqual({});
    expect(writes).toEqual([]);
  });
});

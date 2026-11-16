import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import {
  applyEdits,
  applyListEdit,
  categoryAfterNameSave,
  categoryNameWrite,
  categoryViews,
  shelfScope,
  shelfVersion,
  toEntry,
  type CatalogShelf,
  type CatOverride,
  type CatView,
} from '@/entities/catalog';
import { applyCatalogWrite, type CatalogWrite } from '@/entities/catalog';
import { createFirebaseCatalogPort } from '@/entities/catalog/api/firebase';
import { createFirebaseReorderEntriesPort } from '@/features/catalog/reorder-entries/api/firebase';
import { fakeDb, NOW, withoutAudits } from '../shared/fakeDb';

const part = (id: string, cat: string, order: number) => toEntry('parts', id, { name: id, cat, order });

const shelf = (): CatalogShelf => ({
  entries: [part('a', 'hat', 0), part('b', 'top', 0), part('c', 'hat', 1), part('d', 'hat', 2)],
  categories: [],
  shelves: { 'CATEGORY:hat': 3 },
});

describe('진열대 고치기 말', () => {
  it('범위 이름 — 파츠는 카테고리마다 · 책상 · 소품은 하나씩', () => {
    expect(shelfScope(part('a', 'hat', 0))).toBe('CATEGORY:hat');
    expect(shelfScope(toEntry('desks', 'd', {}))).toBe('DESK');
    expect(shelfScope(toEntry('items', 'i', {}))).toBe('DESK_PROP');
  });

  it('진열대 번호가 없는 범위는 0(서버가 «행이 아직 없으면 번호 0» 이라고 약속한다)', () => {
    expect(shelfVersion(shelf(), 'CATEGORY:hat')).toBe(3);
    expect(shelfVersion(shelf(), 'CATEGORY:top')).toBe(0);
  });

  it('order — 그 범위 줄이 차지한 자리만 새 순서로 다시 채우고 다른 범위는 그대로 둔다', () => {
    const next = applyListEdit(shelf(), {
      op: 'order',
      kind: 'parts',
      scope: 'CATEGORY:hat',
      ids: ['d', 'a', 'c'],
      version: 4,
    });
    expect(next.entries.map((e) => e.id)).toEqual(['d', 'b', 'a', 'c']);
    expect(next.entries.filter((e) => e.cat === 'hat').map((e) => e.order)).toEqual([0, 1, 2]);
    expect(next.shelves).toEqual({ 'CATEGORY:hat': 4 });
  });

  it('order — 번호가 없는 판(0)은 진열대 번호를 건드리지 않는다', () => {
    const next = applyListEdit(shelf(), {
      op: 'order',
      kind: 'parts',
      scope: 'CATEGORY:hat',
      ids: ['c', 'a', 'd'],
      version: 0,
    });
    expect(next.shelves).toEqual({ 'CATEGORY:hat': 3 });
  });

  it('update · drop', () => {
    const upd = applyListEdit(shelf(), {
      op: 'update',
      kind: 'parts',
      id: 'b',
      change: { name: '새', version: 9 },
    });
    expect(upd.entries[1]).toMatchObject({ name: '새', version: 9 });
    expect(
      applyListEdit(shelf(), { op: 'drop', kind: 'parts', ids: ['a', 'c'] }).entries.map((e) => e.id),
    ).toEqual(['b', 'd']);
  });
});

describe('카테고리 이름 저장 뒤 모양', () => {
  const cases: [string, string, string, string][] = [
    ['덮어쓰기 없는 기본 카테고리에 새 이름', 'hat', '챙모자', ''],
    ['이름만 비움 · 아이콘만 바꿈', 'hat', '', '🧢'],
    ['기본 이름 그대로', 'hat', '모자', '🎩'],
    ['둘 다 비움', 'hat', '', ''],
  ];
  it.each(cases)('%s — 쓴 묶음을 categoryViews 가 읽은 것과 같다', (_name, code, label, icon) => {
    const cat = categoryViews({}, {}).find((c) => c.cat === code) as CatView;
    const write: CatalogWrite = categoryNameWrite(cat, label, icon, 1);
    const overrides = applyCatalogWrite<CatOverride>({}, 'catOverrides', write);
    const read = categoryViews({}, overrides).find((c) => c.cat === code);
    expect(categoryAfterNameSave(cat, label, icon)).toEqual(read);
  });

  it('운영 추가 카테고리는 아이콘을 비우면 🏷️', () => {
    const custom = categoryViews({ x: { cat: 'x', label: '엑스', group: 'head' } }, {}).find(
      (c) => c.cat === 'x',
    ) as CatView;
    expect(categoryAfterNameSave(custom, ' 새 ', '')).toMatchObject({ label: '새', icon: '🏷️' });
  });
});

describe('Firebase 판 진열대 읽기', () => {
  const data = {
    'catalog/desks': { d1: { name: '책상', icon: '🪵', order: 0 } },
    'metrics/parts/equipped/desks': { d1: 4 },
  };

  it('노드 줄에 장착 수를 붙이고 카테고리는 파츠에만 읽는다', async () => {
    const port = createFirebaseCatalogPort(fakeDb(data).db);
    const s = await port.shelf('desks', 'order');
    expect(s.entries.map((e) => [e.id, e.equip, e.version, e.state])).toEqual([['d1', 4, 0, null]]);
    expect(s.categories).toEqual([]);
    expect(s.shelves).toEqual({});
    const parts = await port.shelf('parts', 'order');
    expect(parts.categories.length).toBeGreaterThan(0);
  });

  it('장착 수 노드를 못 읽으면 줄은 그대로 오고 equip 만 null(못 읽음)', async () => {
    const { db } = fakeDb(data);
    const port = createFirebaseCatalogPort({
      ...db,
      get: async (path: string) => {
        if (path.startsWith('metrics/')) throw new Error('denied');
        return db.get(path);
      },
    });
    const s = await port.shelf('desks', 'order');
    expect(s.entries.map((e) => [e.id, e.equip])).toEqual([['d1', null]]);
  });
});

describe('Firebase 판 파츠 탭 — 보통 파츠와 가챠 파츠를 한 목록으로', () => {
  const data = {
    'catalog/parts': {
      p1: { cat: 'hat', name: '보통1', order: 1 },
      old: { cat: 'hat', name: '옛 가챠', gacha: true, order: 5 },
    },
    'catalog/gachaParts': { g1: { cat: 'hat', name: '가챠1', order: 0 }, g2: { cat: 'top', name: '가챠2' } },
    'metrics/parts/equipped/parts': { g1: 2, p1: 1 },
  };

  it('order 로 합쳐 세우고(없으면 뒤) 가챠 표시를 단다', async () => {
    const s = await createFirebaseCatalogPort(fakeDb(data).db).shelf('parts', 'order');
    expect(s.entries.map((e) => [e.kind, e.id, e.gacha, e.equip])).toEqual([
      ['gachaParts', 'g1', true, 2],
      ['parts', 'p1', false, 1],
      ['parts', 'old', true, 0],
      ['gachaParts', 'g2', true, 0],
    ]);
  });

  it('한 칸에 섞인 줄을 끌어 놓으면 각자의 통 경로에 order 를 쓴다', async () => {
    const { db, writes } = fakeDb(data);
    const s = await createFirebaseCatalogPort(db).shelf('parts', 'order');
    const hat = s.entries.filter((e) => e.cat === 'hat' && !e.legacyGacha);
    const r = await createFirebaseReorderEntriesPort(db).reorder({
      group: hat,
      dragged: 'p1',
      target: 'g1',
      version: 0,
    });
    expect(r.ok && r.changed).toBe(true);
    expect(withoutAudits(writes)).toEqual([
      ['commit', 'catalog/parts/p1/order', 0],
      ['commit', 'catalog/gachaParts/g1/order', 1],
      ['commit', 'catalogMeta/parts', NOW],
      ['commit', 'catalogMeta/gachaParts', NOW],
    ]);
  });
});

describe('쓰기 말을 캐시에 적용', () => {
  const sortKeyOf = (kind: string, sort: string) => ['catalog', 'shelf', kind, sort];

  it('seed — 진열 순서 캐시는 그대로 두고 다른 정렬 캐시는 낡았다고 표시한다', () => {
    const client = new QueryClient();
    const stale: CatalogShelf = { entries: [], categories: [], shelves: {} };
    client.setQueryData(sortKeyOf('parts', 'popular'), stale);
    const fresh = shelf();
    applyEdits(client, [{ op: 'seed', kind: 'gachaParts', shelf: fresh }]);
    expect(client.getQueryData(sortKeyOf('parts', 'order'))).toBe(fresh);
    expect(client.getQueryState(sortKeyOf('parts', 'popular'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(sortKeyOf('parts', 'order'))?.isInvalidated).toBe(false);
  });

  it('category — 카테고리 카드와 파츠 진열대의 같은 카테고리를 함께 바꾼다', () => {
    const client = new QueryClient();
    const [hat] = categoryViews({}, {});
    client.setQueryData(['catalog', 'categories'], [hat]);
    client.setQueryData(sortKeyOf('parts', 'order'), { entries: [], categories: [hat], shelves: {} });
    applyEdits(client, [{ op: 'category', cat: { ...hat, label: '새 이름', version: 2 } }]);
    expect(client.getQueryData<CatView[]>(['catalog', 'categories'])?.[0]).toMatchObject({
      label: '새 이름',
    });
    expect(client.getQueryData<CatalogShelf>(sortKeyOf('parts', 'order'))?.categories[0]).toMatchObject({
      label: '새 이름',
      version: 2,
    });
  });
});

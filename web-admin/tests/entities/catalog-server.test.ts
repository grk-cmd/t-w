import { describe, expect, it } from 'vitest';
import { createServerCatalogPort } from '@/entities/catalog';
import { isPortError, WIRE_SHAPE_CODE } from '@/shared/api';
import { category, listing, part } from '../shared/catalogFixtures';
import { fakeApiOf } from '../shared/fakeApi';

const caught = (promise: Promise<unknown>) => promise.catch((e: unknown) => e);

const bundle = (over: Record<string, unknown> = {}) => ({
  categories: [
    category('hat'),
    category('x1', { builtin: false, defaultLabel: undefined, defaultIcon: undefined, label: '운영' }),
  ],
  shelves: [{ scope: 'CATEGORY:hat', order: ['p1'], version: 5 }],
  parts: [part('p1'), part('p2', { listing: listing('DRAFT', 'GACHA'), equipCount: 0 })],
  desks: [],
  deskProps: [],
  products: [],
  unlocks: [],
  season: 'AUTUMN',
  ...over,
});

describe('카탈로그 진열대 읽기 — API 판', () => {
  it('종류와 정렬을 서버에 보내고 줄 · 카테고리 · 진열대 번호를 화면 모양으로 바꾼다', async () => {
    const s = fakeApiOf({ 'GET /v2/admin/catalog': () => bundle() });
    const shelf = await createServerCatalogPort(s.api).shelf('parts', 'popular');
    expect(s.calls.map((c) => c.query)).toEqual([{ kind: 'part', sort: 'popular' }]);
    expect(shelf.entries.map((e) => [e.id, e.cat, e.gacha, e.state, e.equip, e.version])).toEqual([
      ['p1', 'hat', false, 'ACTIVE', 7, 2],
      ['p2', 'hat', true, 'DRAFT', 0, 2],
    ]);
    expect(shelf.shelves).toEqual({ 'CATEGORY:hat': 5 });
    expect(shelf.categories.map((c) => [c.id, c.builtin, c.defaultLabel, c.version])).toEqual([
      ['hat', true, '모자', 3],
      ['x1', false, '', 3],
    ]);
  });

  it('책상 · 소품은 각자의 종류 이름 · 배열 · id 칸으로 읽는다', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/catalog': (c) =>
        c.query?.kind === 'desk'
          ? bundle({
              desks: [
                { deskId: 'd1', name: '책상', icon: '', listing: listing(), version: 1, equipCount: 2 },
              ],
            })
          : bundle({
              deskProps: [
                {
                  deskPropId: 'i1',
                  name: '컵',
                  icon: '☕',
                  listing: listing('ARCHIVED'),
                  version: 4,
                  equipCount: 0,
                },
              ],
            }),
    });
    const port = createServerCatalogPort(s.api);
    expect((await port.shelf('desks', 'order')).entries[0]).toMatchObject({
      kind: 'desks',
      id: 'd1',
      cat: null,
      equip: 2,
    });
    expect((await port.shelf('items', 'order')).entries[0]).toMatchObject({
      kind: 'items',
      id: 'i1',
      state: 'ARCHIVED',
      version: 4,
    });
  });

  it('카테고리는 줄이 가장 적은 종류로 받는다', async () => {
    const s = fakeApiOf({ 'GET /v2/admin/catalog': () => bundle() });
    expect((await createServerCatalogPort(s.api).categories()).map((c) => c.id)).toEqual(['hat', 'x1']);
    expect(s.calls[0].query).toEqual({ kind: 'desk', sort: 'order' });
  });

  it.each([
    ['장착 수가 없다', { parts: [part('p1', { equipCount: undefined })] }],
    ['번호가 글자다', { parts: [part('p1', { version: '2' })] }],
    ['모르는 진열 상태', { parts: [part('p1', { listing: listing('HIDDEN', 'GIVEN') })] }],
    ['파츠에 얻는 길이 없다', { parts: [part('p1', { listing: listing('ACTIVE') })] }],
    ['기본 카테고리에 처음 이름이 없다', { categories: [category('hat', { defaultLabel: undefined })] }],
    ['진열대 줄이 어긋남', { shelves: [{ scope: 'DESK' }] }],
  ])('칸이 약속과 다르면(%s) 줄을 버리거나 채우지 않고 던진다', async (_name, over) => {
    const s = fakeApiOf({ 'GET /v2/admin/catalog': () => bundle(over) });
    const e = await caught(createServerCatalogPort(s.api).shelf('parts', 'order'));
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
  });
});

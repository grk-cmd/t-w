import { describe, expect, it } from 'vitest';
import { toCatalogRow, type CatalogEntry, type CatView } from '@/entities/catalog';
import { createServerDeleteEntriesPort } from '@/features/catalog/delete-entries/api/server';
import { createServerEditEntryInfoPort } from '@/features/catalog/edit-entry-info/api/server';
import { createServerManageCategoriesPort } from '@/features/catalog/manage-categories/api/server';
import { createServerReorderEntriesPort } from '@/features/catalog/reorder-entries/api/server';
import { ApiError, isPortError, PortError, WIRE_SHAPE_CODE } from '@/shared/api';
import { category, part } from '../shared/catalogFixtures';
import { fakeApiOf } from '../shared/fakeApi';

const caught = (promise: Promise<unknown>) => promise.catch((e: unknown) => e);
const conflict = () => new ApiError('request', 409, 'CONCURRENT_UPDATE', '다른 곳에서 바꿨어요');

const desk = (over: Record<string, unknown> = {}): CatalogEntry =>
  toCatalogRow(
    'desks',
    {
      deskId: 'd1',
      name: '책상',
      icon: '🪵',
      listing: { state: 'ACTIVE' },
      version: 6,
      equipCount: 3,
      ...over,
    },
    'required',
  );

describe('이름 · 아이콘 고치기 — API 판', () => {
  it('고친 칸과 읽은 번호만 PATCH 로 보내고 새 번호를 줄에 싣는다', async () => {
    const s = fakeApiOf({
      'PATCH /v2/admin/catalog/desks/d1': () => ({
        desk: { deskId: 'd1', name: '큰 책상', icon: '🪵', listing: { state: 'ACTIVE' }, version: 7 },
      }),
    });
    const r = await createServerEditEntryInfoPort(s.api).save(desk(), '큰 책상', '🪵');
    expect(s.calls[0].body).toEqual({ version: 6, name: '큰 책상' });
    expect(r).toEqual({
      ok: true,
      changed: true,
      edits: [
        {
          op: 'update',
          kind: 'desks',
          id: 'd1',
          change: { name: '큰 책상', icon: '🪵', version: 7, state: 'ACTIVE' },
        },
      ],
    });
  });

  it('소품 · 파츠는 경로와 응답 칸 이름이 다르다', async () => {
    const s = fakeApiOf({
      'PATCH /v2/admin/catalog/desk-props/i1': () => ({
        deskProp: { deskPropId: 'i1', name: '컵', icon: '', listing: { state: 'ACTIVE' }, version: 2 },
      }),
    });
    const entry = toCatalogRow(
      'items',
      { deskPropId: 'i1', name: '컵', icon: '☕', listing: { state: 'ACTIVE' }, version: 1, equipCount: 0 },
      'required',
    );
    const r = await createServerEditEntryInfoPort(s.api).save(entry, '컵', '');
    expect(s.calls[0].body).toEqual({ version: 1, icon: '' });
    expect(r.ok && r.edits[0]).toMatchObject({ change: { icon: '', version: 2 } });
  });

  it('입력 검사는 서버가 한다 — 길이 · 빈 이름을 미리 거절하지 않는다', () => {
    const s = fakeApiOf({});
    expect(createServerEditEntryInfoPort(s.api).check('', 'x'.repeat(100))).toBeNull();
  });

  it('409 면 그 종류를 한 번 받아 최신 진열대를 돌려준다(다시 받지 않게)', async () => {
    const s = fakeApiOf({
      'PATCH /v2/admin/catalog/parts/p1': () => {
        throw conflict();
      },
      'GET /v2/admin/catalog': () => ({
        categories: [category('hat')],
        shelves: [],
        parts: [part('p1', { name: '남이 바꿈', version: 9 })],
      }),
    });
    const entry = toCatalogRow('parts', part('p1'), 'required');
    const r = await createServerEditEntryInfoPort(s.api).save(entry, '내 이름', '🎩');
    expect(r.ok).toBe(false);
    expect(s.calls.filter((c) => c.method === 'GET')).toHaveLength(1);
    expect(s.calls[1].query).toEqual({ kind: 'part', sort: 'order' });
    const edit = r.edits[0];
    expect(edit.op === 'seed' && edit.shelf.entries[0]).toMatchObject({ name: '남이 바꿈', version: 9 });
  });

  it('다른 오류는 그대로 던진다(서버 400 문구)', async () => {
    const s = fakeApiOf({
      'PATCH /v2/admin/catalog/desks/d1': () => {
        throw new ApiError('request', 400, 'CATALOG_INVALID_ITEM', 'name 은 30자까지예요');
      },
    });
    const e = await caught(createServerEditEntryInfoPort(s.api).save(desk(), 'x', '🪵'));
    expect(isPortError(e, 'invalid') && e.message).toBe('항목 값이 올바르지 않아요');
  });

  it('응답에 그 물건 칸이 없으면 던진다', async () => {
    const s = fakeApiOf({ 'PATCH /v2/admin/catalog/desks/d1': () => ({ part: {} }) });
    const e = await caught(createServerEditEntryInfoPort(s.api).save(desk(), 'x', '🪵'));
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
  });
});

describe('순서 바꾸기 — API 판', () => {
  const group = [
    toCatalogRow('parts', part('a'), 'required'),
    toCatalogRow('parts', part('b'), 'required'),
    toCatalogRow('parts', part('c'), 'required'),
  ];

  it('그 칸 줄 전부를 새 순서로 PUT 하고 새 진열대 번호를 돌려준다', async () => {
    const s = fakeApiOf({
      'PUT /v2/admin/catalog/shelves/CATEGORY%3Ahat': () => ({
        scope: 'CATEGORY:hat',
        order: ['c', 'a', 'b'],
        version: 5,
      }),
    });
    const r = await createServerReorderEntriesPort(s.api).reorder({
      group,
      dragged: 'c',
      target: 'a',
      version: 4,
    });
    expect(s.calls[0].body).toEqual({ version: 4, order: ['c', 'a', 'b'] });
    expect(r).toEqual({
      ok: true,
      changed: true,
      edits: [{ op: 'order', kind: 'parts', scope: 'CATEGORY:hat', ids: ['c', 'a', 'b'], version: 5 }],
    });
  });

  it('책상은 DESK 범위', async () => {
    const s = fakeApiOf({
      'PUT /v2/admin/catalog/shelves/DESK': () => ({ scope: 'DESK', order: ['d2', 'd1'], version: 1 }),
    });
    await createServerReorderEntriesPort(s.api).reorder({
      group: [desk(), desk({ deskId: 'd2' })],
      dragged: 'd2',
      target: 'd1',
      version: 0,
    });
    expect(s.calls[0].body).toEqual({ version: 0, order: ['d2', 'd1'] });
  });

  it('409 면 최신 진열대를 한 번 받아 돌려준다', async () => {
    const s = fakeApiOf({
      'PUT /v2/admin/catalog/shelves/CATEGORY%3Ahat': () => {
        throw conflict();
      },
      'GET /v2/admin/catalog': () => ({
        categories: [],
        shelves: [{ scope: 'CATEGORY:hat', order: [], version: 8 }],
        parts: [],
      }),
    });
    const r = await createServerReorderEntriesPort(s.api).reorder({
      group,
      dragged: 'c',
      target: 'a',
      version: 4,
    });
    expect(r.ok).toBe(false);
    expect(s.calls.filter((c) => c.method === 'GET')).toHaveLength(1);
    const edit = r.edits[0];
    expect(edit.op === 'seed' && edit.shelf.shelves).toEqual({ 'CATEGORY:hat': 8 });
  });
});

describe('카테고리 이름 — API 판', () => {
  const view = (over: Partial<CatView> = {}): CatView => ({
    id: 'hat',
    cat: 'hat',
    label: '모자',
    icon: '🎩',
    group: 'HEAD',
    builtin: true,
    overridden: false,
    version: 3,
    defaultLabel: '모자',
    defaultIcon: '🎩',
    ...over,
  });

  it('바꾼 이름 · 아이콘을 번호와 함께 PUT 한다', async () => {
    const s = fakeApiOf({
      'PUT /v2/admin/catalog/categories/hat': () =>
        category('hat', { label: '챙모자', overridden: true, version: 4 }),
    });
    const r = await createServerManageCategoriesPort(s.api).save(view(), '챙모자', '');
    expect(s.calls[0].body).toEqual({ version: 3, label: '챙모자', icon: '🎩' });
    expect(r.ok && r.edits[0]).toMatchObject({
      op: 'category',
      cat: { label: '챙모자', version: 4, overridden: true },
    });
  });

  it('기본 카테고리를 비우면 «원래대로» — 본문 없이 ?version=', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/catalog/categories/hat/reset': () => category('hat', { version: 5 }),
    });
    await createServerManageCategoriesPort(s.api).save(
      view({ overridden: true, label: '챙모자', version: 4 }),
      '',
      '',
    );
    expect(s.calls[0]).toMatchObject({ method: 'POST', query: { version: 4 } });
    expect(s.calls[0].body).toBeUndefined();
  });

  it('운영 추가 카테고리는 지금 모양대로(빈 아이콘은 Firebase 판과 같은 🏷️)', async () => {
    const s = fakeApiOf({
      'PUT /v2/admin/catalog/categories/x1': () =>
        category('x1', {
          builtin: false,
          label: '새',
          icon: '🏷️',
          defaultLabel: undefined,
          defaultIcon: undefined,
        }),
    });
    await createServerManageCategoriesPort(s.api).save(
      view({ id: 'x1', cat: 'x1', builtin: false, defaultLabel: '', defaultIcon: '' }),
      ' 새 ',
      '',
    );
    expect(s.calls[0].body).toEqual({ version: 3, label: '새', icon: '🏷️' });
  });

  it('입력 검사는 서버가 한다', () => {
    expect(
      createServerManageCategoriesPort(fakeApiOf({}).api).check(view(), 'x'.repeat(99), 'y'.repeat(99)),
    ).toBeNull();
  });

  it('409 면 카테고리를 한 번 받아 돌려준다', async () => {
    const s = fakeApiOf({
      'PUT /v2/admin/catalog/categories/hat': () => {
        throw conflict();
      },
      'GET /v2/admin/catalog': () => ({
        categories: [category('hat', { version: 9 })],
        shelves: [],
        desks: [],
      }),
    });
    const r = await createServerManageCategoriesPort(s.api).save(view(), '챙모자', '');
    expect(r.ok).toBe(false);
    expect(s.calls.filter((c) => c.method === 'GET')).toHaveLength(1);
    const edit = r.edits[0];
    expect(edit.op === 'categories' && edit.categories[0].version).toBe(9);
  });
});

describe('항목 지우기(단종) — API 판', () => {
  const entries = [
    toCatalogRow('parts', part('a', { version: 1 }), 'required'),
    toCatalogRow('parts', part('b', { version: 2 }), 'required'),
  ];

  it('고른 줄 전부를 읽은 번호와 함께 보내고 줄마다 결과를 돌려준다', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/catalog/listings/bulk': () => [
        { kind: 'part', id: 'a', ok: true },
        { kind: 'part', id: 'b', ok: false, code: 'CONCURRENT_UPDATE' },
      ],
    });
    const r = await createServerDeleteEntriesPort(s.api).remove(entries, entries);
    expect(s.calls[0].body).toEqual({
      action: 'ARCHIVE',
      items: [
        { kind: 'part', id: 'a', version: 1 },
        { kind: 'part', id: 'b', version: 2 },
      ],
    });
    expect(r).toEqual({
      removed: 1,
      filesLeft: 0,
      failed: [{ id: 'b', reason: '다른 곳에서 바꾼 내용을 받아왔어요' }],
      edits: [{ op: 'refetch', kind: 'parts' }],
    });
  });

  it('단종하는 판이다', () => {
    expect(createServerDeleteEntriesPort(fakeApiOf({}).api).archives).toBe(true);
  });

  it('줄이 보낸 순서와 다르면 던진다', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/catalog/listings/bulk': () => [
        { kind: 'part', id: 'b', ok: true },
        { kind: 'part', id: 'a', ok: true },
      ],
    });
    const e = await caught(createServerDeleteEntriesPort(s.api).remove(entries, entries));
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
  });

  it('안 된 줄에 까닭이 없으면 던진다', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/catalog/listings/bulk': () => [
        { kind: 'part', id: 'a', ok: false },
        { kind: 'part', id: 'b', ok: true },
      ],
    });
    expect(await caught(createServerDeleteEntriesPort(s.api).remove(entries, entries))).toBeInstanceOf(
      PortError,
    );
  });
});

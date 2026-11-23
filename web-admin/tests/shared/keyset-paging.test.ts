import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { fetchAllPages, keysetView, needsMore, resetKeyset } from '@/shared/lib';

describe('키셋 쪽 넘기기', () => {
  it('받은 쪽을 이어 붙인다 · nextCursor 가 있으면 more', () => {
    const view = keysetView([
      { items: [1, 2], nextCursor: 'c1' },
      { items: [3], nextCursor: 'c2' },
    ]);
    expect(view.items).toEqual([1, 2, 3]);
    expect(view.more).toBe(true);
    expect(keysetView([{ items: [1], nextCursor: null }]).more).toBe(false);
    expect(keysetView([]).items).toEqual([]);
  });

  it('전체 수는 첫 쪽 것만 — 다음 쪽의 null 은 지우지 않는다 · 안 주면 null', () => {
    expect(
      keysetView([
        { items: [1], nextCursor: 'c', total: 42 },
        { items: [2], nextCursor: null, total: null },
      ]).total,
    ).toBe(42);
    expect(keysetView([{ items: [1] }]).total).toBeNull();
  });

  it('먼 쪽은 그 쪽까지만 받는다', () => {
    // 한 쪽 20 줄씩 받아 둔 40 줄, 크기 20 으로 5쪽을 고름 → 100 줄이 될 때까지 더 받는다
    expect(needsMore(40, 5, 20, true)).toBe(true);
    expect(needsMore(100, 5, 20, true)).toBe(false);
    expect(needsMore(40, 2, 20, true)).toBe(false);
    // 뒤가 없으면 더 받지 않는다
    expect(needsMore(40, 5, 20, false)).toBe(false);
  });

  it('쓰기 뒤에는 첫 쪽부터 다시 받는다 — 받아 둔 쪽을 지우고 커서를 잇지 않는다', async () => {
    const client = new QueryClient();
    client.setQueryData(['licenses', 'a'], { pages: [{ items: [1], nextCursor: 'c' }], pageParams: [null] });
    client.setQueryData(['users'], { pages: [{ items: [9] }], pageParams: [null] });
    await resetKeyset(client, ['licenses']);
    expect(client.getQueryData(['licenses', 'a'])).toBeUndefined();
    expect(client.getQueryData(['users'])).toBeDefined();
  });
});

describe('키셋 목록 끝까지 받기(fetchAllPages)', () => {
  const pages = (n: number, endless = false) => {
    const seen: (string | undefined)[] = [];
    const fetchPage = async (cursor: string | undefined) => {
      seen.push(cursor);
      const i = cursor === undefined ? 0 : Number(cursor);
      return { items: [i], nextCursor: endless || i + 1 < n ? String(i + 1) : null };
    };
    return { seen, fetchPage };
  };

  it('커서가 끝날 때까지 이어 받는다 · 상한을 안 주면 그대로', async () => {
    const p = pages(3);
    expect(await fetchAllPages(p.fetchPage)).toEqual([0, 1, 2]);
    expect(p.seen).toEqual([undefined, '1', '2']);
  });

  it('상한 — 딱 그만큼이면 통과 · 넘으면 던진다(더 부르지 않는다)', async () => {
    expect(await fetchAllPages(pages(3).fetchPage, { maxPages: 3 })).toEqual([0, 1, 2]);
    const e = pages(5, true);
    await expect(fetchAllPages(e.fetchPage, { maxPages: 4 })).rejects.toThrow('끝나지 않아요');
    expect(e.seen).toHaveLength(4);
  });
});

import { describe, expect, it } from 'vitest';
import { createServerLicensePort } from '@/entities/license/api/server';
import { createServerLicenseRequestPort } from '@/entities/license-request/api/server';
import { createServerSecretRoomPort } from '@/entities/secret-room/api/server';
import { takenWarning } from '@/entities/secret-room';
import { isPortError, WIRE_SHAPE_CODE } from '@/shared/api';
import { fakeApiOf } from '../shared/fakeApi';

const item = (n: number, over: Record<string, unknown> = {}) => ({
  licenseId: `id-${n}`,
  key: `KEY-${n}`,
  status: 'VALID',
  note: null,
  ownerUserCode: null,
  ownerName: null,
  deviceCount: 0,
  devices: [],
  createdBy: 'admin',
  createdAt: '2026-11-01T00:00:00Z',
  firstRedeemedAt: null,
  revokedAt: null,
  version: n,
  ...over,
});

const shapeError = async (promise: Promise<unknown>) => {
  const error = await promise.catch((e: unknown) => e);
  expect(isPortError(error, 'invalid')).toBe(true);
  expect(isPortError(error) && error.code).toBe(WIRE_SHAPE_CODE);
};

describe('라이선스 읽기 — API 판', () => {
  it('통계 — 주인 있는 유효 키는 «사용», 없는 유효 키는 «미사용»', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/licenses/stats': () => ({
        total: 10,
        valid: 8,
        owned: 5,
        unowned: 3,
        revoked: 2,
        premiumOwners: 4,
      }),
    });
    expect(await createServerLicensePort(s.api).stats()).toEqual({
      counts: { total: 10, valid: 8, used: 5, unused: 3, revoked: 2 },
      syncedAt: null,
      source: { via: 'server' },
    });
  });

  it('쪽 — 서버 키셋을 첫 쪽부터 이어 받아 화면 쪽을 자른다 · 줄에 id 와 번호가 실린다', async () => {
    const all = Array.from({ length: 5 }, (_, i) => item(i + 1));
    const s = fakeApiOf({
      'GET /v2/admin/licenses': ({ query }) => {
        const from = query?.cursor ? Number(query.cursor) : 0;
        const limit = Number(query?.limit);
        const rows = all.slice(from, from + 2); // 서버는 한 번에 2개만 준다
        const next = from + 2 < all.length && rows.length <= limit ? String(from + 2) : null;
        return { items: rows, nextCursor: next, total: query?.cursor ? null : all.length };
      },
    });
    const view = await createServerLicensePort(s.api).page({ page: 2, size: 2, q: ' 메모 ' });
    expect(view.items.map((r) => [r.key, r.licenseId, r.version])).toEqual([
      ['KEY-3', 'id-3', 3],
      ['KEY-4', 'id-4', 4],
    ]);
    expect([view.total, view.pageCount, view.page, view.source]).toEqual([5, 3, 2, { via: 'server' }]);
    expect(s.calls.map((c) => c.query?.cursor)).toEqual([undefined, '2']);
    expect(s.calls[0].query).toMatchObject({ q: '메모', limit: 4 });
  });

  it('범위를 넘은 쪽은 요청한 쪽 그대로 빈 쪽', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/licenses': () => ({ items: [item(1)], nextCursor: null, total: 1 }),
    });
    const view = await createServerLicensePort(s.api).page({ page: 3, size: 10, q: '' });
    expect([view.items, view.page, view.pageCount, view.total]).toEqual([[], 3, 1, 1]);
  });

  it('상태 · 시각 · 번호가 약속과 다르면 줄을 버리지 않고 던진다', async () => {
    const page = (row: unknown, total: unknown = 1) =>
      createServerLicensePort(
        fakeApiOf({ 'GET /v2/admin/licenses': () => ({ items: [row], nextCursor: null, total }) }).api,
      ).page({ page: 1, size: 10, q: '' });
    await shapeError(page(item(1, { status: 'PAUSED' })));
    await shapeError(page(item(1, { version: '1' })));
    await shapeError(page(item(1, { createdAt: '어제' })));
    await shapeError(page(item(1, { licenseId: undefined })));
    await shapeError(page(item(1), null));
    // 문서가 약속한 null(메모 · 주인 · 시각)은 «없음» 이다
    const view = await page(
      item(1, { status: 'REVOKED', revokedAt: '2026-11-02T00:00:00Z', ownerUserCode: 'u1' }),
    );
    expect(view.items[0]).toMatchObject({
      status: 'revoked',
      note: '',
      revokedAt: Date.parse('2026-11-02T00:00:00Z'),
    });
    expect((await page(item(1, { ownerUserCode: 'u1' }))).items[0].status).toBe('used');
  });
});

describe('라이선스 요청 — API 판', () => {
  const req = (id: string) => ({
    id,
    requesterUserCode: `u-${id}`,
    name: `이름 ${id}`,
    createdAt: '2026-11-01T00:00:00Z',
  });

  it('한 쪽씩 받고 첫 쪽 total 을 그대로 쓴다', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/license-requests': ({ query }) =>
        query?.cursor
          ? { items: [req('b')], nextCursor: null, total: null }
          : { items: [req('a')], nextCursor: 'a', total: 2 },
    });
    const port = createServerLicenseRequestPort(s.api);
    expect(port.kind).toBe('poll');
    if (port.kind !== 'poll') return;
    expect(port.intervalMs).toBe(30_000);
    const first = await port.page(undefined, 100);
    expect(first.items.map((r) => [r.id, r.userCode, r.name])).toEqual([['a', 'u-a', '이름 a']]);
    expect(first).toMatchObject({ nextCursor: 'a', total: 2 });
    expect(await port.page('a', 100)).toMatchObject({ nextCursor: null, total: null });
    expect(s.calls.map((c) => c.query)).toEqual([
      { cursor: undefined, limit: 100 },
      { cursor: 'a', limit: 100 },
    ]);
  });

  it('첫 쪽에 total 이 없으면 약속과 다른 응답', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/license-requests': () => ({ items: [req('a')], nextCursor: null }),
    });
    const port = createServerLicenseRequestPort(s.api);
    if (port.kind !== 'poll') throw new Error('poll 이어야 해요');
    await shapeError(port.page(undefined, 100));
  });

  it('칸이 모자라면 던진다', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/license-requests': () => ({
        items: [{ id: 'a', name: 'x', createdAt: '2026-11-01T00:00:00Z' }],
        nextCursor: null,
        total: 1,
      }),
    });
    const port = createServerLicenseRequestPort(s.api);
    if (port.kind !== 'poll') throw new Error('poll 이어야 해요');
    await shapeError(port.page(undefined, 100));
  });
});

describe('시크릿룸 읽기 — API 판', () => {
  const room = (over: Record<string, unknown>) => ({
    secretRoomId: 'r1',
    code: 'SCRT-AAAA',
    ownerUserCode: 'u1',
    ownerName: '철수',
    name: '철수',
    expiresAt: null,
    endedAt: null,
    version: 1,
    ...over,
  });
  const ofUser = async (rows: unknown[]) => {
    const s = fakeApiOf({ 'GET /v2/admin/secret-rooms': () => rows });
    const info = await createServerSecretRoomPort(s.api).ofUser('u1');
    // 열린 방만 서버가 거른다.
    expect(s.calls.map((c) => c.query)).toEqual([{ ownerUserCode: 'u1', live: 'true' }]);
    return info;
  };

  it('live=true 로 받은 방이 그 사람의 방이다', async () => {
    const info = await ofUser([room({ expiresAt: '2026-12-31T00:00:00Z' })]);
    expect(info).toEqual({
      code: 'SCRT-AAAA',
      pub: { owner: 'u1', name: '철수', exp: Date.parse('2026-12-31T00:00:00Z') },
    });
  });

  it('열린 방이 없으면 null · 둘이거나 끝난 방이 섞이면 약속과 다른 응답', async () => {
    expect(await ofUser([])).toBeNull();
    await shapeError(ofUser([room({ endedAt: '2026-10-01T00:00:00Z' })]));
    await shapeError(ofUser([room({}), room({ secretRoomId: 'r2' })]));
    await shapeError(ofUser([room({ code: null })]));
  });
});

describe('겹친 시크릿룸 문구', () => {
  it('영구 · 기간 · 끝난 방을 말해 준다', () => {
    const now = Date.parse('2026-11-16T00:00:00Z');
    const text = takenWarning(
      'SCRT-AAAA',
      [
        { secretRoomId: 'a', ownerUserCode: 'u1', expiresAt: null, endedAt: null },
        {
          secretRoomId: 'b',
          ownerUserCode: 'u2',
          expiresAt: Date.parse('2026-12-31T00:00:00Z'),
          endedAt: null,
        },
        { secretRoomId: 'c', ownerUserCode: 'u3', expiresAt: null, endedAt: now },
      ],
      now,
    );
    expect(text).toContain('u1(영구)');
    expect(text).toContain('u2(2026-12-31 까지)');
    expect(text).toContain('u3(이미 끝난 방)');
  });
});

import { describe, expect, it } from 'vitest';
import { NO_PERIOD, type UserQuery } from '@/entities/user';
import { createServerUserRowsPort } from '@/features/user/user-rows/api/server';
import { isPortError, WIRE_SHAPE_CODE } from '@/shared/api';
import { fakeApiOf } from '../shared/fakeApi';
import { serverRow } from '../shared/serverUserFixtures';

const ALL: UserQuery = { filter: 'all', q: '', ver: undefined };

describe('사용자 목록 — API 판', () => {
  it('조건은 모두 쿼리로 보내고(검색어 · 거르기 · 버전 · 순서 · 기간) 길이는 자르지 않는다', async () => {
    const s = fakeApiOf({ 'GET /v2/admin/users': () => ({ items: [], nextCursor: null, total: 0 }) });
    const port = createServerUserRowsPort(s.api);
    const long = 'a'.repeat(150);
    await port.page(
      {
        filter: 'revoked',
        q: ` ${long} `,
        ver: null,
        order: 'asc',
        period: { field: 'seen', from: '2026-11-01', to: '2026-11-03' },
      },
      3,
      100,
    );
    expect(s.calls[0].query).toEqual({
      q: long,
      filter: 'revoked',
      ver: 'none',
      sort: 'lastSeen,asc',
      seenFrom: new Date(2026, 10, 1).toISOString(),
      seenTo: new Date(2026, 10, 4).toISOString(),
      page: 3,
      limit: 100,
    });
  });

  it('기본 조건은 쿼리에 싣지 않고, 가입일 기간은 joined* 로 보낸다', async () => {
    const s = fakeApiOf({ 'GET /v2/admin/users': () => ({ items: [], nextCursor: null, total: 0 }) });
    const port = createServerUserRowsPort(s.api);
    await port.page(ALL, 1, 100);
    await port.page({ ...ALL, period: { ...NO_PERIOD, from: '2026-11-01', to: '' } }, 1, 100);
    expect(s.calls[0].query).toEqual({ page: 1, limit: 100 });
    expect(s.calls[1].query).toMatchObject({ joinedFrom: new Date(2026, 10, 1).toISOString() });
    expect(s.calls[1].query).not.toHaveProperty('joinedTo', expect.anything());
  });

  it('먼 쪽도 요청 한 번 — 70쪽은 page=70 하나만 묻는다(앞 쪽을 이어 받지 않는다)', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/users': () => ({ items: [], nextCursor: null, total: 3480, page: 70 }),
    });
    const page = await createServerUserRowsPort(s.api).page(ALL, 70, 50);
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0].query).toEqual({ page: 70, limit: 50 });
    expect(page.total).toBe(3480);
  });

  it('쪽을 줄로 바꾸고 서버가 센 total 을 그대로 둔다(웹이 세지 않는다)', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/users': () => ({
        items: [
          serverRow('u1'),
          serverRow('u2', { online: null, license: null, appVersion: null, lastSeenAt: null }),
        ],
        nextCursor: null,
        total: 1234,
        page: 1,
      }),
    });
    const page = await createServerUserRowsPort(s.api).page(ALL, 1, 100);
    expect(page.total).toBe(1234);
    expect(page.items[1]).toMatchObject({ licenseState: 'none', license: null, ver: null });
    expect(page.items[1].live.presence).toMatchObject({ online: null, lastSeen: null });
  });

  it('통계: 버전 null 은 기록 없음 칩, 최근 7일은 따로', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/users/stats': () => ({
        total: 10,
        versions: [
          { version: '0.13.0', count: 6 },
          { version: null, count: 4 },
        ],
        recentVersions: [{ version: '0.13.0', count: 3 }],
      }),
    });
    const stats = await createServerUserRowsPort(s.api).stats();
    expect(stats.total).toBe(10);
    expect(stats.versions.map((v) => [v.ver, v.count])).toEqual([
      ['0.13.0', 6],
      [null, 4],
    ]);
    expect(stats.recent?.map((v) => [v.ver, v.count])).toEqual([['0.13.0', 3]]);
  });

  it('사용자코드로 찾기는 100개씩 나눠 묻는다', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/users': (c) => ({
        items: String(c.query?.codes)
          .split(',')
          .map((code) => serverRow(code)),
        nextCursor: null,
        total: null,
      }),
    });
    const codes = Array.from({ length: 150 }, (_, i) => `u${i}`);
    const found = await createServerUserRowsPort(s.api).byCodes([...codes, 'u1']);
    expect(found.size).toBe(150);
    expect(s.calls.map((c) => String(c.query?.codes).split(',').length)).toEqual([100, 50]);
  });

  it('줄 칸이 약속과 다르면 던진다', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/users': () => ({
        items: [serverRow('u1', { friendCode: null })],
        nextCursor: null,
        total: 1,
      }),
    });
    const e = await createServerUserRowsPort(s.api)
      .page(ALL, 1, 100)
      .catch((x: unknown) => x);
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
  });
});

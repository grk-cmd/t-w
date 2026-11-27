import { describe, expect, it } from 'vitest';
import { createServerAdminLogPort } from '@/entities/admin-log/api/server';
import { actionLabel, SERVER_LOG_GROUPS } from '@/entities/admin-log';
import { createServerMetricsPort } from '@/entities/metrics/daily-active/api/server';
import { metricsSummary } from '@/entities/metrics/daily-active';
import { createServerUsagePort } from '@/entities/metrics/usage/api/server';
import { createServerUserCountPort } from '@/entities/user-count/api/server';
import { isPortError, type Api, type ApiParams, type ApiSendOptions } from '@/shared/api';
import { kstDateKey } from '@/shared/lib';

interface Call {
  method: string;
  path: string;
  body?: unknown;
  query?: ApiParams;
}

function fake(handlers: Record<string, (call: Call) => unknown>) {
  const calls: Call[] = [];
  const answer = (call: Call) => {
    calls.push(call);
    const h = handlers[`${call.method} ${call.path}`];
    if (!h) throw new Error(`모르는 길 ${call.method} ${call.path}`);
    return h(call);
  };
  const api: Api = {
    baseUrl: 'https://api.test',
    async get<T>(path: string, query?: ApiParams) {
      return answer({ method: 'GET', path, query }) as T;
    },
    async send<T>(method: string, path: string, options?: ApiSendOptions) {
      return answer({ method, path, body: options?.body, query: options?.query }) as T;
    },
    async upload() {
      throw new Error('upload 안 씀');
    },
  };
  return { api, calls };
}

const TODAY = kstDateKey(Date.now());

describe('접속 지표 — API 판', () => {
  const daily = {
    today: TODAY,
    wau: 40,
    mau: 120,
    days: [
      { day: '2026-11-01', dau: 10, visits: 30, ipVisitors: null, pings: 5, summarized: true },
      { day: TODAY, dau: 12, visits: 33, ipVisitors: 20, pings: 9, summarized: false },
    ],
  };

  it('목록 한 번으로 날마다 돌려주고, WAU · MAU 는 오늘 줄에 싣는다', async () => {
    const s = fake({ 'GET /v2/admin/metrics/daily': () => daily });
    const port = createServerMetricsPort(s.api);
    const [old, today] = await Promise.all([port.getDay('2026-11-01'), port.getDay(TODAY, true)]);
    expect(old).toEqual({ date: '2026-11-01', users: [], dau: 10, visits: 30, ipVisitors: 0, pings: 5 });
    expect(today).toMatchObject({ dau: 12, ipVisitors: 20, wau: 40, mau: 120 });
    // 서버가 준 기간 밖의 날은 0 줄로 채우지 않고 던진다
    const outside = await port.getDay('2026-10-01').catch((e: unknown) => e);
    expect(isPortError(outside, 'notFound')).toBe(true);
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0].query).toEqual({ days: 92 });
  });

  it('요약은 서버가 준 WAU · MAU 를 쓴다(users 로 세지 않는다)', async () => {
    const s = fake({ 'GET /v2/admin/metrics/daily': () => daily });
    const days = await createServerMetricsPort(s.api).getRecent(['2026-11-01', TODAY]);
    const port = createServerMetricsPort(s.api);
    expect(metricsSummary(days, port.activeUsers(days))).toMatchObject({ wau: 40, mau: 120 });
  });

  it('서버 시각 차는 서버가 준 «오늘» 에서 구한다', async () => {
    const s = fake({
      'GET /v2/admin/metrics/daily': () => ({
        ...daily,
        today: '2099-01-01',
        days: [{ day: '2099-01-01', dau: 0, visits: 0, ipVisitors: 0, pings: 0 }],
      }),
    });
    const offset = await createServerMetricsPort(s.api).serverTimeOffset();
    expect(offset).toBeGreaterThan(0);
    const same = fake({ 'GET /v2/admin/metrics/daily': () => daily });
    expect(await createServerMetricsPort(same.api).serverTimeOffset()).toBe(0);
  });
});

describe('접속 지표 — 모양이 틀리면 던진다(기본값으로 덮지 않는다)', () => {
  const ok = {
    today: TODAY,
    wau: 1,
    mau: 2,
    days: [{ day: TODAY, dau: 1, visits: 2, ipVisitors: 3, pings: 4 }],
  };
  const ask = (wire: unknown) =>
    createServerMetricsPort(fake({ 'GET /v2/admin/metrics/daily': () => wire }).api)
      .getDay(TODAY)
      .catch((e: unknown) => e);

  it('wau · mau 가 없으면 0 이 아니라 던진다', async () => {
    expect(isPortError(await ask({ ...ok, wau: undefined }), 'invalid')).toBe(true);
    expect(isPortError(await ask({ ...ok, mau: 'x' }), 'invalid')).toBe(true);
  });

  it('days 의 숫자가 글자이거나 오늘 줄이 없으면 던진다', async () => {
    expect(isPortError(await ask({ ...ok, days: [{ ...ok.days[0], dau: '3' }] }), 'invalid')).toBe(true);
    expect(isPortError(await ask({ ...ok, days: [] }), 'invalid')).toBe(true);
  });

  it('요약 숫자는 서버가 준 오늘 줄에서만 — 없는 줄 목록으로는 사용자 목록을 세지 않고 던진다', () => {
    const port = createServerMetricsPort(fake({}).api);
    expect(() =>
      port.activeUsers([{ date: TODAY, users: ['u1'], dau: 1, visits: 0, ipVisitors: 0, pings: 0 }]),
    ).toThrow(/WAU/);
  });
});

describe('가입자 수 — API 판', () => {
  it('users 가 숫자가 아니면 0 이 아니라 던진다', async () => {
    const s = fake({ 'GET /v2/admin/metrics/totals': () => ({ users: '321' }) });
    const error = await createServerUserCountPort(s.api)
      .get()
      .catch((e: unknown) => e);
    expect(isPortError(error, 'invalid')).toBe(true);
  });

  it('totals 의 users', async () => {
    const s = fake({ 'GET /v2/admin/metrics/totals': () => ({ users: 321, premiumUsers: 4, licenses: {} }) });
    expect(await createServerUserCountPort(s.api).get()).toBe(321);
  });
});

describe('사용량 — API 판', () => {
  const usage = {
    today: TODAY,
    days: [
      {
        day: '2026-11-01',
        storage: { bucket: 'b', sentBytes: 1000, storedBytes: 5000, measuredAt: '2026-11-01T23:00:00Z' },
        hosting: { sentBytes: null, measuredAt: '2026-11-01T23:00:00Z' },
      },
    ],
  };

  it('Storage · Hosting 만 채우고 DB · 함수 무리는 null · 포트가 그 줄이 없다고 알린다', async () => {
    const s = fake({ 'GET /v2/admin/metrics/usage': () => usage });
    const port = createServerUsagePort(s.api);
    const day = await port.getDay('2026-11-01');
    expect(day).toMatchObject({
      db: null,
      functions: null,
      storage: { sentBytes: 1000, storedBytes: 5000 },
      hosting: { sentBytes: 0 },
    });
    expect(isPortError(await port.getDay('2026-11-02').catch((e: unknown) => e), 'notFound')).toBe(true);
    expect(port.features).toEqual({ db: false, functions: false });
  });
});

describe('사용량 — 모양이 틀리면 던진다', () => {
  it('사용량 칸이 틀리면 0 으로 덮지 않는다', async () => {
    const day = {
      day: '2026-11-01',
      storage: { sentBytes: 'x', storedBytes: 1, measuredAt: '2026-11-01T00:00:00Z' },
      hosting: null,
    };
    for (const wire of [{ today: TODAY, days: [day] }, { today: TODAY }, { days: [] }]) {
      const s = fake({ 'GET /v2/admin/metrics/usage': () => wire });
      const error = await createServerUsagePort(s.api)
        .getDay('2026-11-01')
        .catch((e: unknown) => e);
      expect(isPortError(error, 'invalid')).toBe(true);
    }
  });
});

describe('작업 기록 — API 판', () => {
  const row = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    at: '2026-11-10T03:00:00Z',
    by: 'uid-1',
    byName: '미희',
    action: 'ops.configSet',
    target: 'room.limits',
    detail: null,
    ...over,
  });

  it('최근 n 개를 키셋으로 이어 받고 서버 칸을 화면 칸으로 바꾼다', async () => {
    let page = 0;
    const s = fake({
      'GET /v2/admin/audit-logs': () =>
        page++ === 0
          ? { items: [row('1'), row('2')], nextCursor: 'c1' }
          : { items: [row('3')], nextCursor: null },
    });
    const log = await createServerAdminLogPort(s.api).list(3);
    expect(log.items.map((e) => e.id)).toEqual(['1', '2', '3']);
    expect(log.items[0]).toMatchObject({
      by: 'uid-1',
      byName: '미희',
      detail: '',
      at: Date.parse('2026-11-10T03:00:00Z'),
    });
    expect(log.hasMore).toBe(false);
    expect(s.calls[1].query).toMatchObject({ cursor: 'c1', limit: 1 });
  });

  it('칸이 약속과 다르면 줄을 버리지 않고 던진다 — byName · detail 의 null 만 «없음»', async () => {
    const list = (items: unknown, nextCursor: unknown = null) =>
      createServerAdminLogPort(fake({ 'GET /v2/admin/audit-logs': () => ({ items, nextCursor }) }).api).list(
        5,
      );
    const shape = async (p: Promise<unknown>) => {
      const e = await p.catch((x: unknown) => x);
      expect(isPortError(e, 'invalid')).toBe(true);
    };
    await shape(list([row('1', { at: '어제' })]));
    await shape(list([row('1', { by: undefined })]));
    await shape(list([row('1', { id: undefined })]));
    await shape(list([row('1', { target: 3 })]));
    await shape(list(undefined));
    await shape(list([row('1')], 7));
    const ok = await list([row('1', { byName: null, detail: '자세히' })]);
    expect(ok.items[0]).toMatchObject({ detail: '자세히' });
    expect(ok.items[0]).not.toHaveProperty('byName');
  });

  it('더 있으면 hasMore · 서버 동작 이름에 라벨이 있고 필터 칩은 서버 이름 앞부분을 따른다', async () => {
    const s = fake({ 'GET /v2/admin/audit-logs': () => ({ items: [row('1')], nextCursor: 'more' }) });
    const port = createServerAdminLogPort(s.api);
    expect((await port.list(1)).hasMore).toBe(true);
    expect(actionLabel('ops.configSet')).toBe('설정 바꿈');
    expect(actionLabel('metrics.improvementAdd')).toBe('개선 기록 추가');
    expect(port.groups).toBe(SERVER_LOG_GROUPS);
  });
});

import { describe, expect, it } from 'vitest';
import { createServerAdminLogPort } from '@/entities/admin-log/api/server';
import { actionLabel, SERVER_LOG_GROUPS } from '@/entities/admin-log';
import { createServerMetricsPort } from '@/entities/metrics/daily-active/api/server';
import { metricsSummary } from '@/entities/metrics/daily-active';
import { createServerUsagePort } from '@/entities/metrics/usage/api/server';
import { createServerUserCountPort } from '@/entities/user-count/api/server';
import { ApiError, isPortError, type Api, type ApiParams, type ApiSendOptions } from '@/shared/api';
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
    const [old, today, none] = await Promise.all([
      port.getDay('2026-11-01'),
      port.getDay(TODAY, true),
      port.getDay('2026-10-01'),
    ]);
    expect(old).toEqual({ date: '2026-11-01', users: [], dau: 10, visits: 30, ipVisitors: 0, pings: 5 });
    expect(today).toMatchObject({ dau: 12, ipVisitors: 20, wau: 40, mau: 120 });
    expect(none).toEqual({ date: '2026-10-01', users: [], dau: 0, visits: 0, ipVisitors: 0, pings: 0 });
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0].query).toEqual({ days: 92 });
  });

  it('요약은 서버가 준 WAU · MAU 를 쓴다(users 로 세지 않는다)', async () => {
    const s = fake({ 'GET /v2/admin/metrics/daily': () => daily });
    const days = await createServerMetricsPort(s.api).getRecent(['2026-11-01', TODAY]);
    expect(metricsSummary(days)).toMatchObject({ wau: 40, mau: 120 });
  });

  it('서버 시각 차는 서버가 준 «오늘» 에서 구한다', async () => {
    const s = fake({ 'GET /v2/admin/metrics/daily': () => ({ ...daily, today: '2099-01-01' }) });
    const offset = await createServerMetricsPort(s.api).serverTimeOffset();
    expect(offset).toBeGreaterThan(0);
    const same = fake({ 'GET /v2/admin/metrics/daily': () => daily });
    expect(await createServerMetricsPort(same.api).serverTimeOffset()).toBe(0);
  });
});

describe('가입자 수 — API 판', () => {
  it('totals 의 users', async () => {
    const s = fake({ 'GET /v2/admin/metrics/totals': () => ({ users: 321, premiumUsers: 4, licenses: {} }) });
    expect(await createServerUserCountPort(s.api).get()).toBe(321);
  });
});

describe('사용량 · 개선 기록 — API 판', () => {
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
    expect(await port.getDay('2026-11-02')).toMatchObject({ storage: null, hosting: null });
    expect(port.features).toEqual({ db: false, functions: false });
  });

  const wire = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    release: '0.13.0',
    releasedAt: '2026-11-10T00:00:00Z',
    title: '제목',
    items: ['하나', '둘'],
    adoptDays: 3,
    version: 4,
    ...over,
  });

  it('개선 기록: 서버 칸을 화면 칸으로 바꿔 읽고, 고치기 · 지우기에 읽은 version 을 싣는다', async () => {
    const s = fake({
      'GET /v2/admin/metrics/improvements': () => ({
        items: [wire('a'), wire('b', { releasedAt: '2026-11-12T00:00:00Z', version: 7 })],
      }),
      'PUT /v2/admin/metrics/improvements/a': () => wire('a'),
      'DELETE /v2/admin/metrics/improvements/b': () => undefined,
    });
    const port = createServerUsagePort(s.api);
    const list = await port.listImprovements();
    expect(list.map((r) => [r.id, r.version, r.revision])).toEqual([
      ['b', '0.13.0', 7],
      ['a', '0.13.0', 4],
    ]);
    const draft = {
      version: ' 0.13.0 ',
      releasedAt: Date.parse('2026-11-10T00:00:00Z'),
      title: '제목',
      items: ['하나', ' '],
      adoptDays: 3,
    };
    expect(await port.saveImprovement(draft, 'a')).toBe('a');
    expect(s.calls.at(-1)?.body).toEqual({
      version: 4,
      release: '0.13.0',
      releasedAt: '2026-11-10T00:00:00.000Z',
      title: '제목',
      items: ['하나'],
      adoptDays: 3,
    });
    await port.deleteImprovement(list[0]);
    expect(s.calls.at(-1)?.query).toEqual({ version: 7 });
  });

  it('개선 기록 추가: 같은 내용을 다시 보내면 같은 요청 번호 · 받을 수 없는 값은 보내지 않는다', async () => {
    let fail = true;
    const s = fake({
      'POST /v2/admin/metrics/improvements': () => {
        if (fail) throw new ApiError('unavailable', 0, '', '끊김');
        return wire('new');
      },
    });
    const port = createServerUsagePort(s.api);
    const draft = {
      version: '0.13.1',
      releasedAt: Date.parse('2026-11-10T00:00:00Z'),
      title: '제목',
      items: ['하나'],
      adoptDays: 3,
    };
    await expect(port.saveImprovement(draft)).rejects.toMatchObject({ kind: 'unreachable' });
    fail = false;
    expect(await port.saveImprovement(draft)).toBe('new');
    const [a, b] = s.calls.map((c) => (c.body as { requestId: string }).requestId);
    expect(a).toBe(b);
    await expect(port.saveImprovement({ ...draft, title: '' })).rejects.toThrow(/제목/);
  });

  it('읽지 못한 id 를 고치려 하면 conflict', async () => {
    const error = await createServerUsagePort(fake({}).api)
      .deleteImprovement({ id: 'x', version: 'v', releasedAt: 1, title: 't', items: [], adoptDays: 3 })
      .catch((e: unknown) => e);
    expect(isPortError(error, 'conflict')).toBe(true);
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

  it('더 있으면 hasMore · 서버 동작 이름에 라벨이 있고 필터 칩은 서버 이름 앞부분을 따른다', async () => {
    const s = fake({ 'GET /v2/admin/audit-logs': () => ({ items: [row('1')], nextCursor: 'more' }) });
    const port = createServerAdminLogPort(s.api);
    expect((await port.list(1)).hasMore).toBe(true);
    expect(actionLabel('ops.configSet')).toBe('설정 바꿈');
    expect(actionLabel('metrics.improvementAdd')).toBe('개선 기록 추가');
    expect(port.groups).toBe(SERVER_LOG_GROUPS);
  });
});

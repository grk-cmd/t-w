import { describe, expect, it } from 'vitest';
import { createServerBroadcastPort } from '@/entities/inbox/api/server';
import { createServerAnnouncePort } from '@/entities/notice/announce/api/server';
import { createServerUpdateNoticePort } from '@/entities/notice/update-notice/api/server';
import { createServerRoomPort } from '@/entities/room/api/server';
import { ApiError, isPortError, type Api, type ApiParams, type ApiSendOptions } from '@/shared/api';
import { createPayloadRequestId } from '@/shared/lib';

interface Call {
  method: string;
  path: string;
  body?: unknown;
  query?: ApiParams;
}

/** 경로마다 답을 정해 두는 가짜 서버 — 부른 것을 차례로 적는다. */
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

const wire = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  tag: 'NOTICE',
  title: `제목 ${id}`,
  body: '본문',
  pinned: false,
  publishedAt: '2026-11-20T03:00:00Z',
  version: 3,
  ...over,
});

describe('소식 포트 — API 판', () => {
  it('고정 + 최신을 한 번에 받고 서버 칸을 화면 칸으로 바꾼다', async () => {
    const s = fake({
      'GET /v2/notices': () => ({
        broadcasts: {
          pinned: [wire('p1', { pinned: true, tag: 'UPDATE' })],
          latest: [wire('a')],
          nextCursor: null,
        },
      }),
    });
    const page = await createServerBroadcastPort(s.api).list(30);
    expect(page.hasMore).toBe(false);
    expect(page.items.map((b) => [b.id, b.tag, b.pinned, b.ts, b.version])).toEqual([
      ['p1', 'update', true, Date.parse('2026-11-20T03:00:00Z'), 3],
      ['a', 'notice', false, Date.parse('2026-11-20T03:00:00Z'), 3],
    ]);
  });

  it('더 달라고 하면 키셋으로 이어 받는다(한 번에 최대 50개)', async () => {
    const s = fake({
      'GET /v2/notices': () => ({
        broadcasts: { pinned: [], latest: [wire('a'), wire('b')], nextCursor: 'c1' },
      }),
      'GET /v2/notices/broadcasts': () => ({ items: [wire('c')], nextCursor: null }),
    });
    const page = await createServerBroadcastPort(s.api).list(60);
    expect(page.items.map((b) => b.id)).toEqual(['a', 'b', 'c']);
    expect(s.calls[1].query).toEqual({ cursor: 'c1', limit: 50 });
    expect(page.hasMore).toBe(false);
  });

  it('보내기: 태그는 서버 이름으로, 같은 내용을 다시 보내면 같은 요청 번호', async () => {
    let fail = true;
    const s = fake({
      'POST /v2/admin/notices/broadcasts': () => {
        if (fail) throw new ApiError('unavailable', 0, '', '끊김');
        return wire('n');
      },
    });
    const port = createServerBroadcastPort(s.api);
    const message = { tag: 'reward' as const, title: ' 새 소식 ', body: '' };
    await expect(port.send(message, true)).rejects.toMatchObject({ kind: 'unreachable' });
    fail = false;
    await port.send(message, true);
    const [first, second] = s.calls.map((c) => c.body as { requestId: string });
    expect(first.requestId).toBe(second.requestId);
    expect(s.calls[1].body).toMatchObject({ tag: 'REWARD', title: '새 소식', body: '', pinned: true });
  });

  it('고정 · 내리기: 한 개는 PATCH · DELETE 에 읽은 version, 여럿은 묶음 한 번', async () => {
    const s = fake({
      'GET /v2/notices': () => ({
        broadcasts: {
          pinned: [],
          latest: [wire('a', { version: 7 }), wire('b', { version: 2 })],
          nextCursor: null,
        },
      }),
      'PATCH /v2/admin/notices/broadcasts/a': () => undefined,
      'DELETE /v2/admin/notices/broadcasts/b': () => undefined,
      'POST /v2/admin/notices/broadcasts/bulk': () => [
        { id: 'a', ok: true },
        { id: 'b', ok: true },
      ],
    });
    const port = createServerBroadcastPort(s.api);
    await port.list();
    expect(await port.setPinned(['a'], true)).toBe(1);
    expect(s.calls.at(-1)).toMatchObject({ body: { version: 7, pinned: true } });
    expect(await port.remove(['b'])).toBe(1);
    expect(s.calls.at(-1)).toMatchObject({ query: { version: 2 } });
    expect(await port.setPinned(['a', 'b'], false)).toBe(2);
    expect(s.calls.at(-1)).toMatchObject({
      body: {
        action: 'UNPIN',
        items: [
          { id: 'a', version: 7 },
          { id: 'b', version: 2 },
        ],
      },
    });
  });

  it('묶음에서 안 된 줄이 있으면 «n개 됨 · m개 안 됨» 으로 던지고 겹침이면 conflict', async () => {
    const s = fake({
      'GET /v2/notices': () => ({
        broadcasts: { pinned: [], latest: [wire('a'), wire('b')], nextCursor: null },
      }),
      'POST /v2/admin/notices/broadcasts/bulk': () => [
        { id: 'a', ok: true },
        { id: 'b', ok: false, code: 'CONCURRENT_UPDATE' },
      ],
    });
    const port = createServerBroadcastPort(s.api);
    await port.list();
    const error = await port.remove(['a', 'b']).catch((e: unknown) => e);
    expect(isPortError(error, 'conflict')).toBe(true);
    expect((error as Error).message).toBe('1개 됨 · 1개 안 됨');
  });

  it('목록에 없는 id 를 고정하려 하면 conflict(목록이 낡았다)', async () => {
    const s = fake({});
    const error = await createServerBroadcastPort(s.api)
      .setPinned(['x'], true)
      .catch((e: unknown) => e);
    expect(isPortError(error, 'conflict')).toBe(true);
  });
});

describe('확성기 · 업데이트 공지 — API 판', () => {
  it('확성기: 보낸 것을 기억해 남은 시간을 보이고, 끄면 지운다', async () => {
    const s = fake({
      'POST /v2/admin/notices/announcements': () => undefined,
      'DELETE /v2/admin/notices/announcements/current': () => undefined,
    });
    const port = createServerAnnouncePort(s.api);
    expect(await port.get()).toBeNull();
    await port.publish('  점검 5분 전  ');
    expect(s.calls[0].body).toMatchObject({ text: '점검 5분 전' });
    expect(await port.get()).toMatchObject({ text: '점검 5분 전', duration: 60_000 });
    expect(await port.serverTimeOffset()).toBe(0);
    await port.clear();
    expect(await port.get()).toBeNull();
  });

  it('업데이트 공지: 읽은 id 로 내린다 · 없으면 notFound', async () => {
    let current: unknown = { id: 'u-1', title: '새 버전', body: '내용', publishedAt: '2026-11-20T03:00:00Z' };
    const s = fake({
      'GET /v2/notices': () => ({ updateNotice: current }),
      'DELETE /v2/admin/notices/update-notices/u-1': () => {
        current = null;
      },
    });
    const port = createServerUpdateNoticePort(s.api);
    expect(await port.get()).toEqual({
      title: '새 버전',
      body: '내용',
      ts: Date.parse('2026-11-20T03:00:00Z'),
    });
    await port.clear();
    expect(s.calls.at(-1)?.path).toBe('/v2/admin/notices/update-notices/u-1');
    const error = await port.clear().catch((e: unknown) => e);
    expect(isPortError(error, 'notFound')).toBe(true);
  });

  it('업데이트 공지 올리기: 응답의 id 를 기억한다', async () => {
    const s = fake({
      'POST /v2/admin/notices/update-notices': () => ({
        id: 'u-2',
        title: 't',
        body: 'b',
        publishedAt: '2026-11-20T03:00:00Z',
      }),
      'DELETE /v2/admin/notices/update-notices/u-2': () => undefined,
    });
    const port = createServerUpdateNoticePort(s.api);
    await port.publish(' 제목 ', ' 본문 ');
    expect(s.calls[0].body).toMatchObject({ title: '제목', body: '본문' });
    await port.clear();
    expect(s.calls.at(-1)?.path).toBe('/v2/admin/notices/update-notices/u-2');
  });
});

describe('방 포트 — API 판', () => {
  const listing = {
    at: '2026-11-20T03:00:00Z',
    rooms: [
      {
        code: 'ABC123',
        channel: 'workingroom',
        secret: false,
        open: true,
        host: 'u1',
        members: [{ userCode: 'u1', name: '가' }],
      },
      { code: 'SCRT-ZZ', channel: 'togetherroom', secret: true, open: false, host: null, members: [] },
      { code: '깨진줄', channel: 'nope' },
    ],
    counts: { workingroom: 1, togetherroom: 1 },
  };

  it('목록 한 번으로 색인 · 코드 · 사람 · 집계 · 시각 차를 채운다', async () => {
    const s = fake({ 'GET /v2/admin/rooms': () => listing });
    const port = createServerRoomPort(s.api);
    const at = Date.parse('2026-11-20T03:00:00Z');
    expect(await port.getCodes()).toEqual(['ABC123', 'SCRT-ZZ']);
    expect(await port.getIndex()).toEqual({
      ABC123: { channel: 'workingroom', open: true, lastSeen: at },
      'SCRT-ZZ': { channel: 'togetherroom', open: false, lastSeen: at },
    });
    expect(await port.probeRooms(['ABC123', 'SCRT-ZZ'], new Set())).toEqual({
      ABC123: { members: 1, lastSeen: null, people: [{ userId: 'u1', name: '가' }] },
      'SCRT-ZZ': { members: 0, lastSeen: null, people: [] },
    });
    expect(await port.getStats()).toEqual({ workingroom: 1, togetherroom: 1, at });
    expect(await port.getLive()).toBeNull();
    expect(typeof (await port.serverTimeOffset())).toBe('number');
    // 이 모든 읽기가 목록 요청 한 번이다
    expect(s.calls.filter((c) => c.path === '/v2/admin/rooms')).toHaveLength(1);
    expect(port.features).toEqual({ ghostCleanup: false, lastSeen: false });
  });

  it('닫기: 500개씩 나눠 보내고, 전체는 all: true', async () => {
    const s = fake({
      'GET /v2/admin/rooms': () => listing,
      'POST /v2/admin/rooms/close': (c) =>
        'all' in (c.body as object)
          ? { closed: ['ABC123', 'SCRT-ZZ'], missing: [] }
          : { closed: [], missing: [] },
    });
    const port = createServerRoomPort(s.api);
    const codes = Array.from({ length: 501 }, (_, i) => `R${i}`);
    await port.close(codes);
    const closes = s.calls.filter((c) => c.path.endsWith('/close'));
    expect(closes.map((c) => (c.body as { codes: string[] }).codes.length)).toEqual([500, 1]);
    expect(await port.closeAll()).toEqual(['ABC123', 'SCRT-ZZ']);
    expect(s.calls.at(-1)?.body).toEqual({ all: true });
  });

  it('방 서버에 닿지 못하면 unreachable', async () => {
    const s = fake({
      'GET /v2/admin/rooms': () => {
        throw new ApiError('unavailable', 503, 'ROOM_REALTIME_UNAVAILABLE', '');
      },
    });
    const error = await createServerRoomPort(s.api)
      .getCodes()
      .catch((e: unknown) => e);
    expect(isPortError(error, 'unreachable')).toBe(true);
    expect((error as Error).message).toBe('방 서버에 닿지 못했어요');
  });
});

describe('요청 번호 — 내용이 같을 때만 남긴다', () => {
  it('닿지 못하면 남기고, 내용이 바뀌거나 서버가 답하면 새 번호', async () => {
    let n = 0;
    const once = createPayloadRequestId(() => `id-${++n}`);
    const seen: string[] = [];
    const lost = (id: string) => {
      seen.push(id);
      return Promise.reject(new ApiError('unavailable', 0, '', ''));
    };
    await once({ a: 1 }, lost).catch(() => undefined);
    await once({ a: 1 }, lost).catch(() => undefined);
    await once({ a: 2 }, lost).catch(() => undefined);
    expect(seen).toEqual(['id-1', 'id-1', 'id-2']);
    await once({ a: 2 }, async (id) => seen.push(id));
    await once({ a: 2 }, async (id) => seen.push(id));
    expect(seen.slice(3)).toEqual(['id-2', 'id-3']);
  });
});

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
          total: 1,
        },
      }),
    });
    const page = await createServerBroadcastPort(s.api).list(30);
    expect(page.hasMore).toBe(false);
    // 서버 total 은 고정 아닌 공지 수 — 고정을 더해 전체 수로.
    expect(page.total).toBe(2);
    expect(page.items.map((b) => [b.id, b.tag, b.pinned, b.ts, b.version])).toEqual([
      ['p1', 'update', true, Date.parse('2026-11-20T03:00:00Z'), 3],
      ['a', 'notice', false, Date.parse('2026-11-20T03:00:00Z'), 3],
    ]);
  });

  it('더 달라고 하면 키셋으로 이어 받는다(한 번에 최대 50개)', async () => {
    const s = fake({
      'GET /v2/notices': () => ({
        broadcasts: { pinned: [], latest: [wire('a'), wire('b')], nextCursor: 'c1', total: 3 },
      }),
      'GET /v2/notices/broadcasts': () => ({ items: [wire('c')], nextCursor: null }),
    });
    const page = await createServerBroadcastPort(s.api).list(60);
    expect(page.items.map((b) => b.id)).toEqual(['a', 'b', 'c']);
    expect(s.calls[1].query).toEqual({ cursor: 'c1', limit: 50 });
    expect(page.hasMore).toBe(false);
  });

  it('공지 판에 total 이 없으면 약속과 다른 응답', async () => {
    const s = fake({
      'GET /v2/notices': () => ({ broadcasts: { pinned: [], latest: [wire('a')], nextCursor: null } }),
    });
    const error = await createServerBroadcastPort(s.api)
      .list()
      .catch((e: unknown) => e);
    expect(isPortError(error, 'invalid')).toBe(true);
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
          total: 2,
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
    const { items } = await port.list();
    const [a, b] = [items.find((x) => x.id === 'a')!, items.find((x) => x.id === 'b')!];
    expect(await port.setPinned([a], true)).toBe(1);
    expect(s.calls.at(-1)).toMatchObject({ body: { version: 7, pinned: true } });
    expect(await port.remove([b])).toBe(1);
    expect(s.calls.at(-1)).toMatchObject({ query: { version: 2 } });
    expect(await port.setPinned([a, b], false)).toBe(2);
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
        broadcasts: { pinned: [], latest: [wire('a'), wire('b')], nextCursor: null, total: 2 },
      }),
      'POST /v2/admin/notices/broadcasts/bulk': () => [
        { id: 'a', ok: true },
        { id: 'b', ok: false, code: 'CONCURRENT_UPDATE' },
      ],
    });
    const port = createServerBroadcastPort(s.api);
    const { items } = await port.list();
    const error = await port.remove(items).catch((e: unknown) => e);
    expect(isPortError(error, 'conflict')).toBe(true);
    expect((error as Error).message).toBe('1개 됨 · 1개 안 됨');
  });

  it('번호가 없는 줄(읽지 않은 줄)로는 요청을 보내지 않고 던진다', async () => {
    const s = fake({});
    const row = { id: 'x', tag: 'notice' as const, title: '', body: '', ts: 0, pinned: false };
    const error = await createServerBroadcastPort(s.api)
      .setPinned([row], true)
      .catch((e: unknown) => e);
    expect(isPortError(error, 'invalid')).toBe(true);
    expect(s.calls).toHaveLength(0);
  });

  it('옛 화면이 든 줄(옛 version)로 고정하면 서버가 409 → conflict, 덮어쓰지 않는다', async () => {
    const s = fake({
      'GET /v2/notices': () => ({
        broadcasts: { pinned: [], latest: [wire('a', { version: 1 })], nextCursor: null, total: 1 },
      }),
      'PATCH /v2/admin/notices/broadcasts/a': () => {
        throw new ApiError('request', 409, 'CONCURRENT_UPDATE', '겹침');
      },
    });
    const port = createServerBroadcastPort(s.api);
    const { items } = await port.list();
    const error = await port.setPinned(items, true).catch((e: unknown) => e);
    expect(isPortError(error, 'conflict')).toBe(true);
    expect(s.calls.at(-1)).toMatchObject({ body: { version: 1 } }); // 포트가 새 번호를 따로 읽어 얹지 않는다
  });

  it('version 이 없는 응답 줄은 0 이나 빈 값으로 덮지 않고 던진다', async () => {
    const s = fake({
      'GET /v2/notices': () => ({
        broadcasts: { pinned: [], latest: [wire('a', { version: undefined })], nextCursor: null, total: 1 },
      }),
    });
    const error = await createServerBroadcastPort(s.api)
      .list()
      .catch((e: unknown) => e);
    expect(isPortError(error, 'invalid')).toBe(true);
  });
});

describe('소식 — 공지 줄의 칸이 틀리면 던진다', () => {
  it('태그 · 제목 · 시각 · pinned 가 틀린 줄을 버리거나 기본값으로 덮지 않는다', async () => {
    for (const bad of [{ tag: 'OTHER' }, { title: 3 }, { publishedAt: 'x' }, { pinned: 'yes' }, { id: 7 }]) {
      const s = fake({
        'GET /v2/notices': () => ({
          broadcasts: { pinned: [], latest: [wire('a', bad)], nextCursor: null, total: 1 },
        }),
      });
      const error = await createServerBroadcastPort(s.api)
        .list()
        .catch((e: unknown) => e);
      expect(isPortError(error, 'invalid')).toBe(true);
    }
  });

  it('묶음 결과가 목록이 아니거나 줄의 ok 가 참 · 거짓이 아니면 던진다', async () => {
    for (const result of [{}, [{ id: 'a' }]]) {
      const s = fake({
        'GET /v2/notices': () => ({
          broadcasts: { pinned: [], latest: [wire('a'), wire('b')], nextCursor: null, total: 2 },
        }),
        'POST /v2/admin/notices/broadcasts/bulk': () => result,
      });
      const port = createServerBroadcastPort(s.api);
      const { items } = await port.list();
      expect(isPortError(await port.remove(items).catch((e: unknown) => e), 'invalid')).toBe(true);
    }
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

  it('업데이트 공지: 화면이 읽은 공지의 id 로 내린다 · 이미 내려갔으면 서버가 notFound', async () => {
    let current: unknown = { id: 'u-1', title: '새 버전', body: '내용', publishedAt: '2026-11-20T03:00:00Z' };
    const s = fake({
      'GET /v2/notices': () => ({ updateNotice: current }),
      'DELETE /v2/admin/notices/update-notices/u-1': () => {
        if (current === null) throw new ApiError('notFound', 404, 'NOTICE_NOT_FOUND', '없음');
        current = null;
      },
    });
    const port = createServerUpdateNoticePort(s.api);
    const read = await port.get();
    expect(read).toEqual({
      id: 'u-1',
      title: '새 버전',
      body: '내용',
      ts: Date.parse('2026-11-20T03:00:00Z'),
    });
    await port.clear(read!);
    expect(s.calls.at(-1)?.path).toBe('/v2/admin/notices/update-notices/u-1');
    const error = await port.clear(read!).catch((e: unknown) => e);
    expect(isPortError(error, 'notFound')).toBe(true);
  });

  it('업데이트 공지: 읽지 않고(id 없이) 내리려 하면 요청 없이 던진다 · 읽기 전에 먼저 읽지도 않는다', async () => {
    const s = fake({});
    const error = await createServerUpdateNoticePort(s.api)
      .clear({ title: 't', body: 'b', ts: 1 })
      .catch((e: unknown) => e);
    expect(isPortError(error, 'invalid')).toBe(true);
    expect(s.calls).toHaveLength(0);
  });

  it('업데이트 공지: 칸이 틀리면 빈 글로 덮지 않고 던진다 · updateNotice 칸이 없어도 던진다', async () => {
    for (const bad of [
      { updateNotice: { id: 'u', title: 3, body: 'b', publishedAt: '2026-11-20T03:00:00Z' } },
      { updateNotice: { id: 'u', title: 't', body: 'b', publishedAt: 'nope' } },
      {},
    ]) {
      const s = fake({ 'GET /v2/notices': () => bad });
      const error = await createServerUpdateNoticePort(s.api)
        .get()
        .catch((e: unknown) => e);
      expect(isPortError(error, 'invalid')).toBe(true);
    }
  });

  it('업데이트 공지 올리기: 요청 번호만 보내고 id 는 기억하지 않는다', async () => {
    const s = fake({ 'POST /v2/admin/notices/update-notices': () => undefined });
    const port = createServerUpdateNoticePort(s.api);
    await port.publish(' 제목 ', ' 본문 ');
    expect(s.calls[0].body).toMatchObject({ title: '제목', body: '본문' });
    expect(s.calls).toHaveLength(1);
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
    expect(port.features).toEqual({ ghostCleanup: false, lastSeen: false, liveLoad: true });
  });

  it('닫기: 500개까지 한 번에, 전체는 all: true', async () => {
    const s = fake({
      'GET /v2/admin/rooms': () => listing,
      'POST /v2/admin/rooms/close': (c) =>
        'all' in (c.body as object)
          ? { closed: ['ABC123', 'SCRT-ZZ'], missing: [] }
          : { closed: [], missing: [] },
    });
    const port = createServerRoomPort(s.api);
    const codes = Array.from({ length: 500 }, (_, i) => `R${i}`);
    await port.close(codes);
    const closes = s.calls.filter((c) => c.path.endsWith('/close'));
    expect(closes.map((c) => (c.body as { codes: string[] }).codes.length)).toEqual([500]);
    expect(await port.closeAll()).toEqual({ closed: ['ABC123', 'SCRT-ZZ'], missing: [] });
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

describe('같은 API 에는 포트가 하나 — 읽는 훅 · 쓰는 훅이 같은 상태를 쓴다', () => {
  it('읽은 줄의 version 이 고정 요청에 실려 간다(포트는 따로 기억하지 않는다)', async () => {
    const s = fake({
      'GET /v2/notices': () => ({
        broadcasts: { pinned: [], latest: [wire('a', { version: 9 })], nextCursor: null, total: 1 },
      }),
      'PATCH /v2/admin/notices/broadcasts/a': () => undefined,
    });
    const { items } = await createServerBroadcastPort(s.api).list();
    await createServerBroadcastPort(s.api).setPinned(items, true);
    expect(s.calls.at(-1)?.body).toEqual({ version: 9, pinned: true });
  });

  it('확성기: 보낸 쪽과 읽는 쪽이 같은 기억을 보고, 현재 값을 못 읽는 판은 끄기를 늘 연다', async () => {
    const s = fake({ 'POST /v2/admin/notices/announcements': () => undefined });
    await createServerAnnouncePort(s.api).publish('안내');
    expect(await createServerAnnouncePort(s.api).get()).toMatchObject({ text: '안내' });
    expect(createServerAnnouncePort(s.api).readsCurrent).toBe(false);
  });

  it('방: 닫으면 목록 캐시가 바로 비워진다', async () => {
    let listed = 0;
    const s = fake({
      'GET /v2/admin/rooms': () => {
        listed += 1;
        return { at: '2026-11-20T03:00:00Z', rooms: [], counts: { workingroom: 0, togetherroom: 0 } };
      },
      'POST /v2/admin/rooms/close': () => ({ closed: ['A'], missing: [] }),
    });
    await createServerRoomPort(s.api).getCodes();
    await createServerRoomPort(s.api).close(['A']);
    await createServerRoomPort(s.api).getCodes();
    expect(listed).toBe(2);
  });

  it('묶음: 번호 없는 줄이 뒤에 있으면 요청을 한 번도 보내지 않고 던진다', async () => {
    const s = fake({
      'GET /v2/notices': () => ({
        broadcasts: {
          pinned: [],
          latest: Array.from({ length: 100 }, (_, i) => wire(`b${i}`)),
          nextCursor: null,
          total: 100,
        },
      }),
    });
    const port = createServerBroadcastPort(s.api);
    const { items } = await port.list(100);
    const stray = { id: 'zz', tag: 'notice' as const, title: '', body: '', ts: 0, pinned: false };
    const error = await port.remove([...items, stray]).catch((e: unknown) => e);
    expect(isPortError(error, 'invalid')).toBe(true);
    expect(s.calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });
});

describe('방 닫기 · 목록 — 결과를 그대로 알리고 모양이 틀리면 던진다', () => {
  const listing = { at: '2026-11-20T03:00:00Z', rooms: [], counts: {} };

  it('close 는 서버가 준 { closed, missing } 을 그대로 돌려준다', async () => {
    const s = fake({ 'POST /v2/admin/rooms/close': () => ({ closed: ['A'], missing: ['B'] }) });
    expect(await createServerRoomPort(s.api).close(['A', 'B'])).toEqual({ closed: ['A'], missing: ['B'] });
  });

  it('500개를 넘기면 나눠 보내지 않고 요청 없이 던진다', async () => {
    const s = fake({});
    const port = createServerRoomPort(s.api);
    expect(port.closeMax).toBe(500);
    const error = await port.close(Array.from({ length: 501 }, (_, i) => `R${i}`)).catch((e: unknown) => e);
    expect(isPortError(error, 'invalid')).toBe(true);
    expect(s.calls).toHaveLength(0);
  });

  it('closed · missing 가 목록이 아니면 빈 목록으로 덮지 않고 던진다', async () => {
    const s = fake({ 'POST /v2/admin/rooms/close': () => ({ closed: 'A' }) });
    const error = await createServerRoomPort(s.api)
      .close(['A'])
      .catch((e: unknown) => e);
    expect(isPortError(error, 'invalid')).toBe(true);
  });

  it('이름이 없는 참여자(name: null)는 null 그대로', async () => {
    const room = { code: 'A', channel: 'workingroom', secret: false, open: true, host: null };
    const wire = {
      ...listing,
      rooms: [{ ...room, members: [{ userCode: 'u1', name: null }] }],
      counts: { workingroom: 1, togetherroom: 0 },
    };
    const port = createServerRoomPort(fake({ 'GET /v2/admin/rooms': () => wire }).api);
    expect(await port.probeRooms(['A'], new Set())).toEqual({
      A: { members: 1, lastSeen: null, people: [{ userId: 'u1', name: null }] },
    });
  });

  it('방 목록의 칸이 틀리면(채널 · 참여자 이름) 그 방을 빼거나 빈 이름으로 두지 않고 던진다', async () => {
    const room = { code: 'A', channel: 'workingroom', secret: false, open: true, host: null, members: [] };
    const bad = [
      { ...listing, rooms: [{ ...room, channel: 'x' }] },
      { ...listing, rooms: [{ ...room, members: [{ userCode: 'u', name: 3 }] }] },
      { ...listing, at: 'nope' },
      { ...listing, counts: { workingroom: 'many', togetherroom: 1 } },
      { ...listing, counts: { workingroom: 1 } },
    ];
    for (const wire of bad) {
      const s = fake({ 'GET /v2/admin/rooms': () => wire });
      const error = await createServerRoomPort(s.api)
        .getCodes()
        .catch((e: unknown) => e);
      expect(isPortError(error, 'invalid')).toBe(true);
    }
  });
});

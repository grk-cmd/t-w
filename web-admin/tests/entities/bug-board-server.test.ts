import { describe, expect, it } from 'vitest';
import { bugAuthorName, needsAuthorLookup } from '@/entities/bug-board';
import { createServerBugBoardPort } from '@/entities/bug-board/api/server';
import { ApiError, isPortError, WIRE_SHAPE_CODE } from '@/shared/api';
import { fakeApiOf } from '../shared/fakeApi';

const caught = (promise: Promise<unknown>) => promise.catch((e: unknown) => e);
const LIST = 'GET /v2/bugs';

const summary = (n: number, extra: Record<string, unknown> = {}) => ({
  number: `B-1101-${n}`,
  visibility: 'PUBLIC',
  category: 'BUG',
  title: `제목 ${n}`,
  status: 'NEW',
  notice: false,
  byAdmin: false,
  author: { userCode: 'u1', name: '철수', anonymous: false },
  mine: false,
  likeCount: 2,
  answerCount: 1,
  createdAt: '2026-11-01T03:00:00Z',
  lastAnswerAt: null,
  lastAuthorReplyAt: null,
  unseen: false,
  ...extra,
});

const detail = (extra: Record<string, unknown> = {}) => ({
  ...summary(1),
  body: '본문',
  env: null,
  canReply: false,
  liked: false,
  doneAt: null,
  version: 7,
  lastAnswerAt: '2026-11-02T03:00:00.123456Z',
  comments: [
    {
      id: 'c1',
      kind: 'ADMIN_ANSWER',
      text: '확인했어요',
      kakaoLink: 'https://open.kakao.com/o/x',
      visibility: 'PRIVATE',
      statusAfter: 'CHECKING',
      createdAt: '2026-11-02T03:00:00.123456Z',
      updatedAt: '2026-11-02T03:00:00.123456Z',
    },
    {
      id: 'c2',
      kind: 'AUTHOR_REPLY',
      text: '아직 안 돼요',
      kakaoLink: null,
      visibility: null,
      statusAfter: 'UNFIXED',
      createdAt: '2026-11-03T03:00:00Z',
      updatedAt: '2026-11-03T03:00:00Z',
    },
  ],
  ...extra,
});

describe('제보 목록 — API 판', () => {
  it('거르기는 서버가 — 화면 갈래를 서버 이름으로 보내고 한 줄을 BugItem 으로 읽는다', async () => {
    const s = fakeApiOf({
      [LIST]: () => ({
        items: [
          summary(1, {
            visibility: 'PRIVATE',
            category: 'SUGGEST',
            status: 'REVIEW',
            lastAnswerAt: '2026-11-02T03:00:00.123456Z',
            lastAuthorReplyAt: '2026-11-03T03:00:00Z',
            author: { userCode: null, name: '운영자', anonymous: false },
            byAdmin: true,
          }),
        ],
        nextCursor: null,
        total: 1,
      }),
    });
    const view = await createServerBugBoardPort(s.api).list({
      filter: 'suggest',
      page: 1,
      size: 20,
      before: null,
    });
    expect(s.calls[0].query).toMatchObject({ filter: 'suggest', limit: 20 });
    expect(view).toMatchObject({ via: 'server', page: 1, pageCount: 1, total: 1 });
    expect(view.items[0]).toMatchObject({
      id: 'B-1101-1',
      no: 'B-1101-1',
      vis: 'prv',
      cat: 'suggest',
      status: 'review',
      name: '운영자',
      code: '',
      title: '제목 1',
      ansN: 1,
      likeN: 2,
      byAdmin: true,
      server: true,
      lastReplyTs: Date.parse('2026-11-02T03:00:00.123456Z'),
      lastReplyAt: '2026-11-02T03:00:00.123456Z',
      userReplyTs: Date.parse('2026-11-03T03:00:00Z'),
    });
  });

  it('공지는 filter=notices 한 번 — 온 줄이 전부(서버 total 은 null)', async () => {
    const s = fakeApiOf({
      [LIST]: () => ({
        items: [summary(1, { notice: true }), summary(2, { notice: true })],
        nextCursor: null,
        total: null,
      }),
    });
    const view = await createServerBugBoardPort(s.api).list({
      filter: 'notice',
      page: 3,
      size: 20,
      before: null,
    });
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0].query?.filter).toBe('notices');
    expect(view).toMatchObject({ via: 'server', page: 1, pageCount: 1, total: 2 });
  });

  it('쪽 번호는 서버 키셋을 이어 받아 자르고, 전체 수는 첫 쪽 total', async () => {
    const all = Array.from({ length: 5 }, (_, i) => summary(i + 1));
    const s = fakeApiOf({
      [LIST]: (c) => {
        const from = c.query?.cursor ? Number(c.query.cursor) : 0;
        const limit = Number(c.query?.limit);
        const items = all.slice(from, from + limit);
        const next = from + limit < all.length ? String(from + limit) : null;
        return { items, nextCursor: next, total: from === 0 ? 5 : null };
      },
    });
    const view = await createServerBugBoardPort(s.api).list({
      filter: 'all',
      page: 2,
      size: 2,
      before: null,
    });
    expect(view.via === 'server' && view.items.map((i) => i.id)).toEqual(['B-1101-3', 'B-1101-4']);
    expect(view).toMatchObject({ page: 2, pageCount: 3, total: 5 });
    expect(s.calls.map((c) => c.query?.limit)).toEqual([4]);
  });

  it('한 번에 100개를 넘겨 달라고 하지 않고 나눠 받는다', async () => {
    const s = fakeApiOf({
      [LIST]: (c) =>
        c.query?.cursor === undefined
          ? { items: [summary(1)], nextCursor: 'c2', total: 150 }
          : { items: [summary(2)], nextCursor: null, total: null },
    });
    await createServerBugBoardPort(s.api).list({ filter: 'open', page: 2, size: 100, before: null });
    expect(s.calls.map((c) => c.query?.limit)).toEqual([100, 100]);
  });

  it('첫 쪽에 total 이 없거나 줄 칸이 다르면 약속과 다른 응답', async () => {
    for (const answer of [
      { items: [summary(1)], nextCursor: null, total: null },
      { items: [summary(1, { status: 'DONE' })], nextCursor: null, total: 1 },
      { items: [summary(1, { visibility: 'HIDDEN' })], nextCursor: null, total: 1 },
      { items: [summary(1, { createdAt: '어제' })], nextCursor: null, total: 1 },
      { items: [summary(1, { author: null })], nextCursor: null, total: 1 },
    ]) {
      const s = fakeApiOf({ [LIST]: () => answer });
      const e = await caught(
        createServerBugBoardPort(s.api).list({ filter: 'all', page: 1, size: 20, before: null }),
      );
      expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
    }
  });
});

describe('제보 상세 — API 판', () => {
  it('글 · 내용 · 댓글을 읽고 version · 마지막 답변 시각 글자를 줄에 싣는다', async () => {
    const s = fakeApiOf({ 'GET /v2/bugs/B-1101-1': () => detail() });
    const post = await createServerBugBoardPort(s.api).post('B-1101-1');
    expect(post?.item).toMatchObject({
      id: 'B-1101-1',
      version: 7,
      ansN: 1,
      lastReplyAt: '2026-11-02T03:00:00.123456Z',
    });
    expect(post?.content).toEqual({ title: '제목 1', body: '본문' });
    expect(post?.answers).toEqual([
      {
        id: 'c1',
        vis: 'prv',
        text: '확인했어요',
        ts: Date.parse('2026-11-02T03:00:00.123456Z'),
        kakao: 'https://open.kakao.com/o/x',
      },
      {
        id: 'c2',
        vis: 'pub',
        text: '아직 안 돼요',
        ts: Date.parse('2026-11-03T03:00:00Z'),
        byAuthor: true,
        st: 'unfixed',
      },
    ]);
  });

  it('환경 칸이 있으면 content.env 로', async () => {
    const s = fakeApiOf({ 'GET /v2/bugs/B-1101-1': () => detail({ env: 'Win11' }) });
    expect((await createServerBugBoardPort(s.api).post('B-1101-1'))?.content?.env).toBe('Win11');
  });

  it('지워진 글(404 BUG_NOT_FOUND)은 null — 다른 404 는 던진다', async () => {
    const gone = fakeApiOf({
      'GET /v2/bugs/B-1101-9': () => {
        throw new ApiError('notFound', 404, 'BUG_NOT_FOUND', '없는 제보');
      },
    });
    expect(await createServerBugBoardPort(gone.api).post('B-1101-9')).toBeNull();
    expect(await createServerBugBoardPort(gone.api).item('B-1101-9')).toBeNull();
    const other = fakeApiOf({
      'GET /v2/bugs/B-1101-9': () => {
        throw new ApiError('notFound', 404, 'SOMETHING', '다른 것');
      },
    });
    const e = await caught(createServerBugBoardPort(other.api).post('B-1101-9'));
    expect(isPortError(e, 'notFound')).toBe(true);
  });

  it('댓글 종류 · 운영자 답변의 공개 범위가 없으면 약속과 다른 응답', async () => {
    for (const comments of [
      [{ ...detail().comments[0], kind: 'SYSTEM' }],
      [{ ...detail().comments[0], visibility: null }],
    ]) {
      const s = fakeApiOf({ 'GET /v2/bugs/B-1101-1': () => detail({ comments }) });
      const e = await caught(createServerBugBoardPort(s.api).post('B-1101-1'));
      expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
    }
  });

  it('version 이 없으면 0 으로 덮지 않고 약속과 다른 응답', async () => {
    const s = fakeApiOf({ 'GET /v2/bugs/B-1101-1': () => ({ ...detail(), version: undefined }) });
    const e = await caught(createServerBugBoardPort(s.api).post('B-1101-1'));
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
  });

  it('날짜 순번은 세지 않는다 — 서버가 번호를 준다', async () => {
    const s = fakeApiOf({});
    const e = await caught(createServerBugBoardPort(s.api).dayOrder('2026-11-01'));
    expect(isPortError(e, 'invalid')).toBe(true);
  });
});

describe('글쓴이 이름 — API 판', () => {
  it('서버가 관리자에게 비공개 글 글쓴이 이름도 주므로 따로 읽지 않고 그 이름을 그대로 보인다', async () => {
    const s = fakeApiOf({
      [LIST]: () => ({
        items: [summary(1, { visibility: 'PRIVATE' })],
        nextCursor: null,
        total: 1,
      }),
    });
    const view = await createServerBugBoardPort(s.api).list({
      filter: 'all',
      page: 1,
      size: 20,
      before: null,
    });
    const [row] = view.items;
    expect(row.code).toBe('u1');
    expect(needsAuthorLookup(row)).toBe(false);
    expect(bugAuthorName(row, undefined)).toBe('철수');
    // Firebase 판 줄(server 표시 없음)은 그대로 따로 읽는다.
    expect(needsAuthorLookup({ vis: 'prv', code: 'u1' })).toBe(true);
  });
});

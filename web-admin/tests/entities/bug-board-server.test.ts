import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { bugAuthorName, needsAuthorLookup, refreshBugBoard } from '@/entities/bug-board';
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
  answerCount: 1,
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
  it('거르기는 서버가 — 갈래 이름 · 커서 · limit 을 그대로 보내고 한 줄을 BugItem 으로 읽는다', async () => {
    const s = fakeApiOf({
      [LIST]: () => ({
        items: [
          summary(1, {
            visibility: 'PRIVATE',
            category: 'SUGGEST',
            status: 'REVIEW',
            lastAnswerAt: '2026-11-02T03:00:00.123456Z',
            lastAuthorReplyAt: '2026-11-03T03:00:00Z',
            byAdmin: true,
          }),
        ],
        nextCursor: 'c2',
        total: 9,
      }),
    });
    const page = await createServerBugBoardPort(s.api).page('suggest', undefined, 100);
    expect(s.calls[0].query).toEqual({ filter: 'suggest', cursor: undefined, limit: 100 });
    expect(page).toMatchObject({ nextCursor: 'c2', total: 9 });
    expect(page.items[0]).toMatchObject({
      id: 'B-1101-1',
      no: 'B-1101-1',
      vis: 'prv',
      cat: 'suggest',
      status: 'review',
      // 비공개 글은 목록 칸 이름 «익명», 서버가 준 이름은 닉네임 칸
      name: '익명',
      nick: '철수',
      code: 'u1',
      title: '제목 1',
      ansN: 1,
      likeN: 2,
      byAdmin: true,
      server: true,
      lastReplyTs: Date.parse('2026-11-02T03:00:00.123456Z'),
      lastReplyAt: '2026-11-02T03:00:00.123456Z',
      userReplyTs: Date.parse('2026-11-03T03:00:00Z'),
    });
    expect(page.items[0]).not.toHaveProperty('authUid');
  });

  it('이름이 없는 글쓴이(author.name: null) — 공개 글은 null, 비공개 글은 «익명» 에 닉네임 칸 없음', async () => {
    const none = { userCode: 'u1', name: null, anonymous: false };
    const s = fakeApiOf({
      [LIST]: () => ({
        items: [summary(1, { author: none }), summary(2, { visibility: 'PRIVATE', author: none })],
        nextCursor: null,
        total: 2,
      }),
    });
    const { items } = await createServerBugBoardPort(s.api).page('all', undefined, 100);
    expect(items[0].name).toBeNull();
    expect(items[1]).toMatchObject({ name: '익명' });
    expect(items[1]).not.toHaveProperty('nick');
    expect(bugAuthorName(items[0], undefined)).toBe('나');
  });

  it('공지도 같은 키셋 쪽 — filter=notices, total 은 서버 값(웹이 세지 않는다)', async () => {
    const s = fakeApiOf({
      [LIST]: () => ({ items: [summary(1, { notice: true })], nextCursor: 'c2', total: 7 }),
    });
    const page = await createServerBugBoardPort(s.api).page('notice', undefined, 100);
    expect(s.calls[0].query?.filter).toBe('notices');
    expect(page.total).toBe(7);
    expect(page.items).toHaveLength(1);
  });

  it('다음 쪽의 total 은 null, 첫 쪽에 total 이 없으면 약속과 다른 응답', async () => {
    const next = fakeApiOf({ [LIST]: () => ({ items: [summary(2)], nextCursor: null, total: null }) });
    expect(await createServerBugBoardPort(next.api).page('all', 'c2', 100)).toMatchObject({ total: null });
    const first = fakeApiOf({ [LIST]: () => ({ items: [], nextCursor: null, total: null }) });
    const e = await caught(createServerBugBoardPort(first.api).page('all', undefined, 100));
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
  });

  it('줄 칸이 다르면 약속과 다른 응답', async () => {
    for (const bad of [
      summary(1, { status: 'DONE' }),
      summary(1, { visibility: 'HIDDEN' }),
      summary(1, { createdAt: '어제' }),
      summary(1, { author: null }),
    ]) {
      const s = fakeApiOf({ [LIST]: () => ({ items: [bad], nextCursor: null, total: 1 }) });
      const e = await caught(createServerBugBoardPort(s.api).page('all', undefined, 100));
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

  it('answerCount 가 없으면 댓글로 세어 채우지 않고 약속과 다른 응답', async () => {
    const s = fakeApiOf({ 'GET /v2/bugs/B-1101-1': () => ({ ...detail(), answerCount: undefined }) });
    const e = await caught(createServerBugBoardPort(s.api).post('B-1101-1'));
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
  });

  it('answerCount 는 서버 값 그대로(댓글 수와 달라도)', async () => {
    const s = fakeApiOf({ 'GET /v2/bugs/B-1101-1': () => detail({ answerCount: 5 }) });
    expect((await createServerBugBoardPort(s.api).post('B-1101-1'))?.item.ansN).toBe(5);
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
  it('비공개 글은 «익명 (닉네임)» — 서버 이름을 닉네임으로 두고 따로 읽지 않는다', async () => {
    const s = fakeApiOf({
      [LIST]: () => ({ items: [summary(1, { visibility: 'PRIVATE' })], nextCursor: null, total: 1 }),
    });
    const [row] = (await createServerBugBoardPort(s.api).page('all', undefined, 100)).items;
    expect(needsAuthorLookup(row)).toBe(false);
    expect(bugAuthorName(row, undefined)).toBe('익명 (철수)');
    // Firebase 판 줄(server 표시 없음)은 그대로 따로 읽는다.
    expect(needsAuthorLookup({ vis: 'prv', code: 'u1' })).toBe(true);
  });

  it('운영진이 쓴 글은 사용자코드가 없다 — 빈 글자로 바꾸지 않는다', async () => {
    const s = fakeApiOf({
      [LIST]: () => ({
        items: [summary(1, { author: { userCode: null, name: '운영자', anonymous: false } })],
        nextCursor: null,
        total: 1,
      }),
    });
    const [row] = (await createServerBugBoardPort(s.api).page('all', undefined, 100)).items;
    expect(row).not.toHaveProperty('code');
  });
});

describe('쓰기 뒤 키셋 목록 다시 받기', () => {
  it('이어 둔 쪽을 버리고 첫 쪽부터 다시 받아 total 이 새 값이 된다', async () => {
    const client = new QueryClient();
    let total = 3;
    const calls: Array<string | undefined> = [];
    const key = ['bugBoard', 'list', 'keyset', 'all'];
    const obs = new InfiniteQueryObserver(client, {
      queryKey: key,
      initialPageParam: undefined as string | undefined,
      queryFn: ({ pageParam }) => {
        calls.push(pageParam);
        return Promise.resolve({
          nextCursor: pageParam ? null : 'c2',
          total: pageParam ? null : total,
        });
      },
      getNextPageParam: (last) => last.nextCursor ?? undefined,
    });
    const unsub = obs.subscribe(() => undefined);
    await obs.refetch();
    await obs.fetchNextPage();
    expect(calls).toEqual([undefined, 'c2']);
    total = 2;
    calls.length = 0;
    await refreshBugBoard(client, 0);
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toEqual([undefined]);
    expect((client.getQueryData(key) as { pages: { total: number }[] }).pages).toEqual([
      { nextCursor: 'c2', total: 2 },
    ]);
    unsub();
  });
});

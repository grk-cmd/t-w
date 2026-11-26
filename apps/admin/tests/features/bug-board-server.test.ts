import { describe, expect, it } from 'vitest';
import type { BugContent, BugItem } from '@/entities/bug-board';
import { createServerAnswerPostPort } from '@/features/bug-board/answer-post/api/server';
import { createServerChangeStatusPort } from '@/features/bug-board/change-status/api/server';
import { createServerDeleteAnswerPort } from '@/features/bug-board/delete-answer/api/server';
import { createServerDeletePostPort } from '@/features/bug-board/delete-post/api/server';
import { createServerEditAnswerPort } from '@/features/bug-board/edit-answer/api/server';
import { createServerEditPostPort } from '@/features/bug-board/edit-post/api/server';
import { ApiError, isPortError } from '@/shared/api';
import { fakeApiOf } from '../shared/fakeApi';

const caught = (promise: Promise<unknown>) => promise.catch((e: unknown) => e);
const NO = 'B-1101-1';
const ADMIN = `/v2/admin/bugs/${NO}`;

const item = (extra: Partial<BugItem> = {}): BugItem => ({
  id: NO,
  no: NO,
  vis: 'pub',
  status: 'new',
  cat: 'bug',
  name: '철수',
  authUid: '',
  code: 'u1',
  ts: 1,
  server: true,
  version: 7,
  lastReplyAt: '2026-11-02T03:00:00.123456Z',
  ...extra,
});
const content: BugContent = { title: '제목', body: '본문' };

describe('운영자 답변 등록 — API 판', () => {
  const POST = `POST ${ADMIN}/answers`;

  it('요청 번호 · 본 마지막 답변 시각(서버 글자 그대로) · 상태 · 공개 범위를 싣는다', async () => {
    const s = fakeApiOf({ [POST]: () => null });
    const r = await createServerAnswerPostPort(s.api).answer(
      item(),
      { text: ' 확인했어요 ', kakao: ' https://open.kakao.com/o/x ', vis: 'prv', status: 'checking' },
      NO,
    );
    expect(r).toEqual({ ok: true });
    expect(s.calls[0].body).toMatchObject({
      seenLastAnswerAt: '2026-11-02T03:00:00.123456Z',
      text: '확인했어요',
      status: 'CHECKING',
      visibility: 'PRIVATE',
      kakaoLink: 'https://open.kakao.com/o/x',
    });
    expect(s.calls[0].body).toHaveProperty('requestId');
  });

  it('상태를 안 골랐으면 보던 글의 상태, 링크가 비면 칸을 싣지 않고, 답변이 없던 글은 null', async () => {
    const s = fakeApiOf({ [POST]: () => null });
    await createServerAnswerPostPort(s.api).answer(
      item({ status: 'review', lastReplyAt: undefined }),
      { text: 'a', kakao: '  ', vis: 'pub' },
      NO,
    );
    const body = s.calls[0].body as Record<string, unknown>;
    expect(body.status).toBe('REVIEW');
    expect(body.seenLastAnswerAt).toBeNull();
    expect(body).not.toHaveProperty('kakaoLink');
  });

  it('글자 수 · 링크 모양은 미리 판정하지 않고 그대로 보낸다 — 400 은 서버 문구로', async () => {
    const port = createServerAnswerPostPort(
      fakeApiOf({
        [POST]: () => {
          throw new ApiError('request', 400, 'BUG_INVALID', '제보 내용이 올바르지 않아요');
        },
      }).api,
    );
    expect(port.check({ text: '', kakao: 'http://x', vis: 'pub' })).toBeNull();
    const s = fakeApiOf({ [POST]: () => null });
    await createServerAnswerPostPort(s.api).answer(
      item(),
      { text: 'ㄱ'.repeat(1500), kakao: 'x', vis: 'pub' },
      NO,
    );
    expect((s.calls[0].body as { text: string }).text).toHaveLength(1500);
    const e = await caught(port.answer(item(), { text: '', vis: 'pub' }, NO));
    expect(isPortError(e, 'invalid')).toBe(true);
  });

  it('다른 관리자가 먼저 답했으면(409 BUG_ANSWER_CONFLICT) 서버 문구와 함께 busy', async () => {
    const s = fakeApiOf({
      [POST]: () => {
        throw new ApiError('request', 409, 'BUG_ANSWER_CONFLICT', '다른 관리자가 먼저 답변했어요');
      },
    });
    const r = await createServerAnswerPostPort(s.api).answer(item(), { text: 'a', vis: 'pub' }, NO);
    expect(r).toMatchObject({ ok: false, busy: true });
  });

  it('다른 409 는 busy 로 삼키지 않고 던진다', async () => {
    const s = fakeApiOf({
      [POST]: () => {
        throw new ApiError('request', 409, 'BUG_NOTICE_NO_REPLY', '공지에는 답글을 달 수 없어요');
      },
    });
    const e = await caught(createServerAnswerPostPort(s.api).answer(item(), { text: 'a', vis: 'pub' }, NO));
    expect(isPortError(e, 'conflict') && e.code).toBe('BUG_NOTICE_NO_REPLY');
  });

  it('닿지 못해 답을 못 받으면 다시 눌러도 같은 요청 번호로 보낸다', async () => {
    let n = 0;
    const s = fakeApiOf({
      [POST]: () => {
        if (++n === 1) throw new ApiError('unavailable', 0, '', '연결 안 됨');
        return null;
      },
    });
    const port = createServerAnswerPostPort(s.api);
    await caught(port.answer(item(), { text: 'a', vis: 'pub' }, NO));
    await port.answer(item(), { text: 'a', vis: 'pub' }, NO);
    const id = (c: { body?: unknown }) => (c.body as { requestId: string }).requestId;
    expect(id(s.calls[0])).toBe(id(s.calls[1]));
  });
});

describe('상태만 바꾸기 — API 판', () => {
  const PATCH = `PATCH ${ADMIN}`;

  it('읽은 글의 version 과 서버 이름의 상태를 보낸다', async () => {
    const s = fakeApiOf({ [PATCH]: () => null });
    await createServerChangeStatusPort(s.api).change(item(), 'norepro', NO);
    expect(s.calls[0].body).toEqual({ version: 7, status: 'NOREPRO' });
  });

  it('글에 version 이 없으면(이 판 상세를 안 거친 줄) 보내지 않고 던진다', async () => {
    const s = fakeApiOf({});
    const e = await caught(
      createServerChangeStatusPort(s.api).change(item({ version: undefined }), 'fixed', NO),
    );
    expect(isPortError(e, 'invalid')).toBe(true);
    expect(s.calls).toHaveLength(0);
  });

  it('그 사이 다른 곳이 고쳤으면(409) conflict', async () => {
    const s = fakeApiOf({
      [PATCH]: () => {
        throw new ApiError('request', 409, 'CONCURRENT_UPDATE', '먼저 고침');
      },
    });
    const e = await caught(createServerChangeStatusPort(s.api).change(item(), 'fixed', NO));
    expect(isPortError(e, 'conflict')).toBe(true);
  });
});

describe('제보 고치기 — API 판', () => {
  const PATCH = `PATCH ${ADMIN}`;

  it('고친 칸만 서버 이름으로 싣는다', async () => {
    const s = fakeApiOf({ [PATCH]: () => null });
    const r = await createServerEditPostPort(s.api).edit(
      item(),
      content,
      { title: '새 제목', body: '본문', cat: 'ui', vis: 'prv' },
      NO,
    );
    expect(r).toEqual({ ok: true });
    expect(s.calls[0].body).toEqual({ version: 7, title: '새 제목', category: 'UI', visibility: 'PRIVATE' });
  });

  it('길이 · 공지는 공개만 같은 판정은 미리 하지 않고 그대로 보낸다', async () => {
    const port = createServerEditPostPort(fakeApiOf({ [PATCH]: () => null }).api);
    expect(port.check({ notice: true }, { title: '', body: '', cat: 'bug', vis: 'prv' })).toBeNull();
    const s = fakeApiOf({ [PATCH]: () => null });
    await createServerEditPostPort(s.api).edit(
      item({ notice: true }),
      content,
      { title: 'ㄱ'.repeat(100), body: '본문', cat: 'bug', vis: 'prv' },
      NO,
    );
    const body = s.calls[0].body as { title: string; visibility: string };
    expect(body.title).toHaveLength(100);
    expect(body.visibility).toBe('PRIVATE');
  });

  it('version 이 없으면 보내지 않고 던진다, 409 는 conflict', async () => {
    const none = fakeApiOf({});
    const e = await caught(
      createServerEditPostPort(none.api).edit(
        item({ version: undefined }),
        content,
        { title: 'a', body: 'b', cat: 'bug', vis: 'pub' },
        NO,
      ),
    );
    expect(isPortError(e, 'invalid')).toBe(true);
    const s = fakeApiOf({
      [PATCH]: () => {
        throw new ApiError('request', 409, 'CONCURRENT_UPDATE', '먼저 고침');
      },
    });
    const c = await caught(
      createServerEditPostPort(s.api).edit(
        item(),
        content,
        { title: 'a', body: 'b', cat: 'bug', vis: 'pub' },
        NO,
      ),
    );
    expect(isPortError(c, 'conflict')).toBe(true);
  });
});

describe('답변 고치기 · 지우기 · 제보 지우기 — API 판', () => {
  it('답변 고치기는 글 · 링크를 보내고 링크를 비우면 빈 글자로(서버가 지움)', async () => {
    const s = fakeApiOf({ [`PATCH ${ADMIN}/answers/c1`]: () => null });
    const port = createServerEditAnswerPort(s.api);
    expect(port.check({ text: '', kakao: 'x' })).toBeNull();
    await port.edit(NO, { id: 'c1', vis: 'pub' }, { text: ' 고침 ', kakao: '' }, NO);
    expect(s.calls[0].body).toEqual({ text: '고침', kakaoLink: '' });
  });

  it('글쓴이 답글이어도 미리 막지 않고 서버가 거절한다(404 BUG_NOT_ADMIN_ANSWER)', async () => {
    const s = fakeApiOf({
      [`DELETE ${ADMIN}/answers/c2`]: () => {
        throw new ApiError('notFound', 404, 'BUG_NOT_ADMIN_ANSWER', '운영자 답변이 아니에요');
      },
    });
    const e = await caught(
      createServerDeleteAnswerPort(s.api).remove(NO, { id: 'c2', vis: 'pub', byAuthor: true }, NO),
    );
    expect(isPortError(e, 'notFound') && e.code).toBe('BUG_NOT_ADMIN_ANSWER');
    expect(s.calls).toHaveLength(1);
  });

  it('답변 지우기 · 제보 지우기는 번호 길로 DELETE', async () => {
    const s = fakeApiOf({
      [`DELETE ${ADMIN}/answers/c1`]: () => null,
      [`DELETE ${ADMIN}`]: () => null,
    });
    expect(await createServerDeleteAnswerPort(s.api).remove(NO, { id: 'c1', vis: 'pub' }, NO)).toEqual({
      ok: true,
    });
    await createServerDeletePostPort(s.api).remove(item(), NO);
    expect(s.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      `DELETE ${ADMIN}/answers/c1`,
      `DELETE ${ADMIN}`,
    ]);
  });
});

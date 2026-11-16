import { describe, expect, it } from 'vitest';
import { createServerModerateReportPort } from '@/features/user/moderate-report/api/server';
import { ApiError, isPortError, WIRE_SHAPE_CODE } from '@/shared/api';
import { fakeApiOf } from '../shared/fakeApi';

const caught = (promise: Promise<unknown>) => promise.catch((e: unknown) => e);
const DISMISS = 'POST /v2/admin/reports/dismissals';
const TAKE_DOWN = 'POST /v2/admin/reports/u1/take-down';

describe('신고 문제없음 — API 판', () => {
  it('한 명은 targets 한 줄로 보낸다(요청 번호 칸 없음)', async () => {
    const s = fakeApiOf({ [DISMISS]: () => [{ id: 'u1', ok: true, code: null }] });
    await createServerModerateReportPort(s.api).dismiss('u1');
    expect(s.calls[0].body).toEqual({ targets: ['u1'] });
  });

  it('고른 사람들은 한 번에, 안 된 줄은 failed 로 남긴다', async () => {
    const s = fakeApiOf({
      [DISMISS]: () => [
        { id: 'u1', ok: true },
        { id: 'bad', ok: false, code: 'INVALID_REQUEST' },
        { id: 'u3', ok: true, code: null },
      ],
    });
    const r = await createServerModerateReportPort(s.api).dismissMany(['u1', 'bad', 'u3']);
    expect(r).toEqual({ dismissed: ['u1', 'u3'], failed: ['bad'] });
  });

  it('100명이 넘어도 미리 거절하거나 쪼개지 않고 그대로 보낸다 — 400 은 서버가 낸다', async () => {
    const many = Array.from({ length: 101 }, (_, i) => `u${i}`);
    const s = fakeApiOf({
      [DISMISS]: () => {
        throw new ApiError('request', 400, 'INVALID_REQUEST', '요청이 올바르지 않아요');
      },
    });
    const e = await caught(createServerModerateReportPort(s.api).dismissMany(many));
    expect(isPortError(e, 'invalid')).toBe(true);
    expect(s.calls).toHaveLength(1);
    expect((s.calls[0].body as { targets: string[] }).targets).toHaveLength(101);
  });

  it('한 명이 안 됐으면 서버 까닭으로 던진다', async () => {
    const s = fakeApiOf({ [DISMISS]: () => [{ id: 'u1', ok: false, code: 'INVALID_REQUEST' }] });
    const e = await caught(createServerModerateReportPort(s.api).dismiss('u1'));
    expect(isPortError(e, 'invalid') && e.code).toBe('INVALID_REQUEST');
  });

  it('줄이 어긋나면(순서 · 수 · 까닭 없는 실패) 약속과 다른 응답', async () => {
    for (const answer of [
      [{ id: 'u2', ok: true }],
      [],
      [{ id: 'u1', ok: false }],
      [{ id: 'u1', ok: true, code: 'X' }],
    ]) {
      const s = fakeApiOf({ [DISMISS]: () => answer });
      const e = await caught(createServerModerateReportPort(s.api).dismissMany(['u1']));
      expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
    }
  });
});

describe('자리비움 그림 내리기 — API 판', () => {
  it('보던 주소를 보내고 성공이면 파일 결과는 모른다(null) — 서버가 지운다', async () => {
    const s = fakeApiOf({ [TAKE_DOWN]: () => null });
    const r = await createServerModerateReportPort(s.api).takeDown('u1', 'https://img/a.png');
    expect(r).toEqual({ ok: true, fileDeleted: null });
    expect(s.calls[0].body).toEqual({ awayImageUrl: 'https://img/a.png' });
  });

  it('그 사이 그림이 바뀌었으면(409 REPORT_IMAGE_CHANGED) changed', async () => {
    const s = fakeApiOf({
      [TAKE_DOWN]: () => {
        throw new ApiError('request', 409, 'REPORT_IMAGE_CHANGED', '그새 바뀜');
      },
    });
    expect(await createServerModerateReportPort(s.api).takeDown('u1', 'x')).toEqual({
      ok: false,
      reason: 'changed',
    });
  });

  it('다른 실패는 삼키지 않고 던진다', async () => {
    const s = fakeApiOf({
      [TAKE_DOWN]: () => {
        throw new ApiError('notFound', 404, 'USER_NOT_FOUND', '없는 사용자');
      },
    });
    const e = await caught(createServerModerateReportPort(s.api).takeDown('u1', 'x'));
    expect(isPortError(e, 'notFound')).toBe(true);
  });
});

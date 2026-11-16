import { describe, expect, it } from 'vitest';
import { createServerDeleteAccountPort } from '@/features/user/delete-account/api/server';
import { createServerResetPasswordPort } from '@/features/user/reset-password/api/server';
import { acceptedText, contextLabel, filesText, providersLabel } from '@/features/user/delete-account';
import { accountErrorMessage, ApiError, isPortError, WIRE_SHAPE_CODE, type Api } from '@/shared/api';
import { fakeApiOf } from '../shared/fakeApi';

const preview = (over: Record<string, unknown> = {}) => ({
  userCode: 'u1',
  name: '민트',
  friendCode: 'MATE-AB12',
  items: 12,
  files: 3,
  byContext: [{ context: 'myhome', count: 5 }],
  hasLogin: true,
  online: null,
  loginProviders: ['google'],
  kept: [{ label: '신고 기록', why: '운영 기록' }],
  ...over,
});

describe('계정 삭제 — API 판', () => {
  it('미리 보기는 친구 코드로도 부르고, 접속 null 을 «모름» 으로 둔다', async () => {
    const s = fakeApiOf({ 'GET /v2/admin/users/MATE-AB12/deletion-preview': () => preview() });
    const p = await createServerDeleteAccountPort(s.api).preview(' MATE-AB12 ');
    expect(p).toMatchObject({ userCode: 'u1', online: null, files: 3, loginProviders: ['google'] });
    expect(p.kept).toEqual([{ label: '신고 기록', why: '운영 기록' }]);
  });

  it('지우기는 메모를 그대로(자르지 않고) 보내고 202 에 받은 양을 읽는다', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/users/u1/deletion': () => ({ items: 12, files: null }),
    });
    const memo = '가'.repeat(80);
    const r = await createServerDeleteAccountPort(s.api).run('u1', memo);
    expect(s.calls[0].body).toEqual({ memo });
    expect(r).toEqual({ items: 12, files: null });
    expect(acceptedText(r)).toBe('삭제를 시작했어요 — DB 12곳을 지워요 · 파일 수는 못 셌어요');
    expect(acceptedText({ items: 12, files: 3 })).toBe('삭제를 시작했어요 — DB 12곳 · 파일 3개를 지워요');
  });

  it('칸이 약속과 다르면 던진다', async () => {
    const s = fakeApiOf({ 'GET /v2/admin/users/u1/deletion-preview': () => preview({ hasLogin: 'yes' }) });
    const e = await createServerDeleteAccountPort(s.api)
      .preview('u1')
      .catch((x: unknown) => x);
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
  });

  it('문구 도우미 — 파일 수를 못 셌으면 «못 셌어요», 모르는 컨텍스트는 서버 이름 그대로', () => {
    expect(filesText(null)).toBe('못 셌어요');
    expect(filesText(0)).toBe('0');
    expect(contextLabel('myhome')).toBe('마이홈');
    expect(contextLabel('newctx')).toBe('newctx');
    expect(providersLabel([])).toBe('없음');
    expect(providersLabel(['google', 'password'])).toBe('구글 · 친구 코드 + 비밀번호');
  });
});

describe('비밀번호 초기화 — API 판', () => {
  it('메모를 그대로 보내고 임시 비밀번호만 읽는다(서버가 안 준 칸은 null)', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/users/MATE-AB12/password-reset': () => ({ tempPassword: 'Abc-123' }),
    });
    const memo = '  제보 B-1  ';
    const r = await createServerResetPasswordPort(s.api).run('MATE-AB12', memo);
    expect(s.calls[0].body).toEqual({ memo });
    expect(r).toMatchObject({ tempPassword: 'Abc-123', kind: 'reset', friendCode: null });
  });

  it('임시 비밀번호가 글자가 아니면 던진다', async () => {
    const s = fakeApiOf({ 'POST /v2/admin/users/u1/password-reset': () => ({ tempPassword: 7 }) });
    const e = await createServerResetPasswordPort(s.api)
      .run('u1', 'm')
      .catch((x: unknown) => x);
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
  });
});

describe('계정 일 오류 문구 — API 판', () => {
  const failing = (status: number, code: string) => {
    const api = {
      baseUrl: 'https://api.test',
      get: async () => {
        throw new ApiError(status >= 500 ? 'unavailable' : 'notFound', status, code, '서버 원문');
      },
      send: async () => {
        throw new ApiError(status >= 500 ? 'unavailable' : 'notFound', status, code, '서버 원문');
      },
      upload: async () => {
        throw new Error('upload 안 씀');
      },
    } as Api;
    return api;
  };

  it('미리 보기 · 삭제 · 초기화의 오류는 errorText 표 문구로 보인다', async () => {
    const unavailable = failing(503, 'USER_AUTH_UNAVAILABLE');
    const missing = failing(404, 'USER_NOT_FOUND');
    const text = (p: Promise<unknown>, fallback = '함수 문구') =>
      p.catch((e: unknown) => accountErrorMessage(e, fallback));
    expect(await text(createServerDeleteAccountPort(unavailable).preview('u1'))).toBe(
      '로그인 서버에 닿지 못했어요 — 잠시 뒤 다시 해 주세요',
    );
    expect(await text(createServerDeleteAccountPort(missing).run('u1', 'm'))).toBe('없는 사용자예요');
    expect(await text(createServerResetPasswordPort(missing).run('u1', 'm'))).toBe('없는 사용자예요');
  });
});

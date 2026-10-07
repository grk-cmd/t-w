import { describe, expect, it } from 'vitest';
import { ACTION_LABEL, LOG_GROUPS } from '@/entities/admin-log';
import {
  authLabel,
  confirmMatches,
  DELETE_ACCOUNT_FN,
  doneSummary,
  previewAccountDelete,
  runAccountDelete,
  type AccountDeleteResult,
} from '@/features/user/delete-account';
import { AUDIT_ACTIONS, callErrorMessage, type Functions } from '@/shared/api';

function fakeFns(reply: Partial<AccountDeleteResult> = {}) {
  const calls: [string, unknown][] = [];
  const fns: Functions = {
    call: async <T>(name: string, data: unknown) => {
      calls.push([name, data]);
      return reply as T;
    },
  };
  return { fns, calls };
}

describe('계정 삭제 호출', () => {
  it('미리 보기는 dryRun: true · 앞뒤 공백을 뗀다', async () => {
    const { fns, calls } = fakeFns();
    await previewAccountDelete(fns, '  MATE-AB12 ');
    expect(calls).toEqual([[DELETE_ACCOUNT_FN, { code: 'MATE-AB12', dryRun: true }]]);
  });

  it('실행은 미리 본 사용자 코드로 dryRun: false 를 분명히 보낸다', async () => {
    const { fns, calls } = fakeFns();
    await runAccountDelete(fns, 'uabc123456');
    expect(calls).toEqual([['adminDeleteAccount', { code: 'uabc123456', dryRun: false }]]);
  });
});

describe('확인 입력', () => {
  const preview = { code: 'uabc123456', friendCode: 'MATE-AB12' };

  it('사용자 코드를 그대로 넣으면 통과', () => {
    expect(confirmMatches('uabc123456', preview)).toBe(true);
    expect(confirmMatches('  uabc123456 ', preview)).toBe(true);
  });

  it('친구 코드도 받는다 — 대소문자 무시', () => {
    expect(confirmMatches('mate-ab12', preview)).toBe(true);
  });

  it('비었거나 다르면 막는다 — 사용자 코드는 대소문자도 같아야', () => {
    expect(confirmMatches('', preview)).toBe(false);
    expect(confirmMatches('uabc12345', preview)).toBe(false);
    expect(confirmMatches('UABC123456', preview)).toBe(false);
    expect(confirmMatches('AB12', preview)).toBe(false);
    expect(confirmMatches('MATE-AB12', { code: 'uabc123456', friendCode: null })).toBe(false);
  });
});

describe('표시 문구', () => {
  it('로그인 계정 칸', () => {
    expect(authLabel({ exists: false, provider: null, willDelete: false })).toBe('없음');
    expect(authLabel({ exists: true, provider: 'google', willDelete: true })).toBe('구글 · 삭제');
    expect(authLabel({ exists: true, provider: 'password', willDelete: false })).toBe(
      '친구 코드 + 비밀번호 · 남김',
    );
  });

  it('결과 한 줄', () => {
    expect(doneSummary({ db: 12, files: 3, auth: true, logId: 'a1' })).toBe(
      'DB 12곳 · 파일 3개 · 로그인 계정 삭제',
    );
  });

  it('함수가 보낸 한국어 문구는 그대로, SDK 영어 문구는 대신 말', () => {
    const fallback = '부르지 못했어요';
    expect(
      callErrorMessage({ code: 'functions/permission-denied', message: '관리자만 쓸 수 있어요' }, fallback),
    ).toBe('관리자만 쓸 수 있어요');
    expect(callErrorMessage({ code: 'functions/internal', message: 'internal' }, fallback)).toBe(fallback);
    expect(callErrorMessage(new Error('네트워크'), fallback)).toBe(fallback);
    expect(callErrorMessage(null, fallback)).toBe(fallback);
  });

  it('작업 기록에 «계정 삭제» 이름 · «계정» 묶음이 있다 (서버 함수가 쓰는 action)', () => {
    expect(AUDIT_ACTIONS).toContain('account.delete');
    expect(ACTION_LABEL['account.delete']).toBe('계정 삭제');
    expect(LOG_GROUPS.some((g) => g.id === 'account')).toBe(true);
  });
});

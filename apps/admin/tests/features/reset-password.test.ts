import { describe, expect, it } from 'vitest';
import { ACTION_LABEL } from '@/entities/admin-log';
import {
  guideText,
  KIND_TEXT,
  MEMO_MAX,
  normalizeMemo,
  RESET_PASSWORD_FN,
  runPasswordReset,
  type PasswordResetResult,
} from '@/features/user/reset-password';
import { AUDIT_ACTIONS, type Functions } from '@/shared/api';

function fakeFns(reply: Partial<PasswordResetResult> = {}) {
  const calls: [string, unknown][] = [];
  const fns: Functions = {
    call: async <T>(name: string, data: unknown) => {
      calls.push([name, data]);
      return reply as T;
    },
  };
  return { fns, calls };
}

describe('비밀번호 초기화 호출', () => {
  it('함수 이름 · 사용자 코드(앞뒤 공백 뗌) · 메모를 보낸다', async () => {
    const { fns, calls } = fakeFns();
    await runPasswordReset(fns, ' uabc123456 ', '오픈채팅 10/17');
    expect(RESET_PASSWORD_FN).toBe('adminResetPassword');
    expect(calls).toEqual([['adminResetPassword', { code: 'uabc123456', memo: '오픈채팅 10/17' }]]);
  });
});

describe('메모', () => {
  it('형식은 자유 · 앞뒤 공백 · 겹친 공백 · 줄바꿈은 한 칸으로', () => {
    expect(normalizeMemo(' B-1017-3 ')).toBe('B-1017-3');
    expect(normalizeMemo('오픈채팅\n  10/17 ')).toBe('오픈채팅 10/17');
  });

  it('비면 null(버튼을 못 누른다) · 길면 MEMO_MAX 로 자른다', () => {
    for (const bad of ['', '   ', '\n\t']) expect(normalizeMemo(bad)).toBeNull();
    expect(normalizeMemo('가'.repeat(MEMO_MAX + 10))).toBe('가'.repeat(MEMO_MAX));
  });
});

describe('안내 글', () => {
  it('아이디(친구 코드) · 임시 비밀번호 · 바꾸는 곳을 담는다', () => {
    const t = guideText({ friendCode: 'MATE-AB12', code: 'uabc123456', tempPassword: 'k7Rm3qTx' });
    expect(t).toContain('MATE-AB12');
    expect(t).toContain('k7Rm3qTx');
    expect(t).toContain('[내 정보 › 계정]');
  });

  it('친구 코드가 없으면 사용자 코드를 아이디로', () => {
    expect(guideText({ friendCode: null, code: 'uabc123456', tempPassword: 'x' })).toContain('uabc123456');
  });
});

describe('작업 기록', () => {
  it('서버가 쓰는 action 이름 · 화면 이름표가 있다', () => {
    expect(AUDIT_ACTIONS).toContain('account.resetPassword');
    expect(ACTION_LABEL['account.resetPassword']).toBe('비밀번호 초기화');
  });
});

describe('한 일 안내', () => {
  it('두 가지(바꿈 · 새로 만듦) 문구가 있다', () => {
    expect(Object.keys(KIND_TEXT).sort()).toEqual(['createLogin', 'reset']);
    expect(KIND_TEXT.createLogin).toContain('새로 만들어');
  });
});

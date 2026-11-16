// Firebase 판 — 지금 코드 그대로: 서버 함수 adminResetPassword.
import type { Functions } from '@/shared/api';
import { normalizeMemo, RESET_PASSWORD_FN, type PasswordResetResult } from '../model/resetPassword';
import type { ResetPasswordPort } from './port';

export function runPasswordReset(fns: Functions, code: string, memo: string): Promise<PasswordResetResult> {
  return fns.call<PasswordResetResult>(RESET_PASSWORD_FN, { code: code.trim(), memo });
}

export function createFirebaseResetPasswordPort(fns: Functions): ResetPasswordPort {
  return {
    run: (code, memo) => {
      // 함수가 받는 모양으로 — 공백을 한 칸으로 · 60자까지. 빈 메모는 화면이 막는다.
      const normalized = normalizeMemo(memo);
      if (normalized === null) throw new Error('메모가 비었어요');
      return runPasswordReset(fns, code, normalized);
    },
  };
}

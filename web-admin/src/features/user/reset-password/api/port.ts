import type { PasswordResetResult } from '../model/resetPassword';

/** 임시 비밀번호 — 사용자 코드 · 메모를 보내고 새 임시 비밀번호를 받는다. */
export interface ResetPasswordPort {
  run(code: string, memo: string): Promise<PasswordResetResult>;
}

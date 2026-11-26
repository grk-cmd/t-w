// Firebase 판 — 지금 코드 그대로: 서버 함수 adminDeleteAccount 가 미리 보고 · 지우고 끝난 결과를 돌려준다.
import type { Functions } from '@/shared/api';
import { DELETE_ACCOUNT_FN, type AccountDeleteResult } from '../model/deleteAccount';
import type { DeleteAccountFunctionsPort } from './port';

export function previewAccountDelete(fns: Functions, code: string): Promise<AccountDeleteResult> {
  return fns.call<AccountDeleteResult>(DELETE_ACCOUNT_FN, { code: code.trim(), dryRun: true });
}

/** 지운다 — 함수는 dryRun 이 false 일 때만 지운다. 미리 본 사용자 코드로 부른다(친구 코드가 그 사이 바뀌어도 같은 사람). */
export function runAccountDelete(fns: Functions, userCode: string): Promise<AccountDeleteResult> {
  return fns.call<AccountDeleteResult>(DELETE_ACCOUNT_FN, { code: userCode, dryRun: false });
}

export function createFirebaseDeleteAccountPort(fns: Functions): DeleteAccountFunctionsPort {
  return {
    kind: 'functions',
    preview: (code) => previewAccountDelete(fns, code),
    run: (userCode) => runAccountDelete(fns, userCode),
  };
}

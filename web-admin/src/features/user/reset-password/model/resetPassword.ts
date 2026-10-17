import type { Functions } from '@/shared/api';

// 서버 함수 functions/index.js adminResetPassword — 로직은 functions/password-reset.js. 모양을 바꾸면 둘을 같이 본다.
export const RESET_PASSWORD_FN = 'adminResetPassword';

/** 메모 길이 — 함수 MEMO_MAX 와 같다(넘치면 함수가 자른다). */
export const MEMO_MAX = 60;

/** 함수가 한 일 — functions/password-reset.js KIND_LABEL 과 같은 두 가지(구글 전용 계정은 함수가 거절). */
export type PasswordResetKind = 'reset' | 'createLogin';

export const KIND_TEXT: Record<PasswordResetKind, string> = {
  reset: '비밀번호를 바꿨어요 — 그 계정의 다른 PC 로그인도 끊었어요.',
  createLogin: '로그인 계정이 없던 옛 계정이라 «친구 코드 + 비밀번호» 로그인 계정을 새로 만들어 연결했어요.',
};

export interface PasswordResetResult {
  ok: true;
  kind: PasswordResetKind;
  code: string;
  friendCode: string | null;
  name: string | null;
  /** 이 창에 한 번만 보인다 — 서버는 어디에도 적지 않는다. */
  tempPassword: string;
  logId: string;
}

/** 메모(제보 번호 · 연락 경로 — 형식 자유)를 함수가 받는 모양으로. 비면 null(버튼을 못 누른다). */
export function normalizeMemo(raw: string): string | null {
  const s = raw.replace(/\s+/g, ' ').trim().slice(0, MEMO_MAX);
  return s ? s : null;
}

export function runPasswordReset(fns: Functions, code: string, memo: string): Promise<PasswordResetResult> {
  return fns.call<PasswordResetResult>(RESET_PASSWORD_FN, { code: code.trim(), memo });
}

/** 사용자에게 보낼 안내 글 — 비공개로 보낸다(공개 답변 · 채팅에 쓰지 않는다). */
export function guideText(r: Pick<PasswordResetResult, 'friendCode' | 'code' | 'tempPassword'>): string {
  return [
    '비밀번호를 초기화했어요.',
    `아이디(친구 코드): ${r.friendCode ?? r.code}`,
    `임시 비밀번호: ${r.tempPassword}`,
    '로그인한 뒤 [내 정보 › 계정] 에서 새 비밀번호로 바꿔 주세요.',
  ].join('\n');
}

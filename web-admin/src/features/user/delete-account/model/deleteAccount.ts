import type { Functions } from '@/shared/api';

// 서버 함수 functions/index.js adminDeleteAccount — 로직은 functions/account-delete.js. 모양을 바꾸면 둘을 같이 본다.
export const DELETE_ACCOUNT_FN = 'adminDeleteAccount';

export interface DeleteGroup {
  key: string;
  label: string;
  count: number;
  paths: string[];
}

export interface AccountDeleteResult {
  ok: true;
  dryRun: boolean;
  code: string;
  friendCode: string | null;
  name: string | null;
  online: boolean;
  auth: { exists: boolean; provider: string | null; willDelete: boolean };
  groups: DeleteGroup[];
  dbCount: number;
  storage: { count: number; places: { place: string; count: number }[] };
  kept: { label: string; why: string }[];
  warnings: string[];
  /** 지울 것이 하나도 없다 — 실행해도 아무것도 하지 않는다. */
  empty: boolean;
  /** 실행했을 때만. */
  done?: { db: number; files: number; auth: boolean; logId: string };
}

export function previewAccountDelete(fns: Functions, code: string): Promise<AccountDeleteResult> {
  return fns.call<AccountDeleteResult>(DELETE_ACCOUNT_FN, { code: code.trim(), dryRun: true });
}

/** 지운다 — 함수는 dryRun 이 false 일 때만 지운다. 미리 본 사용자 코드로 부른다(친구 코드가 그 사이 바뀌어도 같은 사람). */
export function runAccountDelete(fns: Functions, userCode: string): Promise<AccountDeleteResult> {
  return fns.call<AccountDeleteResult>(DELETE_ACCOUNT_FN, { code: userCode, dryRun: false });
}

/** 확인 입력 — 미리 본 사람의 사용자 코드 또는 친구 코드를 그대로(친구 코드만 대소문자 무시). */
export function confirmMatches(
  typed: string,
  preview: Pick<AccountDeleteResult, 'code' | 'friendCode'>,
): boolean {
  const t = typed.trim();
  if (!t) return false;
  return t === preview.code || (!!preview.friendCode && t.toUpperCase() === preview.friendCode);
}

const PROVIDER_LABEL: Record<string, string> = {
  google: '구글',
  password: '친구 코드 + 비밀번호',
  anonymous: '익명',
};

export function authLabel(auth: AccountDeleteResult['auth']): string {
  if (!auth.exists) return '없음';
  const kind = auth.provider ? (PROVIDER_LABEL[auth.provider] ?? auth.provider) : '';
  return `${kind ? `${kind} · ` : ''}${auth.willDelete ? '삭제' : '남김'}`;
}

/** 실행 결과 한 줄 — 토스트 · 결과 칸에 같이 쓴다. */
export function doneSummary(done: NonNullable<AccountDeleteResult['done']>): string {
  return `DB ${done.db}곳 · 파일 ${done.files}개 · 로그인 계정 ${done.auth ? '삭제' : '없음'}`;
}

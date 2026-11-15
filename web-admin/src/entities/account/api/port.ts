import type { AccountSnap } from '../model/account';

/** 계정 요약(accountSnap) — 사용자 표의 로그인 방식 · 가입일을 채운다. */
export interface AccountPort {
  /** 계정 uid → 요약. */
  list(): Promise<Record<string, AccountSnap>>;
}

import type { ExpiryMode } from '@/entities/secret-room';

export interface SecretGrantInput {
  /** 친구코드(뒤 4자리 가능) 또는 유저 코드(u…). */
  target: string;
  /** 원하는 코드 4자리 — 비우면 자동. */
  want: string;
  /** 개월 수 — 비우면 영구. */
  months: string;
}

export interface SecretGrantPlan {
  uid: string;
  name: string;
  code: string;
  months: number;
  expMs: number;
  mode: ExpiryMode;
  confusing: boolean;
  /** 비어 있지 않으면 한 번 더 확인받고 보낸다. */
  warnings: string[];
}

export type PrepareResult = { ok: true; plan: SecretGrantPlan } | { ok: false; error: string };

export type GrantResult =
  | { ok: false; denied: boolean }
  | {
      ok: true;
      code: string;
      period: string;
      sent: boolean;
      linked: boolean;
      expiredOld: string;
      expireFailed: string;
    };

/** 시크릿룸 발급 — 받는 사람 확인(읽기만) → 발급 · 기존 코드 만료 · 사용자 칸 기록 · 수령함. */
export interface GrantSecretRoomPort {
  /** 발급 전 확인 — 읽기만 한다(열쇠가 필요 없다). 한 번 더 묻는 경고를 `warnings` 로 준다. */
  prepare(input: SecretGrantInput): Promise<PrepareResult>;
  /** 발급한다. `key` 는 화면 입력에서 바로 넘긴 발급 열쇠 — 어디에도 남기지 않는다. */
  grant(plan: SecretGrantPlan, key: string): Promise<GrantResult>;
}

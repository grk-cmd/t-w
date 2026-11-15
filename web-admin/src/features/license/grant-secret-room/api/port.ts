import type { ExpiryMode, TakenRoom } from '@/entities/secret-room';

export interface SecretGrantInput {
  /** Firebase 판: 친구코드(뒤 4자리 가능) 또는 유저 코드(u…). API 판: 친구코드(MATE-XXXX · 뒤 4자리). */
  target: string;
  /** 원하는 코드 4자리 — 비우면 자동. */
  want: string;
  /** 개월 수 — 비우면 영구. */
  months: string;
}

interface PlanCommon {
  name: string;
  /** 발급할 코드. API 판은 «자동» 이면 서버가 정해 비어 있다. */
  code: string;
  months: number;
  confusing: boolean;
  /** 비어 있지 않으면 한 번 더 확인받고 보낸다. */
  warnings: string[];
}

/** Firebase 판 계획 — 받는 계정 · 끝나는 시각까지 웹이 셈한다. */
export interface SecretGrantPlan extends PlanCommon {
  uid: string;
  expMs: number;
  mode: ExpiryMode;
}

/** API 판 계획 — 끝나는 날 · 이어붙임은 서버가 정한다. 남의 코드를 넘겨받는다고 확인받았으면 `takeover`. */
export interface ServerSecretPlan extends PlanCommon {
  via: 'server';
  friendCode: string;
  takeover: boolean;
}

export type AnySecretPlan = SecretGrantPlan | ServerSecretPlan;

export const isServerPlan = (plan: AnySecretPlan): plan is ServerSecretPlan => 'via' in plan;

export type PrepareResult = { ok: true; plan: AnySecretPlan } | { ok: false; error: string };

export type GrantResult =
  | { ok: false; denied: boolean; taken?: undefined }
  /** API 판 — 그 코드를 남이 가졌다(발급 답). `takeover` 로 확인받은 뒤 다시 보낸다. */
  | { ok: false; denied: false; taken: TakenRoom[] }
  | {
      ok: true;
      code: string;
      period: string;
      /** 받는 계정(Firebase 판 uid · API 판 사용자 코드) · 이름. */
      recipient: string;
      recipientName: string;
      /** 수령함 전송 — API 판은 서버가 보내 모른다(null). */
      sent: boolean | null;
      /** 참여 화면 자동 채움 — API 판은 이 칸이 없다(null). */
      linked: boolean | null;
      expiredOld: string;
      expireFailed: string;
    };

/** 시크릿룸 발급 — 받는 사람 확인(읽기만) → 발급. Firebase 판은 발급 · 기존 코드 만료 · 사용자 칸 기록 · 수령함까지 웹이 하고, API 판은 서버가 한다. */
export interface GrantSecretRoomPort {
  /** 발급 열쇠 입력이 필요한가 — Firebase 판만(API 판은 관리자 권한이 대신한다). */
  readonly needsKey: boolean;
  /** 발급 전 확인 — 읽기만 한다(열쇠가 필요 없다). 한 번 더 묻는 경고를 `warnings` 로 준다. */
  prepare(input: SecretGrantInput): Promise<PrepareResult>;
  /** 발급한다. `key` 는 화면 입력에서 바로 넘긴 발급 열쇠(`needsKey` 일 때만) — 어디에도 남기지 않는다. */
  grant(plan: AnySecretPlan, key?: string): Promise<GrantResult>;
}

import { useRef } from 'react';
import { ApiError } from '../api/api';

/** 서버가 받는 요청 번호 모양. */
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export function newRequestId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * 새로 만드는 쓰기(발급 · 소식 · 답변 …)에 싣는 요청 번호 — 폼마다 하나.
 * 처음 보낼 때 만들고, 서버가 답하면(성공 · 거절) 버린다. 닿지 못해 답을 못 받았으면 남겨
 * 다시 누를 때 같은 번호로 보낸다(서버가 처음 결과를 돌려준다).
 */
export interface PendingRequestId {
  /** 지금 번호 — 없으면 만든다. */
  take(): string;
  /** 서버가 답했다 — 다음 쓰기는 새 번호. */
  settle(): void;
}

export function createPendingRequestId(make: () => string = newRequestId): PendingRequestId {
  let current: string | null = null;
  return {
    take: () => (current ??= make()),
    settle: () => {
      current = null;
    },
  };
}

export function usePendingRequestId(): PendingRequestId {
  const ref = useRef<PendingRequestId | null>(null);
  return (ref.current ??= createPendingRequestId());
}

/** 서버가 이 요청에 답했는가 — 닿지 못한 것(네트워크 · 시간 초과 · 5xx)만 «답 못 받음». */
function serverAnswered(error: unknown): boolean {
  return error instanceof ApiError && error.kind !== 'unavailable';
}

/** `send(번호)` 를 부르고 결과에 따라 번호를 버리거나 남긴다. 오류는 그대로 던진다. */
export async function sendWithRequestId<T>(
  pending: PendingRequestId,
  send: (requestId: string) => Promise<T>,
): Promise<T> {
  const id = pending.take();
  try {
    const result = await send(id);
    pending.settle();
    return result;
  } catch (error) {
    if (serverAnswered(error)) pending.settle();
    throw error;
  }
}

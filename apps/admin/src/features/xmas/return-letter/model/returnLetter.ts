import { ApiError, type Api } from '@/shared/api';
import { needApi, type ReturnReason } from '@/entities/seasonal/xmas-event';

export interface ReturnRequest {
  userCode: string;
  lid: string;
  version: number;
  reason: ReturnReason;
  note?: string;
}

/** 그새 쓴 사람이 고쳐 쓴 편지(판이 다름) — 서버 409 CONCURRENT_UPDATE */
export const isChangedLetter = (e: unknown) => e instanceof ApiError && e.code === 'CONCURRENT_UPDATE';

/**
 * 편지 반송 — 서버가 «관리자가 본 그 편지(version 이 같을 때)» 만 지우고 반송 기록 · 쓴 사람 알림 · 감사 기록을 한 트랜잭션에(한 번만).
 * 작업 기록(adminLog)은 따로 쓰지 않는다 — 서버 감사 기록 xmas.returnLetter 가 정본이다.
 */
export async function returnLetter(api: Api | null, req: ReturnRequest): Promise<{ notified: boolean }> {
  const { userCode, lid, ...body } = req;
  const r = await needApi(api).send<{ notified?: boolean }>(
    'POST',
    `/v2/admin/xmas/letters/${encodeURIComponent(userCode)}/${encodeURIComponent(lid)}/return`,
    body,
  );
  return { notified: !!r?.notified };
}

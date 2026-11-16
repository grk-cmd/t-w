import { RETURN_REASONS, type ReturnReason } from '@/entities/seasonal/xmas-event';
import { auditAfter, type Db, type Functions } from '@/shared/api';

// 서버 함수 functions/index.js xmasAdminReturn — 로직은 functions/xmas.js handleAdminReturn. 모양을 바꾸면 둘을 같이 본다.
export const RETURN_FN = 'xmasAdminReturn';

export interface ReturnRequest {
  uid: string;
  lid: string;
  ts: number;
  reason: ReturnReason;
  note?: string;
}

/**
 * 편지 반송 — 함수가 «관리자가 본 그 편지(ts 가 같을 때)» 만 지우고 반송 기록 · 쓴 사람 알림함을 쓴다(한 번만).
 * 함수가 끝난 뒤 작업 기록을 따로 남긴다(함수 쓰기와 한 묶음으로 묶을 수 없다).
 */
export async function returnLetter(
  fns: Functions,
  db: Db,
  req: ReturnRequest,
): Promise<{ notified: boolean }> {
  const r = await fns.call<{ ok: true; notified: boolean }>(RETURN_FN, req);
  await auditAfter(
    db,
    'xmas.returnLetter',
    `${req.uid}/${req.lid}`,
    RETURN_REASONS[req.reason] + (req.note ? ` — ${req.note}` : ''),
  );
  return { notified: !!r?.notified };
}

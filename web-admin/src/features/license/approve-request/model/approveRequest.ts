import { inboxMessageWrite, licenseGrantMessage } from '@/entities/inbox';
import { newLicenseWrite } from '@/entities/license';
import { approvedWrite, type LicenseRequest } from '@/entities/license-request';
import { findUserByFriendCode } from '@/entities/user';
import type { Db } from '@/shared/api';

/**
 * 키 생성 · 요청 승인 · 수령함 발송을 한 묶음으로 쓴다 — 중간에 실패해 주인 없는 키가 남는 일이 없다.
 * 친구코드 주인을 못 찾으면 수령함만 빼고 쓴다(요청한 기기 화면에는 키가 뜬다).
 */
export async function approveRequest(
  db: Db,
  req: LicenseRequest,
  genKey?: () => string,
): Promise<{ key: string; delivered: boolean }> {
  const user = await findUserByFriendCode(db, req.friendCode);
  const { key, write } = newLicenseWrite(db, `요청: ${req.name} · 친구코드 ${req.friendCode}`, genKey);
  await db.commit({
    ...write,
    ...approvedWrite(db, req.id, key),
    ...(user ? inboxMessageWrite(user.uid, licenseGrantMessage(key)) : {}),
  });
  return { key, delivered: !!user };
}

export interface BulkResult {
  issued: number;
  failed: number;
  notDelivered: number;
}

// 한 건씩 차례로 — 하나가 실패해도 나머지는 계속한다. 실패한 건은 아무것도 쓰이지 않는다.
export async function approveRequests(
  db: Db,
  reqs: LicenseRequest[],
  genKey?: () => string,
): Promise<BulkResult> {
  const result: BulkResult = { issued: 0, failed: 0, notDelivered: 0 };
  for (const req of reqs) {
    try {
      const { delivered } = await approveRequest(db, req, genKey);
      result.issued++;
      if (!delivered) result.notDelivered++;
    } catch {
      result.failed++;
    }
  }
  return result;
}

import { inboxMessageWrite, licenseGrantMessage } from '@/entities/inbox';
import { newLicenseWrite } from '@/entities/license';
import { approvedWrite, removeRequestWrite, type LicenseRequest } from '@/entities/license-request';
import { findUserByFriendCode } from '@/entities/user';
import { maskKey, withAudit, type Db } from '@/shared/api';

// 기록의 대상은 친구코드 — 신청자 이름은 남기지 않는다. 친구코드 없이 온 옛 신청은 신청 id.
const requestTarget = (req: LicenseRequest) => req.friendCode || req.id;

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
  const updates = {
    ...write,
    ...approvedWrite(db, req.id, key),
    ...(user ? inboxMessageWrite(user.uid, licenseGrantMessage(key)) : {}),
  };
  await db.commit(
    withAudit(
      db,
      updates,
      'license.approve',
      requestTarget(req),
      `${maskKey(key)}${user ? '' : ' · 수령함 없음'}`,
    ),
  );
  return { key, delivered: !!user };
}

// 지우면 앱의 요청 화면이 처음 상태로 돌아가 다시 요청할 수 있다 — 그게 «거절» 이다.
export function rejectRequest(db: Db, req: LicenseRequest): Promise<void> {
  return db.commit(withAudit(db, removeRequestWrite(req.id), 'license.reject', requestTarget(req)));
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

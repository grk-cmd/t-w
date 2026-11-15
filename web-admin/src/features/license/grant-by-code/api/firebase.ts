// Firebase 판 — 지금 코드 그대로: 키 + 수령함 메시지 + 기록을 한 묶음으로 쓴다.
import { inboxMessageWrite, licenseGrantMessage } from '@/entities/inbox';
import { newLicenseWrite } from '@/entities/license';
import { findUserByFriendCode, getUserName } from '@/entities/user';
import { maskKey, withAudit, type Db } from '@/shared/api';
import type { GrantByCodePort, GrantResult } from './port';

// 주인을 못 찾으면 아무것도 쓰지 않는다. 찾으면 키와 수령함 메시지를 한 묶음으로 쓴다.
export async function grantByFriendCode(db: Db, input: string, genKey?: () => string): Promise<GrantResult> {
  const user = await findUserByFriendCode(db, input);
  if (!user) return { ok: false, reason: 'not-found' };
  const name = await getUserName(db, user.uid);
  const note = name ? `${name} · 친구코드 ${user.code}` : `친구코드 발급: ${user.code}`;
  const { key, write } = newLicenseWrite(db, note, genKey);
  const updates = { ...write, ...inboxMessageWrite(user.uid, licenseGrantMessage(key)) };
  await db.commit(withAudit(db, updates, 'license.grantCode', user.code, maskKey(key)));
  return { ok: true, key, code: user.code, name };
}

export function createFirebaseGrantByCodePort(db: Db): GrantByCodePort {
  return { grant: (input) => grantByFriendCode(db, input) };
}

import { useMutation } from '@tanstack/react-query';
import { inboxMessageWrite, licenseGrantMessage } from '@/entities/inbox';
import { newLicenseWrite, useRefreshLicenses } from '@/entities/license';
import { findUserByFriendCode, getUserName } from '@/entities/user';
import { maskKey, useDb, withAudit, type Db } from '@/shared/api';

export type GrantResult =
  { ok: true; key: string; code: string; name: string | null } | { ok: false; reason: 'not-found' };

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

export function useGrantByFriendCode() {
  const db = useDb();
  const refresh = useRefreshLicenses();
  return useMutation({
    mutationFn: (input: string) => grantByFriendCode(db, input),
    onSuccess: (r) => r.ok && refresh(),
  });
}

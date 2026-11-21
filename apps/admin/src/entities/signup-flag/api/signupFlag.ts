import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, withAudit, type Db } from '@/shared/api';
import { flagPath, parseFlag, SIGNUP_FLAGS, type SignupFlag, type SignupFlags } from '../model/signupFlag';

const KEY = ['signupFlags'];

// config/flags 에 다른 스위치가 늘어날 수 있어 통째로 받지 않고 이 두 칸만 읽는다.
export async function getSignupFlags(db: Db): Promise<SignupFlags> {
  const values = await Promise.all(SIGNUP_FLAGS.map((f) => db.get<unknown>(flagPath(f))));
  return Object.fromEntries(SIGNUP_FLAGS.map((f, i) => [f, parseFlag(values[i])])) as SignupFlags;
}

export function useSignupFlags() {
  const db = useDb();
  return useQuery({ queryKey: KEY, queryFn: () => getSignupFlags(db) });
}

export function useRefreshSignupFlags() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: KEY });
}

export function setSignupFlag(db: Db, flag: SignupFlag, value: boolean): Promise<void> {
  return db.commit(
    withAudit(db, { [flagPath(flag)]: value }, `settings.${flag}`, flag, value ? '켜기' : '끄기'),
  );
}

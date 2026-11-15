// Firebase 판 — 지금 코드 그대로: config/flags 의 두 칸을 읽고 쓴다.
import { withAudit, type Db } from '@/shared/api';
import { flagPath, parseFlag, SIGNUP_FLAGS, type SignupFlag, type SignupFlags } from '../model/signupFlag';
import type { SignupFlagPort } from './port';

// config/flags 에 다른 스위치가 늘어날 수 있어 통째로 받지 않고 이 두 칸만 읽는다.
export async function getSignupFlags(db: Db): Promise<SignupFlags> {
  const values = await Promise.all(SIGNUP_FLAGS.map((f) => db.get<unknown>(flagPath(f))));
  return Object.fromEntries(SIGNUP_FLAGS.map((f, i) => [f, parseFlag(values[i])])) as SignupFlags;
}

export function setSignupFlag(db: Db, flag: SignupFlag, value: boolean): Promise<void> {
  return db.commit(
    withAudit(db, { [flagPath(flag)]: value }, `settings.${flag}`, flag, value ? '켜기' : '끄기'),
  );
}

export function createFirebaseSignupFlagPort(db: Db): SignupFlagPort {
  return {
    flags: SIGNUP_FLAGS,
    get: () => getSignupFlags(db),
    set: (flag, value) => setSignupFlag(db, flag, value),
  };
}

import type { SignupFlag, SignupFlags } from '../model/signupFlag';

/** 가입 스위치 두 칸(초대 게이트 등). */
export interface SignupFlagPort {
  get(): Promise<SignupFlags>;
  set(flag: SignupFlag, value: boolean): Promise<void>;
}

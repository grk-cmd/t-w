import type { SignupFlag, SignupFlags } from '../model/signupFlag';

/** 가입 스위치 두 칸(초대 게이트 등). */
export interface SignupFlagPort {
  /** 이 판에서 바꿀 수 있는 스위치(서버 판에는 «기존 사용자 가입» 이 없다). */
  readonly flags: readonly SignupFlag[];
  get(): Promise<SignupFlags>;
  set(flag: SignupFlag, value: boolean): Promise<void>;
}

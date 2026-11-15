import type { Versioned } from '@/shared/api';
import type { SignupFlag, SignupFlags } from '../model/signupFlag';

/** 가입 스위치 두 칸(초대 게이트 등). */
export interface SignupFlagPort {
  /** 이 판에서 바꿀 수 있는 스위치(서버 판에는 «기존 사용자 가입» 이 없다). */
  readonly flags: readonly SignupFlag[];
  get(): Promise<Versioned<SignupFlags>>;
  /** `from` 은 화면이 읽은 값 · 번호 — 그 사이 바뀌었으면 `conflict`. */
  set(flag: SignupFlag, from: Versioned<SignupFlags>, value: boolean): Promise<void>;
}

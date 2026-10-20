// config/flags/{이름} = bool — 앱이 가입 화면에서 읽는 스위치. 칸이 없으면 켜진 것(true)으로 본다.
export const FLAGS_PATH = 'config/flags';

export const SIGNUP_FLAGS = ['inviteGate', 'existingSignup'] as const;
export type SignupFlag = (typeof SIGNUP_FLAGS)[number];
export type SignupFlags = Record<SignupFlag, boolean>;

export const SIGNUP_FLAG_DEFAULT = true;

export const SIGNUP_FLAG_META: Record<SignupFlag, { label: string; on: string; off: string }> = {
  inviteGate: {
    label: '신규 가입에 초대 코드 필요',
    on: '켜면 처음 가입하는 사람은 초대 코드를 넣어야 가입할 수 있어요.',
    off: '끄면 초대 코드 없이 누구나 가입할 수 있어요.',
  },
  existingSignup: {
    label: '기존 사용자 가입 강제',
    on: '켜면 가입하지 않고 쓰던 기존 사용자도 가입을 마쳐야 앱을 계속 쓸 수 있어요.',
    off: '끄면 기존 사용자는 가입하지 않고도 지금처럼 쓸 수 있어요.',
  },
};

export const flagPath = (flag: SignupFlag) => `${FLAGS_PATH}/${flag}`;

/** 서버 값 → 스위치. bool 이 아니면(칸 없음 포함) 기본값. */
export const parseFlag = (v: unknown): boolean => (typeof v === 'boolean' ? v : SIGNUP_FLAG_DEFAULT);

/** 확인 창 글 — 무엇이 바뀌는지와 언제 반영되는지. */
export function flagConfirmText(flag: SignupFlag, value: boolean): string {
  const m = SIGNUP_FLAG_META[flag];
  return `«${m.label}» ${value ? '켜기' : '끄기'} — ${value ? m.on : m.off} 앱은 바로 반영돼요.`;
}

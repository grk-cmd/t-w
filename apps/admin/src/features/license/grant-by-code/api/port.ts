export type GrantResult =
  { ok: true; key: string; code: string; name: string | null } | { ok: false; reason: 'not-found' };

/** 친구코드로 발급 — 받는 사람을 찾아 키를 만들고 수령함으로 보낸다. */
export interface GrantByCodePort {
  /** 주인을 못 찾으면 아무것도 쓰지 않고 `not-found`. */
  grant(input: string): Promise<GrantResult>;
}

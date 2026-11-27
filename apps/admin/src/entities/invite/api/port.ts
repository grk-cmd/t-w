import type { KeysetPage } from '@/shared/lib';
import type { GroupInvite, GroupInviteUse } from '../model/groupInvite';
import type { InviteFound } from '../model/inviteFound';

/** ✉️ 초대장 읽기 — 여러 명 코드 목록 · 코드마다 가입한 사람 · 한 사람의 남은 초대권. 쓰기는 features/user/grant-invites 의 포트가 한다. */
export interface InvitePort {
  /** 여러 명이 쓰는 코드 한 쪽 — 최근 만든 것부터. 첫 쪽은 `cursor` 없음 · 첫 쪽만 `total`(여러 명 코드 전체 수). */
  groups(cursor: string | undefined, limit: number): Promise<KeysetPage<GroupInvite>>;
  /** 그 여러 명 코드로 들어온 사람 한 쪽 — 먼저 들어온 사람부터. 첫 쪽만 `total`. */
  uses(code: string, cursor: string | undefined, limit: number): Promise<KeysetPage<GroupInviteUse>>;
  /** 한 사람의 남은 초대권. 초대 칸이 없는 사람은 null. */
  invitesLeft(uid: string): Promise<number | null>;
  /** 코드 하나(외부인 · 개인 모두). 없는 코드는 PortError `notFound`. `features.find` 가 거짓인 판은 부르지 않는다. */
  find(code: string): Promise<InviteFound>;
  /** 이 판이 할 수 있는 것 — `find`: 코드 하나 찾기 · 이름 검색(API 판만). */
  readonly features: { find: boolean };
}

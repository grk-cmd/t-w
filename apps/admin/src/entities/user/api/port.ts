import type { IssuedInvite } from '@/entities/invite/@x/user';
import type { Presence, UserInvite } from '../model/live';
import type { KeysetPage } from '@/shared/lib';
import type { Invitee, UserDetail } from '../model/detail';

export interface UserBrief {
  name: string | null;
  friendCode: string | null;
  awayImg: string | null;
}

interface UserReads {
  /** 이름. 없으면 null. */
  name(uid: string): Promise<string | null>;
  /** 이름 · 친구코드 · 자리비움 그림. */
  brief(uid: string): Promise<UserBrief>;
  /** 접속 · 마지막 접속 · 앱 버전. 기록이 없으면 null. */
  presence(uid: string): Promise<Presence | null>;
  /** 집중 누적 시간(초). */
  focusSec(uid: string): Promise<number>;
}

/**
 * 👤 사용자 한 사람 읽기 — 이름 · 소개 · 접속 · 집중. 목록은 features/user/user-rows 의 포트가 한다.
 * 읽는 법이 판마다 다르다: Firebase 판은 users/{uid}/… 의 작은 칸을 하나씩 읽고(`cells`),
 * API 판은 서버가 한 사람 몫을 한 번에 준다(`detail` — 칸마다 따로 읽지 않는다).
 */
export type UserPort = UserCellsPort | UserDetailPort;

export type UserCellsPort = UserReads & {
  kind: 'cells';
  /** 가입 · 초대권. 칸이 없으면 null(아직 게이트를 안 지난 옛 앱). */
  invite(uid: string): Promise<UserInvite | null>;
  /** 이 사람이 만든 초대 코드. */
  issuedInvites(uid: string): Promise<IssuedInvite[]>;
};

export type UserDetailPort = UserReads & {
  kind: 'detail';
  /** 한 사람의 상세 — 줄 칸 · 접속 · 방 · 가입 · 초대 · 시크릿룸 · 신고 수. */
  detail(uid: string): Promise<UserDetail>;
  /** 그 사람의 개인 초대 코드로 들어온 사람 한 쪽(가입 최근순) — 첫 쪽은 `cursor` 없음 · 첫 쪽만 `total`. */
  invitees(uid: string, cursor: string | undefined, limit: number): Promise<KeysetPage<Invitee>>;
};

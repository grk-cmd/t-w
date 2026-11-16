import type { GroupInvite } from '../model/groupInvite';

/** ✉️ 초대장 읽기 — 여러 명 코드 목록 · 한 사람의 남은 초대권. 쓰기는 features/user/grant-invites 의 포트가 한다. */
export interface InvitePort {
  /** 여러 명이 쓰는 코드 전부 — 최근 만든 것부터. */
  groups(): Promise<GroupInvite[]>;
  /** 한 사람의 남은 초대권. 초대 칸이 없는 사람은 null. */
  invitesLeft(uid: string): Promise<number | null>;
}

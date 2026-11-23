import type { LiveUserRow } from './userRow';

/** 이 사람이 만든 개인 초대 코드로 들어온 사람 한 줄. 이름 · 친구코드는 탈퇴 처리가 덜 끝난 짧은 사이에만 null. */
export interface Invitee {
  userCode: string;
  name: string | null;
  friendCode: string | null;
  /** 들어올 때 쓴 코드. */
  code: string;
  joinedAt: number;
}

export interface DetailSecretRoom {
  code: string;
  name: string | null;
  /** null = 영구. 지났으면 «만료»(끝내기 전). */
  expiresAt: number | null;
}

/** API 판 사용자 상세 — 줄 칸(`row`)에 상세 창 칸을 더한 것. */
export interface UserDetail {
  row: LiveUserRow;
  /** 로그인 서버(Firebase Auth)의 UID — Firebase 콘솔에서 이 사람을 찾을 때. */
  authUid: string;
  /** 접속 중이고 시크릿룸이 아닐 때만 들어간 방 코드. */
  room: string | null;
  hasPasswordLogin: boolean;
  awayImage: { url: string; size: number } | null;
  openReports: number;
  secretRoom: DetailSecretRoom | null;
  /** 만든 개인 초대 전부. 들어온 사람은 `invitees` 로 쪽마다 받는다. */
  issuedInviteCount: number;
  /** 그중 한 번이라도 쓰인 것. */
  usedInviteCount: number;
}

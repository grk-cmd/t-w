import type { UserRow } from './userRow';

/** 서버가 준 «내가 만든 초대 코드» 한 줄 — 쓴 사람은 사용자코드(여러 명일 수 있다). */
export interface ServerIssuedInvite {
  code: string;
  createdAt: number;
  usedBy: string[];
}

export interface DetailSecretRoom {
  code: string;
  name: string | null;
  /** null = 영구. 지났으면 «만료»(끝내기 전). */
  expiresAt: number | null;
}

/** API 판 사용자 상세 — 줄 칸(`row`)에 상세 창 칸을 더한 것. */
export interface UserDetail {
  row: UserRow;
  /** 접속 중이고 시크릿룸이 아닐 때만 들어간 방 코드. */
  room: string | null;
  hasPasswordLogin: boolean;
  awayImage: { url: string; size: number } | null;
  openReports: number;
  secretRoom: DetailSecretRoom | null;
  /** 최근 200개까지만 — 전체 수는 아래 두 칸. */
  issuedInvites: ServerIssuedInvite[];
  /** 만든 개인 초대 전부. */
  issuedInviteCount: number;
  /** 그중 한 번이라도 쓰인 것. */
  usedInviteCount: number;
}

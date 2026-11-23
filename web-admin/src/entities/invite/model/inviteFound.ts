/** 관리자 코드 찾기 한 건 — 외부인 초대장(관리자가 만든 코드) · 개인 초대 모두. */
export interface InviteFound {
  code: string;
  /** `admin` = 관리자가 만든 코드(외부인 초대장 · 한 명짜리 관리자 코드) · `user` = 사람이 앱에서 만든 개인 초대. */
  kind: 'admin' | 'user';
  /** 개인 초대를 만든 사람 — 관리자 코드이거나 그 사람이 탈퇴했으면 null. */
  issuerUserCode: string | null;
  issuerName: string | null;
  maxUses: number;
  usedCount: number;
  expiresAt: number | null;
  stoppedAt: number | null;
  note: string;
  createdAt: number;
  /** 서버 «쓸 수 있나» 의 답 — USABLE · FULL · EXPIRED · PAUSED. */
  status: InviteFoundStatus;
}

export type InviteFoundStatus = 'USABLE' | 'FULL' | 'EXPIRED' | 'PAUSED';

export const INVITE_FOUND_STATUSES: readonly InviteFoundStatus[] = ['USABLE', 'FULL', 'EXPIRED', 'PAUSED'];

export const INVITE_FOUND_STATUS_LABEL: Record<InviteFoundStatus, string> = {
  USABLE: '쓰는 중',
  FULL: '다 참',
  EXPIRED: '마감',
  PAUSED: '중지',
};

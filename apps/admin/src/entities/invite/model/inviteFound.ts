import type { GroupInvite } from './groupInvite';

/**
 * 관리자 코드 찾기 한 건 — 외부인 초대장(관리자가 만든 코드) · 개인 초대 모두.
 * 상태(쓰는 중 · 다 참 · 마감 · 중지)는 외부인 초대장 목록과 같은 `groupInviteState` 로 정한다 — 서버 `status` 는 쓰지 않는다.
 */
export interface InviteFound extends GroupInvite {
  createdAt: number;
  /** `admin` = 관리자가 만든 코드(외부인 초대장 · 한 명짜리 관리자 코드) · `user` = 사람이 앱에서 만든 개인 초대. */
  kind: 'admin' | 'user';
  /** 개인 초대를 만든 사람 — 관리자 코드이거나 그 사람이 탈퇴했으면 null. */
  issuerUserCode: string | null;
  issuerName: string | null;
}

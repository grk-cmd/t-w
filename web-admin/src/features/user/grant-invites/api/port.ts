import type { GroupInvite, GroupInviteDraft } from '@/entities/invite';
import type {
  BatchOpts,
  GrantAllResult,
  GrantInvitesResult,
  InviteTarget,
  RevokeAllResult,
} from '../model/grantInvites';

/** 진행 알림 · 멈춤 — `scope` 는 Firebase 판 기록 칸이라 포트 밖에서는 받지 않는다. */
export type RunOpts = Omit<BatchOpts, 'scope'>;

/** ✉️ 초대장 쓰기 — 초대권 지급 · 회수, 한 명짜리 코드, 여러 명 코드. */
export interface GrantInvitesPort {
  /** 한 사람에게 count 장. 초대 칸이 없거나 이미 상한이면 `ok: false`. */
  grantOne(uid: string, count: number): Promise<GrantInvitesResult>;
  /** «전체» 대상 수. Firebase 판은 friendCodes 를 읽어 세고, API 판은 서버의 사용자 통계 total 을 읽는다. 못 읽으면 던진다. */
  countAll(): Promise<number>;
  grant(target: InviteTarget, count: number, opts?: RunOpts): Promise<GrantAllResult>;
  /** 남은 초대권을 0 장으로(마이너스는 그대로). */
  revoke(target: InviteTarget, opts?: RunOpts): Promise<RevokeAllResult>;
  /** 한 명짜리 코드 n 개 — 만든 대로 `onCode` 로 알린다. */
  createCodes(n: number, onCode?: (code: string) => void): Promise<string[]>;
  /** 여러 명 코드 하나. */
  createGroup(draft: GroupInviteDraft): Promise<string>;
  /** 중지 · 다시 열기 — 목록이 읽은 줄 그대로 받는다. */
  setGroupStopped(invite: GroupInvite, stop: boolean): Promise<void>;
}

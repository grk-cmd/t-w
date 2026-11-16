import type { ReportTarget } from '../model/report';

/** 🚩 신고 읽기 — 신고가 쌓인 사람 목록 · 한 사람이 받은 신고 수. 쓰기는 features/user/moderate-report 의 포트가 한다. */
export interface ReportPort {
  /** 신고 많은 순. «서로 다른 몇 명 이상» 으로 거르는 일은 Firebase 판은 웹이, API 판은 서버가 한다. */
  targets(): Promise<ReportTarget[]>;
  /** 한 사람이 받은 신고 수(= 서로 다른 신고자 수). */
  countFor(uid: string): Promise<number>;
}

import type { KeysetPage } from '@/shared/lib';
import type { ReportTarget } from '../model/report';

interface ReportReads {
  /** 한 사람이 받은 신고 수(= 서로 다른 신고자 수). */
  countFor(uid: string): Promise<number>;
}

/**
 * 🚩 신고 읽기 — 신고가 쌓인 사람 목록 · 한 사람이 받은 신고 수. 쓰기는 features/user/moderate-report 의 포트가 한다.
 * 목록 읽는 법이 판마다 다르다: Firebase 판은 통째로 받아 웹이 «3명 이상» 을 거르고(`all`),
 * API 판은 서버가 거른 키셋을 한 쪽씩 준다(`keyset` — 화면이 이어 받는다).
 */
export type ReportPort = ReportAllPort | ReportKeysetPort;

export type ReportAllPort = ReportReads & { kind: 'all'; targets(): Promise<ReportTarget[]> };

export type ReportKeysetPort = ReportReads & {
  kind: 'keyset';
  /** 한 쪽 — 첫 쪽은 `cursor` 없음. 첫 쪽만 `total`(기준을 넘는 대상 전체 수). */
  page(cursor: string | undefined, limit: number): Promise<KeysetPage<ReportTarget>>;
};

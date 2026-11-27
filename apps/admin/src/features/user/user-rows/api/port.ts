import type { LiveUserRow, UserPageView, UserQuery, UserRow, UserStatsView } from '@/entities/user';
import type { AllUsersView } from './firebase';

interface UserRowsReads {
  /** 전체 사람 수 · 버전별 수. */
  stats(): Promise<UserStatsView>;
  /** 사용자코드로 찾기 — 목록에 없는 사람(다른 쪽 · 초대한 사람)을 한 줄로. 없는 사람은 빠진다. */
  byCodes(codes: readonly string[]): Promise<Map<string, UserRow>>;
}

/**
 * 👥 사용자 목록 읽기 — 한 쪽 · 통계 · 사용자코드로 찾기.
 * 읽는 법이 판마다 다르다: Firebase 판은 쪽 번호로 받고 기간 검색은 통째로 받아 화면이 거른다(`paged`),
 * API 판은 서버가 거르고 세고 고른 쪽 하나를 준다(`server` — 쪽 번호 한 번 · 이어 받지 않는다).
 */
export type UserRowsPort = UserRowsPagedPort | UserRowsServerPort;

export type UserRowsPagedPort = UserRowsReads & {
  kind: 'paged';
  page(query: UserQuery, page: number, size: number): Promise<UserPageView>;
  /** 조건에 맞는 사람 전부(기간 검색용). */
  all(query: UserQuery): Promise<AllUsersView>;
  /** 같은 키를 쓰는 사람들(본인 포함, 최근 접속 순). */
  sameLicense(license: string): Promise<UserRow[]>;
};

/** 서버가 준 한 쪽과 조건에 맞는 전체 수. */
export interface UserServerPage {
  items: LiveUserRow[];
  total: number;
}

export type UserRowsServerPort = UserRowsReads & {
  kind: 'server';
  /**
   * 고른 쪽 하나(1 부터 · `size` 줄) — 쪽 번호로 한 번에 받는다. 정렬 키(마지막 접속)가 읽는 동안에도 바뀌어
   * 키셋으로 먼 쪽까지 이어 받으면 줄이 빠진다. 거르기 · 찾기 · 기간 · 순서 · 수는 서버가 한다.
   */
  page(query: UserQuery, page: number, size: number): Promise<UserServerPage>;
};

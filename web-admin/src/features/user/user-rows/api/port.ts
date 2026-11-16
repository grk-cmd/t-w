import type { LiveUserRow, UserPageView, UserQuery, UserRow, UserStatsView } from '@/entities/user';
import type { KeysetPage } from '@/shared/lib';
import type { AllUsersView } from './firebase';

interface UserRowsReads {
  /** 전체 사람 수 · 버전별 수. */
  stats(): Promise<UserStatsView>;
  /** 사용자코드로 찾기 — 목록에 없는 사람(다른 쪽 · 초대한 사람 · 방 서버 지정)을 한 줄로. 없는 사람은 빠진다. */
  byCodes(codes: readonly string[]): Promise<Map<string, UserRow>>;
}

/**
 * 👥 사용자 목록 읽기 — 한 쪽 · 통계 · 사용자코드로 찾기.
 * 읽는 법이 판마다 다르다: Firebase 판은 쪽 번호로 받고 기간 검색은 통째로 받아 화면이 거른다(`paged`),
 * API 판은 서버가 거르고 세는 키셋을 한 쪽씩 준다(`keyset` — 화면이 이어 받는다).
 */
export type UserRowsPort = UserRowsPagedPort | UserRowsKeysetPort;

export type UserRowsPagedPort = UserRowsReads & {
  kind: 'paged';
  page(query: UserQuery, page: number, size: number): Promise<UserPageView>;
  /** 조건에 맞는 사람 전부(기간 검색용). */
  all(query: UserQuery): Promise<AllUsersView>;
  /** 같은 키를 쓰는 사람들(본인 포함, 최근 접속 순). */
  sameLicense(license: string): Promise<UserRow[]>;
};

export type UserRowsKeysetPort = UserRowsReads & {
  kind: 'keyset';
  /** 한 쪽 — 첫 쪽은 `cursor` 없음. 첫 쪽만 `total`(조건에 맞는 전체 수). 거르기 · 찾기 · 기간 · 순서는 서버가 한다. */
  page(query: UserQuery, cursor: string | undefined, limit: number): Promise<KeysetPage<LiveUserRow>>;
};

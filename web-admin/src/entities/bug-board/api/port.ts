import type { Versioned } from '@/shared/api';
import type { KeysetPage } from '@/shared/lib';
import type { BugAnswer, BugContent, BugItem, BugListView, BugFilter, BugCursor } from '../model/bugBoard';

export interface BugListQuery {
  filter: BugFilter;
  /** 쪽 번호로 읽을 때 — 1부터. */
  page: number;
  size: number;
  /** 예전 방식(커서)으로 넘기는 중일 때만 — 첫 쪽은 null. Firebase 판만 쓴다. */
  before: BugCursor | null;
}

export interface BugPost {
  item: BugItem;
  content: BugContent | null;
  answers: BugAnswer[];
}

interface BugBoardReads {
  /** 목록 한 줄 하나 — 글이 지워졌으면 null. */
  item(id: string): Promise<BugItem | null>;
  /** 상세 — 글 · 내용 · 답변. 글이 지워졌으면 null. */
  post(id: string): Promise<BugPost | null>;
  /** 비공개 글 제목. */
  prvTitle(item: BugItem): Promise<string>;
  /** 그날 올라온 글의 순번 — 고정 번호(no)가 없는 글의 임시 번호를 셀 때만. */
  dayOrder(day: string): Promise<Map<string, number>>;
}

/**
 * 🐞 제보 읽기 — 목록 · 한 줄 · 상세 · 비공개 제목 · 날짜 순번. 쓰기는 features/bug-board/* 의 포트가 한다.
 * 목록 읽는 법이 판마다 다르다: Firebase 판은 쪽 번호 · 커서로 한 쪽을 받고(`paged`),
 * API 판은 서버 키셋을 한 쪽씩 준다(`keyset` — 화면이 이어 받는다).
 */
export type BugBoardPort = BugBoardPagedPort | BugBoardKeysetPort;

export type BugBoardPagedPort = BugBoardReads & {
  kind: 'paged';
  list(query: BugListQuery): Promise<BugListView>;
};

export type BugBoardKeysetPort = BugBoardReads & {
  kind: 'keyset';
  /** 한 쪽 — 첫 쪽은 `cursor` 없음. 첫 쪽만 `total`(그 갈래의 전체 글 수). */
  page(filter: BugFilter, cursor: string | undefined, limit: number): Promise<KeysetPage<BugItem>>;
};

/** 한 사람 하루 제보 상한 — 판마다 지키는 곳이 다르다(Firebase 판은 앱 · API 판은 서버). */
export interface BugDailyMaxPort {
  /** 이 판에서 누가 막는지 — 카드 안내에 그대로 싣는다. */
  readonly enforcedBy: string;
  /** 저장한 값이 언제부터 먹는지 — 확인 창에 그대로 싣는다. */
  readonly appliesFrom: string;
  /** 저장한 상한 — 없으면 null(기본 `BUG_DAILY_MAX_DEFAULT`). */
  get(): Promise<Versioned<number | null>>;
  /** `from` 은 화면이 읽은 값 · 번호 — 그 사이 다른 곳이 고쳤으면 `conflict`. */
  save(from: Versioned<number | null>, max: number): Promise<void>;
}

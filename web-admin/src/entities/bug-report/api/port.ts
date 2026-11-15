import type { Versioned } from '@/shared/api';
import type { BugReport } from '../model/bugReport';

/** 제보 안내 문구와 제보 링크 — 앱의 [제보하기] 버튼이 읽는다. */
export interface BugReportPort {
  get(): Promise<Versioned<BugReport | null>>;
  /** 링크가 빈 문자열이면 앱의 [제보하기] 버튼이 꺼진다. `from` 은 화면이 읽은 값 · 번호 — 그 사이 바뀌었으면 `conflict`. */
  save(from: Versioned<BugReport | null>, notice: string, link: string): Promise<void>;
}

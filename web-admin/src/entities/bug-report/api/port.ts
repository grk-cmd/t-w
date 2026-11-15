import type { BugReport } from '../model/bugReport';

/** 제보 안내 문구와 제보 링크 — 앱의 [제보하기] 버튼이 읽는다. */
export interface BugReportPort {
  get(): Promise<BugReport | null>;
  /** 링크가 빈 문자열이면 앱의 [제보하기] 버튼이 꺼진다. */
  save(notice: string, link: string): Promise<void>;
}

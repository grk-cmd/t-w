import type { DismissManyResult, TakeDownResult } from '../model/moderateReport';

/** 🚩 신고 처리 — 문제없음(한 명 · 고른 사람들) · 자리비움 그림 내리기. */
export interface ModerateReportPort {
  /** 보고 있던 그림 주소 `shownUrl` 이 지금 그림과 같을 때만 내린다 — 다르면 `changed`. */
  takeDown(target: string, shownUrl: string): Promise<TakeDownResult>;
  dismiss(target: string): Promise<void>;
  dismissMany(targets: readonly string[]): Promise<DismissManyResult>;
}

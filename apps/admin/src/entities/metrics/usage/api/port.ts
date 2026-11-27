import type { Improvement, ImprovementDraft } from '../model/improvement';
import type { DayUsage } from '../model/usage';

/** 💰 사용량(날마다 무리 넷의 바이트 · 횟수)과 📉 개선 기록(릴리스마다 한 칸). */
export interface UsagePort {
  /** 이 판이 재는 무리 — 서버 판은 Storage · Hosting 만 안다(DB · 함수 줄은 컷오버 뒤 값이 없다, 설계 R9). */
  readonly features: { db: boolean; functions: boolean };
  /** 하루치. 기록이 없는 날은 빈 값. */
  getDay(date: string): Promise<DayUsage>;
  /** 서버 시각 − 이 PC 시각(ms). */
  serverTimeOffset(): Promise<number>;
  /** 개선 기록 전부. */
  listImprovements(): Promise<Improvement[]>;
  /**
   * 새로 적거나(`existing` 없음) 고친다 — 고칠 때는 화면이 읽은 줄(번호 `revision` 포함)을 그대로 넘긴다. 그 사이 바뀌었으면 `conflict`.
   * 값이 받을 수 없는 것이면 쓰지 않고 던진다. 쓴 id 를 돌려준다.
   */
  saveImprovement(draft: ImprovementDraft, existing?: Improvement): Promise<string>;
  deleteImprovement(entry: Improvement): Promise<void>;
}

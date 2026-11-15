import type { Improvement, ImprovementDraft } from '../model/improvement';
import type { DayUsage } from '../model/usage';

/** 💰 사용량(날마다 무리 넷의 바이트 · 횟수)과 📉 개선 기록(릴리스마다 한 칸). */
export interface UsagePort {
  /** 하루치. 기록이 없는 날은 빈 값. */
  getDay(date: string): Promise<DayUsage>;
  /** 서버 시각 − 이 PC 시각(ms). */
  serverTimeOffset(): Promise<number>;
  /** 개선 기록 전부. */
  listImprovements(): Promise<Improvement[]>;
  /** 새로 적거나(id 없음) 고친다. 값이 받을 수 없는 것이면 쓰지 않고 던진다. 쓴 id 를 돌려준다. */
  saveImprovement(draft: ImprovementDraft, id?: string): Promise<string>;
  deleteImprovement(entry: Improvement): Promise<void>;
}

import type { DayUsage } from '../model/usage';

/** 💰 사용량(날마다 무리 넷의 바이트 · 횟수). */
export interface UsagePort {
  /** 이 판이 재는 무리 — 서버 판은 Storage · Hosting 만 안다(DB · 함수 줄은 컷오버 뒤 값이 없다, 설계 R9). */
  readonly features: { db: boolean; functions: boolean };
  /** 하루치. 기록이 없는 날은 빈 값. */
  getDay(date: string): Promise<DayUsage>;
  /** 서버 시각 − 이 PC 시각(ms). */
  serverTimeOffset(): Promise<number>;
}

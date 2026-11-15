import type { ActiveUsers, DayMetrics } from '../model/metrics';

/** 날마다 쌓이는 접속 지표(DAU · 방문 · ping · IP). */
export interface MetricsPort {
  /** 하루치. 오늘은 요약이 아직 없다(`isToday`). 기록이 없는 날은 빈 값. */
  getDay(date: string, isToday?: boolean): Promise<DayMetrics>;
  /** `dates` 의 마지막 날을 오늘로 본다. */
  getRecent(dates: readonly string[]): Promise<DayMetrics[]>;
  /** 최근 7일 · 30일 고유 사용자 — `days` 는 `getRecent` 가 준 것(오래된 날 → 오늘). 구할 수 없으면 던진다. */
  activeUsers(days: readonly DayMetrics[]): ActiveUsers;
  /** 서버 시각 − 이 PC 시각(ms) — «오늘» 을 서버 기준으로 정한다. */
  serverTimeOffset(): Promise<number>;
}

import type { AuditAction } from '@/shared/api';
import type { IntGroup, IntValues, LogLevel, LogLevels } from '../model/opsConfig';

/** 서버 운영 설정 — 정수 칸 묶음 · 로그 수준 · API CORS 허용 출처. 빈 값 = 지움(서버 기본값). */
export interface OpsConfigPort {
  getIntGroup(group: IntGroup): Promise<IntValues>;
  getLogLevels(): Promise<LogLevels>;
  getCorsOrigins(): Promise<string[]>;
  /** 바뀐 칸만 `updates` 로(null = 지움). 바뀐 게 없으면 쓰지 않는다. */
  saveIntGroup(
    group: IntGroup,
    action: AuditAction,
    target: string,
    before: IntValues,
    updates: Record<string, number | null>,
  ): Promise<void>;
  saveLogLevels(before: LogLevels, updates: Record<string, LogLevel | null>): Promise<void>;
  /** 출처 목록을 통째로 쓴다 — 빈 목록이면 지운다(= 서버 env 기본). */
  saveCorsOrigins(before: string[], next: string[]): Promise<void>;
}

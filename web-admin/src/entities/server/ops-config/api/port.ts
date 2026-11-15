import type { AuditAction, Versioned } from '@/shared/api';
import type { IntGroup, IntValues, LogLevel, LogLevels, Maintenance, ServerLimits } from '../model/opsConfig';

/** 정수 칸 묶음 셋 — 어떤 칸이 있는지는 판마다 다르다(서버 판의 캐시 초는 `ranking` 이 있고 `count` 가 없다). */
export interface OpsGroups {
  apiCache: IntGroup;
  roomFrame: IntGroup;
  roomTiming: IntGroup;
  /** 하루 한도(가입 · 웹박수 · 선물) — API 판에만 있다. 서버 키 하나가 묶음 하나(칸 하나)라 저장도 하나씩. Firebase 판은 null. */
  dailyLimits: readonly IntGroup[] | null;
}

/** API 판에만 있는 카드 — Firebase 판은 null(그 일은 따로 한다: 점검은 런북, 방 서버 한 대 상한은 방 서버 화면). */
export interface MaintenanceControl {
  get(): Promise<Versioned<Maintenance>>;
  save(from: Versioned<Maintenance>, next: Maintenance): Promise<void>;
}

export interface ServerLimitsControl {
  get(): Promise<Versioned<ServerLimits>>;
  save(from: Versioned<ServerLimits>, next: ServerLimits): Promise<void>;
}

/** 서버 운영 설정 — 정수 칸 묶음 · 로그 수준 · API CORS 허용 출처. 빈 값 = 지움(서버 기본값). */
export interface OpsConfigPort {
  readonly groups: OpsGroups;
  readonly maintenance: MaintenanceControl | null;
  readonly serverLimits: ServerLimitsControl | null;
  getIntGroup(group: IntGroup): Promise<Versioned<IntValues>>;
  getLogLevels(): Promise<Versioned<LogLevels>>;
  getCorsOrigins(): Promise<Versioned<string[]>>;
  /**
   * 바뀐 칸만 `updates` 로(null = 지움). 바뀐 게 없으면 쓰지 않는다.
   * 저장은 화면이 읽은 값 · 번호(`from`)로 한다 — 그 사이 다른 곳이 고쳤으면 `conflict`.
   */
  saveIntGroup(
    group: IntGroup,
    action: AuditAction,
    target: string,
    from: Versioned<IntValues>,
    updates: Record<string, number | null>,
  ): Promise<void>;
  saveLogLevels(from: Versioned<LogLevels>, updates: Record<string, LogLevel | null>): Promise<void>;
  /** 출처 목록을 통째로 쓴다 — 빈 목록이면 지운다(= 서버 env 기본). */
  saveCorsOrigins(from: Versioned<string[]>, next: string[]): Promise<void>;
}

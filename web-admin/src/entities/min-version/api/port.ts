import type { MinVersionKind } from '../model/minVersion';

/** 최소 버전 — 방 입장용 · 앱 전체용 두 칸. */
export interface MinVersionPort {
  /** 없으면 null(= 제한 없음). */
  get(kind: MinVersionKind): Promise<string | null>;
  /** 올리면 그보다 낮은 앱이 막힌다. `before` 는 작업 기록에 «전 → 후» 로 남긴다. */
  save(kind: MinVersionKind, version: string, before: string | null): Promise<void>;
}

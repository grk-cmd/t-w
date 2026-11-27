import type { Versioned } from '@/shared/api';
import type { MinVersionKind } from '../model/minVersion';

/** 최소 버전 — 방 입장용 · 앱 전체용 두 칸. */
export interface MinVersionPort {
  /** 없으면 값이 null(= 제한 없음). */
  get(kind: MinVersionKind): Promise<Versioned<string | null>>;
  /** 올리면 그보다 낮은 앱이 막힌다. `from` 은 화면이 읽은 값 · 번호 — 그 사이 바뀌었으면 `conflict`, 값은 작업 기록에 «전 → 후» 로 남긴다. */
  save(kind: MinVersionKind, from: Versioned<string | null>, version: string): Promise<void>;
}

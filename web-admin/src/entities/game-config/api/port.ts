import type { Versioned } from '@/shared/api';

/** 게임 설정 — 지금은 동물 해금 레벨 한 칸. */
export interface GameConfigPort {
  /** 서버에 정해 둔 값. 없으면 null(앱은 기본값을 쓴다). */
  getAnimalUnlockLevel(): Promise<Versioned<number | null>>;
  /** `from` 은 화면이 읽은 값 · 번호 — 그 사이 바뀌었으면 `conflict`. */
  saveAnimalUnlockLevel(from: Versioned<number | null>, level: number): Promise<void>;
}

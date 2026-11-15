/** 게임 설정 — 지금은 동물 해금 레벨 한 칸. */
export interface GameConfigPort {
  /** 서버에 정해 둔 값. 없으면 null(앱은 기본값을 쓴다). */
  getAnimalUnlockLevel(): Promise<number | null>;
  saveAnimalUnlockLevel(level: number): Promise<void>;
}

/** 🧑‍💼 관리자 이름표 — 할 일 작업자 고르기 · 작업 기록 · 메모의 «누가» 에 쓴다. */
export interface AdminNamePort {
  /** uid → 이름. 이름을 아직 안 남긴 관리자는 없다. 못 읽으면 던진다(빈 표로 덮지 않는다). */
  names(): Promise<Map<string, string>>;
}

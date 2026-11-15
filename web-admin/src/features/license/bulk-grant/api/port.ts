import type { IssuedIndex, PlanRow, SheetRow } from '../model/rows';

type Progress = (done: number, total: number) => void;

/** 엑셀 일괄 발급 — 파일을 읽은 뒤의 조회 · 발급. 파일 읽기 · 판정 · 결과 파일은 화면 규칙(model · lib)이 한다. */
export interface BulkGrantPort {
  /** 전에 발급한 친구코드 표 — 못 받으면 null(«발급한 적 있음» 판정만 빠진다). */
  issued(): Promise<IssuedIndex | null>;
  /** 미리보기용 조회 — 친구코드 → 주인 · 이름만 읽고 아무것도 쓰지 않는다. */
  lookup(data: SheetRow[], onProgress?: Progress): Promise<PlanRow[]>;
  /** 한 명씩 차례로 발급 — 하나가 실패해도 나머지는 계속하고, 어디까지 됐는지 행마다 남긴다. */
  run(rows: PlanRow[], onProgress?: Progress): Promise<PlanRow[]>;
}

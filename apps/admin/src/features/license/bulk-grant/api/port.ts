import type { IssuedCheck, PlanRow, SheetRow } from '../model/rows';

type Progress = (done: number, total: number) => void;

/** 엑셀 일괄 발급 — 파일을 읽은 뒤의 조회 · 발급. 파일 읽기 · 판정 · 결과 파일은 화면 규칙(model · lib)이 한다. */
export interface BulkGrantPort {
  /**
   * «이미 받은 사람» 을 가르는 길 — Firebase 판은 전에 발급한 키의 메모 표(못 받으면 null: 판정만 빠진다),
   * API 판은 미리 보기(`lookup`)가 행마다 실어 준 `hasLicense` 를 본다(통째 목록을 받지 않는다).
   */
  issued(): Promise<IssuedCheck | null>;
  /** 미리보기용 조회 — 친구코드 → 주인 · 이름만 읽고 아무것도 쓰지 않는다. */
  lookup(data: SheetRow[], onProgress?: Progress): Promise<PlanRow[]>;
  /**
   * 발급. Firebase 판은 한 명씩 차례로 — 하나가 실패해도 나머지는 계속하고 어디까지 됐는지 행마다 남긴다.
   * API 판은 한 요청(≤500줄)으로 보내고 줄마다 결과를 받는다. `reissue` 면 이미 유효한 키가 있는 사람에게도 발급한다.
   */
  run(rows: PlanRow[], options: { reissue: boolean }, onProgress?: Progress): Promise<PlanRow[]>;
}

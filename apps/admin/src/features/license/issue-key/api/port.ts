/** 키 한 장 발급 — 메모만 받는다. */
export interface IssueKeyPort {
  /** 새 키를 만들고 키 원문을 돌려준다. */
  issue(note: string): Promise<string>;
}

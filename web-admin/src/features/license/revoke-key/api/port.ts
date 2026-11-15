/** 키 회수 · 삭제 — 한 개든 여러 개든 한 번에, 기록은 한 줄. */
export interface RevokeKeyPort {
  /** 회수한다. 한 묶음으로 — 하나라도 막히면 아무것도 바뀌지 않는다. 회수한 개수를 돌려준다. */
  revoke(keys: readonly string[]): Promise<number>;
  /** 지운다(회수된 키만). 한 묶음으로. 지운 개수를 돌려준다. */
  remove(keys: readonly string[]): Promise<number>;
}

import type { SelectedKey } from '../model/revokeKeys';

/** 키 회수 · 삭제 — 한 개든 여러 개든 한 번에, 기록은 한 줄. 목록이 읽은 줄을 그대로 받는다. */
export interface RevokeKeyPort {
  /**
   * 회수한다. Firebase 판은 한 묶음으로 — 하나라도 막히면 아무것도 바뀌지 않는다.
   * API 판은 키마다 따로 처리돼, 안 된 키가 있으면 «n개 됨 · m개 안 됨» 으로 던진다. 회수한 개수를 돌려준다.
   */
  revoke(keys: readonly SelectedKey[]): Promise<number>;
  /** 지운다(회수된 키만). 위와 같다. 지운 개수를 돌려준다. */
  remove(keys: readonly SelectedKey[]): Promise<number>;
}

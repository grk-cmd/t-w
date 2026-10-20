// 모달(<dialog>) 바깥 클릭으로 닫기 — DOM 없이 판단만 하는 부분. 실제 연결은 shared/ui 의 useModalDialog.

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * 모달의 바깥 막(::backdrop)을 누른 것인가.
 * 막을 눌러도 이벤트 대상은 <dialog> 자신이라, 창의 여백을 누른 것과 구별하려면 좌표가 창 상자 밖인지 본다.
 * 대상이 창 안의 다른 요소(또는 안에 겹쳐 열린 다른 창)면 바깥이 아니다.
 */
export function isBackdropPress(target: unknown, dialog: unknown, box: Box, x: number, y: number): boolean {
  if (target !== dialog) return false;
  return x < box.left || x > box.right || y < box.top || y > box.bottom;
}

/** 입력칸 하나 — 처음 손댈 때의 값과 지금 값을 비교한다. */
export interface FieldLike {
  value: string;
  isConnected: boolean;
}

/** 손댄 입력칸 중 처음 값과 달라진 것이 화면에 남아 있으면 «적다 만 것» 이 있다. */
export function hasUnsavedInput(touched: ReadonlyMap<FieldLike, string>): boolean {
  for (const [el, first] of touched) {
    if (el.isConnected && el.value !== first) return true;
  }
  return false;
}

export interface DismissState {
  /** 누르기 시작한 곳이 바깥 막이었나. */
  startedOnBackdrop: boolean;
  /** 뗀 곳이 바깥 막이었나. */
  endedOnBackdrop: boolean;
  /** 저장 · 삭제 같은 요청이 도는 중 — 닫으면 결과를 볼 수 없다. */
  busy: boolean;
  /** 적다 만 입력이 있다 — 잘못 눌러 날아가지 않게 바깥 클릭은 무시한다(닫기 버튼 · Esc 는 그대로). */
  dirty: boolean;
}

/** 바깥 클릭으로 닫을지. 창 안에서 글자를 고르다 바깥에서 놓은 경우(시작이 안)는 닫지 않는다. */
export function shouldDismissOnBackdrop(s: DismissState): boolean {
  return s.startedOnBackdrop && s.endedOnBackdrop && !s.busy && !s.dirty;
}

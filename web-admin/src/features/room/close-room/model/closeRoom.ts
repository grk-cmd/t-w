// 실수 방지 — 앱과 같이 이 낱말을 직접 입력해야 전체 종료가 된다.
export const CLOSE_ALL_WORD = '종료';

export const isCloseAllConfirmed = (typed: string) => typed.trim() === CLOSE_ALL_WORD;

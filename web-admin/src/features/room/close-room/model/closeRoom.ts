// 실수 방지 — 앱과 같이 이 낱말을 직접 입력해야 전체 종료가 된다.
export const CLOSE_ALL_WORD = '종료';

export const isCloseAllConfirmed = (typed: string) => typed.trim() === CLOSE_ALL_WORD;

/** 닫은 결과 한 줄 — 이미 없던 방이 있으면 함께 알린다. */
export function closeResultText({ closed, missing }: { closed: string[]; missing: string[] }): string {
  if (!closed.length && !missing.length) return '종료할 방이 없어요';
  const done = closed.length ? `방 ${closed.length}개를 종료했어요` : '종료한 방이 없어요';
  return missing.length ? `${done} · 이미 없던 방 ${missing.length}개` : done;
}

/** 한 방을 닫은 결과 — 서버가 «이미 없다» 고 답했으면 닫았다고 하지 않는다. */
export const closeOneText = (code: string, { missing }: { missing: string[] }): string =>
  missing.includes(code) ? `${code} 방은 이미 없어요` : `${code} 방을 종료했어요`;

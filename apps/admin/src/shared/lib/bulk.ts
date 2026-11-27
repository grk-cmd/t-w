/** 고른 대상을 한 번에 보내는 상한 — 서버 묶음 쓰기(`targets` · `items`)가 1~100 을 받는다. */
export const BULK_SEND_MAX = 100;

/** 목록을 `size` 개씩 자른다. */
export function chunks<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

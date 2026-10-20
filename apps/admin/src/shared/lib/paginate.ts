/** 쪽 번호가 범위를 벗어나면 끝 쪽으로 맞춘다 — 필터로 줄었을 때 빈 쪽이 보이지 않게. */
export function paginate<T>(
  items: T[],
  page: number,
  size: number,
): { items: T[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(page, 1), pageCount);
  return { items: items.slice((current - 1) * size, current * size), page: current, pageCount };
}

import type { CatalogKind } from './entry';

// 카탈로그 항목별 장착 사용자 수 — 서버 함수(functions/part-equip.js)가 슬롯이 바뀔 때마다 더하고 뺀다.
//   metrics/parts/equipped/{parts|desks|items}/{id} = 사람 수
// 파츠와 가챠 파츠는 슬롯 def 만 봐서는 어느 통인지 몰라 둘 다 parts 아래에 있다.
export const METRICS_EQUIPPED = 'metrics/parts/equipped';

export type EquipKind = 'parts' | 'desks' | 'items';

/** 카탈로그 종류 → 장착 수가 적힌 종류. */
export function equipKindOf(kind: CatalogKind): EquipKind {
  return kind === 'gachaParts' ? 'parts' : kind;
}

export const equipPath = (kind: EquipKind) => `${METRICS_EQUIPPED}/${kind}`;

/** 서버 값 → { id: 사람 수 }. 숫자가 아니거나 0 이하(백필 전 · 어긋남)는 뺀다 — 없는 항목은 0 으로 본다. */
export function toEquipCounts(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[id] = Math.floor(v);
  }
  return out;
}

export const equipCountOf = (counts: Record<string, number> | undefined, id: string): number =>
  counts?.[id] ?? 0;

/** 많이 쓰는 순 — 같으면 원래 순서(진열 순서)를 지킨다. 원본은 건드리지 않는다. */
export function byPopularity<T extends { id: string }>(
  list: readonly T[],
  counts: Record<string, number> | undefined,
): T[] {
  return list
    .map((item, i) => ({ item, i, n: equipCountOf(counts, item.id) }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.item);
}

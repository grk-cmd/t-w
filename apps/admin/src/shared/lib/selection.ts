import { useMemo, useState } from 'react';

// 선택은 id 집합 하나로 둔다. 목록에서 사라진 id 는 «보이는 선택» 에서 바로 빠지고, 다음 조작 때 집합에서도 지워진다.

/** 목록(ids)에 아직 있는 것만, 목록 순서대로. */
export function pruneSelection(checked: ReadonlySet<string>, ids: readonly string[]): string[] {
  return ids.filter((id) => checked.has(id));
}

export function toggleId(checked: ReadonlySet<string>, ids: readonly string[], id: string): Set<string> {
  const next = new Set(pruneSelection(checked, ids));
  if (next.has(id)) next.delete(id);
  else if (ids.includes(id)) next.add(id);
  return next;
}

/** 이 쪽(pageIds)이 다 골라져 있으면 이 쪽만 풀고, 아니면 이 쪽을 전부 고른다 — 다른 쪽 선택은 그대로. */
export function toggleAllIds(
  checked: ReadonlySet<string>,
  ids: readonly string[],
  pageIds: readonly string[],
): Set<string> {
  const next = new Set(pruneSelection(checked, ids));
  const all = pageIds.length > 0 && pageIds.every((id) => next.has(id));
  for (const id of pageIds) {
    if (all) next.delete(id);
    else next.add(id);
  }
  return next;
}

export function selectionState(
  checked: ReadonlySet<string>,
  pageIds: readonly string[],
): { allChecked: boolean; someChecked: boolean } {
  const n = pageIds.filter((id) => checked.has(id)).length;
  return { allChecked: n > 0 && n === pageIds.length, someChecked: n > 0 && n < pageIds.length };
}

export interface Selection {
  /** 지금 목록에 있는 선택된 id, 목록 순서. */
  selected: string[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  /** 이 쪽 전체 선택 · 해제. */
  toggleAll: () => void;
  clear: () => void;
  /** 주어진 id 만 남긴다 — 일괄 처리 뒤 실패한 것만 골라 둔 채로 두는 용도. */
  keep: (ids: readonly string[]) => void;
  /** 이 쪽이 전부 골라짐. */
  allChecked: boolean;
  /** 이 쪽이 일부만 골라짐. */
  someChecked: boolean;
}

/**
 * ids 는 목록 전체(필터 뒤), pageIds 는 지금 보이는 쪽 — 페이징이 없으면 생략한다.
 * 쪽을 넘겨도 선택은 남고, 전체 선택은 이 쪽만 고른다.
 */
export function useSelection(ids: readonly string[], pageIds: readonly string[] = ids): Selection {
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set());
  const selected = useMemo(() => pruneSelection(checked, ids), [checked, ids]);
  const visible = useMemo(() => new Set(selected), [selected]);
  const { allChecked, someChecked } = selectionState(visible, pageIds);

  return {
    selected,
    isSelected: (id) => visible.has(id),
    toggle: (id) => setChecked((prev) => toggleId(prev, ids, id)),
    toggleAll: () => setChecked((prev) => toggleAllIds(prev, ids, pageIds)),
    clear: () => setChecked(new Set()),
    keep: (keepIds) => setChecked(new Set(pruneSelection(new Set(keepIds), ids))),
    allChecked,
    someChecked,
  };
}

import type { CatView } from './category';
import type { CatalogEntry, CatalogKind } from './entry';

export type CatalogSort = 'order' | 'popular';

/** 화면 탭 하나 = 진열대 하나 — 파츠 탭은 보통 파츠와 가챠 파츠를 한 줄로 보인다. */
export type ShelfKind = 'parts' | 'desks' | 'items';

/** 줄 종류 → 그 줄이 보이는 탭. */
export const shelfKindOf = (kind: CatalogKind): ShelfKind => (kind === 'gachaParts' ? 'parts' : kind);

/** 파츠 줄이 있는 종류 — 카테고리별로 묶는다. */
export const isPartsKind = (kind: CatalogKind | ShelfKind): boolean =>
  kind === 'parts' || kind === 'gachaParts';

/** 한 종류의 진열대 한 벌 — 줄 · 카테고리 · 진열대(범위별 번호). */
export interface CatalogShelf {
  /** 화면에 보일 순서대로. */
  entries: CatalogEntry[];
  /** 파츠 묶음 제목에 쓰는 카테고리. 파츠가 아닌 종류는 빈 목록. */
  categories: CatView[];
  /** 진열대 범위(`shelfScope`) → 서버가 붙인 번호. 번호가 없는 판(Firebase)은 빈 객체. */
  shelves: Record<string, number>;
}

/** 순서를 매기는 단위 — 파츠는 카테고리마다 · 책상 · 소품은 하나씩(서버 진열대 범위 이름). */
export function shelfScope(entry: Pick<CatalogEntry, 'kind' | 'cat'>): string {
  if (entry.kind === 'desks') return 'DESK';
  if (entry.kind === 'items') return 'DESK_PROP';
  return `CATEGORY:${entry.cat ?? ''}`;
}

/** 서버가 «행이 아직 없는 범위는 번호 0 의 빈 진열대» 라고 약속한 값. */
export const shelfVersion = (shelf: Pick<CatalogShelf, 'shelves'>, scope: string): number =>
  shelf.shelves[scope] ?? 0;

/** 받아 둔 진열대를 고치는 말 — 쓰기 포트가 돌려주고 화면 캐시가 그대로 적용한다(다시 받지 않는다). */
export type ListEdit =
  /** 줄 하나의 칸을 바꾼다. */
  | { op: 'update'; kind: CatalogKind; id: string; change: Partial<CatalogEntry> }
  /** 한 범위의 순서를 바꾼다 — 그 범위 줄이 차지한 자리를 새 순서로 다시 채우고 진열대 번호를 맞춘다. */
  | { op: 'order'; kind: CatalogKind; scope: string; ids: string[]; version: number }
  /** 줄을 뺀다. */
  | { op: 'drop'; kind: CatalogKind; ids: string[] }
  /** 서버가 새 번호를 정해서 줄 모양을 알 수 없다 — 그 종류를 다시 받는다. */
  | { op: 'refetch'; kind: CatalogKind }
  /** 충돌 — 포트가 이미 받아 온 최신 진열대(진열 순서)를 그대로 둔다. */
  | { op: 'seed'; kind: CatalogKind; shelf: CatalogShelf }
  /** 카테고리 하나를 바꾼다. */
  | { op: 'category'; cat: CatView }
  /** 충돌 — 포트가 이미 받아 온 최신 카테고리 전부. */
  | { op: 'categories'; categories: CatView[] };

/** 쓰기 포트의 결과 — 성공이든 충돌(남이 먼저 고침)이든 캐시에 적용할 말을 싣는다. */
export type CatalogEditResult =
  | { ok: true; /** 실제로 바뀐 것이 있다. */ changed: boolean; edits: ListEdit[] }
  | { ok: false; conflict: true; edits: ListEdit[] };

/** 진열대 한 벌에 말 하나를 적용한다(순수). `seed` · `refetch` 는 여기서 다루지 않는다. */
export function applyListEdit(shelf: CatalogShelf, edit: ListEdit): CatalogShelf {
  switch (edit.op) {
    case 'update':
      return {
        ...shelf,
        entries: shelf.entries.map((e) =>
          e.kind === edit.kind && e.id === edit.id ? { ...e, ...edit.change } : e,
        ),
      };
    case 'drop': {
      const gone = new Set(edit.ids);
      // 파츠는 parts · gachaParts 어느 통에 있든 같이 지운다 — 종류 없이 id 로 뺀다.
      return { ...shelf, entries: shelf.entries.filter((e) => !gone.has(e.id)) };
    }
    case 'order': {
      const inScope = (e: CatalogEntry) => shelfScope(e) === edit.scope;
      const scoped = shelf.entries.filter(inScope);
      const byId = new Map(scoped.map((e) => [e.id, e]));
      const listed = edit.ids.flatMap((id, i) => {
        const e = byId.get(id);
        return e ? [{ ...e, order: i }] : [];
      });
      // 순서에 없는 줄은 그 뒤에 원래 순서 그대로(서버도 «목록에 없는 물건은 맨 뒤» 로 본다).
      const named = new Set(listed.map((e) => e.id));
      const next = [...listed, ...scoped.filter((e) => !named.has(e.id))];
      let at = 0;
      return {
        ...shelf,
        entries: shelf.entries.map((e) => (inScope(e) ? next[at++] : e)),
        shelves: edit.version ? { ...shelf.shelves, [edit.scope]: edit.version } : shelf.shelves,
      };
    }
    case 'category':
      return { ...shelf, categories: shelf.categories.map((c) => (c.id === edit.cat.id ? edit.cat : c)) };
    case 'categories':
      return { ...shelf, categories: edit.categories };
    default:
      return shelf;
  }
}

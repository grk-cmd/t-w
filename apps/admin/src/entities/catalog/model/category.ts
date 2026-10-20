import { catalogPath, type CatalogWrite } from './catalog';

// 파츠 카테고리 — 기본 목록은 앱 app.js BUILTIN_PART_CATS · PART_GROUPS 와 같아야 한다(앱이 cat 식별자로 부착 본을 정한다).
export type CustomGroup = 'head' | 'cloth' | 'deco' | 'hand';
export type PartGroup = CustomGroup | 'desk';

export const PART_GROUPS: readonly { group: PartGroup; label: string; icon: string }[] = [
  { group: 'head', label: '머리', icon: '👤' },
  { group: 'cloth', label: '옷', icon: '👕' },
  { group: 'deco', label: '장식', icon: '🪽' },
  { group: 'hand', label: '손', icon: '✋' },
  { group: 'desk', label: '책상', icon: '🪑' },
];

export interface BuiltinCat {
  cat: string;
  label: string;
  icon: string;
  group: PartGroup;
}

export const BUILTIN_CATS: readonly BuiltinCat[] = [
  { cat: 'hat', label: '모자', icon: '🎩', group: 'head' },
  { cat: 'mask', label: '탈', icon: '🎭', group: 'head' },
  { cat: 'glasses', label: '안경', icon: '👓', group: 'head' },
  { cat: 'top', label: '상의', icon: '👕', group: 'cloth' },
  { cat: 'bottom', label: '하의', icon: '👖', group: 'cloth' },
  { cat: 'onepiece', label: '한벌옷', icon: '👗', group: 'cloth' },
  { cat: 'cape', label: '망토', icon: '🧣', group: 'cloth' },
  { cat: 'wing', label: '날개', icon: '🪽', group: 'deco' },
  { cat: 'handL', label: '왼손', icon: '🤚', group: 'hand' },
  { cat: 'handR', label: '오른손', icon: '✋', group: 'hand' },
  { cat: 'deskitem', label: '책상 위', icon: '🪑', group: 'desk' },
];

export const CUSTOM_CAT_ICON = '🏷️'; // 아이콘을 비우면 앱이 넣는 값
export const CAT_LABEL_MAX = 20; // 규칙 customCats · catOverrides label
export const ICON_MAX = 8; // 규칙 icon

export interface CustomCat {
  cat: string;
  label: string;
  icon?: string;
  group: string;
  bone?: string;
  createdAt?: number;
}

export interface CatOverride {
  label: string;
  icon?: string;
  updatedAt?: number;
}

/** 문제가 있으면 그 이유, 없으면 null. 기본 카테고리는 이름을 비우면 기본값으로 돌아가니 빈 이름도 받는다. */
export function categoryNameProblem(cat: CatView, label: string, icon: string): string | null {
  const text = label.trim();
  if (!text && !cat.builtin) return '이름을 넣어 주세요';
  if (text.length > CAT_LABEL_MAX) return `이름은 ${CAT_LABEL_MAX}자까지예요`;
  if (icon.trim().length > ICON_MAX) return `아이콘은 ${ICON_MAX}자까지예요`;
  return null;
}

/**
 * 이름 · 아이콘 저장 묶음. 기본 카테고리는 catOverrides 에 — 기본값과 같아지면 덮어쓰기를 지운다.
 * 커스텀은 제 항목의 두 필드만(규칙이 cat · group 을 요구하므로 통째로 쓰지 않는다). 아이콘을 비우면 앱과 같이 🏷️.
 */
export function categoryNameWrite(cat: CatView, label: string, icon: string, now: number): CatalogWrite {
  const text = label.trim();
  const mark = icon.trim();
  if (!cat.builtin) {
    return {
      [`${catalogPath('customCats', cat.id)}/label`]: text,
      [`${catalogPath('customCats', cat.id)}/icon`]: mark || CUSTOM_CAT_ICON,
    };
  }
  const sameLabel = !text || text === cat.defaultLabel;
  const sameIcon = !mark || mark === cat.defaultIcon;
  if (sameLabel && sameIcon) return { [catalogPath('catOverrides', cat.id)]: null };
  // 앱 rebuildPartCats 는 빈 label 을 기본값으로 읽지만 규칙이 label 을 요구한다 — 기본 이름을 그대로 넣는다.
  const value: CatOverride = { label: text || cat.defaultLabel, updatedAt: now };
  if (!sameIcon) value.icon = mark;
  return { [catalogPath('catOverrides', cat.id)]: value };
}

export interface CatView {
  /** DB 키 — 기본 카테고리는 cat 과 같다. */
  id: string;
  cat: string;
  label: string;
  icon: string;
  group: string;
  builtin: boolean;
  overridden: boolean;
  /** 덮어쓰기 전 이름 · 아이콘 — 커스텀은 빈 값. */
  defaultLabel: string;
  defaultIcon: string;
}

/** 앱 rebuildPartCats 와 같게 — 기본 카테고리에 덮어쓰기를 얹고 커스텀을 뒤에 붙인다. */
export function categoryViews(
  customCats: Record<string, CustomCat> = {},
  overrides: Record<string, CatOverride> = {},
): CatView[] {
  const builtin = BUILTIN_CATS.map((c): CatView => {
    const o = overrides[c.cat];
    const label = o?.label != null && String(o.label).trim() ? String(o.label) : c.label;
    const icon = o?.icon != null && String(o.icon).trim() ? String(o.icon) : c.icon;
    return {
      id: c.cat,
      cat: c.cat,
      label,
      icon,
      group: c.group,
      builtin: true,
      overridden: !!o,
      defaultLabel: c.label,
      defaultIcon: c.icon,
    };
  });
  const custom = Object.entries(customCats)
    .filter(([, c]) => c && typeof c === 'object')
    .map(([id, c]): CatView => ({
      id,
      cat: c.cat || id,
      label: c.label || id,
      icon: c.icon || CUSTOM_CAT_ICON,
      group: c.group || 'head',
      builtin: false,
      overridden: false,
      defaultLabel: '',
      defaultIcon: '',
    }));
  return [...builtin, ...custom];
}

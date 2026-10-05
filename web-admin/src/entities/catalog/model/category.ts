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

// 규칙 customCats .validate 가 받는 그룹 — 앱 화면은 책상 그룹에도 «추가» 가 있지만 규칙이 거절한다.
export const CUSTOM_GROUPS: readonly CustomGroup[] = ['head', 'cloth', 'deco', 'hand'];

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

export const BONES = ['head', 'spine', 'handL', 'handR'] as const;
export type Bone = (typeof BONES)[number];

// 앱 «추가» 폼이 그룹마다 미리 골라 두는 본.
export const DEFAULT_BONE: Record<CustomGroup, Bone> = {
  head: 'head',
  cloth: 'spine',
  deco: 'spine',
  hand: 'handR',
};

export const CUSTOM_CAT_ICON = '🏷️'; // 아이콘을 비우면 앱이 넣는 값
export const CAT_LABEL_MAX = 20; // 규칙 customCats · catOverrides label
export const CAT_ID_MAX = 20; // 규칙 customCats cat
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

/** 입력 → ID. 앱과 같이 소문자로 바꾸고 영문 소문자 · 숫자 · _ 밖의 글자는 버린다. */
export function normalizeCatId(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}

export interface CustomCatInput {
  id: string;
  label: string;
  icon: string;
  group: CustomGroup;
  bone: Bone;
}

/** 문제가 있으면 그 이유, 없으면 null. taken 은 기본 · 커스텀 카테고리 ID 전부. */
export function customCatProblem(input: CustomCatInput, taken: ReadonlySet<string>): string | null {
  const label = input.label.trim();
  if (!label) return '이름을 넣어 주세요';
  if (label.length > CAT_LABEL_MAX) return `이름은 ${CAT_LABEL_MAX}자까지예요`;
  if (!input.id) return 'ID 를 넣어 주세요';
  if (!/^[a-z][a-z0-9_]*$/.test(input.id)) return 'ID 는 영문 소문자로 시작해요';
  if (input.id.length > CAT_ID_MAX) return `ID 는 ${CAT_ID_MAX}자까지예요`;
  if (taken.has(input.id)) return '이미 있는 ID 예요';
  if (input.icon.trim().length > ICON_MAX) return `아이콘은 ${ICON_MAX}자까지예요`;
  return null;
}

export function customCatWrite(input: CustomCatInput, now: number): CatalogWrite {
  return {
    [catalogPath('customCats', input.id)]: {
      cat: input.id,
      label: input.label.trim(),
      icon: input.icon.trim() || CUSTOM_CAT_ICON,
      group: input.group,
      bone: input.bone,
      createdAt: now,
    },
  };
}

export function removeCustomCatsWrite(ids: readonly string[]): CatalogWrite {
  return Object.fromEntries(ids.map((id) => [catalogPath('customCats', id), null]));
}

export function overrideProblem(label: string, icon: string): string | null {
  const text = label.trim();
  if (!text) return '이름을 넣어 주세요';
  if (text.length > CAT_LABEL_MAX) return `이름은 ${CAT_LABEL_MAX}자까지예요`;
  if (icon.trim().length > ICON_MAX) return `아이콘은 ${ICON_MAX}자까지예요`;
  return null;
}

/** 기본 카테고리 이름 · 아이콘 덮어쓰기. 아이콘을 비우면 앱과 같이 키를 두지 않아 기본 아이콘을 쓴다. */
export function overrideWrite(cat: string, label: string, icon: string, now: number): CatalogWrite {
  const value: CatOverride = { label: label.trim(), updatedAt: now };
  if (icon.trim()) value.icon = icon.trim();
  return { [catalogPath('catOverrides', cat)]: value };
}

export function revertOverridesWrite(cats: readonly string[]): CatalogWrite {
  return Object.fromEntries(cats.map((cat) => [catalogPath('catOverrides', cat), null]));
}

export interface CatView {
  cat: string;
  label: string;
  icon: string;
  group: string;
  builtin: boolean;
  overridden: boolean;
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
    return { cat: c.cat, label, icon, group: c.group, builtin: true, overridden: !!o };
  });
  const custom = Object.entries(customCats)
    .filter(([, c]) => c && typeof c === 'object')
    .map(([id, c]): CatView => ({
      cat: c.cat || id,
      label: c.label || id,
      icon: c.icon || CUSTOM_CAT_ICON,
      group: c.group || 'head',
      builtin: false,
      overridden: false,
    }));
  return [...builtin, ...custom];
}

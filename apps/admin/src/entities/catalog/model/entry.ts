import { catalogPath, type CatalogWrite } from './catalog';

/** glb 를 가진 카탈로그 종류 — 항목 하나가 파츠 · 책상 · 아이템 하나다. */
export type CatalogKind = 'parts' | 'gachaParts' | 'desks' | 'items';

export const KIND_LABEL: Record<CatalogKind, string> = {
  parts: '파츠',
  gachaParts: '가챠 파츠',
  desks: '책상',
  items: '아이템',
};

/** DB 의 항목 그대로 — 옛 항목은 glb · thumbnail 에 base64 가 들어 있다. */
export type CatalogRecord = Record<string, unknown>;

export interface CatalogEntry {
  kind: CatalogKind;
  id: string;
  name: string;
  icon: string;
  /** 파츠 카테고리. 책상 · 아이템은 null. */
  cat: string | null;
  order: number | null;
  /** 목록에 보일 썸네일 주소(https 또는 data:image). */
  thumb: string | null;
  /** 지울 때 같이 지울 Storage 파일 — catalog/ 아래 파일만. */
  files: string[];
  /** glb base64 가 DB 에 남아 있음. */
  base64: boolean;
  /** catalog/parts 에 gacha:true 로 남은 옛 가챠 항목 — 규칙이 이 항목의 쓰기를 거절한다. */
  legacyGacha: boolean;
}

export const NO_ORDER = 9999; // 앱 merge 정렬 — order 가 없으면 뒤로

const str = (v: unknown) => (typeof v === 'string' ? v : '');

// 로컬 호스트는 Storage 에뮬레이터 주소(e2e) — 에뮬레이터에 붙은 SDK 는 googleapis 주소를 제 것으로 못 알아본다.
const STORAGE_HOSTS = ['firebasestorage.googleapis.com', '127.0.0.1', 'localhost'];

/** 다운로드 URL → Storage 안 경로. catalog/ 아래 파일이 아니면 null — 그 밖의 주소는 지우지 않는다. */
export function catalogFilePath(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    const m = u.pathname.match(/^\/v0\/b\/[^/]+\/o\/(.+)$/);
    const path = m && STORAGE_HOSTS.includes(u.hostname) ? decodeURIComponent(m[1]) : '';
    return path.startsWith('catalog/') ? path : null;
  } catch {
    return null;
  }
}

export const isCatalogFileUrl = (url: unknown): url is string => catalogFilePath(url) !== null;

function thumbOf(rec: CatalogRecord): string | null {
  const url = str(rec.thumbUrl);
  if (/^https:\/\//.test(url)) return url;
  const data = str(rec.thumbnail);
  return data.startsWith('data:image/') ? data : null;
}

export function toEntry(kind: CatalogKind, id: string, rec: CatalogRecord): CatalogEntry {
  return {
    kind,
    id,
    name: str(rec.name),
    icon: str(rec.icon),
    cat: kind === 'parts' || kind === 'gachaParts' ? str(rec.cat) || null : null,
    order: typeof rec.order === 'number' ? rec.order : null,
    thumb: thumbOf(rec),
    files: [rec.glbUrl, rec.thumbUrl].filter(isCatalogFileUrl),
    base64: !!str(rec.glb),
    legacyGacha: kind === 'parts' && rec.gacha === true,
  };
}

/** 앱과 같은 진열 순서 — order 오름차순, 없으면 뒤로. 같으면 키 순. */
export function catalogEntries(kind: CatalogKind, raw: Record<string, CatalogRecord>): CatalogEntry[] {
  return Object.entries(raw)
    .filter(([, rec]) => rec && typeof rec === 'object')
    .map(([id, rec]) => toEntry(kind, id, rec))
    .sort(
      (a, b) => (a.order ?? NO_ORDER) - (b.order ?? NO_ORDER) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
}

/** 끌어 놓기 — 앱 reorderSavedPart 와 같게 끌던 것을 빼고 놓은 자리에 넣는다. */
export function moveId(ids: readonly string[], dragged: string, target: string): string[] {
  const from = ids.indexOf(dragged);
  const to = ids.indexOf(target);
  if (from < 0 || to < 0 || from === to) return [...ids];
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, dragged);
  return next;
}

/**
 * 새 순서대로 order = 0,1,2… 중 값이 바뀌는 항목만. 반드시 제 종류 경로에 쓴다 —
 * 가챠 파츠를 catalog/parts/{id}/order 로 쓰면 {order} 만 있는 항목이 생겨 규칙에 걸리고 묶음 전체가 거절된다.
 * 옛 가챠 항목(parts 의 gacha:true)은 규칙이 어떤 쓰기도 받지 않아 뺀다.
 */
export function orderWrite(ordered: readonly CatalogEntry[]): CatalogWrite {
  const out: CatalogWrite = {};
  ordered.forEach((e, i) => {
    if (!e.legacyGacha && e.order !== i) out[`${catalogPath(e.kind, e.id)}/order`] = i;
  });
  return out;
}

/** 파츠는 앱 unpublishPart 처럼 parts · gachaParts 양쪽을 지운다(어느 통에 있든). 없는 쪽 지우기는 아무 일도 안 한다. */
export function removeEntriesWrite(kind: CatalogKind, ids: readonly string[]): CatalogWrite {
  const kinds: CatalogKind[] = kind === 'parts' || kind === 'gachaParts' ? ['parts', 'gachaParts'] : [kind];
  return Object.fromEntries(ids.flatMap((id) => kinds.map((k) => [catalogPath(k, id), null])));
}

export const NAME_MAX = 30; // 규칙 name
export const ENTRY_ICON_MAX = 8; // 규칙 icon

export function entryInfoProblem(name: string, icon: string): string | null {
  const text = name.trim();
  if (!text) return '이름을 넣어 주세요';
  if (text.length > NAME_MAX) return `이름은 ${NAME_MAX}자까지예요`;
  if (icon.trim().length > ENTRY_ICON_MAX) return `아이콘은 ${ENTRY_ICON_MAX}자까지예요`;
  return null;
}

/**
 * 바뀐 필드만 쓴다 — glb · glbUrl 같은 나머지 필드는 그대로라 규칙 .validate(항목 전체를 본다)를 그대로 통과한다.
 * 아이콘을 비우면 키를 지우지 않고 '' 로 쓴다 — 규칙이 icon 이 없는 항목을 거절한다.
 */
export function entryInfoWrite(entry: CatalogEntry, name: string, icon: string): CatalogWrite {
  const base = catalogPath(entry.kind, entry.id);
  const out: CatalogWrite = {};
  if (name.trim() !== entry.name) out[`${base}/name`] = name.trim();
  if (icon.trim() !== entry.icon) out[`${base}/icon`] = icon.trim();
  return out;
}

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

/** 다운로드 URL 이 Storage 의 catalog/ 아래 파일인지 — 그 밖의 주소는 지우지 않는다. */
export function isCatalogFileUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    const m = u.pathname.match(/^\/v0\/b\/[^/]+\/o\/(.+)$/);
    return STORAGE_HOSTS.includes(u.hostname) && !!m && decodeURIComponent(m[1]).startsWith('catalog/');
  } catch {
    return false;
  }
}

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

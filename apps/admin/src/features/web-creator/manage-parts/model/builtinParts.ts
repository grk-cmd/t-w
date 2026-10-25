import {
  listWebParts,
  PART_LANGS,
  WEB_PART_SLOTS,
  type PartNames,
  type WebPart,
  type WebPartSlot,
} from '@/entities/web-creator/part';
import type { Api } from '@/shared/api';
import { savePart } from './savePart';
import manifest from '../builtin/manifest.json';

/* 홈페이지 코드에 도형으로 있던 기본 파츠를 서버 상품으로 옮기는 한 번짜리 가져오기.
   그림 · 목록은 apps/web/scripts/export-builtin-parts.mjs 가 뽑은 것(builtin/) — 동공 · «없음» · 처음 얼굴은 코드에 남는다. */

/** 옮길 기본 파츠 하나 */
export interface BuiltinPart {
  key: string;
  slot: WebPartSlot;
  name: PartNames;
  w: number;
  h: number;
  file: string;
  closedFile: string | null;
}

const isSlot = (v: unknown): v is WebPartSlot =>
  typeof v === 'string' && (WEB_PART_SLOTS as readonly string[]).includes(v);

/** 목록 파일 검사 — 뽑기 도구가 틀린 것을 내면 가져오기 전에 드러나게 */
export function parseManifest(raw: unknown): BuiltinPart[] {
  if (!Array.isArray(raw)) throw new Error('기본 파츠 목록 모양이 달라요');
  return raw.map((v: Record<string, unknown>, i) => {
    const name = v.name as Record<string, unknown> | undefined;
    const ok =
      typeof v.key === 'string' &&
      isSlot(v.slot) &&
      PART_LANGS.every((l) => typeof name?.[l] === 'string') &&
      typeof v.w === 'number' &&
      typeof v.h === 'number' &&
      typeof v.file === 'string' &&
      (v.closedFile === null || typeof v.closedFile === 'string');
    if (!ok) throw new Error(`기본 파츠 목록 ${i}번 줄 모양이 달라요`);
    return v as unknown as BuiltinPart;
  });
}

export const BUILTIN_PARTS: readonly BuiltinPart[] = parseManifest(manifest);

/** base64 data 주소 → 바이트 */
export function bytesFromDataUrl(url: string): Uint8Array {
  return Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), (c) => c.charCodeAt(0));
}

/** 이미 서버에 있는가 — 같은 자리 · 같은 한국어 이름(이 화면이 고칠 수 있는 조각 하나짜리만 견준다) */
const sameAs = (b: BuiltinPart) => (p: WebPart) => p.piece?.slot === b.slot && p.name.ko === b.name.ko;

/** 아직 서버에 없는 기본 파츠 */
export function missingBuiltins(existing: readonly WebPart[], all: readonly BuiltinPart[] = BUILTIN_PARTS) {
  return all.filter((b) => !existing.some(sameAs(b)));
}

/** 서버 목록(단종 포함)을 새로 읽어 없는 것만 차례로 초안으로 올린다 — 다시 눌러도 겹치지 않는다. 올린 수를 돌려준다 */
export async function importBuiltins(
  api: Api | null,
  loadBytes: (file: string) => Promise<Uint8Array>,
  onProgress: (done: number, total: number) => void = () => {},
  all: readonly BuiltinPart[] = BUILTIN_PARTS,
): Promise<number> {
  const [live, archived] = await Promise.all([listWebParts(api), listWebParts(api, true)]);
  const todo = missingBuiltins([...live, ...archived], all);
  let done = 0;
  onProgress(done, todo.length);
  for (const b of todo) {
    await savePart(api, {
      part: null,
      draft: { slot: b.slot, name: { ...b.name }, w: b.w, h: b.h },
      image: await loadBytes(b.file),
      closedImage: b.closedFile ? await loadBytes(b.closedFile) : undefined,
    });
    onProgress(++done, todo.length);
  }
  return done;
}

import {
  base64CleanupWrite,
  catalogCommit,
  catalogPath,
  type CatalogWrite,
  type CleanupTarget,
} from '@/entities/catalog';
import type { Db } from '@/shared/api';

export interface CleanBase64Result {
  cleaned: CleanupTarget[];
  /** 미리보기 뒤 glbUrl 이 사라져 건드리지 않은 항목. */
  skipped: CleanupTarget[];
  written: CatalogWrite;
}

// 한꺼번에 몰지 않는다 — 다른 일괄 동작과 같은 20개씩.
const CHUNK = 20;

/**
 * 미리 보여 준 대상의 glb 필드만 한 묶음으로 지운다. 보여 준 뒤 항목이 바뀌었을 수 있어
 * 지우기 직전에 glbUrl 한 칸씩만(작은 문자열) 다시 읽고, 아직 있는 항목만 지운다 — 원본이 DB 뿐인 항목은 절대 안 건드린다.
 */
export async function cleanBase64(db: Db, targets: readonly CleanupTarget[]): Promise<CleanBase64Result> {
  const urls: unknown[] = [];
  for (let i = 0; i < targets.length; i += CHUNK) {
    urls.push(
      ...(await Promise.all(
        targets.slice(i, i + CHUNK).map((t) => db.get<unknown>(`${catalogPath(t.kind, t.id)}/glbUrl`)),
      )),
    );
  }
  const hasUrl = (i: number) => typeof urls[i] === 'string' && urls[i] !== '';
  const cleaned = targets.filter((_, i) => hasUrl(i));
  const skipped = targets.filter((_, i) => !hasUrl(i));
  const written = base64CleanupWrite(cleaned);
  await catalogCommit(db, written);
  return { cleaned, skipped, written };
}

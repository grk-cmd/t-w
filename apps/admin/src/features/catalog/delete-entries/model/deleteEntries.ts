import {
  catalogCommit,
  catalogFilePath,
  removeEntriesWrite,
  type CatalogEntry,
  type CatalogWrite,
} from '@/entities/catalog';
import { countTarget, withAudit, type Db, type Files } from '@/shared/api';

export interface DeleteEntriesResult {
  removed: number;
  /** 지우지 못하고 남은 Storage 파일 수 — 항목은 이미 지워졌다. */
  filesLeft: number;
  written: CatalogWrite;
}

// 한꺼번에 몰지 않는다 — 다른 일괄 동작과 같은 20개씩.
const FILE_CHUNK = 20;

/**
 * 항목을 한 묶음으로 지운 뒤 Storage 파일(glb · 썸네일)을 지운다. DB 가 먼저다 —
 * 거꾸로 하면 DB 가 실패했을 때 모든 사용자에게 깨진 주소가 남는다. 이 순서면 최악이 «주인 없는 파일» 이다.
 * 남는 항목(rest)이 같은 파일을 가리키면 그 파일은 두고 셈에서도 뺀다.
 */
export async function deleteEntries(
  db: Db,
  files: Files,
  entries: readonly CatalogEntry[],
  rest: readonly CatalogEntry[] = [],
): Promise<DeleteEntriesResult> {
  if (!entries.length) return { removed: 0, filesLeft: 0, written: {} };
  const written = removeEntriesWrite(
    entries[0].kind,
    entries.map((e) => e.id),
  );
  const target = `${entries[0].kind} ${entries.length}개`;
  await catalogCommit(
    db,
    withAudit(db, written, 'catalog.delete', target, countTarget(entries.map((e) => e.name || e.id))),
  );

  const removing = new Set(entries.map((e) => e.id));
  const inUse = new Set(rest.filter((e) => !removing.has(e.id)).flatMap((e) => e.files.map(catalogFilePath)));
  const byPath = new Map(entries.flatMap((e) => e.files.map((url) => [catalogFilePath(url), url] as const)));
  const urls = [...byPath].filter(([path]) => !inUse.has(path)).map(([, url]) => url);
  let filesLeft = 0;
  for (let i = 0; i < urls.length; i += FILE_CHUNK) {
    const results = await Promise.allSettled(
      urls.slice(i, i + FILE_CHUNK).map((url) => files.deleteByUrl(url)),
    );
    filesLeft += results.filter((r) => r.status === 'rejected').length;
  }
  return { removed: entries.length, filesLeft, written };
}

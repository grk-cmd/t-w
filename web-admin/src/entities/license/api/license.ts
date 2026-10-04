import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';
import { genLicenseKey, NOTE_MAX, type License } from '../model/license';

const LICENSES_KEY = ['licenses'];

// licenses 는 통째로 받는 노드다(요금 = 내려받은 바이트) — 구독하지 않고 캐시해 두었다가 쓰기 직후에만 다시 받는다.
export async function listLicenses(db: Db): Promise<Record<string, License>> {
  return (await db.get<Record<string, License>>('licenses')) ?? {};
}

export function useLicenses() {
  const db = useDb();
  return useQuery({ queryKey: LICENSES_KEY, queryFn: () => listLicenses(db) });
}

export function useRefreshLicenses() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: LICENSES_KEY });
}

/** 새 키 한 장을 쓸 내용. 다른 쓰기와 한 묶음(db.commit)으로 보낼 수 있게 경로 → 값으로 돌려준다. */
export function newLicenseWrite(db: Db, note: string, genKey: () => string = genLicenseKey) {
  const key = genKey();
  const write = {
    [`licenses/${key}`]: {
      valid: true,
      note: note.slice(0, NOTE_MAX),
      createdAt: db.now(),
      redeemedAt: null,
    },
  };
  return { key, write };
}

export async function createLicense(db: Db, note: string, genKey?: () => string): Promise<string> {
  const { key, write } = newLicenseWrite(db, note, genKey);
  await db.commit(write);
  return key;
}

/** 여러 키 회수 — 한 묶음(db.commit)으로 보낼 경로 → 값. */
export function revokeLicensesWrite(db: Db, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    out[`licenses/${key}/valid`] = false;
    out[`licenses/${key}/revokedAt`] = db.now();
  }
  return out;
}

export function removeLicensesWrite(keys: readonly string[]): Record<string, null> {
  return Object.fromEntries(keys.map((key) => [`licenses/${key}`, null]));
}

export function revokeLicense(db: Db, key: string): Promise<void> {
  return db.update(`licenses/${key}`, { valid: false, revokedAt: db.now() });
}

export function removeLicense(db: Db, key: string): Promise<void> {
  return db.remove(`licenses/${key}`);
}

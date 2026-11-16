import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';
import {
  gotFromOf,
  lettersOf,
  ornamentOf,
  reportsOf,
  type AdminLetter,
  type Ornament,
  type XmasReport,
} from '../model/xmas';

const ROOT = ['xmas'];
const AUTHORS_KEY = [...ROOT, 'authors'];
const lettersKey = (uid: string) => [...ROOT, 'letters', uid];
const REPORTS_KEY = [...ROOT, 'reports'];

/** 편지를 맡긴 사람 — 키 이름만(값은 안 받는다 · 사람마다 편지 다섯 통이라 통째로 받으면 수 MB). */
export async function listLetterAuthors(db: Db): Promise<string[]> {
  return (await db.shallowKeys('xmasLetters')).sort();
}
export function useLetterAuthors() {
  const db = useDb();
  return useQuery({ queryKey: AUTHORS_KEY, queryFn: () => listLetterAuthors(db) });
}

/** 한 사람의 편지 — 목록에 보이는 사람만 읽는다. */
export async function getUserLetters(db: Db, uid: string): Promise<AdminLetter[]> {
  return lettersOf(uid, await db.get<unknown>(`xmasLetters/${uid}`));
}
export function useUserLetters(uid: string) {
  const db = useDb();
  return useQuery({ queryKey: lettersKey(uid), queryFn: () => getUserLetters(db, uid) });
}

/** 신고 — 관리자만 읽는 작은 노드(신고 한 줄 수십 바이트 · 처리하면 지운다)라 통째로. */
export async function listXmasReports(db: Db): Promise<XmasReport[]> {
  return reportsOf(await db.get<unknown>('xmasReports'));
}
export function useXmasReports() {
  const db = useDb();
  return useQuery({ queryKey: REPORTS_KEY, queryFn: () => listXmasReports(db) });
}

/** 신고된 장식 한 자리 — 목록 · 그림 · 건 사람(셋 다 관리자 읽기). 이미 지워졌으면 null. */
export async function getOrnament(db: Db, tree: number, slot: number): Promise<Ornament | null> {
  const [o, img, owner] = await Promise.all([
    db.get<unknown>(`xmasTrees/${tree}/o/${slot}`),
    db.get<unknown>(`xmasImg/${tree}/${slot}`),
    db.get<unknown>(`xmasOwners/${tree}/${slot}`),
  ]);
  return ornamentOf(o, img, owner);
}
export function useOrnament(tree: number, slot: number) {
  const db = useDb();
  return useQuery({
    queryKey: [...REPORTS_KEY, 'orn', tree, slot],
    queryFn: () => getOrnament(db, tree, slot),
  });
}

/**
 * 신고된 받은 편지 — 받은 편지 본문(xmasGot)은 받은 사람만 읽는다. 보낸 사람 칸(xmasGotFrom)으로 쓴 사람의 편지(xmasLetters)를 읽는다
 * (마감 뒤라 바뀌지 않는다). 찾지 못하면 null.
 */
export async function getReportedLetter(db: Db, got: string, n: number): Promise<AdminLetter | null> {
  const from = gotFromOf(await db.get<unknown>(`xmasGotFrom/${got}/${n}`));
  if (!from) return null;
  const box = await db.get<unknown>(`xmasLetters/${from.from}/${from.lid}`);
  return lettersOf(from.from, { [from.lid]: box })[0] ?? null;
}
export function useReportedLetter(got: string, n: number) {
  const db = useDb();
  return useQuery({
    queryKey: [...REPORTS_KEY, 'got', got, n],
    queryFn: () => getReportedLetter(db, got, n),
  });
}

export function useRefreshXmas() {
  const client = useQueryClient();
  return {
    authors: () => client.invalidateQueries({ queryKey: AUTHORS_KEY }),
    letters: (uid: string) => client.invalidateQueries({ queryKey: lettersKey(uid) }),
    reports: () => client.invalidateQueries({ queryKey: REPORTS_KEY }),
  };
}

/** 처리한 신고는 캐시에서만 뺀다 — 목록을 다시 받지 않아도 된다. */
export function useForgetXmasReport() {
  const client = useQueryClient();
  return (key: string) =>
    client.setQueryData<XmasReport[]>(REPORTS_KEY, (all) => all?.filter((r) => r.key !== key));
}

/** 서버 시각(ms) — 반송 마감을 이 기기 시계가 아니라 서버로 본다. 받기 전엔 null. */
export function useXmasServerNow(): number | null {
  const db = useDb();
  const q = useQuery({ queryKey: [...ROOT, 'offset'], queryFn: () => db.serverTimeOffset() });
  return q.data == null ? null : Date.now() + q.data;
}

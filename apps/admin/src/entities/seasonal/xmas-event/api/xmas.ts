import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi, useEnv, type Api } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import {
  authorsPageOf,
  bucketOf,
  clockOf,
  lettersOf,
  reportDetailOf,
  reportsOf,
  type AdminLetter,
  type LetterAuthor,
  type ReportDetail,
  type XmasClock,
  type XmasReport,
} from '../model/xmas';

const ROOT = ['xmas'];
const AUTHORS_KEY = [...ROOT, 'authors'];
const lettersKey = (userCode: string) => [...ROOT, 'letters', userCode];
const REPORTS_KEY = [...ROOT, 'reports'];
const BASE = '/v2/admin/xmas';
const AUTHORS_PAGE = 100; // 서버 상한
const AUTHORS_MAX_PAGES = 100; // 1만 명 — 끝없이 돌지 않게

/** 이 환경에는 API 가 없다(dev · e2e) — 크리스마스는 자체 서버에만 있다(옛 RTDB · 함수는 걷었다) */
export class NoApiError extends Error {
  constructor() {
    super('이 환경에는 자체 서버 API 가 없어 크리스마스를 볼 수 없어요(운영 관리자에서만)');
    this.name = 'NoApiError';
  }
}
/** 화면 실패 글 — API 가 없는 환경이면 그 까닭을, 아니면 공용 글(errorMessage) */
export const xmasErrorMessage = (error: unknown, fallback: string) =>
  error instanceof NoApiError ? error.message : errorMessage(error, fallback);
export const needApi = (api: Api | null): Api => {
  if (!api) throw new NoApiError();
  return api;
};
const enc = encodeURIComponent;

/** 편지를 맡긴 사람 전부 — 키셋 쪽을 끝까지(사람 수만큼 · 편지 글은 안 받는다). */
export async function listLetterAuthors(api: Api | null): Promise<LetterAuthor[]> {
  const out: LetterAuthor[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < AUTHORS_MAX_PAGES; i++) {
    const p = authorsPageOf(
      await needApi(api).get<unknown>(`${BASE}/letter-authors`, { cursor, limit: AUTHORS_PAGE }),
    );
    out.push(...p.items);
    if (!p.next) break;
    cursor = p.next;
  }
  return out;
}
export function useLetterAuthors() {
  const api = useApi();
  return useQuery({ queryKey: AUTHORS_KEY, queryFn: () => listLetterAuthors(api) });
}

/** 한 사람의 편지 — 목록에 보이는 사람만 읽는다. */
export async function getUserLetters(api: Api | null, userCode: string): Promise<AdminLetter[]> {
  const d = await needApi(api).get<{ letters?: unknown }>(`${BASE}/letters/${enc(userCode)}`);
  return lettersOf(userCode, d?.letters);
}
export function useUserLetters(userCode: string) {
  const api = useApi();
  return useQuery({ queryKey: lettersKey(userCode), queryFn: () => getUserLetters(api, userCode) });
}

/** 신고 — 대상마다 한 줄 · 신고 수 많은 순(서버가 정렬). */
export async function listXmasReports(api: Api | null): Promise<XmasReport[]> {
  const d = await needApi(api).get<{ items?: unknown }>(`${BASE}/reports`);
  return reportsOf(d?.items);
}
export function useXmasReports() {
  const api = useApi();
  return useQuery({ queryKey: REPORTS_KEY, queryFn: () => listXmasReports(api) });
}

/** 한 대상의 신고 — 장식(그림 · 건 사람 · 판) 또는 받은 편지(쓴 사람) · 신고한 사람 · 메모. */
export async function getReportDetail(api: Api | null, key: string, bucket: string): Promise<ReportDetail> {
  return reportDetailOf(await needApi(api).get<unknown>(`${BASE}/reports/${enc(key)}`), bucket);
}
export function useReportDetail(key: string) {
  const api = useApi();
  const bucket = bucketOf(useEnv().projectId);
  return useQuery({
    queryKey: [...REPORTS_KEY, 'detail', key],
    queryFn: () => getReportDetail(api, key, bucket),
  });
}

export function useRefreshXmas() {
  const client = useQueryClient();
  return {
    authors: () => client.invalidateQueries({ queryKey: AUTHORS_KEY }),
    letters: (userCode: string) => client.invalidateQueries({ queryKey: lettersKey(userCode) }),
    reports: () => client.invalidateQueries({ queryKey: REPORTS_KEY }),
  };
}

/** 처리한 신고는 캐시에서만 뺀다 — 목록을 다시 받지 않아도 된다. */
export function useForgetXmasReport() {
  const client = useQueryClient();
  return (key: string) =>
    client.setQueryData<XmasReport[]>(REPORTS_KEY, (all) => all?.filter((r) => r.key !== key));
}

/** 서버 시각 · 반송 마감 — 요약(GET /v2/admin/xmas)으로. 30초마다 다시 읽어 화면을 연 채 마감을 넘겨도 단추가 닫힌다. 받기 전엔 null. */
export function useXmasClock(): XmasClock | null {
  const api = useApi();
  const q = useQuery({
    queryKey: [...ROOT, 'clock'],
    queryFn: async () => clockOf(await needApi(api).get<unknown>(BASE)),
    refetchInterval: 30000,
  });
  return q.data ?? null;
}

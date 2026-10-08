import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';
import { DAY_MS, kstDateKey, kstDayStart } from '@/shared/lib';
import {
  bugDay,
  BUG_LIST,
  BUG_PAGE,
  BUG_ROOT,
  dayOrder,
  filterKey,
  shortNo,
  toAnswers,
  toBugItem,
  toBugPage,
  type BugAnswer,
  type BugContent,
  type BugCursor,
  type BugFilter,
  type BugItem,
  type BugPage,
} from '../model/bugBoard';

const BUG_KEY = ['bugBoard'];
// 하루 순번을 셀 때 한 날짜에서 받을 쪽 수 상한 — 하루 제보가 이걸 넘으면 앞쪽 번호는 «?».
const DAY_PAGES_MAX = 10;

/** 목록 한 쪽(≤ 20) — 규칙이 limitToLast ≤ 20 쿼리만 받는다. 통째로 받지 않는다. */
export async function listBugPage(db: Db, filter: BugFilter, before: BugCursor | null): Promise<BugPage> {
  const key = filterKey(filter);
  const raw = await db.getLast<unknown>(
    BUG_LIST,
    key,
    BUG_PAGE,
    before ? { endBefore: { value: before.value, key: before.key } } : undefined,
  );
  return toBugPage(raw, key);
}

export function useBugPage(filter: BugFilter, before: BugCursor | null) {
  const db = useDb();
  return useQuery({
    queryKey: [...BUG_KEY, 'list', filter, before?.value ?? null, before?.key ?? null],
    queryFn: () => listBugPage(db, filter, before),
    placeholderData: keepPreviousData,
  });
}

export async function getBugItem(db: Db, id: string): Promise<BugItem | null> {
  return toBugItem(id, await db.get<unknown>(`${BUG_LIST}/${id}`));
}

/** 그날(서울) 올라온 글의 순번 — ts 범위 쿼리로 그날 것만, 20개씩 거슬러 받는다. */
export async function getDayOrder(db: Db, day: string): Promise<Map<string, number>> {
  const start = kstDayStart(day);
  const all: Record<string, unknown> = {};
  let before = { value: start + DAY_MS } as { value: number; key?: string };
  for (let i = 0; i < DAY_PAGES_MAX; i++) {
    const got = await db.getLast<unknown>(BUG_LIST, 'ts', BUG_PAGE, { startAt: start, endBefore: before });
    Object.assign(all, got);
    const entries = Object.entries(got);
    if (entries.length < BUG_PAGE) return dayOrder(all);
    const [oldestId, oldest] = entries
      .map(([id, v]) => [id, Number((v as { ts?: unknown } | null)?.ts)] as const)
      .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1))[0];
    before = { value: oldest, key: oldestId };
  }
  // 상한까지 받고도 남았다 — 앞쪽 순번을 모르니 아무 번호도 주지 않는다(틀린 번호보다 «?»).
  return new Map();
}

/** 지난 날짜는 글이 더 붙지 않으니 다시 받지 않는다. 오늘은 새로고침 때 다시. */
export function useDayOrder(day: string) {
  const db = useDb();
  return useQuery({
    queryKey: [...BUG_KEY, 'day', day],
    queryFn: () => getDayOrder(db, day),
    staleTime: () => (day < kstDateKey(Date.now()) ? Infinity : 0),
  });
}

/** 화면용 짧은 번호 «B-MMDD-n» — 그날 순번을 받기 전엔 «B-MMDD-?». */
export function useShortNo(item: Pick<BugItem, 'id' | 'ts'>): string {
  const order = useDayOrder(bugDay(item.ts));
  return shortNo(item.ts, order.data?.get(item.id));
}

/** 비공개 글 제목 — 목록에는 없어서 prv 에서 제목 칸만 읽는다(관리자 읽기 허용). */
export function usePrvTitle(item: BugItem) {
  const db = useDb();
  return useQuery({
    queryKey: [...BUG_KEY, 'prvTitle', item.id],
    queryFn: async () => (await db.get<string>(`${BUG_ROOT}/prv/${item.authUid}/${item.id}/title`)) ?? '',
    enabled: item.vis === 'prv',
    staleTime: Infinity,
  });
}

export interface BugPost {
  item: BugItem;
  content: BugContent | null;
  answers: BugAnswer[];
}

/** 상세 — 목록 줄 · 내용 · 답변. 공개 글이 아니면 공개 답변 칸은 읽지 않는다(있을 수 없다). */
export async function getBugPost(db: Db, id: string): Promise<BugPost | null> {
  const item = await getBugItem(db, id);
  if (!item) return null;
  const contentPath = item.vis === 'pub' ? `${BUG_ROOT}/pub/${id}` : `${BUG_ROOT}/prv/${item.authUid}/${id}`;
  const [content, pub, prv] = await Promise.all([
    db.get<BugContent>(contentPath),
    item.vis === 'pub' ? db.get<unknown>(`${BUG_ROOT}/ans/pub/${id}`) : Promise.resolve(null),
    db.get<unknown>(`${BUG_ROOT}/ans/prv/${id}`),
  ]);
  return { item, content, answers: toAnswers(pub, prv) };
}

export function useBugPost(id: string | null) {
  const db = useDb();
  return useQuery({
    queryKey: [...BUG_KEY, 'post', id],
    queryFn: () => getBugPost(db, id as string),
    enabled: !!id,
  });
}

/** 목록 · 상세 · 오늘 순번을 다시 받는다(지난 날짜 순번 · 비공개 제목은 그대로). */
export function useRefreshBugBoard() {
  const client = useQueryClient();
  return () =>
    client.invalidateQueries({
      queryKey: BUG_KEY,
      predicate: (q) => {
        const [, kind, arg] = q.queryKey;
        return kind === 'list' || kind === 'post' || (kind === 'day' && arg === kstDateKey(Date.now()));
      },
    });
}

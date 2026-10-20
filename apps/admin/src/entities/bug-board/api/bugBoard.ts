import {
  keepPreviousData,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  REPLICA_LAG_MS,
  useApi,
  useDb,
  viaApiOr,
  withAudit,
  type Api,
  type ApiFallback,
  type Db,
} from '@/shared/api';
import { DAY_MS, kstDateKey, kstDayStart } from '@/shared/lib';
import {
  bugDay,
  bugListFromApi,
  bugNo,
  BUG_DAILY_MAX_DEFAULT,
  BUG_DAILY_MAX_PATH,
  BUG_LIST,
  BUG_PAGE,
  BUG_ROOT,
  dayOrder,
  filterKey,
  toAnswers,
  toBugItem,
  toBugPage,
  type ApiBugPage,
  type BugAnswer,
  type BugContent,
  type BugCursor,
  type BugFilter,
  type BugItem,
  type BugListView,
  type BugNo,
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

export interface BugListQuery {
  filter: BugFilter;
  /** API(쪽 번호)로 읽을 때 — 1부터. */
  page: number;
  size: number;
  /** 예전 방식(커서)으로 넘기는 중일 때만 — 첫 쪽은 null. */
  before: BugCursor | null;
}

/**
 * 목록 — API 읽기 사본을 먼저(전체 수 · 쪽 번호), 닿지 못하면(또는 이 환경에 없으면) 예전처럼 RTDB 커서로 20줄씩.
 * 커서는 예전 방식에서만 생긴다 — 커서로 넘기는 중이면 API 를 묻지 않는다(쪽 번호와 섞이지 않게).
 */
export function fetchBugList(api: Api | null, db: Db, query: BugListQuery): Promise<BugListView> {
  const fromRtdb = async (fallback: ApiFallback): Promise<BugListView> => ({
    via: 'rtdb',
    fallback,
    ...(await listBugPage(db, query.filter, query.before)),
  });
  if (query.before) return fromRtdb(api ? 'unavailable' : 'no-api');
  return viaApiOr(
    api,
    async (a) =>
      bugListFromApi(
        await a.get<ApiBugPage>('/v1/admin/bugs', {
          page: query.page,
          size: query.size,
          filter: query.filter,
        }),
      ),
    fromRtdb,
  );
}

export function useBugList(query: BugListQuery) {
  const api = useApi();
  const db = useDb();
  const { filter, page, size, before } = query;
  return useQuery({
    queryKey: [...BUG_KEY, 'list', filter, page, size, before?.value ?? null, before?.key ?? null],
    queryFn: () => fetchBugList(api, db, query),
    placeholderData: keepPreviousData,
  });
}

export async function getBugItem(db: Db, id: string): Promise<BugItem | null> {
  return toBugItem(id, await db.get<unknown>(`${BUG_LIST}/${id}`));
}

/** 목록 한 줄 하나 — 할 일 화면이 연결된 제보 번호를 보일 때. 글이 지워졌으면 null. */
export function useBugItem(id: string) {
  const db = useDb();
  return useQuery({
    queryKey: [...BUG_KEY, 'item', id],
    queryFn: () => getBugItem(db, id),
    staleTime: 60_000,
  });
}

/**
 * 제보 id → 고정 번호(B-MMDD-n) — 할 일 검색용. useBugItem 과 같은 캐시를 써서, 할 일 카드가 이미 받은 줄이면 다시 읽지 않는다.
 * 고정 번호가 없는 옛 글 · 지워진 글은 빠진다(임시 번호는 날마다 순번을 세야 해서 검색에 쓰지 않는다).
 */
export function useBugNos(ids: readonly string[]): Map<string, string> {
  const db = useDb();
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: [...BUG_KEY, 'item', id],
      queryFn: () => getBugItem(db, id),
      staleTime: 60_000,
    })),
    combine: (results) => {
      const out = new Map<string, string>();
      results.forEach((r, i) => {
        if (r.data?.no) out.set(ids[i], r.data.no);
      });
      return out;
    },
  });
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
export function useDayOrder(day: string, enabled = true) {
  const db = useDb();
  return useQuery({
    queryKey: [...BUG_KEY, 'day', day],
    queryFn: () => getDayOrder(db, day),
    staleTime: () => (day < kstDateKey(Date.now()) ? Infinity : 0),
    enabled,
  });
}

/** 번호 — 고정 번호(no)가 있으면 그대로(그날 순번은 받지 않는다), 없으면 임시 번호 «B-MMDD-n»(순번 받기 전엔 «?»). */
export function useBugNo(item: Pick<BugItem, 'id' | 'ts' | 'no'>): BugNo {
  const order = useDayOrder(bugDay(item.ts), !item.no);
  return bugNo(item, order.data?.get(item.id));
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

/** 상세 — 목록 줄 · 내용 · 답변 · 글쓴이 답글. 공개 글이 아니면 공개 답변 칸은, 답글을 단 적 없는 글은 답글 칸을 읽지 않는다. */
export async function getBugPost(db: Db, id: string): Promise<BugPost | null> {
  const item = await getBugItem(db, id);
  if (!item) return null;
  const contentPath = item.vis === 'pub' ? `${BUG_ROOT}/pub/${id}` : `${BUG_ROOT}/prv/${item.authUid}/${id}`;
  const [content, [pub, prv], rep] = await Promise.all([
    db.get<BugContent>(contentPath),
    getStaffAnswersRaw(db, item),
    item.userReplyTs ? db.get<unknown>(`${BUG_ROOT}/rep/${item.vis}/${id}`) : Promise.resolve(null),
  ]);
  return { item, content, answers: toAnswers(pub, prv, { vis: item.vis, all: rep }) };
}

/** 운영자 답변 두 갈래 원본 — 공개 글이 아니면 공개 답변 칸은 읽지 않는다(앱도 안 읽는 자리). */
function getStaffAnswersRaw(db: Db, item: Pick<BugItem, 'id' | 'vis'>): Promise<[unknown, unknown]> {
  return Promise.all([
    item.vis === 'pub' ? db.get<unknown>(`${BUG_ROOT}/ans/pub/${item.id}`) : Promise.resolve(null),
    db.get<unknown>(`${BUG_ROOT}/ans/prv/${item.id}`),
  ]);
}

/** 운영자 답변만(글쓴이 답글 빼고) 오래된 순 — 답변 지우기 직전 다시 셀 때. */
export async function getStaffAnswers(db: Db, item: Pick<BugItem, 'id' | 'vis'>): Promise<BugAnswer[]> {
  const [pub, prv] = await getStaffAnswersRaw(db, item);
  return toAnswers(pub, prv);
}

export function useBugPost(id: string | null) {
  const db = useDb();
  return useQuery({
    queryKey: [...BUG_KEY, 'post', id],
    queryFn: () => getBugPost(db, id as string),
    enabled: !!id,
  });
}

const DAILY_MAX_KEY = [...BUG_KEY, 'dailyMax'];

/** 하루 제보 상한 — 서버에 정해 둔 값. 없으면 null(앱은 기본값 5). */
export async function getBugDailyMax(db: Db): Promise<number | null> {
  const v = await db.get<unknown>(BUG_DAILY_MAX_PATH);
  return typeof v === 'number' ? v : null;
}

export function useBugDailyMax() {
  const db = useDb();
  return useQuery({ queryKey: DAILY_MAX_KEY, queryFn: () => getBugDailyMax(db) });
}

export function useRefreshBugDailyMax() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: DAILY_MAX_KEY });
}

/** 상한 저장 + 작업 기록(이전 → 다음) 한 묶음. */
export function saveBugDailyMax(db: Db, max: number, before: number | null): Promise<void> {
  const detail = `${before ?? `기본 ${BUG_DAILY_MAX_DEFAULT}`} → ${max}`;
  return db.commit(
    withAudit(db, { [BUG_DAILY_MAX_PATH]: max }, 'settings.bugDailyMax', `하루 ${max}건`, detail),
  );
}

/** 비공개 제목은 staleTime Infinity 라 글을 고친 뒤엔 그 글 것만 다시 받는다. */
export function useRefreshPrvTitle() {
  const client = useQueryClient();
  return (id: string) => client.invalidateQueries({ queryKey: [...BUG_KEY, 'prvTitle', id] });
}

const LIST_KEY = [...BUG_KEY, 'list'];

/**
 * 목록 · 상세 · 오늘 순번을 다시 받는다(지난 날짜 순번 · 비공개 제목은 그대로).
 * 목록을 API 사본으로 읽고 있었으면 쓰기 직후엔 사본이 늦으니 [lagMs] 뒤에 목록을 한 번 더 받는다.
 */
export function refreshBugBoard(client: QueryClient, lagMs: number = REPLICA_LAG_MS): Promise<void> {
  const viaApi = client
    .getQueriesData<BugListView>({ queryKey: LIST_KEY })
    .some(([, data]) => data?.via === 'api');
  if (viaApi && lagMs > 0) setTimeout(() => void client.invalidateQueries({ queryKey: LIST_KEY }), lagMs);
  return client.invalidateQueries({
    queryKey: BUG_KEY,
    predicate: (q) => {
      const [, kind, arg] = q.queryKey;
      return kind === 'list' || kind === 'post' || (kind === 'day' && arg === kstDateKey(Date.now()));
    },
  });
}

export function useRefreshBugBoard() {
  const client = useQueryClient();
  return () => refreshBugBoard(client);
}

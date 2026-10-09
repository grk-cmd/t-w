import { kstDateKey } from '@/shared/lib';

/*
 * 🐞 버그제보 게시판 — 앱 app/parts/bug-board.js 와 같은 모양 · 같은 규칙을 따른다.
 *   bugBoard/list/{id}            목록 한 줄. 규칙상 limitToLast ≤ 20 쿼리(ts · openTs · nts)로만 읽힌다(관리자도).
 *   bugBoard/pub/{id}             공개 글 제목 · 본문
 *   bugBoard/prv/{authUid}/{id}   비공개 글 — 글쓴이 · 관리자만
 *   bugBoard/ans/{pub|prv}/{id}   운영자 답변
 * openTs = 미해결(new · checking)일 때만 ts, nts = 공지면 ts — 목록 쿼리가 이 칸으로 미해결 · 공지만 집는다.
 */

export const BUG_ROOT = 'bugBoard';
export const BUG_LIST = `${BUG_ROOT}/list`;
export const BUG_PAGE = 20; // 규칙 list .read limitToLast ≤ 20
// 앱 bug-board.js BUG_TITLE_MAX · BUG_BODY_MAX 와 규칙 bugBoard/pub · prv .validate 길이와 같다.
export const BUG_TITLE_MAX = 60;
export const BUG_BODY_MAX = 2000;
export const BUG_ANS_MAX = 1000;
export const BUG_KAKAO_MAX = 300;
export const KAKAO_RE = /^https:\/\/open\.kakao\.com\//;
// 규칙 bugBoard/list/$id/no 와 같은 모양
export const BUG_NO_RE = /^B-\d{4}-\d{1,4}$/;

export type BugVis = 'pub' | 'prv';
export type BugStatus = 'new' | 'checking' | 'fixed' | 'norepro';
export type BugFilter = 'open' | 'all' | 'notice';

export const BUG_STATUS: Record<BugStatus, string> = {
  new: '접수',
  checking: '확인 중',
  fixed: '수정 완료',
  norepro: '재현 안 됨',
};
export const BUG_STATUSES = Object.keys(BUG_STATUS) as BugStatus[];

// 앱 BUG_CATS 와 같다(규칙 cat 정규식과 짝).
export const BUG_CATS: Record<string, string> = {
  bug: '오류 · 멈춤',
  ui: '화면 · 표시',
  room: '방 · 접속',
  chat: '채팅',
  myhome: '마이홈',
  etc: '기타',
};

export const BUG_FILTERS: { id: BugFilter; label: string; key: 'openTs' | 'ts' | 'nts' }[] = [
  { id: 'open', label: '미해결', key: 'openTs' },
  { id: 'all', label: '전체', key: 'ts' },
  { id: 'notice', label: '공지', key: 'nts' },
];

export const filterKey = (filter: BugFilter) => BUG_FILTERS.find((f) => f.id === filter)?.key ?? 'ts';

export interface BugItem {
  id: string;
  vis: BugVis;
  status: BugStatus;
  cat: string;
  name: string;
  authUid: string;
  code: string;
  ts: number;
  openTs?: number;
  nts?: number;
  notice?: boolean;
  lastReplyTs?: number;
  ansN?: number;
  likeN?: number;
  /** 공개 글만 — 비공개 글 제목은 prv 에서 따로 읽는다. */
  title?: string;
  /** 고정 번호 «B-MMDD-n» — 서버 함수(functions/bug-no.js)가 붙인다. 옛 글 · 함수가 아직 안 돈 글은 없다. */
  no?: string;
  /** 관리자가 쓴 글 — 규칙상 관리자만 넣을 수 있는 칸(🛡 배지). */
  byAdmin?: boolean;
}

export interface BugContent {
  title: string;
  body: string;
  env?: string;
}

export interface BugAnswer {
  id: string;
  vis: BugVis;
  text: string;
  ts: number;
  kakao?: string;
}

export const isOpen = (st: BugStatus) => st === 'new' || st === 'checking';

const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/** 목록 한 줄 — 모양이 틀리면 null. */
export function toBugItem(id: string, v: unknown): BugItem | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (r.vis !== 'pub' && r.vis !== 'prv') return null;
  if (typeof r.ts !== 'number') return null;
  const status = BUG_STATUSES.includes(r.status as BugStatus) ? (r.status as BugStatus) : 'new';
  return {
    id,
    vis: r.vis,
    status,
    cat: str(r.cat) ?? 'etc',
    name: str(r.name) ?? '',
    authUid: str(r.authUid) ?? '',
    code: str(r.code) ?? '',
    ts: r.ts,
    openTs: num(r.openTs),
    nts: num(r.nts),
    notice: r.notice === true,
    lastReplyTs: num(r.lastReplyTs),
    ansN: num(r.ansN),
    likeN: num(r.likeN),
    title: str(r.title),
    no: typeof r.no === 'string' && BUG_NO_RE.test(r.no) ? r.no : undefined,
    byAdmin: r.byAdmin === true,
  };
}

/** 🛡 운영진 글 — byAdmin 또는 공지(공지는 관리자만 쓴다). 이름으로 가르지 않는다. */
export const isStaffPost = (item: Pick<BugItem, 'byAdmin' | 'notice'>) => !!item.byAdmin || !!item.notice;

// 하루 제보 상한 — 앱이 config/bugDailyMax 를 읽는다(없으면 기본값). 규칙 .validate 와 같은 범위.
export const BUG_DAILY_MAX_PATH = 'config/bugDailyMax';
export const BUG_DAILY_MAX_DEFAULT = 5;
export const BUG_DAILY_MAX_MIN = 1;
export const BUG_DAILY_MAX_MAX = 100;

/** 입력 → 상한. 정수가 아니거나 범위를 벗어나면 null. */
export function parseBugDailyMax(input: string): number | null {
  const text = input.trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= BUG_DAILY_MAX_MIN && n <= BUG_DAILY_MAX_MAX ? n : null;
}

export interface BugCursor {
  value: number;
  key: string;
}

export interface BugPage {
  items: BugItem[];
  /** 다음 쪽을 받을 자리 — 더 없으면 null. */
  next: BugCursor | null;
}

/**
 * 쿼리 한 번의 결과 → 화면 한 쪽.
 * «꽉 찼나» 는 거르기 **전** 받은 개수로 본다 — 앱은 공지를 먼저 걸러 낸 뒤 세서, 공지가 낀 쪽에서 [다음] 이 사라졌다.
 * 정렬 칸이 없는 줄(null)은 RTDB 가 맨 앞에 두므로 그런 줄이 섞였다면 정렬 칸이 있는 줄은 이미 다 받은 것이다.
 */
export function toBugPage(raw: Record<string, unknown>, key: 'openTs' | 'ts' | 'nts', n = BUG_PAGE): BugPage {
  const entries = Object.entries(raw ?? {});
  const keyed = entries
    .map(([id, v]) => ({ id, value: (v as Record<string, unknown> | null)?.[key] }))
    .filter((e): e is { id: string; value: number } => typeof e.value === 'number')
    .sort((a, b) => a.value - b.value || (a.id < b.id ? -1 : 1));
  const full = entries.length >= n && keyed.length === entries.length;
  const oldest = keyed[0];
  const items = entries
    .map(([id, v]) => toBugItem(id, v))
    .filter((it): it is BugItem => !!it && typeof it[key] === 'number')
    .sort((a, b) => (b[key] as number) - (a[key] as number) || (a.id < b.id ? 1 : -1));
  return { items, next: full && oldest ? { value: oldest.value, key: oldest.id } : null };
}

/** 하루 안 순번 — ts 순(같으면 키 순)으로 1부터. */
export function dayOrder(all: Record<string, unknown>): Map<string, number> {
  const list = Object.entries(all ?? {})
    .map(([id, v]) => ({ id, ts: (v as Record<string, unknown> | null)?.ts }))
    .filter((e): e is { id: string; ts: number } => typeof e.ts === 'number')
    .sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : 1));
  return new Map(list.map((e, i) => [e.id, i + 1]));
}

/** 하루를 가르는 날짜(서울 기준) — «YYYY-MM-DD». */
export const bugDay = (ts: number) => kstDateKey(ts);

/** 임시 번호 «B-MMDD-n» — 고정 번호(no)가 없는 글에만 화면에서 센다(앞 글이 지워지면 바뀐다). 순번을 모르면 «B-MMDD-?». */
export function shortNo(ts: number, n: number | undefined): string {
  const [, mm, dd] = bugDay(ts).split('-');
  return `B-${mm}${dd}-${n ?? '?'}`;
}

export interface BugNo {
  no: string;
  /** 고정 번호가 아니라 화면에서 센 번호 — «(임시)» 를 붙여 보인다. */
  temp: boolean;
}

/** 고정 번호가 있으면 그것, 없으면 임시 번호. */
export function bugNo(item: Pick<BugItem, 'ts' | 'no'>, n: number | undefined): BugNo {
  return item.no ? { no: item.no, temp: false } : { no: shortNo(item.ts, n), temp: true };
}

/** 작업 기록 · 확인 문구에 쓰는 이름 — 임시 번호면 그렇다고 적는다. */
export const bugNoLabel = (b: BugNo) => (b.temp ? `${b.no}(임시)` : b.no);

/**
 * 글 지우기 — 목록 줄 · 내용 · 답변 · 공감을 한 묶음으로 null.
 * 그날 카운터(bugBoard/seq)는 건드리지 않는다 — 번호는 늘기만 해서 지운 글의 번호가 다시 쓰이지 않는다.
 * 글쓴이 우편함에 이미 간 답변 알림은 그대로 둔다(누르면 «글을 찾지 못했어요»).
 */
export function deleteWrite(item: Pick<BugItem, 'id' | 'vis' | 'authUid'>): Record<string, null> {
  const content =
    item.vis === 'pub' ? `${BUG_ROOT}/pub/${item.id}` : `${BUG_ROOT}/prv/${item.authUid}/${item.id}`;
  return {
    [`${BUG_LIST}/${item.id}`]: null,
    [content]: null,
    [`${BUG_ROOT}/ans/pub/${item.id}`]: null,
    [`${BUG_ROOT}/ans/prv/${item.id}`]: null,
    [`${BUG_ROOT}/likes/${item.id}`]: null,
  };
}

/** 상태만 바꾸는 쓰기 — openTs 는 미해결일 때만 ts(공지는 늘 없음). 앱 addAnswer 와 같은 규칙. */
export function statusWrite(item: BugItem, status: BugStatus): Record<string, unknown> {
  const base = `${BUG_LIST}/${item.id}`;
  return {
    [`${base}/status`]: status,
    [`${base}/openTs`]: isOpen(status) && !item.notice ? item.ts : null,
  };
}

export interface AnswerInput {
  text: string;
  kakao?: string;
  vis: BugVis;
  /** 답변과 함께 바꿀 상태 — 없으면 그대로. */
  status?: BugStatus;
}

/** 답변 입력 확인 — 문제없으면 null. */
export function checkAnswer(input: Pick<AnswerInput, 'text' | 'kakao'>): string | null {
  const text = input.text.trim();
  if (!text) return '답변 내용 필요';
  if (text.length > BUG_ANS_MAX) return `답변은 ${BUG_ANS_MAX}자까지`;
  const kakao = input.kakao?.trim() ?? '';
  if (kakao && (!KAKAO_RE.test(kakao) || kakao.length > BUG_KAKAO_MAX))
    return '오픈카톡 링크는 https://open.kakao.com/ 으로 시작';
  return null;
}

/** 비공개 글엔 비공개 답변만(규칙 ans/pub 은 공개 글만 받는다). */
export const answerVis = (item: BugItem, vis: BugVis): BugVis => (item.vis === 'prv' ? 'prv' : vis);

/**
 * 답변 + 상태 + 쿼리용 칸을 한 묶음으로 — 앱 addAnswer 와 같다.
 * ansN 은 방금 읽은 item 기준 +1, lastReplyTs 는 now(서버 시각), openTs 는 미해결일 때만.
 */
export function answerWrite(
  item: BugItem,
  input: AnswerInput,
  rid: string,
  now: unknown,
): Record<string, unknown> {
  const vis = answerVis(item, input.vis);
  const kakao = input.kakao?.trim() ?? '';
  const status = input.status ?? item.status;
  const base = `${BUG_LIST}/${item.id}`;
  return {
    [`${BUG_ROOT}/ans/${vis}/${item.id}/${rid}`]: {
      text: input.text.trim().slice(0, BUG_ANS_MAX),
      ts: now,
      ...(kakao ? { kakao } : {}),
    },
    ...statusWrite(item, status),
    [`${base}/lastReplyTs`]: now,
    [`${base}/ansN`]: (item.ansN ?? 0) + 1,
  };
}

export const BUG_NOTICE_TITLE = '접수된 제보에 답변이 달렸어요';
/** 앱 BUG_PRV_NOTICE_BODY 와 같다. */
export const BUG_PRV_NOTICE_BODY = '비공개 제보예요 — 버그제보 탭의 «내 글» 에서 확인해 주세요';

/**
 * 답변 알림(우편함) 본문 — 우편함은 누구나 읽을 수 있고 글쓴이 코드는 공개 목록에 있어서,
 * 비공개 글의 제목을 넣으면 그 길로 샌다. 비공개 글은 고정 문구만. 어느 글인지는 bugId 로 연다.
 */
export function answerNoticeBody(vis: BugVis, title: string | undefined, hasKakao: boolean): string {
  const head = vis === 'pub' ? String(title ?? '') : BUG_PRV_NOTICE_BODY;
  return head + (hasKakao ? '\n💬 오픈카톡 연결이 함께 왔어요' : '');
}

/** 답변 한 개 id — 앱의 push 키 대신. 정렬은 ts 로 하므로 모양만 맞으면 된다. */
export function answerId(): string {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** ans/{vis}/{id} 두 갈래를 합쳐 오래된 순으로. */
export function toAnswers(pub: unknown, prv: unknown): BugAnswer[] {
  const pick = (all: unknown, vis: BugVis): BugAnswer[] =>
    Object.entries((all && typeof all === 'object' ? all : {}) as Record<string, unknown>)
      .map(([id, v]) => {
        const r = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
        if (typeof r.text !== 'string' || typeof r.ts !== 'number') return null;
        return {
          id,
          vis,
          text: r.text,
          ts: r.ts,
          ...(typeof r.kakao === 'string' ? { kakao: r.kakao } : {}),
        };
      })
      .filter((a): a is BugAnswer => !!a);
  return [...pick(pub, 'pub'), ...pick(prv, 'prv')].sort((a, b) => a.ts - b.ts);
}

/** 관리자 글 수정 — 바꿀 수 있는 칸만. env · 번호 · 시각 · 상태 · 공감 · 답변 수는 그대로 둔다. */
export interface EditInput {
  title: string;
  body: string;
  cat: string;
  vis: BugVis;
}

/** 수정 입력 확인 — 앱 checkPost 와 같은 기준. 문제없으면 null. */
export function checkEdit(item: Pick<BugItem, 'notice'>, input: EditInput): string | null {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) return '제목 필요';
  if (!body) return '본문 필요';
  if (title.length > BUG_TITLE_MAX) return `제목은 ${BUG_TITLE_MAX}자까지`;
  if (body.length > BUG_BODY_MAX) return `본문은 ${BUG_BODY_MAX}자까지`;
  if (input.vis !== 'pub' && input.vis !== 'prv') return '공개 범위 필요';
  if (!Object.hasOwn(BUG_CATS, input.cat)) return '분류 필요';
  if (item.notice && input.vis !== 'pub') return '공지는 공개 글만';
  return null;
}

const contentPath = (item: Pick<BugItem, 'id' | 'authUid'>, vis: BugVis) =>
  vis === 'pub' ? `${BUG_ROOT}/pub/${item.id}` : `${BUG_ROOT}/prv/${item.authUid}/${item.id}`;

/** 무엇이 바뀌었나 — 작업 기록 detail 용. 제목 · 본문 글자는 넣지 않는다(비공개 글이 기록으로 새지 않게). */
export function editChanges(
  item: Pick<BugItem, 'vis' | 'cat'>,
  content: Pick<BugContent, 'title' | 'body'> | null,
  input: EditInput,
): string[] {
  const out: string[] = [];
  if (input.title.trim() !== (content?.title ?? '')) out.push('제목');
  if (input.body.trim() !== (content?.body ?? '')) out.push('본문');
  if (input.cat !== item.cat) out.push(`분류 ${BUG_CATS[item.cat] ?? item.cat} → ${BUG_CATS[input.cat]}`);
  if (input.vis !== item.vis) out.push(input.vis === 'prv' ? '공개 → 비공개' : '비공개 → 공개');
  return out;
}

/**
 * 수정 쓰기 한 묶음 — 앱 listEntry · contentEntry 와 같은 모양으로 맞춘다.
 *   목록 줄: vis · cat · title(공개 글만 — 비공개 글 목록 줄엔 제목을 두지 않는다. 누구나 읽는 노드다)
 *   내용: 공개면 pub/{id}, 비공개면 prv/{authUid}/{id}. 공개 범위가 바뀌면 옛 자리는 null. env 는 그대로 옮긴다.
 *   공개 → 비공개: 공개 답변(ans/pub — 누구나 읽음)을 같은 id 로 ans/prv 에 옮긴다.
 *     앱은 비공개 글의 ans/pub 을 읽지 않아, 그대로 두면 답변이 안 보이면서 바깥에선 읽힌다.
 *   비공개 → 공개: 비공개 답변은 비공개로 남긴다(공개 글도 비공개 답변을 가질 수 있다).
 */
export function editWrite(
  item: Pick<BugItem, 'id' | 'vis' | 'authUid'>,
  content: BugContent | null,
  answers: BugAnswer[],
  input: EditInput,
): Record<string, unknown> {
  const title = input.title.trim().slice(0, BUG_TITLE_MAX);
  const body = input.body.trim().slice(0, BUG_BODY_MAX);
  const base = `${BUG_LIST}/${item.id}`;
  const from = contentPath(item, item.vis);
  const to = contentPath(item, input.vis);
  const updates: Record<string, unknown> = {
    [`${base}/vis`]: input.vis,
    [`${base}/cat`]: input.cat,
    [`${base}/title`]: input.vis === 'pub' ? title : null,
    [to]: { title, body, ...(content?.env ? { env: content.env } : {}) },
  };
  if (from !== to) updates[from] = null;
  if (item.vis === 'pub' && input.vis === 'prv') {
    const pub = answers.filter((a) => a.vis === 'pub');
    for (const a of pub)
      updates[`${BUG_ROOT}/ans/prv/${item.id}/${a.id}`] = {
        text: a.text,
        ts: a.ts,
        ...(a.kakao ? { kakao: a.kakao } : {}),
      };
    if (pub.length) updates[`${BUG_ROOT}/ans/pub/${item.id}`] = null;
  }
  return updates;
}

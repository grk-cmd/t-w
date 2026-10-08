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
export const BUG_ANS_MAX = 1000;
export const BUG_KAKAO_MAX = 300;
export const KAKAO_RE = /^https:\/\/open\.kakao\.com\//;

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
  };
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

/** 짧은 번호 «B-MMDD-n». 저장하지 않고 화면에서만 셈한다. 순번을 아직 모르면 «B-MMDD-?». */
export function shortNo(ts: number, n: number | undefined): string {
  const [, mm, dd] = bugDay(ts).split('-');
  return `B-${mm}${dd}-${n ?? '?'}`;
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

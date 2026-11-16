// API 판 — 목록 `GET /v2/bugs?filter=open|all|notices|suggest&cursor&limit`(관리자는 limit 1~100 · 최신순 키셋 · 첫 쪽 `total`),
// 글 열기 `GET /v2/bugs/{number}`(글 · 댓글 · `version` · `lastAnswerAt`). 번호 `B-MMDD-n` 이 글의 id 다.
// 화면은 쪽 번호로 묻는다 — 서버 키셋을 첫 쪽부터 이어 받아 그 쪽을 자른다(받아 둔 커서를 포트가 기억하지 않는다).
// 거르기 · 세기(미해결 · 건의 · 공지 · 전체 수)는 서버가 한다. 서버가 원본이라 사본 지연도 날짜 순번 세기도 없다.
import {
  ApiError,
  perApi,
  portCall,
  PortError,
  wireArray,
  wireBool,
  wireError,
  wireNullableString,
  wireNumber,
  wireObject,
  wireString,
  wireTime,
  type Api,
} from '@/shared/api';
import type { BugAnswer, BugContent, BugFilter, BugItem, BugStatus, BugVis } from '../model/bugBoard';
import type { BugBoardPort, BugPost } from './port';

const BUGS = '/v2/bugs';
/** 서버 한 번에 받는 상한(관리자 `limit` 1~100). */
const PAGE_MAX = 100;
const NOT_FOUND = 'BUG_NOT_FOUND';

const FILTERS: Record<BugFilter, string> = {
  open: 'open',
  suggest: 'suggest',
  all: 'all',
  notice: 'notices',
};
const VISIBILITY: Record<string, BugVis> = { PUBLIC: 'pub', PRIVATE: 'prv' };
const STATUS: Record<string, BugStatus> = {
  NEW: 'new',
  CHECKING: 'checking',
  REVIEW: 'review',
  FIXED: 'fixed',
  NOREPRO: 'norepro',
  UNFIXED: 'unfixed',
};
const CATEGORY: Record<string, string> = {
  BUG: 'bug',
  UI: 'ui',
  ROOM: 'room',
  CHAT: 'chat',
  MYHOME: 'myhome',
  SUGGEST: 'suggest',
  ETC: 'etc',
};

/** 이름 표에서 찾는다 — 모르는 이름이면 짐작으로 채우지 않고 던진다. */
function named<T>(table: Record<string, T>, value: unknown, what: string): T {
  const key = wireString(value, what);
  if (!Object.hasOwn(table, key)) throw wireError(what, Object.keys(table).join(' · '));
  return table[key];
}

/** 글 한 줄 · 상세가 같이 가진 칸. `lastAnswerAt` · `lastAuthorReplyAt` 의 null 만 문서가 약속한 «없음». */
function toBase(o: Record<string, unknown>): BugItem {
  const number = wireString(o.number, '제보의 number');
  const what = (field: string) => `제보 ${number} 의 ${field}`;
  const author = wireObject(o.author, what('author'));
  const code = wireNullableString(author.userCode, what('author.userCode'));
  const lastAnswerAt = wireNullableString(o.lastAnswerAt, what('lastAnswerAt'));
  const lastAuthorReplyAt = wireNullableString(o.lastAuthorReplyAt, what('lastAuthorReplyAt'));
  return {
    id: number,
    no: number,
    vis: named(VISIBILITY, o.visibility, what('visibility')),
    status: named(STATUS, o.status, what('status')),
    cat: named(CATEGORY, o.category, what('category')),
    name: wireString(author.name, what('author.name')),
    // Firebase 경로를 만드는 데만 쓰는 칸 — 서버 줄에는 없다.
    authUid: '',
    code: code ?? '',
    ts: wireTime(o.createdAt, what('createdAt')),
    notice: wireBool(o.notice, what('notice')),
    byAdmin: wireBool(o.byAdmin, what('byAdmin')),
    title: wireString(o.title, what('title')),
    likeN: wireNumber(o.likeCount, what('likeCount')),
    ...(lastAnswerAt !== null
      ? { lastReplyTs: wireTime(lastAnswerAt, what('lastAnswerAt')), lastReplyAt: lastAnswerAt }
      : {}),
    ...(lastAuthorReplyAt !== null
      ? { userReplyTs: wireTime(lastAuthorReplyAt, what('lastAuthorReplyAt')) }
      : {}),
    server: true,
  };
}

/** 목록 한 줄. */
export function toBugSummary(w: unknown): BugItem {
  const o = wireObject(w, '제보 줄');
  return { ...toBase(o), ansN: wireNumber(o.answerCount, `제보 ${String(o.number)} 의 answerCount`) };
}

/** 댓글 한 줄 — 운영자 답변은 공개 범위가 있고, 글쓴이 답글은 글의 공개 범위를 따라 칸이 없다. */
function toAnswer(w: unknown, post: string, vis: BugVis): BugAnswer {
  const o = wireObject(w, `제보 ${post} 의 댓글`);
  const id = wireString(o.id, `제보 ${post} 댓글의 id`);
  const what = (field: string) => `제보 ${post} 댓글 ${id} 의 ${field}`;
  const kind = wireString(o.kind, what('kind'));
  const kakao = wireNullableString(o.kakaoLink, what('kakaoLink'));
  const after = wireNullableString(o.statusAfter, what('statusAfter'));
  const common = { id, text: wireString(o.text, what('text')), ts: wireTime(o.createdAt, what('createdAt')) };
  if (kind === 'ADMIN_ANSWER') {
    return {
      ...common,
      vis: named(VISIBILITY, o.visibility, what('visibility')),
      ...(kakao !== null ? { kakao } : {}),
    };
  }
  if (kind === 'AUTHOR_REPLY') {
    return {
      ...common,
      vis,
      byAuthor: true,
      ...(after !== null ? { st: named(STATUS, after, what('statusAfter')) } : {}),
    };
  }
  throw wireError(what('kind'), 'ADMIN_ANSWER · AUTHOR_REPLY');
}

/** 상세 — 글 줄 + 내용 + 댓글. 글 번호(`version`)를 줄에 싣는다. */
export function toBugPost(w: unknown): BugPost {
  const o = wireObject(w, '제보 상세');
  const base = toBase(o);
  const what = (field: string) => `제보 ${base.id} 의 ${field}`;
  const answers = wireArray(o.comments, what('comments')).map((c) => toAnswer(c, base.id, base.vis));
  const env = wireNullableString(o.env, what('env'));
  const content: BugContent = {
    title: base.title ?? '',
    body: wireString(o.body, what('body')),
    ...(env !== null ? { env } : {}),
  };
  return {
    item: {
      ...base,
      version: wireNumber(o.version, what('version')),
      ansN: answers.filter((a) => !a.byAuthor).length,
    },
    content,
    answers,
  };
}

function build(api: Api | null): BugBoardPort {
  /** 글 하나 — 없는 글(404 `BUG_NOT_FOUND`)은 null. */
  const detail = (id: string): Promise<BugPost | null> =>
    portCall(
      api,
      async (a) => {
        try {
          return toBugPost(await a.get<unknown>(`${BUGS}/${encodeURIComponent(id)}`));
        } catch (error) {
          if (error instanceof ApiError && error.status === 404 && error.code === NOT_FOUND) return null;
          throw error;
        }
      },
      '제보를 불러오지 못했어요',
    );

  return {
    list: (query) =>
      portCall(
        api,
        async (a) => {
          const filter = FILTERS[query.filter];
          const read = async (cursor: string | undefined, limit: number) => {
            const page = wireObject(await a.get<unknown>(BUGS, { filter, cursor, limit }), '제보 쪽');
            return {
              page,
              rows: wireArray(page.items, '제보 쪽의 items').map(toBugSummary),
              next: wireNullableString(page.nextCursor, '제보 쪽의 nextCursor') ?? undefined,
            };
          };
          // 공지는 쪽 없이 한 번에 온다(서버 `total` 은 null) — 온 줄이 곧 전부다.
          if (query.filter === 'notice') {
            const { rows } = await read(undefined, PAGE_MAX);
            return { via: 'server', items: rows, page: 1, pageCount: 1, total: rows.length };
          }
          const want = query.page * query.size;
          // `total` 은 첫 쪽에만 온다.
          const first = await read(undefined, Math.min(PAGE_MAX, want));
          const total = wireNumber(first.page.total, '제보 첫 쪽의 total');
          const rows = first.rows;
          let cursor = first.next;
          while (cursor !== undefined && rows.length < want) {
            const next = await read(cursor, Math.min(PAGE_MAX, want - rows.length));
            rows.push(...next.rows);
            cursor = next.next;
          }
          return {
            via: 'server',
            items: rows.slice((query.page - 1) * query.size, want),
            page: query.page,
            pageCount: Math.max(1, Math.ceil(total / query.size)),
            total,
          };
        },
        '제보 목록을 불러오지 못했어요',
      ),

    item: async (id) => (await detail(id))?.item ?? null,
    post: detail,

    // 서버는 비공개 글 제목도 목록 · 상세에 준다 — 상세에서 읽는다.
    prvTitle: async (item) => {
      const post = await detail(item.id);
      if (!post?.content) throw new PortError('notFound', '지워진 글이에요', NOT_FOUND);
      return post.content.title;
    },

    // 서버가 모든 글에 고정 번호를 줘서 날짜 순번을 셀 글이 없다.
    dayOrder: async () => {
      throw new PortError('invalid', '서버가 번호를 주는 판이라 날짜 순번을 세지 않아요');
    },
  };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerBugBoardPort = perApi(build);

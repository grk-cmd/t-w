import { useMemo, useState } from 'react';
import { TodoBadge, todoByReport, useRefreshTodos, useTodos, type Todo } from '@/entities/admin/todo';
import {
  BUG_CATS,
  BUG_FILTERS,
  BugNoText,
  commentSummary,
  hasAuthorReply,
  isStaffPost,
  StatusChip,
  useBugList,
  useBugNo,
  usePrvTitle,
  useRefreshBugBoard,
  type BugCursor,
  type BugFilter,
  type BugItem,
} from '@/entities/bug-board';
import { errorMessage, formatDate, pageForSize, readPageSize, savePageSize } from '@/shared/lib';
import { Pager } from '@/shared/ui';
import styles from './BugBoardList.module.css';

function Title({ item }: { item: BugItem }) {
  const prv = usePrvTitle(item);
  if (item.vis === 'pub') return <>{item.title || <span className="soft">(제목 없음)</span>}</>;
  if (prv.isLoading) return <span className="soft">…</span>;
  if (prv.error) return <span className="soft">읽지 못함</span>;
  return <>{prv.data || <span className="soft">(제목 없음)</span>}</>;
}

function Comments({ item }: { item: BugItem }) {
  const { answers, authorReplied } = commentSummary(item);
  if (!answers && !authorReplied) return <span className="soft">없음</span>;
  return (
    <span className={styles.comments}>
      {answers > 0 && <span title={`운영자 답변 ${answers}개`}>💬 {answers}</span>}
      {answers > 0 && authorReplied && ' · '}
      {authorReplied && <span title="글쓴이 답글이 있어요">✍</span>}
    </span>
  );
}

function Row({ item, todo, onOpen }: { item: BugItem; todo?: Todo; onOpen: (id: string) => void }) {
  const no = useBugNo(item);
  return (
    <tr>
      <td>
        <button type="button" className={styles.link} onClick={() => onOpen(item.id)}>
          <BugNoText value={no} />
        </button>
      </td>
      <td>
        <StatusChip status={item.status} />
        {hasAuthorReply(item) && (
          <span className={styles.authorReply} title="운영자 답변 뒤에 글쓴이가 답글을 달았어요">
            ✍ 글쓴이 답글
          </span>
        )}
        {todo && (
          <>
            {' '}
            <TodoBadge todo={todo} />
          </>
        )}
      </td>
      <td>{BUG_CATS[item.cat] ?? item.cat}</td>
      <td>{item.notice ? '📌 공지' : item.vis === 'pub' ? '공개' : '🔒 비공개'}</td>
      <td className={styles.title}>
        <button type="button" className={styles.link} onClick={() => onOpen(item.id)}>
          <Title item={item} />
        </button>
      </td>
      <td>
        {item.name || <span className="soft">이름 없음</span>}
        {isStaffPost(item) && <span title="운영진 글"> 🛡</span>}{' '}
        <small className="soft key">{item.code}</small>
      </td>
      <td>{formatDate(item.ts)}</td>
      <td className={styles.num}>
        <Comments item={item} />
      </td>
    </tr>
  );
}

const LIST_KEY = 'bugs';

/**
 * API 읽기 사본으로 읽으면 전체 수 · 쪽 번호(Pager). 닿지 못하면 예전처럼 한 쪽 20개씩(규칙 상한) —
 * 앞 쪽들의 자리(cursor)를 쌓아 [이전] 으로 돌아가고, 쪽 수 · 총 개수는 모른다(세려면 전부 받아야 한다).
 */
export function BugBoardList({ onOpen }: { onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<BugFilter>('open');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(() => readPageSize(LIST_KEY));
  const [cursors, setCursors] = useState<(BugCursor | null)[]>([null]);
  const before = cursors[cursors.length - 1];
  const { data, error, isFetching, isPlaceholderData } = useBugList({ filter, page, size, before });
  const refresh = useRefreshBugBoard();
  // 할 일 전체를 한 번 받아 줄마다 찾는다 — 줄마다 읽지 않는다.
  const todos = useTodos();
  const refreshTodos = useRefreshTodos();
  const byReport = useMemo(() => todoByReport(todos.data ?? []), [todos.data]);

  // 지우기 · 상태 바꾸기로 줄어 지금 쪽이 끝을 넘으면 끝 쪽으로(API 는 넘은 쪽을 빈 채로 돌려준다)
  if (data?.via === 'api' && !isPlaceholderData && page > data.pageCount) setPage(data.pageCount);

  const pick = (next: BugFilter) => {
    setFilter(next);
    setPage(1);
    setCursors([null]);
  };

  const paging = {
    page: data?.via === 'api' ? data.page : page,
    pageCount: data?.via === 'api' ? data.pageCount : 1,
    size,
    total: data?.via === 'api' ? data.total : 0,
    setPage: (next: number) => setPage(Math.max(1, next)),
    setSize: (next: number) => {
      savePageSize(LIST_KEY, next);
      setPage(pageForSize(page, size, next));
      setSize(next);
    },
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2>🐞 버그 제보</h2>
        <button
          type="button"
          className="btn"
          onClick={() => {
            void refresh();
            void refreshTodos();
          }}
        >
          새로고침
        </button>
      </div>
      <div className={styles.chips}>
        {BUG_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={f.id === filter}
            className={f.id === filter ? `${styles.filter} ${styles.on}` : styles.filter}
            onClick={() => pick(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error && <p className="msg err">{errorMessage(error, '제보 목록 불러오기 실패')}</p>}
      {!error && !data && <p className="soft">불러오는 중…</p>}
      {data && data.items.length === 0 && <p className="soft">해당 제보 없음</p>}
      {data && data.items.length > 0 && (
        <div className={styles.wrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>번호</th>
                <th>상태</th>
                <th>분류</th>
                <th>공개</th>
                <th>제목</th>
                <th>작성자</th>
                <th>작성</th>
                <th>댓글</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <Row key={item.id} item={item} todo={byReport.get(item.id)} onOpen={onOpen} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data?.via === 'api' && <Pager paging={paging} />}
      {data?.via === 'rtdb' && (
        <div className={styles.pager}>
          <button
            type="button"
            className="btn"
            disabled={cursors.length <= 1 || isFetching}
            onClick={() => setCursors(cursors.slice(0, -1))}
          >
            이전
          </button>
          <span className="soft">{cursors.length}쪽</span>
          <button
            type="button"
            className="btn"
            disabled={!data.next || isFetching}
            onClick={() => data.next && setCursors([...cursors, data.next])}
          >
            다음
          </button>
        </div>
      )}
    </section>
  );
}

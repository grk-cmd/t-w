import { useEffect, useRef, useState } from 'react';
import { adminNameOf, adminOptions, useAdminNames } from '@/entities/admin/name';
import {
  ALL_TODOS,
  filterTodos,
  ReleaseBadge,
  releasesOf,
  searchTodos,
  searchWords,
  TODO_STATUS,
  TODO_STATUSES,
  TODO_TYPE,
  TODO_TYPE_NONE,
  TODO_TYPES,
  TypeBadge,
  useRefreshTodos,
  useTodos,
  type Todo,
  type TodoFilter,
  type TodoStatus,
  type TodoType,
} from '@/entities/admin/todo';
import { BugNoText, useBugItem, useBugNo, useBugNos, type BugItem } from '@/entities/bug-board';
import { useReleaseDownloads } from '@/entities/release';
import { ApplyReleaseButton, ReleaseTplPanel } from '@/features/admin-todo/apply-release';
import { DeleteTodoButton, TodoForm } from '@/features/admin-todo/edit-todo';
import { useDb } from '@/shared/api';
import { errorMessage, formatDate, useHashParam, useHashSub } from '@/shared/lib';
import styles from './TodoBoard.module.css';

function ReportNo({ item }: { item: BugItem }) {
  return <BugNoText value={useBugNo(item)} />;
}

/** 연결된 제보 — 번호를 보이고 누르면 제보 화면에서 그 글을 연다. 지워진 글은 id 만. */
function ReportLink({ id }: { id: string }) {
  const item = useBugItem(id);
  return (
    <a className={styles.report} href={`#/bugs/${id}`}>
      🐞{' '}
      {item.data ? (
        <ReportNo item={item.data} />
      ) : item.isLoading ? (
        '…'
      ) : (
        <span className="soft" title={id}>
          지워진 제보
        </span>
      )}
    </a>
  );
}

function TodoCard({
  todo,
  names,
  me,
  focus,
  latest,
}: {
  todo: Todo;
  names: ReadonlyMap<string, string>;
  me: string | null;
  focus: boolean;
  /** GitHub 최신 공개 릴리스 — 모르면 undefined(배지에 버전만). */
  latest: string | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ block: 'center' });
  }, [focus]);

  const who = (uid: string) => (uid === me ? '나' : adminNameOf(uid, names));
  const assignee = todo.assignee
    ? todo.assignee === me
      ? '나'
      : (names.get(todo.assignee) ?? (todo.assigneeName || adminNameOf(todo.assignee, names)))
    : null;

  return (
    <article
      ref={ref}
      className={`${styles.todo} ${todo.status === 'doing' ? styles.doing : ''} ${focus ? styles.focus : ''}`}
    >
      {editing ? (
        <TodoForm todo={todo} onDone={() => setEditing(false)} />
      ) : (
        <>
          <div className={styles.head}>
            <span className={styles.status}>
              {todo.status === 'doing' ? '🔧' : todo.status === 'done' ? '✅' : '📋'}{' '}
              {TODO_STATUS[todo.status]}
            </span>
            <TypeBadge type={todo.type} />
            <b className={styles.title}>{todo.title}</b>
            <ReleaseBadge release={todo.release} latest={latest} />
            <span className={styles.assignee}>
              {assignee ? `👤 ${assignee}` : <span className="soft">작업자 없음</span>}
            </span>
          </div>
          {todo.memo && <p className={styles.memo}>{todo.memo}</p>}
          {todo.reports.length > 0 && (
            <div className={styles.reports}>
              {todo.reports.map((rid) => (
                <ReportLink key={rid} id={rid} />
              ))}
            </div>
          )}
          <div className={styles.foot}>
            <small className="soft">
              {who(todo.updatedBy)} · {formatDate(todo.updatedAt)}
            </small>
            <span className={styles.tools}>
              <button type="button" className="btn" onClick={() => setEditing(true)}>
                수정
              </button>
              <DeleteTodoButton todo={todo} />
            </span>
          </div>
        </>
      )}
    </article>
  );
}

/** 📋 할 일 — 진행 중 → 할 일 → 완료(접어 둠). 전체를 한 번 받아 화면에서 거른다. */
export function TodoBoard() {
  const me = useDb().uid();
  const todos = useTodos();
  const refresh = useRefreshTodos();
  const names = useAdminNames().data ?? new Map<string, string>();
  const focusId = useHashSub();
  const [filter, setFilter] = useState<TodoFilter>(ALL_TODOS);
  const [adding, setAdding] = useState(false);
  // 검색어는 주소(#/todos?q=…)에 — 주소를 복사해 주면 같은 검색으로 열린다.
  const [query, setQuery] = useHashParam('q');
  const searching = searchWords(query).length > 0;
  // 출시 여부 배지용 — 화면을 열 때 한 번(자동 재조회 없음 · 다운로드 화면과 같은 캐시). 실패하면 버전만.
  const latest = useReleaseDownloads().data?.[0]?.version;
  const versions = releasesOf(todos.data ?? []);
  // 고르고 있던 버전이 목록에서 사라져도(고쳐서) 칸에서 빠지지 않게.
  if (filter.release !== 'all' && filter.release !== 'none' && !versions.includes(filter.release))
    versions.push(filter.release);

  // 연결된 제보 번호 — 카드가 보이려고 받는 것과 같은 캐시(검색하려고 더 읽지 않는다).
  const reportNos = useBugNos([...new Set((todos.data ?? []).flatMap((t) => t.reports))]);
  const filtered = filterTodos(todos.data ?? [], filter, me);
  const shown = searchTodos(filtered, query, reportNos);
  const active = shown.filter((t) => t.status !== 'done');
  const done = shown.filter((t) => t.status === 'done');
  const focusDone = done.some((t) => t.id === focusId);
  const card = (t: Todo) => (
    <TodoCard key={t.id} todo={t} names={names} me={me} focus={t.id === focusId} latest={latest} />
  );

  return (
    <section className="card">
      <div className="card-head">
        <h2>📋 할 일</h2>
        <span className={styles.tools}>
          <button type="button" className="btn primary" onClick={() => setAdding(true)} disabled={adding}>
            새 할 일
          </button>
          <ApplyReleaseButton />
          <button type="button" className="btn" onClick={refresh}>
            새로고침
          </button>
        </span>
      </div>
      <ReleaseTplPanel />
      <div className={styles.filters}>
        <input
          type="search"
          className={styles.search}
          aria-label="할 일 검색"
          placeholder="검색 — 제목 · 메모 · 제보 번호 · 버전"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="상태"
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value as TodoStatus | 'all' })}
        >
          <option value="all">상태 전체</option>
          {TODO_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TODO_STATUS[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="종류"
          value={filter.type}
          onChange={(e) => setFilter({ ...filter, type: e.target.value as TodoType | 'all' | 'none' })}
        >
          <option value="all">종류 전체</option>
          {TODO_TYPES.map((t) => (
            <option key={t} value={t}>
              {TODO_TYPE[t]}
            </option>
          ))}
          <option value="none">{TODO_TYPE_NONE}</option>
        </select>
        <select
          aria-label="작업자"
          value={filter.assignee}
          onChange={(e) => setFilter({ ...filter, assignee: e.target.value })}
        >
          <option value="all">작업자 전체</option>
          <option value="none">작업자 없음</option>
          {adminOptions(names).map((o) => (
            <option key={o.uid} value={o.uid}>
              {o.uid === me ? `${o.name} (나)` : o.name}
            </option>
          ))}
        </select>
        <select
          aria-label="릴리스 버전"
          value={filter.release}
          onChange={(e) => setFilter({ ...filter, release: e.target.value })}
        >
          <option value="all">버전 전체</option>
          <option value="none">버전 없음</option>
          {versions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <label className={styles.mine}>
          <input
            type="checkbox"
            checked={filter.mine}
            onChange={(e) => setFilter({ ...filter, mine: e.target.checked })}
          />
          내 것
        </label>
      </div>
      {adding && (
        <article className={styles.todo}>
          <TodoForm onDone={() => setAdding(false)} />
        </article>
      )}
      {todos.error && <p className="msg err">{errorMessage(todos.error, '할 일 불러오기 실패')}</p>}
      {!todos.error && !todos.data && <p className="soft">불러오는 중…</p>}
      {todos.data && searching && (
        <p className={styles.searchInfo}>
          <span>
            «{query.trim()}» 검색 결과 {shown.length}건
            {filtered.length !== shown.length && <span className="soft"> (거른 {filtered.length}건 중)</span>}
          </span>
          <button type="button" className="btn" onClick={() => setQuery('')}>
            검색어 지우기
          </button>
        </p>
      )}
      {todos.data && shown.length === 0 && <p className="soft">해당 할 일 없음</p>}
      <div className={styles.list}>{active.map(card)}</div>
      {done.length > 0 && (
        <details
          className={styles.done}
          open={focusDone || searching || filter.status === 'done' || filter.release !== 'all'}
        >
          <summary>완료 {done.length}</summary>
          <div className={styles.list}>{done.map(card)}</div>
        </details>
      )}
    </section>
  );
}

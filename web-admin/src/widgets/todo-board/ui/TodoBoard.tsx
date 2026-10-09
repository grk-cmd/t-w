import { useEffect, useRef, useState } from 'react';
import { adminNameOf, adminOptions, useAdminNames } from '@/entities/admin/name';
import {
  ALL_TODOS,
  filterTodos,
  TODO_STATUS,
  TODO_STATUSES,
  useRefreshTodos,
  useTodos,
  type Todo,
  type TodoFilter,
  type TodoStatus,
} from '@/entities/admin/todo';
import { BugNoText, useBugItem, useBugNo, type BugItem } from '@/entities/bug-board';
import { DeleteTodoButton, TodoForm } from '@/features/admin-todo/edit-todo';
import { useDb } from '@/shared/api';
import { errorMessage, formatDate, useHashSub } from '@/shared/lib';
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
}: {
  todo: Todo;
  names: ReadonlyMap<string, string>;
  me: string | null;
  focus: boolean;
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
            <b className={styles.title}>{todo.title}</b>
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

  const shown = filterTodos(todos.data ?? [], filter, me);
  const active = shown.filter((t) => t.status !== 'done');
  const done = shown.filter((t) => t.status === 'done');
  const focusDone = done.some((t) => t.id === focusId);
  const card = (t: Todo) => <TodoCard key={t.id} todo={t} names={names} me={me} focus={t.id === focusId} />;

  return (
    <section className="card">
      <div className="card-head">
        <h2>📋 할 일</h2>
        <span className={styles.tools}>
          <button type="button" className="btn primary" onClick={() => setAdding(true)} disabled={adding}>
            새 할 일
          </button>
          <button type="button" className="btn" onClick={refresh}>
            새로고침
          </button>
        </span>
      </div>
      <div className={styles.filters}>
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
      {todos.data && shown.length === 0 && <p className="soft">해당 할 일 없음</p>}
      <div className={styles.list}>{active.map(card)}</div>
      {done.length > 0 && (
        <details className={styles.done} open={focusDone || filter.status === 'done'}>
          <summary>완료 {done.length}</summary>
          <div className={styles.list}>{done.map(card)}</div>
        </details>
      )}
    </section>
  );
}

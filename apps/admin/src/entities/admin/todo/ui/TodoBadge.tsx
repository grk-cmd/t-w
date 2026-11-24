import { TODO_STATUS, type Todo } from '../model/adminTodo';
import styles from './TodoBadge.module.css';

const ICON = { todo: '📋', doing: '🔧', done: '✅' } as const;

/** 제보에 걸린 할 일 — 상태만(작업자는 할 일 화면에서만) · 완료면 나가는 판까지. 누르면 그 할 일로. */
export function TodoBadge({ todo }: { todo: Pick<Todo, 'id' | 'status' | 'title' | 'release'> }) {
  const cls = todo.status === 'doing' ? styles.doing : todo.status === 'done' ? styles.done : '';
  return (
    <a className={`${styles.badge} ${cls}`} href={`#/todos/${todo.id}`} title={`할 일 — ${todo.title}`}>
      {ICON[todo.status]} {TODO_STATUS[todo.status]}
      {todo.status === 'done' && todo.release && ` · ${todo.release}`}
    </a>
  );
}

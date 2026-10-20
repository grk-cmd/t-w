import { TODO_STATUS, type Todo } from '../model/adminTodo';
import styles from './TodoBadge.module.css';

/** 제보에 걸린 할 일 — 상태만(작업자는 할 일 화면에서만). 누르면 그 할 일로. */
export function TodoBadge({ todo }: { todo: Pick<Todo, 'id' | 'status' | 'title'> }) {
  const icon = todo.status === 'doing' ? '🔧' : '📋';
  return (
    <a
      className={`${styles.badge} ${todo.status === 'doing' ? styles.doing : ''}`}
      href={`#/todos/${todo.id}`}
      title={`할 일 — ${todo.title}`}
    >
      {icon} {TODO_STATUS[todo.status]}
    </a>
  );
}

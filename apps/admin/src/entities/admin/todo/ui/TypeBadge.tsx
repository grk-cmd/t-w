import { TODO_TYPE, TODO_TYPE_NONE, type TodoType } from '../model/adminTodo';
import styles from './TodoBadge.module.css';

/** 종류 배지 — 🆕 기능 · 🐞 버그, 없으면 흐린 «미분류». */
export function TypeBadge({ type }: { type: TodoType | null }) {
  return (
    <span className={`${styles.badge} ${type ? '' : styles.untyped}`}>
      {type ? TODO_TYPE[type] : TODO_TYPE_NONE}
    </span>
  );
}

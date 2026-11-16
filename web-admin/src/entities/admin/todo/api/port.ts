import type { Todo } from '../model/adminTodo';
import type { TodoNote } from '../model/todoNote';

/** 📋 관리자 할 일 읽기 — 목록 · 공용 메모. 만들기 · 고치기 · 지우기 · 메모 저장은 features/admin-todo/edit-todo · edit-note 의 포트가 한다. */
export interface TodoPort {
  /** 할 일 전부 — 진행 중 → 할 일 → 완료, 같은 상태는 최근에 고친 것부터. 못 읽으면 던진다. */
  list(): Promise<Todo[]>;
  /** 공용 메모. 아직 아무도 안 썼으면 null. */
  note(): Promise<TodoNote | null>;
}

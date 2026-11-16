import type { Todo } from '@/entities/admin/todo';
import type { SaveTodoInput, SaveTodoResult } from '../model/saveTodo';

/** 📋 할 일 쓰기 — 만들기 · 고치기 · 지우기 · 제보 연결. 남이 먼저 고쳤으면 쓰지 않고 지금 값을 돌려준다(`conflict`). */
export interface EditTodoPort {
  /** 완료로 바꿀 때 «연결된 제보를 수정 완료로» 를 같이 해 주는 판인가. 아니면 화면이 그 물음을 띄우지 않는다. */
  readonly fixesReports: boolean;
  /** 만들기(`seen` 없음) · 고치기 — 화면이 읽은 할 일(`seen`)을 그대로 받는다. */
  save(input: SaveTodoInput): Promise<SaveTodoResult>;
  delete(todo: Todo): Promise<SaveTodoResult>;
  /** 제보 하나를 할 일에 붙이기 — 이미 붙어 있으면 쓰지 않는다. */
  link(todo: Todo, reportId: string, names: ReadonlyMap<string, string>): Promise<SaveTodoResult>;
}

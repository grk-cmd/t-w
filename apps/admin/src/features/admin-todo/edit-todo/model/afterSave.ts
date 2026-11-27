import type { Todo } from '@/entities/admin/todo';
import type { SaveTodoResult } from './saveTodo';

export interface AfterTodoEffects {
  /** 목록을 다시 받는다. */
  refreshTodos: () => unknown;
  /** 받아 둔 목록을 이것으로 바꾼다(다시 받지 않는다). */
  setTodos: (todos: Todo[]) => unknown;
  refreshBugs: () => unknown;
}

/**
 * 쓴 뒤의 화면 정리 — 성공이든 충돌이든 목록을 최신으로(충돌이면 최신 값을 봐야 하니까). 제보를 바꿨으면 제보 목록도.
 * 포트가 최신 목록을 이미 받아 왔으면(`list`) 그것을 그대로 두고 같은 목록을 또 받지 않는다.
 */
export function afterTodoSave(r: SaveTodoResult, fx: AfterTodoEffects): void {
  if (!r.ok && 'conflict' in r && r.list) fx.setTodos(r.list);
  else if (r.ok || 'conflict' in r) void fx.refreshTodos();
  if (r.ok && (r.fixed || r.fixFailed)) void fx.refreshBugs();
}

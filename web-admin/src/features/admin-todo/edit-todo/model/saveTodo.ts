import { adminNameOf } from '@/entities/admin/name';
import { draftOf, type Todo, type TodoDraft } from '@/entities/admin/todo';

export type SaveTodoResult =
  | {
      ok: true;
      id: string;
      fixed: number;
      /** 제보를 «수정 완료» 로 바꾸다 일부가 안 됐을 때(할 일 저장은 됐다) — 안 된 수 · 첫 원인. */
      fixFailed?: { count: number; reason: string };
    }
  | { ok: false; reason: string }
  | {
      ok: false;
      conflict: true;
      latest: Todo | null;
      /** 포트가 최신 값을 찾으려고 방금 받은 목록 — 있으면 화면이 그대로 캐시에 두고 다시 받지 않는다(Firebase 판은 없다). */
      list?: Todo[];
    };

export interface SaveTodoInput {
  id: string;
  /** 화면에서 본 값 — 새로 만들면 null. 이 값의 rev 그대로일 때만 쓴다. */
  seen: Todo | null;
  draft: TodoDraft;
  names: ReadonlyMap<string, string>;
  /** 완료로 바꾸면서 연결된 제보를 «수정 완료» 로 — 확인 창에서 «예» 일 때만. */
  markFixed?: boolean;
}

/** 작업자 이름 — 이름표에서, 없으면 같은 작업자일 때 저장돼 있던 이름. 모르면 빈 글자(작업자 이름 칸은 비워 둔다). */
export function assigneeNameOf(d: TodoDraft, seen: Todo | null, names: ReadonlyMap<string, string>): string {
  if (!d.assignee) return '';
  return names.get(d.assignee) ?? (seen?.assignee === d.assignee ? seen.assigneeName : '');
}

/** 제보 하나를 할 일에 붙이기 — 이미 붙어 있으면 쓰지 않는다. `save` 는 그 판의 쓰기. */
export function linkWith(
  save: (input: SaveTodoInput) => Promise<SaveTodoResult>,
  todo: Todo,
  reportId: string,
  names: ReadonlyMap<string, string>,
): Promise<SaveTodoResult> {
  if (todo.reports.includes(reportId)) return Promise.resolve({ ok: true, id: todo.id, fixed: 0 });
  const draft: TodoDraft = { ...draftOf(todo), reports: [...todo.reports, reportId] };
  return save({ id: todo.id, seen: todo, draft, names });
}

/** 충돌 안내 — «방금 ○○님이 바꿨어요». 지워졌으면 그렇게. */
export function conflictMessage(
  latest: Todo | null,
  names: ReadonlyMap<string, string>,
  me: string | null,
): string {
  if (!latest) return '방금 다른 관리자가 이 할 일을 지웠어요';
  const who = latest.updatedBy === me ? '다른 창에서 내가' : `${adminNameOf(latest.updatedBy, names)}님이`;
  return `방금 ${who} 바꿨어요 — 최신 내용으로 다시 불러왔어요`;
}

/** 실패 결과 → 안내 문구. */
export function resultMessage(
  r: Exclude<SaveTodoResult, { ok: true }>,
  names: ReadonlyMap<string, string>,
  me: string | null,
): string {
  return 'reason' in r ? r.reason : conflictMessage(r.latest, names, me);
}

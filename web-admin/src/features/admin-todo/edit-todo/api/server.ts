// API 판 — 만들기 `POST /v2/admin/todos` · 고치기 `PATCH …/{id}`(`version` 필수) · 지우기 `DELETE …/{id}?version=` → 한 줄 응답.
// 작업 기록은 서버가 같은 트랜잭션에 남긴다. 제목 · 메모 · 제보 수 · 버전 모양 판정은 서버가 한다 — 값은 그대로 보내고 400 은 서버 문구로 띄운다.
// 연결된 제보는 번호(`B-MMDD-n`)다. 이 판은 완료로 바꿀 때 제보 상태를 같이 바꾸지 않는다(그 일은 «릴리스 반영» 이 한다).
// 남이 먼저 고쳤으면(409) 또는 그새 지워졌으면(`OPS_TODO_NOT_FOUND`) 목록을 한 번 다시 받아 그 할 일의 지금 값(지워졌으면 null)을 돌려준다.
import { createServerTodoPort, toTodoRow, type Todo } from '@/entities/admin/todo';
import { adminPath, isPortError, perApi, portCall, type Api, type PortError } from '@/shared/api';
import { assigneeNameOf, linkWith, type SaveTodoInput, type SaveTodoResult } from '../model/saveTodo';
import type { EditTodoPort } from './port';

const TODOS = adminPath('/todos');
const todoPath = (id: string) => `${TODOS}/${encodeURIComponent(id)}`;

/** 남이 먼저 고쳤거나 그새 지워졌다 — 화면이 «최신 값으로 다시 채우기» 로 받는 실패. */
const lost = (error: unknown): error is PortError =>
  isPortError(error, 'conflict') || (isPortError(error, 'notFound') && error.code === 'OPS_TODO_NOT_FOUND');

function build(api: Api | null): EditTodoPort {
  const todos = createServerTodoPort(api);

  /** 겹침 · 지워짐 뒤 — 목록을 한 번 다시 받아 그 할 일의 지금 값을 찾는다. 다시 받지 못하면 그 실패를 던진다. */
  async function latestOf(id: string): Promise<SaveTodoResult> {
    const latest = (await todos.list()).find((t) => t.id === id) ?? null;
    return { ok: false, conflict: true, latest };
  }

  async function save(input: SaveTodoInput): Promise<SaveTodoResult> {
    const { id, seen, draft, names } = input;
    const body = {
      ...(seen ? { version: seen.rev } : {}),
      title: draft.title,
      memo: draft.memo,
      status: draft.status,
      type: draft.type,
      assignee: draft.assignee,
      assigneeName: draft.assignee ? assigneeNameOf(draft, seen, names) : null,
      reports: draft.reports,
      release: draft.release,
    };
    try {
      const saved: Todo = toTodoRow(
        await portCall(
          api,
          (a) =>
            seen
              ? a.send<unknown>('PATCH', todoPath(seen.id), { body })
              : a.send<unknown>('POST', TODOS, { body }),
          '저장하지 못했어요',
        ),
      );
      return { ok: true, id: saved.id, fixed: 0 };
    } catch (error) {
      if (seen && lost(error)) return latestOf(id);
      throw error;
    }
  }

  return {
    fixesReports: false,
    save,
    async delete(todo) {
      try {
        await portCall(
          api,
          (a) => a.send<unknown>('DELETE', todoPath(todo.id), { query: { version: todo.rev } }),
          '지우지 못했어요',
        );
        return { ok: true, id: todo.id, fixed: 0 };
      } catch (error) {
        if (lost(error)) return latestOf(todo.id);
        throw error;
      }
    },
    link: (todo, reportId, names) => linkWith(save, todo, reportId, names),
  };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerEditTodoPort = perApi(build);

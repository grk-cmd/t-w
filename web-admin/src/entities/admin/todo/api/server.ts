// API 판 — 할 일 `GET /v2/admin/todos?cursor&limit`(최근에 고친 것부터 키셋 · limit 1~200) · 공용 메모 `GET /v2/admin/todo-note`.
// 할 일은 몇십~몇백 건이라 끝까지 이어 받아 한 목록으로 둔다(화면이 거르고 찾는다). 줄은 `version` 을 `rev` 에 싣는다 — 저장 · 지우기가 그대로 돌려준다.
// 칸이 약속과 다르면 줄을 버리거나 짐작으로 채우지 않고 던진다. memo · type · assignee · assigneeName · release 의 null 만 문서가 약속한 «없음».
import {
  adminPath,
  perApi,
  portCall,
  wireArray,
  wireError,
  wireNullableString,
  wireNumber,
  wireObject,
  wireString,
  wireTime,
  type Api,
} from '@/shared/api';
import {
  sortTodos,
  TODO_STATUSES,
  TODO_TYPES,
  type Todo,
  type TodoStatus,
  type TodoType,
} from '../model/adminTodo';
import type { TodoNote } from '../model/todoNote';
import type { TodoPort } from './port';

const TODOS_PATH = adminPath('/todos');
const NOTE_PATH = adminPath('/todo-note');
/** 서버 한 번에 받는 상한(`limit` 1~200). */
const PAGE_MAX = 200;

/** 서버 할 일 한 줄 → 화면 줄. */
export function toTodoRow(w: unknown): Todo {
  const o = wireObject(w, '할 일 줄');
  const id = wireString(o.todoId, '할 일 줄의 todoId');
  const what = (field: string) => `할 일 ${id} 의 ${field}`;
  const status = wireString(o.status, what('status'));
  if (!TODO_STATUSES.includes(status as TodoStatus))
    throw wireError(what('status'), TODO_STATUSES.join(' · '));
  const type = wireNullableString(o.type, what('type'));
  if (type !== null && !TODO_TYPES.includes(type as TodoType))
    throw wireError(what('type'), TODO_TYPES.join(' · '));
  return {
    id,
    title: wireString(o.title, what('title')),
    memo: wireNullableString(o.memo, what('memo')) ?? '',
    status: status as TodoStatus,
    type: type as TodoType | null,
    assignee: wireNullableString(o.assignee, what('assignee')),
    assigneeName: wireNullableString(o.assigneeName, what('assigneeName')) ?? '',
    reports: wireArray(o.reports, what('reports')).map((r) => wireString(r, what('reports 의 한 줄'))),
    release: wireNullableString(o.release, what('release')) ?? '',
    createdBy: wireString(o.createdBy, what('createdBy')),
    createdAt: wireTime(o.createdAt, what('createdAt')),
    updatedBy: wireString(o.updatedBy, what('updatedBy')),
    updatedAt: wireTime(o.updatedAt, what('updatedAt')),
    rev: wireNumber(o.version, what('version')),
  };
}

/**
 * 서버 메모 → 화면 메모. 아직 아무도 안 쓴 메모는 `updatedBy` · `updatedAt` 이 null · `version` 0 · 빈 글(문서가 약속한 «없음») → null.
 * 한쪽만 null 이거나 쓴 적 없는데 번호가 0 이 아니면 약속과 다른 응답.
 */
export function toNoteRow(w: unknown): TodoNote | null {
  const o = wireObject(w, '공용 메모');
  const text = wireString(o.text, '공용 메모의 text');
  const rev = wireNumber(o.version, '공용 메모의 version');
  const by = wireNullableString(o.updatedBy, '공용 메모의 updatedBy');
  const at = o.updatedAt === null ? null : wireTime(o.updatedAt, '공용 메모의 updatedAt');
  if (by === null && at === null) {
    if (rev !== 0 || text !== '') throw wireError('공용 메모', '쓴 적 없으면 version 0 · 빈 글');
    return null;
  }
  if (by === null || at === null)
    throw wireError('공용 메모', 'updatedBy · updatedAt 둘 다 있거나 둘 다 없음');
  return { text, rev, updatedBy: by, updatedAt: at };
}

function build(api: Api | null): TodoPort {
  return {
    list: () =>
      portCall(
        api,
        async (a) => {
          const rows: Todo[] = [];
          let cursor: string | undefined;
          do {
            const page = wireObject(
              await a.get<unknown>(TODOS_PATH, { cursor, limit: PAGE_MAX }),
              '할 일 쪽',
            );
            rows.push(...wireArray(page.items, '할 일 쪽의 items').map(toTodoRow));
            cursor = wireNullableString(page.nextCursor, '할 일 쪽의 nextCursor') ?? undefined;
          } while (cursor !== undefined);
          return sortTodos(rows);
        },
        '할 일을 불러오지 못했어요',
      ),

    note: () =>
      portCall(api, async (a) => toNoteRow(await a.get<unknown>(NOTE_PATH)), '메모를 불러오지 못했어요'),
  };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerTodoPort = perApi(build);

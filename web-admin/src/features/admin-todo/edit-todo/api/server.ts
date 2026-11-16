// API 판 — 만들기 `POST /v2/admin/todos` · 고치기 `PATCH …/{id}`(`version` 필수) · 지우기 `DELETE …/{id}?version=` → 한 줄 응답.
// 만들기는 `requestId` 를 싣는다. 작업 기록은 서버가 같은 트랜잭션에 남긴다. 제목 · 메모 · 제보 수 · 버전 모양 판정은 서버가 한다 — 값은 그대로 보내고 400 은 서버 문구로 띄운다.
// 연결된 제보는 번호(`B-MMDD-n`)다. 완료로 바꾸며 «제보도 수정 완료로» 를 고르면 할 일을 저장한 뒤 제보마다 `GET /v2/bugs/{n}` 으로 version 을 읽고 `PATCH /v2/admin/bugs/{n} { version, status }` 한다(요청이 따로라 일부만 될 수 있다 — 안 된 수 · 원인을 결과에 싣는다).
// 남이 먼저 고쳤으면(409) 또는 그새 지워졌으면(`OPS_TODO_NOT_FOUND`) 목록을 한 번 다시 받아 그 할 일의 지금 값(지워졌으면 null)을 돌려준다.
import { becomesDone, createServerTodoPort, toTodoRow, type Todo } from '@/entities/admin/todo';
import {
  adminPath,
  isPortError,
  perApi,
  portCall,
  wireNumber,
  wireObject,
  wireString,
  type Api,
  type PortError,
} from '@/shared/api';
import { createPayloadRequestId } from '@/shared/lib';
import { assigneeNameOf, linkWith, type SaveTodoInput, type SaveTodoResult } from '../model/saveTodo';
import type { EditTodoPort } from './port';

const TODOS = adminPath('/todos');
const BUGS = '/v2/bugs';
const ADMIN_BUGS = adminPath('/bugs');
/** 서버 글 상태 중 미해결 — 이것만 «수정 완료» 로 바꾼다(다 된 글 · 재현 안 됨은 그대로). */
const OPEN_BUG = ['NEW', 'CHECKING', 'REVIEW', 'UNFIXED'];
const todoPath = (id: string) => `${TODOS}/${encodeURIComponent(id)}`;

/** 남이 먼저 고쳤거나 그새 지워졌다 — 화면이 «최신 값으로 다시 채우기» 로 받는 실패. */
const lost = (error: unknown): error is PortError =>
  isPortError(error, 'conflict') || (isPortError(error, 'notFound') && error.code === 'OPS_TODO_NOT_FOUND');

function build(api: Api | null): EditTodoPort {
  const todos = createServerTodoPort(api);
  // 만들기만 — 답을 못 받고 다시 누르면 같은 내용에 같은 번호(서버가 처음 만든 할 일을 돌려준다).
  const once = createPayloadRequestId();

  /** 겹침 · 지워짐 뒤 — 목록을 한 번 다시 받아 그 할 일의 지금 값을 찾는다. 다시 받지 못하면 그 실패를 던진다. */
  async function latestOf(id: string): Promise<SaveTodoResult> {
    const latest = (await todos.list()).find((t) => t.id === id) ?? null;
    return { ok: false, conflict: true, latest };
  }

  /** 연결된 제보 중 미해결인 것만 «수정 완료» 로 — 제보마다 따로 읽고 따로 고친다. 지워진 글은 건너뛴다. */
  async function fixBugs(numbers: readonly string[]) {
    const settled = await Promise.allSettled(
      numbers.map(async (n) => {
        const path = `${BUGS}/${encodeURIComponent(n)}`;
        let detail: Record<string, unknown>;
        try {
          detail = wireObject(
            await portCall(api, (a) => a.get<unknown>(path), '제보를 불러오지 못했어요'),
            `제보 ${n}`,
          );
        } catch (error) {
          if (isPortError(error, 'notFound') && error.code === 'BUG_NOT_FOUND') return false;
          throw error;
        }
        if (!OPEN_BUG.includes(wireString(detail.status, `제보 ${n} 의 status`))) return false;
        const version = wireNumber(detail.version, `제보 ${n} 의 version`);
        await portCall(
          api,
          (a) =>
            a.send<unknown>('PATCH', `${ADMIN_BUGS}/${encodeURIComponent(n)}`, {
              body: { version, status: 'FIXED' },
            }),
          '제보를 고치지 못했어요',
        );
        return true;
      }),
    );
    const fixed = settled.filter((r) => r.status === 'fulfilled' && r.value).length;
    const failed = settled.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (!failed.length) return { fixed };
    const first = failed[0].reason;
    return {
      fixed,
      fixFailed: {
        count: failed.length,
        reason: first instanceof Error ? first.message : String(first),
        conflict: failed.some((r) => isPortError(r.reason, 'conflict')),
      },
    };
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
              : once(body, (requestId) => a.send<unknown>('POST', TODOS, { body: { requestId, ...body } })),
          '저장하지 못했어요',
        ),
      );
      if (!input.markFixed || !becomesDone(seen, draft)) return { ok: true, id: saved.id, fixed: 0 };
      return { ok: true, id: saved.id, ...(await fixBugs(draft.reports)) };
    } catch (error) {
      if (seen && lost(error)) return latestOf(id);
      throw error;
    }
  }

  return {
    fixesReports: true,
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

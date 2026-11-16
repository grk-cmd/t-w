// API 판 — `PUT /v2/admin/todo-note { version, text }` → 한 장의 메모. 쓴 적 없는 메모는 version 0(읽은 메모가 없으면 0 을 싣는다).
// 작업 기록은 서버가 남긴다. 글 길이 판정은 서버가 한다 — 값은 그대로 보내고(끝 공백도 자르지 않는다) 400 은 서버 문구로 띄운다.
// 남이 먼저 고쳤으면(409) 메모를 한 번 다시 받아 지금 값을 돌려준다. 다시 받지 못하면 그 실패를 던진다.
import { createServerTodoPort, toNoteRow } from '@/entities/admin/todo';
import { adminPath, isPortError, perApi, portCall, type Api } from '@/shared/api';
import type { EditNotePort } from './port';

const NOTE = adminPath('/todo-note');

function build(api: Api | null): EditNotePort {
  const todos = createServerTodoPort(api);
  return {
    check: () => null,
    async save(seen, text) {
      try {
        const answer = await portCall(
          api,
          (a) => a.send<unknown>('PUT', NOTE, { body: { version: seen?.rev ?? 0, text } }),
          '메모를 저장하지 못했어요',
        );
        // 저장한 값이 약속한 모양인지만 본다 — 화면은 이어서 메모를 다시 받는다.
        toNoteRow(answer);
        return { ok: true };
      } catch (error) {
        if (isPortError(error, 'conflict')) return { ok: false, conflict: true, latest: await todos.note() };
        throw error;
      }
    },
  };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerEditNotePort = perApi(build);

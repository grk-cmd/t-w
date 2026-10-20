/*
 * 📝 할 일 공용 메모 — adminTodoNote 한 칸. 관리자끼리 같이 보는 자유 메모.
 *   { text, rev, updatedBy, updatedAt } — 관리자만 읽고 쓴다(규칙).
 * rev — 할 일과 같다. 규칙이 «지금 rev + 1»(처음이면 0)만 받아서, 본 뒤 남이 먼저 고쳤으면 내 쓰기가 거절된다.
 */
export const TODO_NOTE_PATH = 'adminTodoNote';
// 규칙 adminTodoNote/text 와 같다.
export const TODO_NOTE_MAX = 2000;

export interface TodoNote {
  text: string;
  rev: number;
  updatedBy: string;
  updatedAt: number;
}

/** 읽은 값 → 메모. 아직 아무도 안 썼거나 모양이 틀리면 null. */
export function toTodoNote(v: unknown): TodoNote | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (typeof r.text !== 'string' || typeof r.rev !== 'number') return null;
  return {
    text: r.text,
    rev: r.rev,
    updatedBy: typeof r.updatedBy === 'string' ? r.updatedBy : '',
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : 0,
  };
}

/** 입력 확인 — 문제없으면 null. 빈 메모(비우기)도 된다. */
export function checkTodoNote(text: string): string | null {
  const n = text.trimEnd().length;
  return n > TODO_NOTE_MAX ? `메모는 ${TODO_NOTE_MAX}자까지 (지금 ${n}자)` : null;
}

/** 저장할 값 — 처음이면 rev 0, 고치면 본 값(prev)의 rev + 1. 끝 공백만 정리한다(줄바꿈 · 들여쓰기는 그대로). */
export function todoNoteValue(
  text: string,
  prev: Pick<TodoNote, 'rev'> | null,
  me: string,
  now: unknown,
): Record<string, unknown> {
  return {
    text: text.trimEnd().slice(0, TODO_NOTE_MAX),
    rev: prev ? prev.rev + 1 : 0,
    updatedBy: me,
    updatedAt: now,
  };
}

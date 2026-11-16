import { adminNameOf } from '@/entities/admin/name';
import type { TodoNote } from '@/entities/admin/todo';

export type SaveNoteResult =
  { ok: true } | { ok: false; reason: string } | { ok: false; conflict: true; latest: TodoNote | null };

/** 작업 기록 detail — 메모 본문은 기록에 남기지 않고 길이만(기록은 120자라 어차피 잘린다). */
export function noteChange(prev: TodoNote | null, text: string): string {
  const after = text.trimEnd().length;
  return prev ? `${prev.text.length}자 → ${after}자` : `처음 작성 · ${after}자`;
}

/** 충돌 안내 — «방금 ○○님이 고쳤어요». */
export function noteConflictMessage(
  latest: TodoNote | null,
  names: ReadonlyMap<string, string>,
  me: string | null,
): string {
  if (!latest) return '방금 메모가 지워졌어요 — 다시 불러왔어요';
  const who = latest.updatedBy === me ? '다른 창에서 내가' : `${adminNameOf(latest.updatedBy, names)}님이`;
  return `방금 ${who} 메모를 고쳤어요 — 최신 내용으로 다시 불러왔어요`;
}

import type { TodoNote } from '@/entities/admin/todo';
import type { SaveNoteResult } from './saveNote';

export interface AfterNoteEffects {
  refresh: () => unknown;
  /** 받아 둔 메모를 이것으로 바꾼다(다시 받지 않는다). */
  setNote: (note: TodoNote | null) => unknown;
}

/** 쓴 뒤 — 성공이든 충돌이든 메모를 최신으로. 포트가 최신 메모를 이미 받아 왔으면(`fresh`) 그것을 두고 또 받지 않는다. */
export function afterNoteSave(r: SaveNoteResult, fx: AfterNoteEffects): void {
  if (!r.ok && 'conflict' in r && r.fresh) fx.setNote(r.latest);
  else if (r.ok || 'conflict' in r) void fx.refresh();
}

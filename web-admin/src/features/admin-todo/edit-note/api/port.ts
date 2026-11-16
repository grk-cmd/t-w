import type { TodoNote } from '@/entities/admin/todo';
import type { SaveNoteResult } from '../model/saveNote';

/** 📝 할 일 공용 메모 쓰기. */
export interface EditNotePort {
  /** 입력 칸 곁 안내 — 문제없으면 null. 판정이 서버 몫인 판은 늘 null. */
  check(text: string): string | null;
  /** 저장 — 화면이 읽은 메모(처음이면 null)를 그대로 받는다. 남이 먼저 고쳤으면 쓰지 않고 지금 값을 돌려준다. */
  save(seen: TodoNote | null, text: string): Promise<SaveNoteResult>;
}

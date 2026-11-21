import { auditEntry, type Db } from '@/shared/api';

/*
 * 릴리스 반영 답변 템플릿 — 관리자끼리 같은 문구를 쓰게 DB 에 둔다. 규칙: 관리자만 · 글자 1~1000자 · 읽기도 관리자만(config).
 * 칸이 없으면 코드 기본 문구(RELEASE_TPL_DEFAULT). 앱은 읽지 않는다.
 */
export const RELEASE_TPL_PATH = 'config/releaseAnswerTpl';
export const RELEASE_TPL_KEY = ['config', 'releaseAnswerTpl'];

/** 저장된 템플릿 — 없거나 모양이 틀리면 null(기본 문구). */
export async function getReleaseTpl(db: Db): Promise<string | null> {
  const v = await db.get<unknown>(RELEASE_TPL_PATH);
  return typeof v === 'string' && v.trim() ? v : null;
}

/** 저장(null 이면 지워서 기본 문구로) + 작업 기록 한 줄. 템플릿은 비밀이 아니라 기록에 앞부분을 남긴다. */
export function releaseTplWrite(db: Db, tpl: string | null): Record<string, unknown> {
  const value = tpl === null ? null : tpl.trim();
  return {
    [RELEASE_TPL_PATH]: value,
    ...auditEntry(
      db,
      'todo.releaseTpl',
      value === null ? '기본 문구로 되돌림' : '템플릿 저장',
      value ?? undefined,
    ),
  };
}

export function saveReleaseTpl(db: Db, tpl: string | null): Promise<void> {
  return db.commit(releaseTplWrite(db, tpl));
}

/*
 * 릴리스 반영 답변 템플릿 — 관리자끼리 같은 문구를 쓰게 DB 에 둔다. 규칙: 관리자만 · 글자 1~1000자 · 읽기도 관리자만(config).
 * 칸이 없으면 코드 기본 문구(RELEASE_TPL_DEFAULT). 앱은 읽지 않는다.
 */
export const RELEASE_TPL_PATH = 'config/releaseAnswerTpl';
export const RELEASE_TPL_KEY = ['config', 'releaseAnswerTpl'];

/** 관리자끼리 쓰는 릴리스 답변 틀 — `saved` 가 null 이면 저장된 것이 없어 `fallback`(기본 문구)을 쓴다. */
export interface ReleaseTemplate {
  saved: string | null;
  fallback: string;
}

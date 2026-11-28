/*
 * 🌐 홈페이지(together-working.com) 소식 · 💾 웹 내려받기 — 관리자 쪽 모양.
 * 원본은 자체 서버. 홈페이지는 공개 GET /v2/site 로 읽는다(apps/web entities/site). 서버 응답을 화면 모양으로 맞추는 곳은 여기뿐.
 *   GET · POST /v2/admin/site/news · PATCH · DELETE /v2/admin/site/news/{id}   소식(고쳐 쓰기 · 지우기는 version — 다르면 409)
 *   GET · PUT  /v2/admin/site/download                                      열림 · 판(PUT 은 rev — 다르면 409)
 */

export const SITE_LANGS = ['ko', 'en', 'ja'] as const;
export type SiteLang = (typeof SITE_LANGS)[number];
export const SITE_LANG_LABEL: Record<SiteLang, string> = { ko: '한국어', en: 'English', ja: '日本語' };
/** 서버와 같은 상한 — 넘으면 서버가 400 */
export const SITE_TITLE_MAX = 60;
export const SITE_BODY_MAX = 400;

export type SiteText = Record<SiteLang, string>;

export interface SiteNews {
  id: string;
  pinned: boolean;
  title: SiteText;
  body: SiteText;
  /** 공개한 때(ms) */
  publishedAt: number;
  /** 고쳐 쓰기 · 지우기에 그대로 돌려보낸다 */
  version: number;
}

/** 쓰기 칸 — 새 글 · 고치기 같은 모양 */
export interface SiteNewsDraft {
  pinned: boolean;
  title: SiteText;
  body: SiteText;
}

export interface SiteDownload {
  open: boolean;
  /** GitHub 릴리스 판(앞 v 없이 · 예 0.14.0) */
  version: string | null;
  files: { win: string | null; macArm64: string | null; macX64: string | null };
  /** 저장에 그대로 돌려보낸다 */
  rev: number;
}

export const emptyNewsDraft = (): SiteNewsDraft => ({
  pinned: false,
  title: { ko: '', en: '', ja: '' },
  body: { ko: '', en: '', ja: '' },
});
export const newsToDraft = (n: SiteNews): SiteNewsDraft => ({
  pinned: n.pinned,
  title: { ...n.title },
  body: { ...n.body },
});

type Check<T> = { ok: true; next: T } | { ok: false; error: string };

/** 저장해도 되는지 — 한국어 제목은 꼭 · 상한 · 본문만 있고 제목이 없는 언어는 안 됨(홈페이지는 제목이 있는 언어에만 글을 보인다) */
export function checkNewsDraft(d: SiteNewsDraft): Check<SiteNewsDraft> {
  const title = { ko: d.title.ko.trim(), en: d.title.en.trim(), ja: d.title.ja.trim() };
  const body = { ko: d.body.ko.trim(), en: d.body.en.trim(), ja: d.body.ja.trim() };
  if (!title.ko) return { ok: false, error: '한국어 제목은 꼭 써 주세요' };
  for (const l of SITE_LANGS) {
    if (title[l].length > SITE_TITLE_MAX)
      return { ok: false, error: `${SITE_LANG_LABEL[l]} 제목은 ${SITE_TITLE_MAX}자까지예요` };
    if (body[l].length > SITE_BODY_MAX)
      return { ok: false, error: `${SITE_LANG_LABEL[l]} 본문은 ${SITE_BODY_MAX}자까지예요` };
    if (body[l] && !title[l])
      return { ok: false, error: `${SITE_LANG_LABEL[l]} 본문이 있으면 제목도 써 주세요` };
  }
  return { ok: true, next: { pinned: d.pinned, title, body } };
}

/** 같은 글인지(고치기에서 바뀐 게 없으면 저장하지 않게) */
export function sameNews(a: SiteNewsDraft, b: SiteNewsDraft): boolean {
  return (
    a.pinned === b.pinned && SITE_LANGS.every((l) => a.title[l] === b.title[l] && a.body[l] === b.body[l])
  );
}

/** 내려받기 저장값 — 열려면 판을 골라야 한다 · 고를 수 있는 판은 정식 릴리스 목록(versions) 안에서만 */
export function checkDownload(
  saved: SiteDownload,
  draft: { open: boolean; version: string | null },
  versions: readonly string[] | null,
): Check<{ open: boolean; version: string | null; rev: number }> {
  if (draft.open && !draft.version) return { ok: false, error: '열려면 내보일 판을 골라 주세요' };
  if (draft.version && versions && !versions.includes(draft.version))
    return { ok: false, error: '정식 릴리스 목록에 없는 판이에요' };
  if (draft.open === saved.open && draft.version === saved.version)
    return { ok: false, error: '지금 값과 같음' };
  return { ok: true, next: { open: draft.open, version: draft.version, rev: saved.rev } };
}

export function downloadConfirmText(next: { open: boolean; version: string | null }): string {
  return next.open
    ? `홈페이지 내려받기를 열어요(판 ${next.version}) — 누구나 홈페이지에서 설치 파일을 받을 수 있어요.`
    : '홈페이지 내려받기를 닫아요 — 단추가 «준비 중» 으로 돌아가요.';
}

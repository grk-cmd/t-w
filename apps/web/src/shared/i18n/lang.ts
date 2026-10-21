import { en, ja, ko, type Messages } from './messages';

/** 페이지 언어 — 언어마다 미리 그린 HTML 한 장(주소가 언어를 정한다: 검색 · 공유 링크가 언어째 남는다) */
export const LANGS = ['ko', 'en', 'ja'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'ko';

const MESSAGES: Record<Lang, Messages> = { ko, en, ja };
/** 언어 고르기 메뉴에 보이는 이름 — 그 언어로 적는다(어느 페이지에서 봐도 같다) */
export const LANG_NAMES: Record<Lang, string> = { ko: '한국어', en: 'English', ja: '日本語' };

export const isLang = (v: unknown): v is Lang =>
  typeof v === 'string' && (LANGS as readonly string[]).includes(v);

export const messagesFor = (lang: Lang): Messages => MESSAGES[lang];

/** 그 언어 페이지의 경로 — 기본 언어는 맨 앞(/), 나머지는 /en/ · /ja/ */
export const pathFor = (lang: Lang): string => (lang === DEFAULT_LANG ? '/' : `/${lang}/`);

/** 경로 → 언어. 첫 마디가 언어 이름이 아니면 기본 언어 */
export function langFromPath(pathname: string): Lang {
  const first = pathname.split('/').find(Boolean);
  return isLang(first) && first !== DEFAULT_LANG ? first : DEFAULT_LANG;
}

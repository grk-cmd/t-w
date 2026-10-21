import { SITE_ORIGIN } from '@/shared/config';
import { DEFAULT_LANG, LANGS, messagesFor, pathFor, type Lang } from '@/shared/i18n';

/** <head> 에 들어갈 언어별 줄 — 제목 · 설명 · 대표 주소 · 다른 언어 주소(검색 엔진이 언어별 페이지를 묶는다) */
export function HomeHead({ lang }: { lang: Lang }) {
  const m = messagesFor(lang);
  const url = SITE_ORIGIN + pathFor(lang);
  return (
    <>
      <title>{m.metaTitle}</title>
      <meta name="description" content={m.metaDescription} />
      <link rel="canonical" href={url} />
      {LANGS.map((l) => (
        <link key={l} rel="alternate" hrefLang={l} href={SITE_ORIGIN + pathFor(l)} />
      ))}
      <link rel="alternate" hrefLang="x-default" href={SITE_ORIGIN + pathFor(DEFAULT_LANG)} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={m.metaTitle} />
      <meta property="og:description" content={m.metaDescription} />
      <meta property="og:url" content={url} />
    </>
  );
}

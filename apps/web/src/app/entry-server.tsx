import { StrictMode } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { HomeHead } from '@/pages/home';
import { LANGS, pathFor, type Lang } from '@/shared/i18n';
import { fillTemplate } from '@/shared/lib/html-template';
import { App } from './App';

/** 빌드 때 언어마다 한 장씩 미리 그린다(scripts/prerender.mjs). 검색 노출 · 스크립트가 늦어도 첫 화면이 비지 않게. */
export function renderPage(lang: Lang) {
  return {
    lang,
    head: renderToStaticMarkup(<HomeHead lang={lang} />),
    body: renderToString(
      <StrictMode>
        <App lang={lang} />
      </StrictMode>,
    ),
  };
}

/** 언어마다 [쓸 파일, 내용] — 기본 언어는 index.html, 나머지는 en/index.html 처럼 */
export function prerenderAll(template: string): [string, string][] {
  return LANGS.map((lang) => {
    const file = `${pathFor(lang).replace(/^\//, '')}index.html`;
    return [file, fillTemplate(template, renderPage(lang))];
  });
}

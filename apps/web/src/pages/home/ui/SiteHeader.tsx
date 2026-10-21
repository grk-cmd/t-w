import { HELP_URL } from '@/shared/config';
import { LANGS, LANG_NAMES, pathFor, useI18n } from '@/shared/i18n';

/** 맨 위 메뉴 — 로고 · 메뉴 · 언어 · 다운로드. 언어 메뉴는 <details> 라 스크립트가 늦게 떠도 열린다(미리 그린 HTML 그대로 쓸 수 있다). */
export function SiteHeader() {
  const { lang, m } = useI18n();
  return (
    <header className="top">
      <div className="wrap">
        <a className="brand" href={pathFor(lang)}>
          <img alt="" src="/icons/tw-mini.png" width="28" height="26" />
          {m.siteName}
        </a>
        <nav className="nav" aria-label={m.navLabel}>
          <a href="#maker">{m.navMaker}</a>
          <a href="#about">{m.navAbout}</a>
          <a href={HELP_URL} target="_blank" rel="noopener noreferrer">
            {m.navHelp}
          </a>
        </nav>
        <div className="right">
          <details className="lang">
            <summary aria-label={m.langLabel}>{LANG_NAMES[lang]}</summary>
            <ul className="lang-menu">
              {LANGS.map((l) => (
                <li key={l}>
                  <a href={pathFor(l)} hrefLang={l} lang={l} aria-current={l === lang ? 'page' : undefined}>
                    {LANG_NAMES[l]}
                  </a>
                </li>
              ))}
            </ul>
          </details>
          <a className="btn default" href="#download">
            {m.navDownload}
          </a>
        </div>
      </div>
    </header>
  );
}

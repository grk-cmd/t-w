import type { ReactNode } from 'react';
import { I18nContext } from './i18n-context';
import { messagesFor, type Lang } from './lang';

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <I18nContext value={{ lang, m: messagesFor(lang) }}>{children}</I18nContext>;
}

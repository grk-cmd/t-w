import { createContext } from 'react';
import type { Lang } from './lang';
import type { Messages } from './messages';

export interface I18n {
  lang: Lang;
  m: Messages;
}

export const I18nContext = createContext<I18n | null>(null);

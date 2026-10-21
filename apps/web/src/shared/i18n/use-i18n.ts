import { useContext } from 'react';
import { I18nContext, type I18n } from './i18n-context';

export function useI18n(): I18n {
  const v = useContext(I18nContext);
  if (!v) throw new Error('I18nProvider 밖에서 useI18n 을 불렀다');
  return v;
}

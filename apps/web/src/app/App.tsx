import { HomePage } from '@/pages/home';
import { I18nProvider, type Lang } from '@/shared/i18n';

export function App({ lang }: { lang: Lang }) {
  return (
    <I18nProvider lang={lang}>
      <HomePage />
    </I18nProvider>
  );
}

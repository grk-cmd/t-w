import { useI18n } from '@/shared/i18n';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { DownloadPanel } from './DownloadPanel';
import { FeatureTour } from './FeatureTour';
import { Hero } from './Hero';

export function HomePage() {
  const { m } = useI18n();
  return (
    <>
      <a className="skip" href="#top">
        {m.skipToContent}
      </a>
      <SiteHeader />
      <main id="top">
        <Hero />
        <FeatureTour />
        <DownloadPanel />
      </main>
      <SiteFooter />
    </>
  );
}

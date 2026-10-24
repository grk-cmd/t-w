import { useI18n } from '@/shared/i18n';
import { DownloadIcon } from '@/shared/ui';
import { NewsSlot } from './NewsSlot';
import { TogetherLand } from './TogetherLand';

export function Hero() {
  const { m } = useI18n();
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap">
        <div className="hero-copy">
          <div className="hero-top">
            <img className="logo" src="/icons/icon-256.png" alt="" width="256" height="256" />
            <TogetherLand />
          </div>
          <p className="eyebrow">{m.heroEyebrow}</p>
          <h1 id="hero-title">
            {m.heroTitleA}
            <br />
            <em>{m.heroTitleB}</em>
          </h1>
          <p className="lead">
            {m.heroLead1}
            <br />
            {m.heroLead2}
          </p>
          <div className="cta">
            <a className="btn big default" href="#download">
              <DownloadIcon />
              {m.heroCtaDownload}
            </a>
            <a className="btn big" href="#maker">
              {m.heroCtaMaker}
            </a>
          </div>
          <p className="ver">{m.heroNote}</p>
        </div>
        <NewsSlot />
      </div>
    </section>
  );
}

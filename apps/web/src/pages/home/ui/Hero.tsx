import { useI18n } from '@/shared/i18n';
import { CREW } from '../model/crew';
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
          <p className="ver">{m.heroNote}</p>
        </div>
        <div className="hero-side">
          <NewsSlot />
          <div className="crew-row">
            {CREW.map((c) => (
              <img key={c.key} className="crew" src={c.src} width={c.w} height={c.h} alt={m.crewAlt[c.key]} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

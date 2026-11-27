import { useId, useState } from 'react';
import { useI18n } from '@/shared/i18n';
import { Win } from '@/shared/ui';

/** 소개 — 왼쪽 기능 목록(탭) · 오른쪽 설명. 미리 그린 HTML 은 첫 기능이 열린 채로 나간다. */
export function FeatureTour() {
  const { m } = useI18n();
  const [cur, setCur] = useState(0);
  const base = useId();
  const f = m.features[cur] ?? m.features[0];
  if (!f) return null;
  return (
    <section className="section wrap" id="about" aria-labelledby="about-title">
      <div className="sec-head">
        <h2 id="about-title">{m.aboutTitle}</h2>
        <p>{m.aboutLead}</p>
      </div>
      <Win title={m.aboutWinTitle} className="feat">
        <div className="feat-list field" role="tablist" aria-label={m.aboutListLabel}>
          {m.features.map((it, i) => (
            <button
              key={it.label}
              type="button"
              role="tab"
              id={`${base}-tab-${i}`}
              aria-selected={i === cur}
              aria-controls={`${base}-panel`}
              onClick={() => setCur(i)}
            >
              <span aria-hidden="true">{it.icon}</span>
              <b>{it.label}</b>
              <small>{it.sub}</small>
            </button>
          ))}
        </div>
        <div
          className="feat-show"
          role="tabpanel"
          id={`${base}-panel`}
          aria-labelledby={`${base}-tab-${cur}`}
        >
          <h3>{f.sub}</h3>
          <p>{f.text}</p>
        </div>
      </Win>
    </section>
  );
}

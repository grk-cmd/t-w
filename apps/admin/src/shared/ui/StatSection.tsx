import type { ReactNode } from 'react';
import styles from './StatSection.module.css';

export interface Stat {
  label: string;
  /** undefined = 불러오는 중(…) · null = 값 없음(–) */
  value: number | null | undefined;
  unit: string;
  hint?: string;
  /** 숫자 아래 작은 글씨(예: 최대가 나온 날 · 추정 금액) */
  sub?: string;
  main?: boolean;
  /** 빨갛게 — 평소보다 크게 늘었을 때 */
  alert?: boolean;
  /** 숫자 모양 — 기본은 천 단위 쉼표 */
  format?: (v: number) => string;
}

const show = (s: Stat) =>
  s.value === undefined ? '…' : s.value === null ? '–' : (s.format ?? ((v) => v.toLocaleString()))(s.value);

/** 지표 구역 — 제목 · 설명 · 숫자 칸 4개 · 그래프. alert 는 칸 아래 한 줄 경고, foot 은 그래프 아래 한 줄. */
export function StatSection({
  title,
  desc,
  stats,
  chart,
  alert,
  foot,
}: {
  title: string;
  desc: ReactNode;
  stats: Stat[];
  chart: ReactNode;
  alert?: ReactNode;
  foot?: ReactNode;
}) {
  return (
    <section className={`card ${styles.section}`} aria-label={title}>
      <div className={styles.head}>
        <h2>{title}</h2>
        <p className="soft">{desc}</p>
      </div>
      <div className={styles.stats}>
        {stats.map((s) => (
          <div
            key={s.label}
            className={`${styles.stat} ${s.main ? styles.statMain : ''} ${s.alert ? styles.statAlert : ''}`}
            title={s.hint}
            data-alert={s.alert ? 'true' : undefined}
          >
            <span className="soft">{s.label}</span>
            <strong>
              {show(s)}
              <small>{s.unit}</small>
            </strong>
            {s.sub && <small className="soft">{s.sub}</small>}
          </div>
        ))}
      </div>
      {alert && (
        <p className={styles.alert} role="alert">
          {alert}
        </p>
      )}
      {chart}
      {foot && <p className={`soft ${styles.foot}`}>{foot}</p>}
    </section>
  );
}

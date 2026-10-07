import type { DayMetrics } from '@/entities/daily-active';
import styles from './MetricsDashboard.module.css';

const W = 600;
const H = 140;
const PAD_TOP = 8;
const GAP = 2;

const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

// 한 계열 막대 — DAU 와 방문 수는 크기가 달라 한 축에 겹치지 않고 그래프를 나눈다. 막대에 올리면 그날 숫자가 뜬다.
export function DailyBars({
  title,
  unit,
  days,
  value,
}: {
  title: string;
  unit: string;
  days: readonly DayMetrics[];
  value: (d: DayMetrics) => number;
}) {
  const values = days.map(value);
  const max = Math.max(1, ...values);
  const slot = W / Math.max(1, days.length);
  const barW = Math.max(1, slot - GAP);
  const y = (v: number) => H - (v / max) * (H - PAD_TOP);

  return (
    <figure className={styles.chart}>
      <figcaption>
        <span>{title}</span>
        <span className="soft">
          최고 {max.toLocaleString()}
          {unit}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${title} 최근 ${days.length}일`}
      >
        <line x1={0} y1={H - 0.5} x2={W} y2={H - 0.5} className={styles.axis} />
        {days.map((d, i) => {
          const v = values[i];
          const top = y(v);
          return (
            <g key={d.date}>
              <rect x={i * slot} y={0} width={slot} height={H} className={styles.hit}>
                <title>{`${d.date} · ${v.toLocaleString()}${unit}`}</title>
              </rect>
              {v > 0 && (
                <rect
                  x={i * slot + GAP / 2}
                  y={top}
                  width={barW}
                  height={H - top}
                  rx={2}
                  className={styles.bar}
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className={`${styles.ticks} soft`}>
        <span>{days.length ? shortDate(days[0].date) : ''}</span>
        <span>{days.length ? shortDate(days[days.length - 1].date) : ''}</span>
      </div>
    </figure>
  );
}

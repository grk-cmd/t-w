import type { DayMetrics } from '@/entities/daily-active';
import styles from './MetricsDashboard.module.css';

const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
// 날짜 글자가 겹치지 않게 4일마다 하나 — 오늘은 따로 «오늘» 로 적는다.
const LABEL_EVERY = 4;

/** 눈금 위 끝 — 1 · 2 · 2.5 · 5 × 10ⁿ 중 최댓값 이상인 가장 작은 수. 눈금 숫자가 어중간하지 않게. */
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

// 한 계열 막대 — 계열마다 크기가 달라 한 축에 겹치지 않고 구역마다 그린다. 막대에 올리면 그날 숫자가 뜬다.
export function DailyBars({
  label,
  unit,
  days,
  value,
}: {
  label: string;
  unit: string;
  days: readonly DayMetrics[];
  value: (d: DayMetrics) => number;
}) {
  const values = days.map(value);
  const top = niceCeil(Math.max(0, ...values));
  const last = days.length - 1;

  return (
    <figure className={styles.chart}>
      <figcaption className={styles.legend}>
        <span>최근 {days.length}일</span>
        <span className="soft">
          <i className={styles.dot} /> {label} <i className={`${styles.dot} ${styles.dotToday}`} /> 오늘
        </span>
      </figcaption>
      <div className={styles.plot}>
        <div className={`${styles.yAxis} soft`} aria-hidden="true">
          <span>{top.toLocaleString()}</span>
          <span>{Number.isInteger(top / 2) ? (top / 2).toLocaleString() : ''}</span>
          <span>0</span>
        </div>
        <div className={styles.area} role="img" aria-label={`${label} 최근 ${days.length}일`}>
          <div className={styles.grid} aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          {days.map((d, i) => {
            const v = values[i];
            const tip = `${d.date} · ${v.toLocaleString()}${unit}`;
            return (
              <div key={d.date} className={styles.col} title={tip} data-tip={tip}>
                {v > 0 && (
                  <span
                    className={`${styles.bar} ${i === last ? styles.barToday : ''}`}
                    style={{ height: `${(v / top) * 100}%` }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className={`${styles.xAxis} soft`} aria-hidden="true">
        {days.map((d, i) => (
          <span key={d.date} className={i === last ? styles.xToday : undefined}>
            {i === last ? '오늘' : i % LABEL_EVERY === 0 && last - i >= 2 ? shortDate(d.date) : ''}
          </span>
        ))}
      </div>
    </figure>
  );
}

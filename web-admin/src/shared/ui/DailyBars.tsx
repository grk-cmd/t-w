import styles from './DailyBars.module.css';

/** 막대 하나 — 날짜(YYYY-MM-DD)와 그날 값. */
export interface DailyPoint {
  date: string;
  value: number;
}

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

/**
 * 한 계열 30일 막대 — 계열마다 크기가 달라 한 축에 겹치지 않고 구역마다 그린다. 막대에 올리면 그날 숫자가 뜬다.
 * 마지막 칸을 오늘로 칠한다. digits 는 소수 자리(GB 처럼 1 보다 작은 값이 나오는 계열).
 */
export function DailyBars({
  label,
  unit,
  days,
  digits = 0,
}: {
  label: string;
  unit: string;
  days: readonly DailyPoint[];
  digits?: number;
}) {
  const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: digits });
  const top = niceCeil(Math.max(0, ...days.map((d) => d.value)));
  const half = top / 2;
  const showHalf = Number.isInteger(half * 10 ** digits);
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
          <span>{fmt(top)}</span>
          <span>{showHalf ? fmt(half) : ''}</span>
          <span>0</span>
        </div>
        <div className={styles.area} role="img" aria-label={`${label} 최근 ${days.length}일`}>
          <div className={styles.grid} aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          {days.map((d, i) => {
            const tip = `${d.date} · ${fmt(d.value)}${unit}`;
            return (
              <div key={d.date} className={styles.col} title={tip} data-tip={tip}>
                {d.value > 0 && (
                  <span
                    className={`${styles.bar} ${i === last ? styles.barToday : ''}`}
                    style={{ height: `${(d.value / top) * 100}%` }}
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

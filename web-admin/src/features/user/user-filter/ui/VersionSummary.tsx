import { toVersionCounts, type VerFilter, type VersionCount } from '@/entities/user';
import styles from './VersionSummary.module.css';

export type { VerFilter } from '@/entities/user';

interface Props {
  /** 버전별 수 — API 통계 또는 받아 둔 계정 요약으로 센 것(사람마다 presence 를 읽지 않는다). */
  counts: VersionCount[];
  value: VerFilter;
  onChange: (ver: VerFilter) => void;
}

// «0.10.2 이하»(버전 기록 없음) 칩은 뺀다 — 계정 요약은 로그인된 기기만 다시 써서, 지금 0.11 인 사람도 여기로 몰린다.
// 표의 버전 칸은 presence 로 정확히 보인다(currentVer).
export function VersionSummary({ counts, value, onChange }: Props) {
  // 몫도 남은 칩끼리 다시 나눈다(합이 100%).
  const known = toVersionCounts(counts.filter((c) => c.ver !== null));
  if (!known.length) return null;

  return (
    <div className={styles.wrap}>
      <span className="soft">버전별 사용자</span>
      <div className={styles.list}>
        {known.map(({ ver, count, share }) => {
          const on = value === ver;
          const pct = Math.round(share * 100);
          return (
            <button
              key={ver ?? ''}
              type="button"
              className={on ? `${styles.item} ${styles.on}` : styles.item}
              aria-pressed={on}
              // 다시 누르면 푼다.
              onClick={() => onChange(on ? undefined : ver)}
            >
              <span className={styles.ver}>{ver ?? ''}</span>
              <span className={styles.bar} style={{ width: `${Math.max(pct, 1)}%` }} />
              <small>
                {count}명 · {pct}%
              </small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

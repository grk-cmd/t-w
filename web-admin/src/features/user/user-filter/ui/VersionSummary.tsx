import { ACTIVE_DAYS, OLD_VER_LABEL, type VerFilter, type VersionCount } from '@/entities/user';
import styles from './VersionSummary.module.css';

export type { VerFilter } from '@/entities/user';

interface Props {
  /** 버전별 수 — API 통계 또는 받아 둔 계정 요약으로 센 것(사람마다 presence 를 읽지 않는다). */
  counts: VersionCount[];
  value: VerFilter;
  onChange: (ver: VerFilter) => void;
}

export function VersionSummary({ counts, value, onChange }: Props) {
  if (!counts.length) return null;

  return (
    <div className={styles.wrap}>
      <span className="soft">버전별 사용자 · 최근 {ACTIVE_DAYS}일</span>
      <div className={styles.list}>
        {counts.map(({ ver, count, share }) => {
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
              <span className={styles.ver}>{ver ?? OLD_VER_LABEL}</span>
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

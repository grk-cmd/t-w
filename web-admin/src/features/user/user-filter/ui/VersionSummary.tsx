import { useMemo, useState } from 'react';
import { ACTIVE_DAYS, OLD_VER_LABEL, versionCounts, type UserRow } from '@/entities/user';
import styles from './VersionSummary.module.css';

/** undefined = 버전으로 좁히지 않음 · null = 버전 기록 없음. */
export type VerFilter = string | null | undefined;

interface Props {
  rows: UserRow[];
  value: VerFilter;
  onChange: (ver: VerFilter) => void;
}

// 이미 받은 계정 요약만으로 센다 — 사람마다 presence 를 읽지 않는다.
export function VersionSummary({ rows, value, onChange }: Props) {
  const [now] = useState(Date.now);
  const counts = useMemo(() => versionCounts(rows, now), [rows, now]);
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

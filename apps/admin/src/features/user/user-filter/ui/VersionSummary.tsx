import { OLD_VER_LABEL, type VerFilter, type VersionCount } from '@/entities/user';
import styles from './VersionSummary.module.css';

export type { VerFilter } from '@/entities/user';

interface Props {
  /** 버전별 수 — 서버가 presence 로 센 것. ver null = presence 에 버전이 없는 옛 앱(0.10.2 이하). */
  counts: VersionCount[];
  title?: string;
  /** 없으면 보기만 하는 줄(눌러서 거르지 않음). */
  filter?: { value: VerFilter; onChange: (ver: VerFilter) => void };
}

export function VersionSummary({ counts, title = '버전별 사용자', filter }: Props) {
  if (!counts.length) return null;

  return (
    <div className={styles.wrap}>
      <span className="soft">{title}</span>
      <div className={styles.list}>
        {counts.map(({ ver, count, share }) => {
          const pct = Math.round(share * 100);
          const body = (
            <>
              <span className={styles.ver}>{ver ?? OLD_VER_LABEL}</span>
              <span className={styles.bar} style={{ width: `${Math.max(pct, 1)}%` }} />
              <small>
                {count}명 · {pct}%
              </small>
            </>
          );
          if (!filter) {
            return (
              <div key={ver ?? ''} className={`${styles.item} ${styles.static}`}>
                {body}
              </div>
            );
          }
          const on = filter.value === ver;
          return (
            <button
              key={ver ?? ''}
              type="button"
              className={on ? `${styles.item} ${styles.on}` : styles.item}
              aria-pressed={on}
              // 다시 누르면 푼다.
              onClick={() => filter.onChange(on ? undefined : ver)}
            >
              {body}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { pageNumbers, PAGE_SIZES, type Paging } from '@/shared/lib';
import styles from './Pager.module.css';

interface Props {
  paging: Pick<Paging<unknown>, 'page' | 'pageCount' | 'size' | 'total' | 'setPage' | 'setSize'>;
  /** 받아 둔 것 뒤에 더 있다 — 총 개수를 모르니 «N개+», 끝 쪽에서도 다음으로 갈 수 있다. */
  more?: boolean;
}

/** 총 개수 · 쪽 이동 · 페이지당 개수. 쪽 이동은 2쪽 이상일 때만. */
export function Pager({ paging, more = false }: Props) {
  const { page, pageCount, size, total, setPage, setSize } = paging;
  if (total === 0 && !more) return null;
  const moving = pageCount > 1 || more;

  return (
    <div className={styles.pager}>
      <span className={styles.total}>
        총 {total}개{more && '+'}
      </span>
      {moving && (
        <nav className={styles.pages} aria-label="쪽 이동">
          <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            이전
          </button>
          {pageNumbers(page, pageCount).map((n, i) =>
            n === 'gap' ? (
              <span key={`gap${i}`} className={styles.gap}>
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                className={`btn ${styles.num}`}
                aria-label={`${n}쪽`}
                aria-current={n === page ? 'page' : undefined}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ),
          )}
          {more && <span className={styles.gap}>…</span>}
          <button
            type="button"
            className="btn"
            disabled={page >= pageCount && !more}
            onClick={() => setPage(page + 1)}
          >
            다음
          </button>
        </nav>
      )}
      <select
        className={styles.size}
        aria-label="페이지당 개수"
        value={size}
        onChange={(e) => setSize(Number(e.target.value))}
      >
        {PAGE_SIZES.map((n) => (
          <option key={n} value={n}>
            {n}개씩
          </option>
        ))}
      </select>
    </div>
  );
}

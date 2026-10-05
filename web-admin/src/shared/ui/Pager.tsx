import styles from './Pager.module.css';

interface Props {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}

export function Pager({ page, pageCount, onChange }: Props) {
  if (pageCount <= 1) return null;
  return (
    <div className={styles.pager}>
      <button type="button" className="btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        이전
      </button>
      <span>
        {page} / {pageCount}
      </span>
      <button type="button" className="btn" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
        다음
      </button>
    </div>
  );
}

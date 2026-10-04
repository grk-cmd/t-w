import { USER_FILTERS, type UserFilter } from '../model/filter';
import styles from './UserFilterBar.module.css';

interface Props {
  filter: UserFilter;
  search: string;
  onFilterChange: (filter: UserFilter) => void;
  onSearchChange: (search: string) => void;
}

export function UserFilterBar({ filter, search, onFilterChange, onSearchChange }: Props) {
  return (
    <>
      <div className="field">
        <input
          type="search"
          placeholder="이름 · 친구코드 · 사용자코드 · 라이선스 키로 검색"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className={styles.chips}>
        {USER_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={f.id === filter ? `${styles.chip} ${styles.on}` : styles.chip}
            onClick={() => onFilterChange(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
    </>
  );
}

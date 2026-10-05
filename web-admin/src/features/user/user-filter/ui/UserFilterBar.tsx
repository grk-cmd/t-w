import { useState, type FormEvent } from 'react';
import {
  hasPeriod,
  NO_PERIOD,
  PERIOD_FIELDS,
  USER_FILTERS,
  type Period,
  type PeriodField,
  type UserFilter,
  type UserSearch,
} from '../model/filter';
import styles from './UserFilterBar.module.css';

interface Props {
  filter: UserFilter;
  /** 지금 걸려 있는 검색 — 칸에 적기만 하고 검색을 누르지 않은 값과 다를 수 있다. */
  search: UserSearch;
  onFilterChange: (filter: UserFilter) => void;
  onSearch: (search: UserSearch) => void;
}

// 글자 · 기간은 «검색» 을 눌러야 걸린다 — 기간은 사람마다 한 칸씩 읽어야 해서 칠 때마다 돌리면 안 된다. 칩은 바로.
export function UserFilterBar({ filter, search, onFilterChange, onSearch }: Props) {
  const [text, setText] = useState(search.text);
  const [period, setPeriod] = useState<Period>(search.period);
  const active = Boolean(search.text.trim()) || hasPeriod(search.period);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch({ text: text.trim(), period });
  };
  const clear = () => {
    setText('');
    setPeriod(NO_PERIOD);
    onSearch({ text: '', period: NO_PERIOD });
  };

  return (
    <>
      <form className={styles.search} onSubmit={submit}>
        <input
          type="search"
          className={styles.text}
          placeholder="이름 · 친구코드 · 사용자코드 · 키"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <select
          aria-label="기간 기준"
          value={period.field}
          onChange={(e) => setPeriod({ ...period, field: e.target.value as PeriodField })}
        >
          {PERIOD_FIELDS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label="시작일"
          value={period.from}
          max={period.to || undefined}
          onChange={(e) => setPeriod({ ...period, from: e.target.value })}
        />
        <span className="soft">~</span>
        <input
          type="date"
          aria-label="종료일"
          value={period.to}
          min={period.from || undefined}
          onChange={(e) => setPeriod({ ...period, to: e.target.value })}
        />
        <button type="submit" className="btn primary">
          검색
        </button>
        {active && (
          <button type="button" className="btn" onClick={clear}>
            초기화
          </button>
        )}
      </form>
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

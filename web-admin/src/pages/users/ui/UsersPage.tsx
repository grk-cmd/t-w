import { useMemo, useState } from 'react';
import {
  CreateInviteCodesButton,
  GrantInvitesAllButton,
  GrantInvitesSelectedButton,
} from '@/features/user/grant-invites';
import {
  filterUsers,
  hasPeriod,
  inPeriod,
  NO_SEARCH,
  PERIOD_FIELDS,
  usePeriodTimes,
  UserFilterBar,
  type UserFilter,
  type UserSearch,
} from '@/features/user/user-filter';
import { errorMessage, paginate, useSelection } from '@/shared/lib';
import { Pager, SelectionBar } from '@/shared/ui';
import { UserTable } from '@/widgets/user-table';
import { useUserRows } from '../model/useUserRows';

const PAGE_SIZE = 50;

export function UsersPage() {
  const { rows, error, refresh } = useUserRows();
  const [filter, setFilter] = useState<UserFilter>('all');
  const [search, setSearch] = useState<UserSearch>(NO_SEARCH);
  const [page, setPage] = useState(1);

  const base = useMemo(
    () => (rows ? filterUsers(rows, filter, search.text) : null),
    [rows, filter, search.text],
  );
  // 기간은 사람마다 한 칸씩 읽어야 알 수 있다 — 기간을 걸었을 때만, 칩 · 글자로 좁힌 사람만 읽는다.
  const periodOn = hasPeriod(search.period);
  const { times, progress } = usePeriodTimes(periodOn ? base : null, search.period.field);
  const filtered = useMemo(() => {
    if (!base) return [];
    if (!periodOn) return base;
    return times ? base.filter((r) => inPeriod(times.get(r.userCode), search.period)) : [];
  }, [base, periodOn, times, search.period]);
  const fieldLabel = PERIOD_FIELDS.find((f) => f.id === search.period.field)?.label;
  const view = paginate(filtered, page, PAGE_SIZE);
  const ids = useMemo(() => filtered.map((r) => r.userCode), [filtered]);
  const pageIds = useMemo(() => view.items.map((r) => r.userCode), [view.items]);
  const selection = useSelection(ids, pageIds);

  // 조건이 바뀌면 첫 쪽부터 본다.
  const changeFilter = (next: UserFilter) => {
    setFilter(next);
    setPage(1);
  };
  const changeSearch = (next: UserSearch) => {
    setSearch(next);
    setPage(1);
  };

  return (
    <section className="card">
      <div className="card-head">
        <span className="soft grow">
          {progress
            ? `${fieldLabel} 확인 중 ${progress.done} / ${progress.total}명`
            : rows && `${filtered.length} / ${rows.length}명`}
        </span>
        <CreateInviteCodesButton />
        <GrantInvitesAllButton />
        <button type="button" className="btn" onClick={refresh}>
          새로고침
        </button>
      </div>
      <UserFilterBar filter={filter} search={search} onFilterChange={changeFilter} onSearch={changeSearch} />
      {error && <p className="msg err">{errorMessage(error, '사용자 목록을 불러오지 못했어요')}</p>}
      {!error && !rows && <p className="soft">불러오는 중…</p>}
      {rows && (
        <>
          <SelectionBar count={selection.selected.length} onClear={selection.clear}>
            <GrantInvitesSelectedButton uids={selection.selected} onDone={selection.clear} />
          </SelectionBar>
          <UserTable rows={view.items} startIndex={(view.page - 1) * PAGE_SIZE} selection={selection} />
        </>
      )}
      <Pager page={view.page} pageCount={view.pageCount} onChange={setPage} />
    </section>
  );
}

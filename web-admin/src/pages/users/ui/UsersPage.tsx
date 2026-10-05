import { useMemo, useState } from 'react';
import {
  CreateInviteCodesButton,
  GrantInvitesAllButton,
  GrantInvitesSelectedButton,
} from '@/features/user/grant-invites';
import { filterUsers, UserFilterBar, type UserFilter } from '@/features/user/user-filter';
import { errorMessage, paginate, useSelection } from '@/shared/lib';
import { Pager, SelectionBar } from '@/shared/ui';
import { UserTable } from '@/widgets/user-table';
import { useUserRows } from '../model/useUserRows';

const PAGE_SIZE = 50;

export function UsersPage() {
  const { rows, error, refresh } = useUserRows();
  const [filter, setFilter] = useState<UserFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => (rows ? filterUsers(rows, filter, search) : []), [rows, filter, search]);
  const view = paginate(filtered, page, PAGE_SIZE);
  const ids = useMemo(() => filtered.map((r) => r.userCode), [filtered]);
  const pageIds = useMemo(() => view.items.map((r) => r.userCode), [view.items]);
  const selection = useSelection(ids, pageIds);

  // 조건이 바뀌면 첫 쪽부터 본다.
  const changeFilter = (next: UserFilter) => {
    setFilter(next);
    setPage(1);
  };
  const changeSearch = (next: string) => {
    setSearch(next);
    setPage(1);
  };

  return (
    <section className="card">
      <div className="card-head">
        <span className="soft grow">{rows && `${filtered.length} / ${rows.length}명`}</span>
        <CreateInviteCodesButton />
        <GrantInvitesAllButton />
        <button type="button" className="btn" onClick={refresh}>
          새로고침
        </button>
      </div>
      <UserFilterBar
        filter={filter}
        search={search}
        onFilterChange={changeFilter}
        onSearchChange={changeSearch}
      />
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

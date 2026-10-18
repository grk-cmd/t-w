import { useMemo, useState } from 'react';
import { userSourceNote, type LastSeenOrder, type UserQuery, type UserRow } from '@/entities/user';
import { DeleteAccountButton } from '@/features/user/delete-account';
import {
  CreateInviteCodesButton,
  GrantInvitesAllButton,
  GrantInvitesSelectedButton,
  RevokeInvitesAllButton,
  RevokeInvitesSelectedButton,
} from '@/features/user/grant-invites';
import {
  hasPeriod,
  inPeriod,
  NO_SEARCH,
  PERIOD_FIELDS,
  usePeriodTimes,
  UserFilterBar,
  VersionSummary,
  type UserFilter,
  type UserSearch,
  type VerFilter,
} from '@/features/user/user-filter';
import {
  useAllUsers,
  useRefreshUsers,
  useReloadUsers,
  useUserByCode,
  useUserPage,
  useUserStats,
} from '@/features/user/user-rows';
import { errorMessage, pageForSize, usePaging, useSelection } from '@/shared/lib';
import { Pager, SelectionBar } from '@/shared/ui';
import { UserDetail } from '@/widgets/user-detail';
import { UserTable } from '@/widgets/user-table';

const LIST_KEY = 'users';
const NO_ROWS: UserRow[] = [];

// 보통은 쪽 단위로 받는다(API 는 서버가 거르고 자른다, 폴백은 통째로 받아 화면에서). 선택은 지금 보이는 쪽 안에서만.
// 기간 검색은 사람마다 한 칸씩 읽어야 알 수 있어, 걸었을 때만 조건에 맞는 사람을 전부 받아 화면에서 거르고 자른다.
export function UsersPage() {
  const reload = useReloadUsers();
  const refresh = useRefreshUsers();
  const [filter, setFilter] = useState<UserFilter>('all');
  const [search, setSearch] = useState<UserSearch>(NO_SEARCH);
  const [ver, setVer] = useState<VerFilter>(undefined);
  const [order, setOrder] = useState<LastSeenOrder>('desc');
  const [openUid, setOpenUid] = useState<string | null>(null);
  const query: UserQuery = useMemo(
    () => ({ filter, q: search.text, ver, order }),
    [filter, search.text, ver, order],
  );

  const periodOn = hasPeriod(search.period);
  const stats = useUserStats();
  const all = useAllUsers(query, periodOn);
  const base = periodOn ? (all.data?.rows ?? null) : null;
  const { times, progress } = usePeriodTimes(base, search.period.field);
  const periodRows = useMemo(() => {
    if (!base || !times) return NO_ROWS;
    return base.filter((r) => inPeriod(times.get(r.userCode), search.period));
  }, [base, times, search.period]);
  // 쪽 · 개수는 한 곳에서 든다 — 기간 검색이면 받아 둔 줄을 자르고, 아니면 고른 쪽(want)을 서버에 묻는다.
  const local = usePaging(periodRows, LIST_KEY);
  const list = useUserPage(query, local.want, local.size, !periodOn);
  const view = list.data;

  // 지우기로 줄어 지금 쪽이 끝을 넘으면 끝 쪽으로(API 는 넘은 쪽을 빈 채로 돌려준다). 렌더 중에 맞추는 React 권장 모양
  if (!periodOn && view && !list.isPlaceholderData && local.want > view.pageCount)
    local.setPage(view.pageCount);

  const paging = periodOn
    ? local
    : {
        items: view?.items ?? NO_ROWS,
        page: view?.page ?? local.want,
        pageCount: view?.pageCount ?? 1,
        size: local.size,
        total: view?.total ?? 0,
        start: ((view?.page ?? local.want) - 1) * local.size,
        setPage: local.setPage,
        setSize: (next: number) => {
          local.setSize(next);
          local.setPage(pageForSize(local.want, local.size, next));
        },
      };
  const items = paging.items;
  const pageIds = useMemo(() => items.map((r) => r.userCode), [items]);
  const selection = useSelection(pageIds);

  // 상세 창은 지금 쪽에 없는 사람(같은 키 · 초대한 사람을 눌러 건너감)도 연다 — 그때만 그 한 사람을 찾는다.
  const inPage = items.find((r) => r.userCode === openUid) ?? null;
  const found = useUserByCode(inPage ? null : openUid);
  const openRow = inPage ?? found.data ?? null;

  const firstPage = () => local.setPage(1);
  // 조건이 바뀌면 첫 쪽부터 본다.
  const changeFilter = (next: UserFilter) => {
    setFilter(next);
    firstPage();
  };
  const changeSearch = (next: UserSearch) => {
    setSearch(next);
    firstPage();
  };
  const changeVer = (next: VerFilter) => {
    setVer(next);
    firstPage();
  };
  const toggleOrder = () => {
    setOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
    firstPage();
  };
  // 지운 사람은 목록에서 빠져야 한다 — 상세 창을 닫고 다시 읽는다.
  const afterDelete = () => {
    setOpenUid(null);
    refresh();
  };

  const error = (periodOn ? all.error : list.error) ?? stats.error;
  const loaded = periodOn ? !!base : !!view;
  const allCount = stats.data?.total;
  const source = (periodOn ? all.data?.source : view?.source) ?? stats.data?.source;
  const fieldLabel = PERIOD_FIELDS.find((f) => f.id === search.period.field)?.label;
  const countText = progress
    ? `${fieldLabel} 확인 중 ${progress.done} / ${progress.total}명`
    : loaded && allCount !== undefined
      ? `${paging.total} / ${allCount}명`
      : '';

  return (
    <section className="card">
      <div className="card-head">
        <span className="soft grow">
          <span>{countText}</span>
          {/* 서버 사본이면 기준 시각을, 예전 방식이면 왜 넘어왔는지를 작게 */}
          {source && countText && <small> · {userSourceNote(source, stats.data?.syncedAt ?? null)}</small>}
        </span>
        <CreateInviteCodesButton />
        <GrantInvitesAllButton />
        <RevokeInvitesAllButton />
        <DeleteAccountButton onDeleted={afterDelete} />
        <button type="button" className="btn" onClick={reload}>
          새로고침
        </button>
      </div>
      {stats.data && (
        <VersionSummary counts={stats.data.versions} filter={{ value: ver, onChange: changeVer }} />
      )}
      {/* 최근 7일은 보기만 — 누르는 칩(위)과 기준이 달라 섞이면 헷갈린다 */}
      {stats.data?.recent && <VersionSummary counts={stats.data.recent} title="최근 7일 접속 · 버전별" />}
      <UserFilterBar filter={filter} search={search} onFilterChange={changeFilter} onSearch={changeSearch} />
      {error && <p className="msg err">{errorMessage(error, '사용자 목록을 불러오지 못했어요')}</p>}
      {!error && !loaded && <p className="soft">불러오는 중…</p>}
      {loaded && (
        <>
          <SelectionBar count={selection.selected.length} onClear={selection.clear}>
            <GrantInvitesSelectedButton uids={selection.selected} onDone={selection.clear} />
            <RevokeInvitesSelectedButton uids={selection.selected} onDone={selection.clear} />
          </SelectionBar>
          <UserTable
            rows={items}
            startIndex={paging.start}
            selection={selection}
            onOpen={setOpenUid}
            order={filter === 'dup-license' ? null : order}
            onToggleOrder={toggleOrder}
          />
          <UserDetail
            row={openRow}
            onOpen={setOpenUid}
            onClose={() => setOpenUid(null)}
            onDeleted={afterDelete}
          />
        </>
      )}
      <Pager paging={paging} />
    </section>
  );
}

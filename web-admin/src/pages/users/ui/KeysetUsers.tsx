import { useMemo, useState } from 'react';
import type { LastSeenOrder, UserQuery } from '@/entities/user';
import { DeleteAccountButton } from '@/features/user/delete-account';
import { GrantInvitesSelectedButton, RevokeInvitesSelectedButton } from '@/features/user/grant-invites';
import {
  hasPeriod,
  NO_SEARCH,
  SERVER_USER_FILTERS,
  UserFilterBar,
  VersionSummary,
  type UserFilter,
  type UserSearch,
  type VerFilter,
} from '@/features/user/user-filter';
import {
  useRefreshUsers,
  useReloadUsers,
  useUserByCode,
  useUserPageKeyset,
  useUserStats,
} from '@/features/user/user-rows';
import { errorMessage, useKeysetPaging, useSelection } from '@/shared/lib';
import { Pager, SelectionBar } from '@/shared/ui';
import { UserDetail } from '@/widgets/user-detail';
import { UserTable } from '@/widgets/user-table';

const LIST_KEY = 'users';
/** 서버 검색어 상한(1~100)을 칸에서 알려 주는 힌트 — 판정은 서버가 한다. */
const SEARCH_HINT_MAX = 100;

/**
 * API 판 — 서버가 거르고 · 찾고 · 정렬하고 · 센다. 화면은 받은 쪽을 이어 붙여 쪽으로 자르기만 한다.
 * 기간(가입일 · 마지막 접속)도 서버 쿼리라 «사람마다 읽기» 가 없다. 선택은 지금 보이는 쪽 안에서만.
 */
export function KeysetUsers() {
  const reload = useReloadUsers();
  const refresh = useRefreshUsers();
  const [filter, setFilter] = useState<UserFilter>('all');
  const [search, setSearch] = useState<UserSearch>(NO_SEARCH);
  const [ver, setVer] = useState<VerFilter>(undefined);
  const [order, setOrder] = useState<LastSeenOrder>('desc');
  const [openUid, setOpenUid] = useState<string | null>(null);
  const query: UserQuery = useMemo(
    () => ({
      filter,
      q: search.text,
      ver,
      order,
      period: hasPeriod(search.period) ? search.period : undefined,
    }),
    [filter, search.text, search.period, ver, order],
  );

  const stats = useUserStats();
  const list = useUserPageKeyset(query);
  const paging = useKeysetPaging(list, LIST_KEY);
  const items = paging.items;
  const selection = useSelection(useMemo(() => items.map((r) => r.userCode), [items]));

  // 상세 창은 지금 쪽에 없는 사람(초대한 사람을 눌러 건너감)도 연다 — 그때만 그 한 사람을 찾는다.
  const inPage = items.find((r) => r.userCode === openUid) ?? null;
  const found = useUserByCode(inPage ? null : openUid);
  const openRow = inPage ?? found.data ?? null;

  // 조건이 바뀌면 첫 쪽부터 본다.
  const changeFilter = (next: UserFilter) => {
    setFilter(next);
    paging.setPage(1);
  };
  const changeSearch = (next: UserSearch) => {
    setSearch(next);
    paging.setPage(1);
  };
  const changeVer = (next: VerFilter) => {
    setVer(next);
    paging.setPage(1);
  };
  const toggleOrder = () => {
    setOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
    paging.setPage(1);
  };
  // 지운 사람은 목록에서 빠져야 한다 — 상세 창을 닫고 첫 쪽부터 다시 읽는다.
  const afterDelete = () => {
    setOpenUid(null);
    refresh();
  };

  const error = list.error ?? stats.error;
  const loaded = !!list.data;
  // 조건에 맞는 수 · 전체 수 — 둘 다 서버가 센 값. 못 받았으면 글자를 비운다(0 으로 채우지 않는다).
  const countText = loaded && stats.data ? `${paging.total} / ${stats.data.total}명` : '';

  return (
    <section className="card">
      <div className="card-head">
        <span className="soft grow">
          <span>{countText}</span>
        </span>
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
      <UserFilterBar
        filter={filter}
        search={search}
        chips={SERVER_USER_FILTERS}
        textMax={SEARCH_HINT_MAX}
        onFilterChange={changeFilter}
        onSearch={changeSearch}
      />
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
            order={order}
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
      <Pager paging={paging} more={paging.more} />
    </section>
  );
}

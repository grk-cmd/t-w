import { useMemo, useState } from 'react';
import {
  LICENSE_QUERY_MAX,
  sourceNote,
  useLicensePage,
  useLicenseStats,
  useReloadLicenses,
  type LicenseStatus,
} from '@/entities/license';
import { BulkKeyActions, KeyActions } from '@/features/license/revoke-key';
import {
  copyText,
  errorMessage,
  formatDate,
  pageForSize,
  readPageSize,
  savePageSize,
  useDebouncedValue,
  useSelection,
} from '@/shared/lib';
import { Pager, RowCheckbox, SelectAllCheckbox, SelectionBar, useToast } from '@/shared/ui';

const STATUS_LABEL: Record<LicenseStatus, string> = {
  unused: '⬜ 미사용',
  used: '✅ 사용됨',
  revoked: '🚫 회수됨',
};

const LIST_KEY = 'licenses';
/** 입력이 이만큼 멈추면 묻는다 — 글자마다 서버에 묻지 않게. */
const SEARCH_DEBOUNCE_MS = 300;

// 쪽 단위로 받는다(API 는 서버가 거르고 자른다, 폴백은 통째로 받아 화면에서). 선택은 지금 보이는 쪽 안에서만.
export function LicenseList() {
  const toast = useToast();
  const reload = useReloadLicenses();
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(() => readPageSize(LIST_KEY));
  const list = useLicensePage({ page, size, q });
  const stats = useLicenseStats();
  const view = list.data;

  // 지우기로 줄어 지금 쪽이 끝을 넘으면 끝 쪽으로(API 는 넘은 쪽을 빈 채로 돌려준다). 렌더 중에 맞추는 React 권장 모양
  if (view && !list.isPlaceholderData && page > view.pageCount) setPage(view.pageCount);

  const items = useMemo(() => view?.items ?? [], [view]);
  const ids = useMemo(() => items.map((row) => row.key), [items]);
  const selection = useSelection(ids);
  const statusOf = useMemo(() => new Map(items.map((row) => [row.key, row.status])), [items]);
  const selectedKeys = selection.selected.map((key) => ({ key, status: statusOf.get(key) ?? 'revoked' }));

  const changeSearch = (next: string) => {
    setSearch(next.slice(0, LICENSE_QUERY_MAX));
    setPage(1);
  };

  const paging = {
    page: view?.page ?? page,
    pageCount: view?.pageCount ?? 1,
    size,
    total: view?.total ?? 0,
    setPage: (next: number) => setPage(Math.max(1, next)),
    setSize: (next: number) => {
      savePageSize(LIST_KEY, next);
      setPage(pageForSize(page, size, next));
      setSize(next);
    },
  };

  const copy = async (key: string) => toast((await copyText(key)) ? '복사했어요' : '복사하지 못했어요');
  const searching = q.trim() !== '';
  const allCount = stats.data?.counts.total;

  return (
    <section className="card">
      <div className="card-head">
        <span className="soft grow">
          {view &&
            `${view.total.toLocaleString()}${allCount !== undefined ? ` / ${allCount.toLocaleString()}` : ''}건`}
          {/* 기준 시각은 위 통계 칸에 — 여기는 목록만 따로 예전 방식으로 넘어갔을 때만 알린다 */}
          {view?.source.via === 'rtdb' &&
            stats.data?.source.via === 'api' &&
            ` · ${sourceNote(view.source, null)}`}
        </span>
        <button type="button" className="btn" onClick={reload}>
          새로고침
        </button>
      </div>
      <div className="field">
        <input
          type="search"
          placeholder={view?.source.via === 'api' ? '키 · 메모 · 사용자 코드로 검색' : '키 · 메모로 검색'}
          value={search}
          maxLength={LICENSE_QUERY_MAX}
          onChange={(e) => changeSearch(e.target.value)}
        />
      </div>
      {items.length > 0 && (
        <SelectionBar
          count={selectedKeys.length}
          onClear={selection.clear}
          selectAll={
            <SelectAllCheckbox
              allChecked={selection.allChecked}
              someChecked={selection.someChecked}
              onChange={selection.toggleAll}
            />
          }
        >
          <BulkKeyActions keys={selectedKeys} onDone={selection.clear} />
        </SelectionBar>
      )}
      <div className="list tall">
        {list.error && errorMessage(list.error, '목록을 불러오지 못했어요')}
        {!list.error && !view && '불러오는 중…'}
        {view && view.total === 0 && (searching ? '검색 결과가 없어요' : '아직 발급된 키가 없어요')}
        {items.map((row) => (
          <div key={row.key} className={row.status === 'revoked' ? 'row dim' : 'row'}>
            <RowCheckbox
              label={`${row.key} 선택`}
              checked={selection.isSelected(row.key)}
              onChange={() => selection.toggle(row.key)}
            />
            <span className="grow">
              <code className="key">{row.key}</code>
              <span className="meta">
                {STATUS_LABEL[row.status]} · {formatDate(row.createdAt)}
              </span>
              <span className="note">{row.note || '메모 없음'}</span>
            </span>
            <button type="button" className="btn" onClick={() => copy(row.key)}>
              복사
            </button>
            <KeyActions licenseKey={row.key} status={row.status} />
          </div>
        ))}
      </div>
      <Pager paging={paging} />
    </section>
  );
}
